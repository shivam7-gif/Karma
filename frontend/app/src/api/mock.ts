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
    let replyText = `Regarding **${text}**, everything is synced and ready. Where would you like to start?`;
    let elicitation: { id: string; question: string; options: string[] } | null = null;

    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening))\b/i.test(lower)) {
      toolName = 'conversation_agent';
      toolArgs = { intent: 'greeting' };
      toolResult = { greeting: 'acknowledged' };
      replyText = 'Hey Shiva, what are we working on?';
    } else if (lower.includes('meeting') || lower.includes('summarize')) {
      toolName = 'calendar_retrieval';
      toolArgs = { query: 'last_meeting' };
      toolResult = { meeting: 'Architecture Sync', participants: 4 };
      replyText =
        'Your last meeting was the **Architecture Sync**:\n\n' +
        '• Finalized the WebSocket and SSE streaming pipeline for real-time trace.\n' +
        '• Confirmed the MCP schema integration for lists and calendars.\n' +
        '• Next step: verify the voice synthesis latency benchmarks.';
    } else if (lower.includes('calendar') || lower.includes('tomorrow')) {
      toolName = 'calendar_query';
      toolArgs = { date: 'tomorrow' };
      toolResult = { events_count: 3 };
      replyText =
        'Here’s what’s on your calendar for tomorrow:\n\n' +
        '• **10:00 AM** — Product Design Review\n' +
        '• **02:30 PM** — Deep Dive on Agentic Workflows\n' +
        '• **05:00 PM** — Team Standup';
    } else if (lower.includes('document') || lower.includes('find')) {
      toolName = 'workspace_search';
      toolArgs = { query: 'documents' };
      toolResult = { matches: 2 };
      replyText =
        'Found 2 relevant documents in your workspace:\n\n' +
        '1. **`specs/voice-engine-v2.md`** — Updated with latency benchmarks.\n' +
        '2. **`notes/mcp-contracts.pdf`** — Tool specifications for search and navigation.';
    } else if (lower.includes('list') || lower.includes('shop') || lower.includes('grocery')) {
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
