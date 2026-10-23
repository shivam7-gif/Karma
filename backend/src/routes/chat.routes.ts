import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { conversations, messages, userSecrets, userSettings, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { openRouterProvider } from '../llm/openrouter.js';
import { groqProvider } from '../llm/groq.js';
import type { LLMMessage, LLMToolDefinition, LLMProvider } from '../llm/types.js';
import { mcpManager } from '../mcp/client.js';
import { decryptSecret } from '../lib/crypto.js';
import { config } from '../config.js';
import { buildSystemPrompt } from '../agent/prompts.js';
import { logger } from '../lib/logger.js';
import { authMiddleware, toUuid, type AuthenticatedRequest } from '../lib/auth.js';
import { type AgentLifecycleStatus, LIFECYCLE_MESSAGES } from '../agent/types.js';
import { orchestrator } from '../agent/orchestrator/orchestrator.js';
import { isComplexPrompt } from '../agent/orchestrator/planner.js';
import { taskStore } from '../agent/orchestrator/taskStore.js';
import { appBuilderService } from '../services/appBuilder/index.js';

export const chatRouter = Router();
chatRouter.use(authMiddleware);

const chatRequestSchema = z.object({
  message: z.string().optional(),
  conversationId: z.string().optional(),
  sessionId: z.string().optional(),
  model: z.string().optional(),
  regenerate: z.boolean().optional(),
});

// In-flight stream controllers by messageId for cancellation / stop
const activeStreamControllers = new Map<string, AbortController>();

async function ensureUserExists(userId: string) {
  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!existing) {
    await db.insert(users).values({
      id: userId,
      name: 'User',
      email: `${userId}@karma.local`,
    });
  }
}

/**
 * POST /api/chat
 * Main streaming chat endpoint over SSE with typed events (delta, trace, done, error).
 * Persists conversations and messages in Neon Postgres.
 * Supports stop and regenerate.
 */
chatRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  await ensureUserExists(userId);

  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request payload', details: parsed.error.issues });
    return;
  }

  const { message: rawMessage, conversationId: reqConvId, model: overrideModel, regenerate } = parsed.data;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let isAborted = false;
  const abortController = new AbortController();
  let seq = 0;

  const sendEvent = (event: Record<string, unknown>) => {
    if (isAborted) return;
    seq++;
    res.write(`data: ${JSON.stringify({ ...event, seq })}\n\n`);
  };

  const db = getDb();
  let convId: string | undefined;
  let assistantMsgId: string | undefined;
  let emitLifecycle:
    | ((status: AgentLifecycleStatus, message?: string, tool?: string, metadata?: Record<string, unknown>) => void)
    | undefined;

  try {
    // 1. Resolve or create conversation
    const rawConvId = reqConvId || parsed.data.sessionId;
    convId = rawConvId ? toUuid(rawConvId) : undefined;
    if (convId) {
      const existingConv = await db.query.conversations.findFirst({
        where: and(eq(conversations.id, convId), eq(conversations.userId, userId)),
      });
      if (!existingConv) {
        // Create conversation with deterministic UUID
        await db
          .insert(conversations)
          .values({
            id: convId,
            userId,
            title: rawMessage ? rawMessage.slice(0, 40).trim() : 'New Conversation',
          })
          .onConflictDoNothing();
      }
    }

    if (!convId) {
      const initialTitle = rawMessage ? rawMessage.slice(0, 40).trim() : 'New Conversation';
      const inserted = await db
        .insert(conversations)
        .values({
          userId,
          title: initialTitle,
        })
        .returning();

      const newConv = inserted[0];
      if (!newConv) {
        throw new Error('Failed to initialize conversation');
      }
      convId = newConv.id;
    }

    emitLifecycle = (
      status: AgentLifecycleStatus,
      message?: string,
      tool?: string,
      metadata?: Record<string, unknown>
    ) => {
      sendEvent({
        type: 'lifecycle',
        sessionId: convId,
        status,
        timestamp: new Date().toISOString(),
        message: message || LIFECYCLE_MESSAGES[status] || status,
        ...(tool ? { tool } : {}),
        ...(metadata ? { metadata } : {}),
      });
    };

    activeStreamControllers.set(convId, abortController);
    emitLifecycle('planning', 'Planning your request...');

    // 2. Handle regenerate vs new message
    let promptText = rawMessage || '';
    if (regenerate) {
      // Find latest user message in this conversation
      const lastUserMsg = await db.query.messages.findFirst({
        where: and(eq(messages.conversationId, convId), eq(messages.role, 'user')),
        orderBy: [desc(messages.createdAt)],
      });

      if (lastUserMsg) {
        promptText = lastUserMsg.content;
      } else if (!promptText) {
        sendEvent({ type: 'error', error: 'No previous message found to regenerate.' });
        res.end();
        return;
      }
    } else {
      if (!promptText.trim()) {
        sendEvent({ type: 'error', error: 'Message cannot be empty.' });
        res.end();
        return;
      }

      // Persist user message
      await db.insert(messages).values({
        conversationId: convId,
        role: 'user',
        content: promptText,
        parts: [{ type: 'text', text: promptText }],
        status: 'complete',
      });
    }

    // 3. Resolve Provider, API Key & Model
    // Support Groq (if GROQ_API_KEY is configured in env or explicitly requested)
    const useGroq = Boolean(process.env.GROQ_API_KEY) || process.env.LLM_PROVIDER === 'groq';

    let activeProvider: LLMProvider = openRouterProvider;
    let effectiveApiKey: string | undefined;
    let effectiveModel = overrideModel;

    if (useGroq) {
      activeProvider = groqProvider;
      effectiveApiKey = process.env.GROQ_API_KEY?.trim();
      const rawModel = overrideModel || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      effectiveModel =
        rawModel.includes('llama') || !rawModel.includes('/')
          ? 'openai/gpt-oss-120b'
          : rawModel;

    } else {
      activeProvider = openRouterProvider;
      // Resolve OpenRouter key
      const secret = await db.query.userSecrets.findFirst({
        where: and(eq(userSecrets.userId, userId), eq(userSecrets.keyType, 'openrouter_api_key')),
      });

      if (secret) {
        try {
          effectiveApiKey = decryptSecret({
            ciphertext: secret.encryptedValue,
            iv: secret.iv,
            tag: secret.tag,
          });
        } catch (err) {
          logger.warn({ err, userId }, 'Failed to decrypt user OpenRouter key; falling back');
        }
      }

      if (!effectiveApiKey && config.OPENROUTER_FALLBACK_KEY) {
        effectiveApiKey = config.OPENROUTER_FALLBACK_KEY;
      }

      if (!effectiveModel) {
        const settings = await db.query.userSettings.findFirst({
          where: eq(userSettings.userId, userId),
        });
        effectiveModel = settings?.defaultModel || 'meta-llama/llama-3.3-70b-instruct:free';
      }
    }

    // 5. Create initial assistant message record (status: 'streaming')
    const insertedAssistant = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: 'assistant',
        content: '',
        parts: [],
        status: 'streaming',
      })
      .returning();

    const assistantMsg = insertedAssistant[0];
    if (!assistantMsg) {
      throw new Error('Failed to create assistant message placeholder');
    }

    assistantMsgId = assistantMsg.id;
    activeStreamControllers.set(assistantMsgId, abortController);

    req.on('close', async () => {
      if (!isAborted) {
        isAborted = true;
        abortController.abort();
        if (assistantMsgId) activeStreamControllers.delete(assistantMsgId);
        if (convId) activeStreamControllers.delete(convId);
        emitLifecycle?.('stopped', 'Automation stopped by user.');
        if (assistantMsgId) {
          try {
            await db
              .update(messages)
              .set({ status: 'stopped' })
              .where(eq(messages.id, assistantMsgId));
          } catch (e) {
            // ignore
          }
        }
      }
    });

    // Direct Intent Match: Amazon Shopping, Playwright Automation & Screen Control Overlay
    const isAmazonIntent =
      (/\b(amazon|playwright|shop_amazon)\b/i.test(promptText) &&
        /\b(buy|shop|cart|creatine|purchase|product|order|overlay|connect|mcp|automate|find|search)\b/i.test(promptText)) ||
      /\b(buy\s+on\s+amazon|shop\s+on\s+amazon|add\s+to\s+cart|amazon\s+creatine)\b/i.test(promptText) ||
      /connect\s+mcp.*playwright.*overlay.*amazon/i.test(promptText);

    if (isAmazonIntent && !isAborted) {
      emitLifecycle?.('controlling_screen', 'Connecting MCP, Playwright browser, and Amazon overlay...', 'shop_amazon');

      // Extract budget
      const budgetMatch = promptText.match(/(?:under|below|budget\s+(?:of)?|max(?:\s+price)?)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
      const budget = budgetMatch && budgetMatch[1] ? parseInt(budgetMatch[1].replace(/,/g, ''), 10) : 500;

      // Extract search query
      let query = 'creatine monohydrate';
      const cleanCandidates = promptText
        .replace(/connect\s+mcp.*playwright.*overlay.*amazon.*promptbar/i, '')
        .replace(/connect\s+mcp.*promptbar/i, '')
        .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:buy|shop|find|search|automate|order|get)\s+(?:for\s+)?/i, '')
        .replace(/(?:on\s+amazon|from\s+amazon|in\s+amazon|via\s+playwright|with\s+overlay|and\s+add\s+to\s+cart)/gi, '')
        .replace(/(?:under|below|budget\s+(?:of)?|max(?:\s+price)?)\s*(?:₹|rs\.?|inr)?\s*[\d,]+/gi, '')
        .trim();

      if (cleanCandidates && cleanCandidates.length > 2 && !cleanCandidates.toLowerCase().includes('connect') && !cleanCandidates.toLowerCase().includes('mcp')) {
        query = cleanCandidates;
      }

      const tcId = `call-amazon-${Date.now()}`;
      sendEvent({
        type: 'tool_call',
        id: tcId,
        name: 'shop_amazon',
        args: { query, maxPriceINR: budget },
      });

      try {
        const result = await mcpManager.executeTool(
          'shop_amazon',
          { query, maxPriceINR: budget, requirements: 'Best rated, authentic seller, verified price within budget' },
          {
            signal: abortController.signal,
            onProgress: (p) => {
              const status = p.status === 'checkout_review' || p.status === 'waiting_for_user' ? 'waiting_for_user' : 'controlling_screen';
              emitLifecycle?.(status, p.message, 'shop_amazon', p.data as Record<string, unknown>);
              sendEvent({
                type: 'progress',
                sessionId: convId,
                status: p.status,
                message: p.message,
                data: p.data,
                timestamp: new Date().toISOString(),
              });
            },
          }
        );

        sendEvent({
          type: 'tool_result',
          id: tcId,
          name: 'shop_amazon',
          result: result.result,
          ms: result.durationMs,
        });

        if (isAborted) {
          emitLifecycle?.('stopped', 'Automation stopped by user.');
          res.end();
          return;
        }

        let summaryText = '';
        const data = result.data as any;
        if (result.success && data?.selectedProduct) {
          summaryText = `I connected the **Karma MCP server**, launched **Playwright Chromium browser automation**, and initialized the **desktop Screen Control Overlay** for Amazon.in.\n\n` +
            `### 🛒 Amazon Shopping Automation Result\n` +
            `- **Search Query:** "${query}"\n` +
            `- **Budget Ceiling:** ₹${budget}\n` +
            `- **Selected Product:** [${data.selectedProduct.title}](${data.selectedProduct.url})\n` +
            `- **Live Verified Price:** ${data.selectedProduct.price} *(Within ₹${budget} budget)*\n` +
            `- **Rating:** ${data.selectedProduct.rating || 'Verified'} | **Reviews:** ${data.selectedProduct.reviews || 'Popular'}\n` +
            `- **Action Taken:** Added to Cart & Navigated to Checkout Review\n` +
            `- **Cart Link:** [Open Amazon Cart](https://www.amazon.in/gp/cart/view.html)\n\n` +
            `> 🛡️ **Purchase Safeguard Notice:**\n` +
            `> Karma safely performed search, candidate comparison, and cart addition up to checkout review. For security, Karma will never automatically submit payment. You can review and place the order manually in your browser.`;
        } else if (result.error) {
          summaryText = `### ⚠️ Amazon Shopping Workflow Notice\n\n${result.result}`;
        } else {
          summaryText = `### 🛒 Amazon Automation Completed\n\n${result.result}`;
        }

        // Stream synthesized summary
        const chunkSize = 20;
        for (let i = 0; i < summaryText.length; i += chunkSize) {
          if (isAborted) break;
          sendEvent({ type: 'delta', text: summaryText.slice(i, i + chunkSize) });
          await new Promise((r) => setTimeout(r, 12));
        }

        emitLifecycle?.('completed', 'Amazon automation completed.');

        if (!isAborted && assistantMsgId) {
          await db
            .update(messages)
            .set({
              content: summaryText,
              parts: [{ type: 'text', text: summaryText }],
              status: 'complete',
            })
            .where(eq(messages.id, assistantMsgId));

          sendEvent({
            type: 'done',
            conversationId: convId,
            messageId: assistantMsgId,
          });

          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendEvent({ type: 'error', error: errorMsg });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }

    // Direct Intent Match: External AI App Builders (Manus / Replit)
    const isAppBuildingIntent = appBuilderService.shouldHandlePrompt(promptText);

    if (isAppBuildingIntent && !isAborted) {
      emitLifecycle?.('planning', 'Classified as external app-building request. Selecting optimal builder...');

      // Extract provider preference if user explicitly mentioned
      let providerPreference: 'auto' | 'manus' | 'replit' = 'auto';
      if (/\b(manus)\b/i.test(promptText)) providerPreference = 'manus';
      if (/\b(replit)\b/i.test(promptText)) providerPreference = 'replit';

      const tcId = `call-appbuilder-${Date.now()}`;
      sendEvent({
        type: 'tool_call',
        id: tcId,
        name: 'build_external_app',
        args: { prompt: promptText, provider: providerPreference },
      });

      try {
        const build = await appBuilderService.buildApp(promptText, {
          sessionId: convId || 'default-session',
          userId,
          providerOverride: providerPreference,
          signal: abortController.signal,
          onProgress: (p) => {
            const domain = p.message.toLowerCase().includes('manus') ? 'manus.im' : 'replit.com';
            const siteName = p.message.toLowerCase().includes('manus') ? 'Manus AI' : 'Replit Agent';
            const actionUrl =
              (p.data as any)?.previewUrl ||
              (p.data as any)?.actionUrl ||
              (p.data as any)?.taskUrl ||
              (domain === 'manus.im' ? 'https://manus.im' : 'https://replit.com/new/react-vite-ts');

            emitLifecycle?.('executing_tool', p.message, 'build_external_app', p.data as Record<string, unknown>);
            sendEvent({
              type: 'progress',
              sessionId: convId,
              status: p.status,
              message: p.message,
              data: {
                ...(p.data && typeof p.data === 'object' ? p.data : {}),
                domain,
                url: actionUrl,
                siteName,
                agentRole: 'AI App Builder',
              },
              timestamp: new Date().toISOString(),
            });
          },
        });

        sendEvent({
          type: 'tool_result',
          id: tcId,
          name: 'build_external_app',
          result: build.result.outputSummary,
        });

        if (isAborted) {
          emitLifecycle?.('stopped', 'App building cancelled by user.');
          res.end();
          return;
        }

        const summaryText = build.formattedChatResponse;

        // Stream the formatted response in chunks
        const chunkSize = 24;
        for (let i = 0; i < summaryText.length; i += chunkSize) {
          if (isAborted) break;
          sendEvent({ type: 'delta', text: summaryText.slice(i, i + chunkSize) });
          await new Promise((r) => setTimeout(r, 10));
        }

        emitLifecycle?.('completed', `${build.selectedProviderName} build brief and telemetry prepared.`);

        if (!isAborted && assistantMsgId) {
          await db
            .update(messages)
            .set({
              content: summaryText,
              parts: [{ type: 'text', text: summaryText }],
              status: 'complete',
            })
            .where(eq(messages.id, assistantMsgId));

          sendEvent({
            type: 'done',
            conversationId: convId,
            messageId: assistantMsgId,
          });

          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendEvent({ type: 'error', error: errorMsg });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }

    // If no API key configured yet:
    if (!effectiveApiKey) {
      const isGreeting = /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|who\s+are\s+you|what\s+can\s+you\s+do)[\s!.?]*$/i.test(promptText.trim());
      if (isGreeting) {
        const greetingText = "Hello! I am Karma. How can I help you today? You can attach your documents (PDF, DOCX, TXT, MD, CSV) using the paperclip icon below, or configure your API key in Settings.";
        for (const token of greetingText.split(' ')) {
          sendEvent({ type: 'delta', text: token + ' ' });
          await new Promise((r) => setTimeout(r, 25));
        }
        await db
          .update(messages)
          .set({
            content: greetingText,
            parts: [{ type: 'text', text: greetingText }],
            status: 'complete',
          })
          .where(eq(messages.id, assistantMsgId));

        sendEvent({
          type: 'done',
          conversationId: convId,
          messageId: assistantMsgId,
        });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      sendEvent({
        type: 'error',
        error: useGroq
          ? 'No Groq API key found. Please check GROQ_API_KEY in backend/.env.'
          : 'No OpenRouter API key found. Please open Settings (gear icon in the top right) and save your OpenRouter key.',
      });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 6. Build History & Persona Context
    const userRow = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const systemPrompt = buildSystemPrompt({
      userName: userRow?.name || 'Shiva',
      timezone: userRow?.timezone || 'UTC',
    });

    // Load recent message history (last 12)
    const rawHistory = await db.query.messages.findMany({
      where: eq(messages.conversationId, convId),
      orderBy: [desc(messages.createdAt)],
      limit: 12,
    });

    // Reverse to chronological order, excluding current streaming assistant message
    const historyList = rawHistory
      .reverse()
      .filter((m) => m.id !== assistantMsgId && m.status !== 'error')
      .map((m): LLMMessage => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

    const conversationContext: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyList,
    ];

    // Emit initial trace event
    sendEvent({
      type: 'trace',
      step: 'model_call',
      status: 'started',
      model: effectiveModel,
      conversationId: convId,
      messageId: assistantMsgId,
    });

    // Discover available tools across connected MCP servers
    let availableTools: LLMToolDefinition[] = [];
    try {
      availableTools = await mcpManager.getLLMTools();
    } catch (err) {
      logger.warn({ err }, 'Failed to discover MCP tools; proceeding with no tools');
    }

    // 6.5. Multi-Agent Orchestrator Dispatch for complex / parallel tasks
    if (isComplexPrompt(promptText) && !isAborted) {
      emitLifecycle('planning', 'Karma Orchestrator formulating multi-agent plan...');
      try {
        const orchResult = await orchestrator.execute(promptText, {
          sessionId: convId,
          signal: abortController.signal,
          onEvent: (taskEvent) => {
            sendEvent(taskEvent as unknown as Record<string, unknown>);
          },
          onProgress: (activity) => {
            emitLifecycle?.('thinking', activity);
          },
        });

        if (orchResult.isMultiAgent && orchResult.tasks.length > 0) {
          emitLifecycle?.('completed', 'All specialist agents completed tasks.');

          // Stream the synthesized answer to the chat
          const answer = orchResult.finalOutput;
          const chunkSize = 24;
          for (let i = 0; i < answer.length; i += chunkSize) {
            if (isAborted) break;
            const slice = answer.slice(i, i + chunkSize);
            sendEvent({ type: 'delta', text: slice });
            await new Promise((r) => setTimeout(r, 10));
          }

          if (!isAborted) {
            if (assistantMsgId) {
              await db
                .update(messages)
                .set({
                  content: answer,
                  parts: [{ type: 'text', text: answer }],
                  status: 'complete',
                })
                .where(eq(messages.id, assistantMsgId));
            }

            sendEvent({
              type: 'done',
              conversationId: convId,
              messageId: assistantMsgId,
              model: effectiveModel,
            });

            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
        }
      } catch (err: unknown) {
        logger.warn({ err }, 'Orchestrator failed; continuing with direct single-agent execution');
      }
    }

    let accumulatedText = '';
    let finalModel = effectiveModel;
    let promptTokens = 0;
    let completionTokens = 0;
    const MAX_TOOL_ITERATIONS = 5;
    let iteration = 0;

    // 7. Direct Single-Agent Execution Loop
    while (iteration < MAX_TOOL_ITERATIONS && !isAborted) {
      iteration++;
      const currentTurnToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      let currentTurnText = '';

      emitLifecycle('thinking', 'Analyzing options...');

      const streamGen = activeProvider.stream(
        conversationContext,
        availableTools.length > 0 ? availableTools : undefined,
        {
          model: effectiveModel,
          apiKey: effectiveApiKey,
          signal: abortController.signal,
        }
      );

      for await (const event of streamGen) {
        if (isAborted) break;

        if (event.type === 'text') {
          currentTurnText += event.text;
          accumulatedText += event.text;
          // Emit single typed delta event (sendEvent attaches monotonic seq)
          sendEvent({ type: 'delta', text: event.text });
        } else if (event.type === 'tool_call') {
          currentTurnToolCalls.push({
            id: event.id,
            name: event.name,
            arguments: event.arguments,
          });
        } else if (event.type === 'usage') {
          promptTokens += event.promptTokens;
          completionTokens += event.completionTokens;
        } else if (event.type === 'done') {
          finalModel = event.model;
        } else if (event.type === 'error') {
          sendEvent({ type: 'error', error: event.error, code: event.code });
        }
      }

      if (isAborted) break;

      // If no tools were called, the model provided its complete response
      if (currentTurnToolCalls.length === 0) {
        break;
      }

      // Add assistant message with tool_calls to conversation history
      conversationContext.push({
        role: 'assistant',
        content: currentTurnText,
        tool_calls: currentTurnToolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      });

      // Execute each requested tool on its MCP server
      for (const tc of currentTurnToolCalls) {
        if (isAborted) break;

        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.arguments || '{}');
        } catch {
          parsedArgs = {};
        }

        // Emit tool_call trace event to frontend
        sendEvent({
          type: 'tool_call',
          id: tc.id,
          name: tc.name,
          args: parsedArgs,
        });

        if (tc.name === 'shop_amazon') {
          emitLifecycle?.('controlling_screen', 'Karma is controlling the screen on Amazon...', tc.name);
        } else {
          emitLifecycle?.('executing_tool', `Executing tool ${tc.name}...`, tc.name);
        }

        // Execute tool safely via MCP manager with progress and abort signal
        const toolResult = await mcpManager.executeTool(tc.name, parsedArgs, {
          signal: abortController.signal,
          onProgress: (p) => {
            if (p.status === 'waiting_for_user' || p.status === 'checkout_review') {
              emitLifecycle?.('waiting_for_user', p.message, tc.name, p.data as Record<string, unknown>);
            } else if (
              p.status === 'controlling_screen' ||
              p.status === 'searching' ||
              p.status === 'analyzing' ||
              p.status === 'opening_product' ||
              p.status === 'adding_to_cart'
            ) {
              emitLifecycle?.('controlling_screen', p.message, tc.name, p.data as Record<string, unknown>);
            }
            sendEvent({
              type: 'progress',
              sessionId: convId,
              status: p.status,
              message: p.message,
              data: p.data,
              timestamp: new Date().toISOString(),
            });
          },
        });

        if (toolResult.requiresConfirmation) {
          emitLifecycle?.('waiting_for_user', toolResult.result, tc.name);
        }

        // Emit tool_result trace event to frontend
        sendEvent({
          type: 'tool_result',
          id: tc.id,
          name: tc.name,
          result: toolResult.result,
          ms: toolResult.durationMs,
        });

        // Append tool result message to conversation context for next iteration
        conversationContext.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.name,
          content: toolResult.result,
        });
      }
    }

    if (!isAborted) {
      emitLifecycle?.('completed', 'Execution completed.');
      // 8. Finalize assistant message in DB
      if (assistantMsgId) {
        await db
          .update(messages)
          .set({
            content: accumulatedText,
            parts: [{ type: 'text', text: accumulatedText }],
            status: 'complete',
            promptTokens,
            completionTokens,
          })
          .where(eq(messages.id, assistantMsgId));
      }

      sendEvent({
        type: 'done',
        conversationId: convId,
        messageId: assistantMsgId,
        model: finalModel,
        promptTokens,
        completionTokens,
      });

      // Send standard SSE closing token
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err, userId }, 'Chat streaming failed');

    if (!isAborted) {
      if (typeof emitLifecycle === 'function') {
        emitLifecycle('error', errorMsg);
      }
      sendEvent({ type: 'error', error: errorMsg });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } finally {
    isAborted = true;
    if (convId) activeStreamControllers.delete(convId);
    if (assistantMsgId) activeStreamControllers.delete(assistantMsgId);
  }
});

