export type AgentType = 'research' | 'browser' | 'coding' | 'analysis' | 'synthesis';

export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CancellationState {
  cancelled: boolean;
  reason?: string | undefined;
}

export interface OrchestratorTask {
  taskId: string;
  sessionId: string;
  parentTaskId?: string | undefined;
  agentType: AgentType;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  result?: string | undefined;
  error?: string | undefined;
  createdAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  cancellationState?: CancellationState | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface TaskCreatedEvent {
  type: 'task_created';
  task: OrchestratorTask;
  sessionId: string;
  timestamp: string;
}

export interface TaskUpdatedEvent {
  type: 'task_updated';
  taskId: string;
  sessionId: string;
  agentType: AgentType;
  status: TaskStatus;
  activity?: string | undefined;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  result?: string | undefined;
  error?: string | undefined;
  timestamp: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface TaskCompletedEvent {
  type: 'task_completed';
  taskId: string;
  sessionId: string;
  agentType: AgentType;
  result?: string | undefined;
  timestamp: string;
  metadata?: Record<string, unknown> | undefined;
}

export type OrchestratorStreamEvent =
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskCompletedEvent;

export interface OrchestratorConfig {
  maxConcurrency: number; // default 3, hard limit 5
  taskTimeoutMs: number;  // default 60,000ms
  maxRetries: number;     // default 1
}

export interface OrchestratorPlan {
  planId: string;
  sessionId: string;
  summary: string;
  isMultiAgent: boolean;
  tasks: Array<{
    taskId: string;
    agentType: AgentType;
    description: string;
    dependencies: string[];
    metadata?: Record<string, unknown> | undefined;
  }>;
}

export interface AgentContext {
  task: OrchestratorTask;
  sessionId: string;
  dependencyResults: Map<string, string>;
  signal: AbortSignal;
  onActivity: (activity: string) => void;
  onProgress?: ((data: unknown) => void) | undefined;
}

export interface AgentResult {
  success: boolean;
  output: string;
  error?: string | undefined;
  citations?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}
