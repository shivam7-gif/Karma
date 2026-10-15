import type { StreamEvent } from './types';

export async function simulateMockStream(
  text: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const sleep = (ms: number) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

  try {
    const lower = text.toLowerCase();

    // Step 1: Initial tool call simulation
    let toolName = 'home_assistant_core';
    let toolArgs: Record<string, unknown> = { query: text };
    let toolResult: Record<string, unknown> | string = { status: 'ok', matched_intent: 'general_query' };
    let replyText = `I looked into "${text}" for you. Here is what you need to know.`;
    let elicitation: { id: string; question: string; options: string[] } | null = null;

    if (lower.includes('list') || lower.includes('shop') || lower.includes('grocery')) {
      toolName = 'manage_lists';
      toolArgs = { action: 'query', filter: 'active' };
      toolResult = { total_lists: 8, shopping_count: 7, priority: 'Whole Foods' };
      replyText = `You have 7 items on your Shopping list and 8 custom lists ready. Whole Foods and London Packing have upcoming deadlines.`;
    } else if (lower.includes('plan') || lower.includes('trip') || lower.includes('vacation')) {
      toolName = 'travel_planner';
      toolArgs = { destination_query: text, mode: 'itinerary' };
      toolResult = { candidates: ['Maui', 'London', 'Yosemite'], season: 'Autumn 2026' };
      replyText = `I can help you build an itinerary for your upcoming travel.`;
      elicitation = {
        id: 'el-1',
        question: 'Which trip would you like to plan right now?',
        options: ['Maui Packing (42)', 'London Trip (11)', 'Weekend Camping']
      };
    } else if (lower.includes('learn')) {
      toolName = 'knowledge_retrieval';
      toolArgs = { subject: 'ambient_voice_ai', depth: 'concise' };
      toolResult = { topic: 'Voice UI latency', cache_hit: true };
      replyText = `Modern ambient assistants combine low-latency streaming responses with multimodal screen cards for rich context.`;
    } else if (lower.includes('create')) {
      toolName = 'creative_studio';
      toolArgs = { prompt: text, style: 'assistant' };
      toolResult = { status: 'generated', format: 'markdown' };
      replyText = `Here's a quick creative concept tailored to your day: an ambient evening wind-down routine with soft lighting and ambient acoustics.`;
    }

    // Emit tool call
    const callId = `call_${Date.now().toString(36)}`;
    await sleep(250);
    onEvent({
      type: 'tool_call',
      id: callId,
      name: toolName,
      args: toolArgs,
    });

    // Tool execution delay
    const execMs = Math.floor(180 + Math.random() * 240);
    await sleep(execMs);
    onEvent({
      type: 'tool_result',
      id: callId,
      result: toolResult,
      ms: execMs,
    });

    // Stream response tokens
    const words = replyText.split(' ');
    for (let i = 0; i < words.length; i++) {
      await sleep(35 + Math.random() * 30);
      onEvent({
        type: 'token',
        text: (i === 0 ? '' : ' ') + words[i],
      });
    }

    // If elicitation present, emit it
    if (elicitation) {
      await sleep(200);
      onEvent({
        type: 'elicitation',
        id: elicitation.id,
        question: elicitation.question,
        options: elicitation.options,
      });
    }

    // Done event
    await sleep(150);
    onEvent({ type: 'done' });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Stream cancelled gracefully
      return;
    }
    throw err;
  }
}
