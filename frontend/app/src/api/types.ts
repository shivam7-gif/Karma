export const STREAM_EVENT_TYPES = ['token', 'tool_call', 'tool_result', 'elicitation', 'done'] as const;

export type StreamEventType = 'token' | 'tool_call' | 'tool_result' | 'elicitation' | 'done';

export interface TokenEvent {
  type: 'token';
  text: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  result: Record<string, unknown> | string;
  ms: number;
}

export interface ElicitationEvent {
  type: 'elicitation';
  id: string;
  question: string;
  options?: string[];
}

export interface DoneEvent {
  type: 'done';
}

export type StreamEvent = 
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | ElicitationEvent
  | DoneEvent;

export interface TraceItem {
  id: string;
  timestamp: string;
  name: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown> | string;
  ms?: number;
  status: 'running' | 'completed' | 'error';
}

export type DeviceMode = 'voice-only' | 'screen'; // "Echo (voice only)" vs "Echo Show (screen)"

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  elicitation?: {
    id: string;
    question: string;
    options?: string[];
    answered?: string;
  };
  richCard?: {
    type: 'list' | 'weather' | 'summary';
    title: string;
    items?: Array<{ label: string; count?: number; done?: boolean }>;
    details?: string;
  };
}