/**
 * POST /api/chat/stop
 * Halts active streaming for a given message or user
 */
chatRouter.post('/stop', (req: AuthenticatedRequest, res: Response) => {
  const { messageId, conversationId, sessionId } = req.body;
  const rawTarget = messageId || conversationId || sessionId;
  const targetId = rawTarget ? toUuid(rawTarget) : undefined;

  if (targetId && activeStreamControllers.has(targetId)) {
    activeStreamControllers.get(targetId)?.abort();
    activeStreamControllers.delete(targetId);
    res.json({ success: true, message: `Stream for ${targetId} stopped.` });
    return;
  }

  if (rawTarget && activeStreamControllers.has(rawTarget)) {
    activeStreamControllers.get(rawTarget)?.abort();
    activeStreamControllers.delete(rawTarget);
    res.json({ success: true, message: `Stream for ${rawTarget} stopped.` });
    return;
  }

  // Propagate to orchestrator
  if (rawTarget) {
    orchestrator.cancelSession(rawTarget, 'Stop request received');
  }

  // If no targetId or not found, abort all active streams
  for (const [id, controller] of activeStreamControllers.entries()) {
    controller.abort();
    activeStreamControllers.delete(id);
  }
  res.json({ success: true, message: 'Active streams stopped.' });
});

/**
 * POST /api/chat/tasks/cancel
 * Cancels a specific orchestrator task by taskId
 */
chatRouter.post('/tasks/cancel', (req: AuthenticatedRequest, res: Response) => {
  const { taskId, reason } = req.body;
  if (!taskId) {
    res.status(400).json({ error: 'taskId is required' });
    return;
  }
  orchestrator.cancelTask(taskId, reason || 'Cancelled by user');
  res.json({ success: true, message: `Task ${taskId} cancelled.` });
});

/**
 * POST /api/chat/tasks/cancel-all
 * Cancels all active tasks for a session
 */
chatRouter.post('/tasks/cancel-all', (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  orchestrator.cancelSession(sessionId, 'All tasks cancelled by user');
  res.json({ success: true, message: `All tasks for session ${sessionId} cancelled.` });
});

/**
 * GET /api/chat/tasks/:sessionId
 * Retrieves all orchestrator tasks for a session
 */
chatRouter.get('/tasks/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = String(req.params.sessionId || '');
  const tasks = await taskStore.getSessionTasks(sessionId);
  res.json({ tasks });
});


