export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMMessage {
  role: LLMRole;
  content: string;
  name?: string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface LLMStreamDelta {
  type: 'text';
  text: string;
}

export interface LLMStreamToolCall {
  type: 'tool_call';
  id: string;
  name: string;
  arguments: string;
  index: number;
}

export interface LLMStreamUsage {
  type: 'usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMStreamDone {
  type: 'done';
  model: string;
}

export interface LLMStreamError {
  type: 'error';
  error: string;
  code?: string;
}

export type LLMStreamEvent =
  | LLMStreamDelta
  | LLMStreamToolCall
  | LLMStreamUsage
  | LLMStreamDone
  | LLMStreamError;

export interface LLMOptions {
  model?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  apiKey?: string | undefined;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  description?: string | undefined;
  contextLength: number;
  isFree: boolean;
  supportsTools: boolean;
  promptPrice: number;
  completionPrice: number;
}

export interface LLMProvider {
  stream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    options?: LLMOptions
  ): AsyncGenerator<LLMStreamEvent, void, unknown>;
  
  getAvailableModels(apiKey?: string): Promise<LLMModelInfo[]>;
  testKey(apiKey: string): Promise<{ valid: boolean; message: string }>;
}
