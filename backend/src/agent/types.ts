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

export interface AgentLifecycleEvent {
  type: 'lifecycle';
  sessionId: string;
  status: AgentLifecycleStatus;
  timestamp: string;
  message: string;
  tool?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface AgentProgressEvent {
  type: 'progress';
  sessionId: string;
  step: string;
  status: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

export const LIFECYCLE_MESSAGES: Record<AgentLifecycleStatus, string> = {
  idle: 'Ready',
  planning: 'Planning your request...',
  thinking: 'Analyzing options...',
  executing_tool: 'Executing tool...',
  controlling_screen: 'Karma is controlling the screen...',
  waiting_for_user: 'Waiting for your review...',
  completed: 'Execution completed.',
  stopped: 'Automation stopped by user.',
  error: 'An error occurred during execution.',
};
