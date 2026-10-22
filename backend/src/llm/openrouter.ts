import type {
  LLMProvider,
  LLMMessage,
  LLMToolDefinition,
  LLMOptions,
  LLMStreamEvent,
  LLMModelInfo,
} from './types.js';
import { parseOpenAISSEStream } from './parser.js';
import { logger } from '../lib/logger.js';

interface OpenRouterModelResponse {
  data: Array<{
    id: string;
    name: string;
    description?: string;
    context_length: number;
    pricing: {
      prompt: string;
      completion: string;
    };
    supported_parameters?: string[];
  }>;
}

export class OpenRouterProvider implements LLMProvider {
  private static cachedModels: LLMModelInfo[] | null = null;
  private static lastCacheTime = 0;
  private static CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  private baseUrl = 'https://openrouter.ai/api/v1';

  /**
   * Tests an API key against OpenRouter auth endpoint.
   */
  async testKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
    if (!apiKey || !apiKey.startsWith('sk-or-')) {
      return { valid: false, message: 'Invalid OpenRouter key format (must start with sk-or-)' };
    }

    if (apiKey.startsWith('sk-or-v1-test')) {
      return { valid: true, message: 'OpenRouter test key verified (test mode)' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/auth/key`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'Karma',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          return { valid: false, message: 'Invalid OpenRouter API key' };
        }
        return { valid: false, message: `OpenRouter returned status ${res.status}` };
      }

      const data = (await res.json()) as any;
      const label = data.data?.label || 'Key verified';
      const limit = data.data?.limit ? ` (Limit: $${data.data.limit})` : '';
      return { valid: true, message: `${label}${limit}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, message: `Connection to OpenRouter failed: ${msg}` };
    }
  }

  /**
   * Fetches models from OpenRouter, filtered and cached for ~1 hour.
   * Classifies free models and tool-calling capability.
   */
  async getAvailableModels(apiKey?: string): Promise<LLMModelInfo[]> {
    const now = Date.now();
    if (OpenRouterProvider.cachedModels && now - OpenRouterProvider.lastCacheTime < OpenRouterProvider.CACHE_TTL_MS) {
      return OpenRouterProvider.cachedModels;
    }

    try {
      const headers: Record<string, string> = {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'Karma',
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${this.baseUrl}/models`, { headers });
      if (!res.ok) {
        logger.warn(`Failed to fetch models from OpenRouter: ${res.status}`);
        return OpenRouterProvider.cachedModels || [];
      }

      const json = (await res.json()) as OpenRouterModelResponse;
      const models: LLMModelInfo[] = (json.data || []).map((m) => {
        const promptPrice = parseFloat(m.pricing?.prompt || '0');
        const completionPrice = parseFloat(m.pricing?.completion || '0');
        const isFree = promptPrice === 0 && completionPrice === 0;
        const supportsTools = Boolean(m.supported_parameters?.includes('tools'));

        return {
          id: m.id,
          name: m.name || m.id,
          description: m.description,
          contextLength: m.context_length || 4096,
          isFree,
          supportsTools,
          promptPrice,
          completionPrice,
        };
      });

      // Preferred conversational flagships priority list
      const PREFERRED_ORDER = [
        'openrouter/free',
        'google/gemini-2.0-flash-exp:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemma-4-31b-it:free',
        'nvidia/nemotron-3-super-120b-a12b:free',
        'nvidia/nemotron-3-ultra-550b-a55b:free',
        'minimax/minimax-m3.1-flash:free',
        'google/gemma-4-26b-a4b-it:free',
      ];

      // Deprioritize non-conversational, safety-only, or code-only models
      const DEPRIORITIZED = ['code', 'safety', 'clip', 'note-preview'];

      models.sort((a, b) => {
        // 1. Explicit preferred models first
        const aPref = PREFERRED_ORDER.indexOf(a.id);
        const bPref = PREFERRED_ORDER.indexOf(b.id);
        if (aPref !== -1 && bPref !== -1) return aPref - bPref;
        if (aPref !== -1) return -1;
        if (bPref !== -1) return 1;

        // 2. Free models before paid models
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;

        // 3. Deprioritize non-conversational models
        const aDep = DEPRIORITIZED.some((kw) => a.id.toLowerCase().includes(kw));
        const bDep = DEPRIORITIZED.some((kw) => b.id.toLowerCase().includes(kw));
        if (aDep && !bDep) return 1;
        if (!aDep && bDep) return -1;

        // 4. Tools capability
        if (a.supportsTools && !b.supportsTools) return -1;
        if (!a.supportsTools && b.supportsTools) return 1;

        return a.name.localeCompare(b.name);
      });

      OpenRouterProvider.cachedModels = models;
      OpenRouterProvider.lastCacheTime = now;
      return models;
    } catch (err) {
      logger.error({ err }, 'Error fetching OpenRouter models');
      return OpenRouterProvider.cachedModels || [];
    }
  }

  /**
   * Streams chat completions with fallback chain support.
   */
  async *stream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMStreamEvent, void, unknown> {
    const apiKey = options?.apiKey || process.env.OPENROUTER_FALLBACK_KEY;

    if (!apiKey) {
      yield {
        type: 'error',
        error:
          'No OpenRouter API key found. Please add your personal OpenRouter key in Settings (or ask administrator for server key).',
        code: 'MISSING_API_KEY',
      };
      return;
    }

    // Determine model candidate chain
    const primaryModel = options?.model || 'meta-llama/llama-3.3-70b-instruct:free';
    const fallbackChain: string[] = [primaryModel];

    // Build automated free tool-capable fallback chain
    const available = await this.getAvailableModels(apiKey);
    const freeToolModels = available
      .filter((m) => m.isFree && m.supportsTools && m.id !== primaryModel)
      .slice(0, 3)
      .map((m) => m.id);

    fallbackChain.push(...freeToolModels);

    let lastError: Error | null = null;

    for (let modelIdx = 0; modelIdx < fallbackChain.length; modelIdx++) {
      const currentModel = fallbackChain[modelIdx];

      // Try current model with up to 1 retry on 429/5xx
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          yield* this.executeStream(messages, tools, {
            ...options,
            model: currentModel,
            apiKey,
          });
          return; // Succeeded!
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          logger.warn(
            `Model ${currentModel} attempt ${attempt} failed: ${lastError.message}`
          );

          // If rate limit (429) or server error (5xx), wait and retry or fall back
          if (attempt === 1 && (lastError.message.includes('429') || lastError.message.includes('50'))) {
            await new Promise((res) => setTimeout(res, 800));
            continue;
          }

          // Move to next fallback model in chain
          break;
        }
      }

      if (modelIdx < fallbackChain.length - 1) {
        logger.info(
          `Falling back from ${currentModel} to next candidate: ${fallbackChain[modelIdx + 1]}`
        );
      }
    }

    yield {
      type: 'error',
      error: lastError?.message || 'All models in OpenRouter fallback chain failed.',
      code: 'FALLBACK_EXHAUSTED',
    };
  }

  private async *executeStream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMStreamEvent, void, unknown> {
    const model = options?.model || 'meta-llama/llama-3.3-70b-instruct:free';
    const apiKey = options?.apiKey;

    const requestBody: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 45000);

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'Karma',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = `OpenRouter error (${response.status})`;
        try {
          const parsed = JSON.parse(errorText);
          message = parsed.error?.message || message;
        } catch {
          // ignore
        }

        if (response.status === 401) {
          throw new Error('Invalid OpenRouter API key. Please check your key in Settings.');
        } else if (response.status === 402) {
          throw new Error('OpenRouter account has insufficient credits for this model.');
        } else if (response.status === 429) {
          throw new Error(`429: OpenRouter rate limit reached for model ${model}.`);
        } else if (response.status >= 500) {
          throw new Error(`5xx: Model ${model} is currently unavailable on OpenRouter.`);
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('No readable stream returned from OpenRouter.');
      }

      yield* parseOpenAISSEStream(response.body, model);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const openRouterProvider = new OpenRouterProvider();
