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

export class GroqProvider implements LLMProvider {
  private baseUrl = 'https://api.groq.com/openai/v1';

  async testKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
    if (!apiKey || !apiKey.startsWith('gsk_')) {
      return { valid: false, message: 'Invalid Groq API key format (must start with gsk_)' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        return { valid: false, message: `Groq returned status ${res.status}` };
      }

      return { valid: true, message: 'Groq API key verified' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, message: `Connection to Groq failed: ${msg}` };
    }
  }

  async getAvailableModels(): Promise<LLMModelInfo[]> {
    return [
      {
        id: 'openai/gpt-oss-120b',
        name: 'OpenAI GPT OSS 120B (Groq)',
        contextLength: 128000,
        isFree: true,
        supportsTools: true,
        promptPrice: 0,
        completionPrice: 0,
      },
      {
        id: 'qwen/qwen3.8-27b',
        name: 'Qwen 3.8 27B (Groq)',
        contextLength: 128000,
        isFree: true,
        supportsTools: true,
        promptPrice: 0,
        completionPrice: 0,
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'OpenAI GPT OSS 20B (Groq)',
        contextLength: 128000,
        isFree: true,
        supportsTools: true,
        promptPrice: 0,
        completionPrice: 0,
      },
    ];
  }

  async *stream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMStreamEvent, void, unknown> {
    const apiKey = (options?.apiKey || process.env.GROQ_API_KEY || '').trim();

    if (!apiKey) {
      yield {
        type: 'error',
        error:
          'No Groq API key found. Please set GROQ_API_KEY in backend/.env (starts with gsk_).',
        code: 'MISSING_GROQ_KEY',
      };
      return;
    }

    if (!apiKey.startsWith('gsk_')) {
      yield {
        type: 'error',
        error:
          `Invalid GROQ_API_KEY format: found key starting with '${apiKey.substring(0, 4)}...' instead of 'gsk_...'. Please update GROQ_API_KEY in backend/.env with your key from console.groq.com/keys.`,
        code: 'INVALID_GROQ_KEY',
      };
      return;
    }

    let model = options?.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    if (model.startsWith('meta-llama/')) {
      model = model.includes('70b') ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
    }

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
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = `Groq error (${response.status})`;
        try {
          const parsed = JSON.parse(errorText);
          message = parsed.error?.message || message;
        } catch {
          // ignore
        }

        if (response.status === 401) {
          throw new Error('Invalid Groq API key. Check GROQ_API_KEY in backend/.env (must be from console.groq.com/keys).');
        } else if (response.status === 429) {
          throw new Error(`429: Groq rate limit reached for model ${model}.`);
        }

        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('No readable stream returned from Groq.');
      }

      yield* parseOpenAISSEStream(response.body, model);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err: errorMsg, model }, 'Groq streaming execution failed');
      yield {
        type: 'error',
        error: errorMsg,
        code: 'GROQ_STREAM_ERROR',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const groqProvider = new GroqProvider();
