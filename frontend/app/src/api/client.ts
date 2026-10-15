import { CONFIG } from '../config';
import type { StreamEvent } from './types';
import { simulateMockStream } from './mock';

export async function sendMessage(
  text: string,
  sessionId: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  if (CONFIG.useMock) {
    return simulateMockStream(text, onEvent, signal);
  }

  try {
    const response = await fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message: text,
        session_id: sessionId,
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
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') {
            onEvent({ type: 'done' });
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr) as StreamEvent;
            onEvent(parsed);
          } catch (e) {
            console.warn('Failed to parse SSE JSON payload:', jsonStr, e);
          }
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    console.warn('Backend fetch failed, falling back to mock stream:', err);
    return simulateMockStream(text, onEvent, signal);
  }
}
