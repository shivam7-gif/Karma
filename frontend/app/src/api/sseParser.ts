import type { StreamEvent } from './types';

export interface SSEParserOptions {
  onEvent: (event: StreamEvent) => void;
  onError?: (err: unknown) => void;
}

export interface StreamAccumulatorState {
  text: string;
  lastSeq: number;
}

/**
 * Pure accumulator function to apply stream events idempotently.
 * Any event whose seq <= lastSeq is ignored.
 */
export function applyStreamEvent(
  state: StreamAccumulatorState,
  event: StreamEvent
): StreamAccumulatorState {
  if (typeof event.seq === 'number' && event.seq <= state.lastSeq) {
    // Duplicate or out-of-order event: discard (idempotent apply)
    return state;
  }

  const nextSeq = typeof event.seq === 'number' ? event.seq : state.lastSeq;

  if (event.type === 'delta' || event.type === 'token') {
    return {
      text: state.text + (event.text || ''),
      lastSeq: nextSeq,
    };
  }

  return {
    ...state,
    lastSeq: nextSeq,
  };
}

/**
 * Creates an SSE parser that buffers partial data across network chunks,
 * splits on blank lines (\n\n or \r\n\r\n), handles multi-line data fields,
 * and ignores comments/keepalive lines.
 */
export function createSSEParser(options: SSEParserOptions) {
  let buffer = '';
  let lastSeq = -1;

  return {
    feed(chunk: string) {
      buffer += chunk;

      // SSE event blocks are separated by double newlines (\n\n or \r\n\r\n)
      while (true) {
        const match = buffer.match(/\r?\n\r?\n/);
        if (!match || match.index === undefined) {
          break;
        }

        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);

        if (!block.trim()) {
          continue;
        }

        const lines = block.split(/\r?\n/);
        const dataLines: string[] = [];

        for (const line of lines) {
          // Ignore comments / keepalive lines
          if (line.startsWith(':') || !line.trim()) {
            continue;
          }

          if (line.startsWith('data:')) {
            let dataContent = line.slice(5);
            if (dataContent.startsWith(' ')) {
              dataContent = dataContent.slice(1);
            }
            dataLines.push(dataContent);
          }
        }

        if (dataLines.length === 0) {
          continue;
        }

        const combinedData = dataLines.join('\n');

        if (combinedData === '[DONE]') {
          options.onEvent({ type: 'done' });
          continue;
        }

        try {
          const parsed = JSON.parse(combinedData) as StreamEvent;
          
          // Enforce sequence check if seq is present
          if (typeof parsed.seq === 'number') {
            if (parsed.seq <= lastSeq) {
              // Ignore duplicate or older event
              continue;
            }
            lastSeq = parsed.seq;
          }

          // Normalize delta to token for frontend components if needed
          if (parsed.type === 'delta') {
            options.onEvent({
              type: 'token',
              text: (parsed as any).text,
              seq: parsed.seq,
            });
          } else {
            options.onEvent(parsed);
          }
        } catch (err) {
          options.onError?.(err);
        }
      }
    },

    reset() {
      buffer = '';
      lastSeq = -1;
    },
  };
}
