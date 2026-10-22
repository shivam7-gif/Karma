import { CONFIG } from '../config';
import type { StreamEvent } from './types';
import { createSSEParser } from './sseParser';

export async function sendMessage(
  text: string,
  sessionId: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    let userId = 'default-user';
    try {
      const saved = localStorage.getItem('karma_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.email || u.id) userId = u.email || u.id;
      }
    } catch (e) {}

    const response = await fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        message: text,
        conversationId: sessionId,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body returned from chat endpoint');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSSEParser({
      onEvent,
      onError: (err) => console.warn('SSE parse error:', err),
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      parser.feed(chunk);
    }
    // Flush any remaining characters in stream decoder
    const finalChunk = decoder.decode();
    if (finalChunk) {
      parser.feed(finalChunk);
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    console.error('Chat backend streaming failed:', err);
    throw err;
  }
}
