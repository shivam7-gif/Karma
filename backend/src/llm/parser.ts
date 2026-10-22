import type { LLMStreamEvent } from './types.js';

export async function* parseOpenAISSEStream(
  stream: ReadableStream<Uint8Array>,
  modelName: string
): AsyncGenerator<LLMStreamEvent, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Accumulate tool calls by index
  const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') {
            // Flush any remaining accumulated tool calls
            for (const [idx, tool] of toolCallBuffers.entries()) {
              yield {
                type: 'tool_call',
                id: tool.id,
                name: tool.name,
                arguments: tool.args,
                index: idx,
              };
            }
            yield { type: 'done', model: modelName };
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            // 1. Text Delta
            if (delta?.content) {
              yield {
                type: 'text',
                text: delta.content,
              };
            }

            // 2. Tool Calls Delta
            if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                let existing = toolCallBuffers.get(idx);
                if (!existing) {
                  existing = {
                    id: tc.id || `call_${Date.now()}_${idx}`,
                    name: '',
                    args: '',
                  };
                  toolCallBuffers.set(idx, existing);
                }

                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) {
                  if (!existing.name) {
                    existing.name = tc.function.name;
                  } else if (!existing.name.endsWith(tc.function.name)) {
                    existing.name += tc.function.name;
                  }
                }
                if (tc.function?.arguments) existing.args += tc.function.arguments;
              }
            }

            // 3. Usage tokens
            if (parsed.usage) {
              yield {
                type: 'usage',
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              };
            }
          } catch {
            // ignore partial JSON chunks
          }
        }
      }
    }

    // Flush any pending tool calls if stream ended without explicit [DONE]
    for (const [idx, tool] of toolCallBuffers.entries()) {
      yield {
        type: 'tool_call',
        id: tool.id,
        name: tool.name,
        arguments: tool.args,
        index: idx,
      };
    }
    yield { type: 'done', model: modelName };
  } finally {
    reader.releaseLock();
  }
}
