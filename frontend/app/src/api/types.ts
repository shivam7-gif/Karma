export const STREAM_EVENT_TYPES = ['token', 'tool_call', 'tool_result', 'elicitation', 'done'] as const;

export type StreamEventType = 'token' | 'tool_call' | 'tool_result' | 'elicitation' | 'done';

export interface BaseStreamEvent {
  seq?: number;
}

export interface TokenEvent extends BaseStreamEvent {
  type: 'token';
  text: string;
}

export interface DeltaEvent extends BaseStreamEvent {
  type: 'delta';
  text: string;
}

export interface ToolCallEvent extends BaseStreamEvent {
  type: 'tool_call';
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent extends BaseStreamEvent {
  type: 'tool_result';
  id: string;
  result: Record<string, unknown> | string;
  ms: number;
}

export interface ElicitationEvent extends BaseStreamEvent {
  type: 'elicitation';
  id: string;
  question: string;
  options?: string[];
}

export interface DoneEvent extends BaseStreamEvent {
  type: 'done';
  conversationId?: string;
  messageId?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  error: string;
  code?: string;
}

export type AgentLifecycleStatus =
  | 'idle'
  | 'planning'
  | 'thinking'
  | 'executing_tool'
  | 'controlling_screen'
  | 'waiting_for_user'
  | 'completed'
  | 'stopped'
  | 'error';

export interface LifecycleEvent extends BaseStreamEvent {
  type: 'lifecycle';
  sessionId: string;
  status: AgentLifecycleStatus;
  timestamp: string;
  message: string;
  tool?: string;
  metadata?: Record<string, unknown>;
}

export interface ProgressEvent extends BaseStreamEvent {
  type: 'progress';
  sessionId?: string;
  status: string;
  message: string;
  timestamp?: string;
  data?: unknown;
}

export type OrchestratorAgentType = 'research' | 'browser' | 'coding' | 'analysis' | 'synthesis';

export type OrchestratorTaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ClientOrchestratorTask {
  taskId: string;
  sessionId: string;
  agentType: OrchestratorAgentType;
  description: string;
  status: OrchestratorTaskStatus;
  dependencies: string[];
  result?: string;
  error?: string;
  activity?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskCreatedEvent extends BaseStreamEvent {
  type: 'task_created';
  task: ClientOrchestratorTask;
  sessionId: string;
  timestamp: string;
}

export interface TaskUpdatedEvent extends BaseStreamEvent {
  type: 'task_updated';
  taskId: string;
  sessionId: string;
  agentType: OrchestratorAgentType;
  status: OrchestratorTaskStatus;
  activity?: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
  timestamp: string;
}

export interface TaskCompletedEvent extends BaseStreamEvent {
  type: 'task_completed';
  taskId: string;
  sessionId: string;
  agentType: OrchestratorAgentType;
  result?: string;
  timestamp: string;
}

export type StreamEvent = 
  | TokenEvent
  | DeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | ElicitationEvent
  | DoneEvent
  | ErrorEvent
  | LifecycleEvent
  | ProgressEvent
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskCompletedEvent;

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
