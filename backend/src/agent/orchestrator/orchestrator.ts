import {
  type OrchestratorTask,
  type OrchestratorPlan,
  type OrchestratorConfig,
  type OrchestratorStreamEvent,
  type AgentType,
  type TaskStatus,
  type AgentResult,
} from './types.js';
import { taskStore } from './taskStore.js';
import { generatePlan } from './planner.js';
import { runResearchAgent } from './agents/researchAgent.js';
import { runBrowserAgent } from './agents/browserAgent.js';
import { runCodingAgent } from './agents/codingAgent.js';
import { runAnalysisAgent } from './agents/analysisAgent.js';
import { runSynthesisAgent } from './agents/synthesisAgent.js';
import { logger } from '../../lib/logger.js';

export interface OrchestratorRunOptions {
  sessionId: string;
  config?: Partial<OrchestratorConfig> | undefined;
  signal?: AbortSignal | undefined;
  onEvent?: ((event: OrchestratorStreamEvent) => void) | undefined;
  onProgress?: ((activity: string) => void) | undefined;
  forceMultiAgent?: boolean | undefined;
}

export class MultiAgentOrchestrator {
  private activeControllers: Map<string, AbortController> = new Map(); // taskId -> controller
  private sessionControllers: Map<string, AbortController> = new Map(); // sessionId -> controller

  constructor(
    private defaultConfig: OrchestratorConfig = {
      maxConcurrency: 3, // Initial 3 concurrent workers as specified
      taskTimeoutMs: 60000,
      maxRetries: 1, // 1 bounded retry on transient failure
    }
  ) {}

  /**
   * Plans and executes a multi-agent workflow for the given user prompt.
   */
  async execute(prompt: string, options: OrchestratorRunOptions): Promise<{
    isMultiAgent: boolean;
    plan: OrchestratorPlan;
    tasks: OrchestratorTask[];
    finalOutput: string;
  }> {
    const { sessionId, signal, onEvent, onProgress, forceMultiAgent } = options;

    const concurrencyLimit = Math.min(
      options.config?.maxConcurrency ?? this.defaultConfig.maxConcurrency,
      5 // Hard upper bound
    );
    const timeoutMs = options.config?.taskTimeoutMs ?? this.defaultConfig.taskTimeoutMs;
    const maxRetries = options.config?.maxRetries ?? this.defaultConfig.maxRetries;

    // 1. Session abort controller
    const sessionAbort = new AbortController();
    this.sessionControllers.set(sessionId, sessionAbort);

    if (signal) {
      signal.addEventListener('abort', () => {
        sessionAbort.abort();
        this.cancelSession(sessionId, 'Parent session aborted');
      });
    }

    // 2. Generate Plan (DAG)
    onProgress?.('Formulating multi-agent execution plan...');
    const plan = await generatePlan(prompt, sessionId, {
      signal: sessionAbort.signal,
      forceMultiAgent,
    });

    if (!plan.isMultiAgent || plan.tasks.length === 0) {
      return {
        isMultiAgent: false,
        plan,
        tasks: [],
        finalOutput: '',
      };
    }

    // 3. Instantiate typed tasks and persist as queued
    const tasksMap = new Map<string, OrchestratorTask>();
    const taskControllers = new Map<string, AbortController>();
    const now = new Date().toISOString();

    for (const taskDef of plan.tasks) {
      const task: OrchestratorTask = {
        taskId: taskDef.taskId,
        sessionId,
        agentType: taskDef.agentType,
        description: taskDef.description,
        status: 'queued',
        dependencies: taskDef.dependencies,
        createdAt: now,
        metadata: taskDef.metadata || {},
      };

      tasksMap.set(task.taskId, task);
      await taskStore.saveTask(task);

      onEvent?.({
        type: 'task_created',
        task,
        sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Concurrency Scheduler & Worker Pool
    let runningCount = 0;
    const completedTasks = new Set<string>();
    const failedTasks = new Set<string>();
    const taskPromises = new Map<string, Promise<void>>();

    const scheduleNextTasks = () => {
      if (sessionAbort.signal.aborted) return;

      for (const [taskId, task] of tasksMap.entries()) {
        if (task.status !== 'queued') continue;

        // Check if all prerequisites have settled (either completed or failed)
        const allDepsSettled = task.dependencies.every(
          (depId) => completedTasks.has(depId) || failedTasks.has(depId)
        );

        if (!allDepsSettled) {
          // Still waiting for some prerequisite tasks
          continue;
        }

        // If task has dependencies and ALL of them failed, only then fail this dependent task
        if (task.dependencies.length > 0 && task.dependencies.every((depId) => failedTasks.has(depId))) {
          task.status = 'failed';
          task.error = 'All prerequisite dependency tasks failed';
          task.completedAt = new Date().toISOString();
          failedTasks.add(taskId);
          taskStore.updateTask(taskId, { status: 'failed', error: task.error, completedAt: task.completedAt });
          onEvent?.({
            type: 'task_updated',
            taskId,
            sessionId,
            agentType: task.agentType,
            status: 'failed',
            error: task.error,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // If prerequisites have settled (with partial or full results) and concurrency slot available
        if (runningCount < concurrencyLimit) {
          runningCount++;
          task.status = 'running';
          const p = runTask(task).finally(() => {
            runningCount--;
            scheduleNextTasks();
          });
          taskPromises.set(taskId, p);
        }
      }
    };

    const runTask = async (task: OrchestratorTask) => {
      const taskAbort = new AbortController();
      taskControllers.set(task.taskId, taskAbort);
      this.activeControllers.set(task.taskId, taskAbort);

      // Link session abort to task abort
      const onSessionAbort = () => taskAbort.abort();
      sessionAbort.signal.addEventListener('abort', onSessionAbort);

      task.status = 'running';
      task.startedAt = new Date().toISOString();
      await taskStore.updateTask(task.taskId, { status: 'running', startedAt: task.startedAt });

      onEvent?.({
        type: 'task_updated',
        taskId: task.taskId,
        sessionId,
        agentType: task.agentType,
        status: 'running',
        startedAt: task.startedAt,
        activity: `Agent [${task.agentType}] executing research and gathering evidence...`,
        timestamp: new Date().toISOString(),
      });

      // Gather completed and partial dependency results
      const depResults = new Map<string, string>();
      for (const depId of task.dependencies) {
        const depTask = tasksMap.get(depId);
        if (depTask?.result) {
          depResults.set(depId, depTask.result);
        } else if (depTask?.error) {
          depResults.set(depId, `[NOTICE: Upstream specialist task ${depId} failed with error: ${depTask.error}]`);
        }
      }

      let attempt = 0;
      let finalResult: AgentResult | null = null;

      try {
        while (attempt <= maxRetries && !taskAbort.signal.aborted && !sessionAbort.signal.aborted) {
          try {
            if (attempt > 0) {
              onEvent?.({
                type: 'task_updated',
                taskId: task.taskId,
                sessionId,
                agentType: task.agentType,
                status: 'running',
                activity: `Retrying task execution (attempt ${attempt + 1}/${maxRetries + 1})...`,
                timestamp: new Date().toISOString(),
              });
            }

            // Timeout wrapper per attempt
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Task timed out after ${timeoutMs}ms`)), timeoutMs)
            );

            const agentPromise = this.dispatchToAgent(task, sessionId, depResults, taskAbort.signal, (act) => {
              onEvent?.({
                type: 'task_updated',
                taskId: task.taskId,
                sessionId,
                agentType: task.agentType,
                status: 'running',
                activity: act,
                timestamp: new Date().toISOString(),
              });
            });

            finalResult = await Promise.race([agentPromise, timeoutPromise]);
            if (finalResult && finalResult.success) {
              break;
            }
          } catch (err: unknown) {
            if (taskAbort.signal.aborted || sessionAbort.signal.aborted) {
              throw err;
            }
            if (attempt < maxRetries) {
              attempt++;
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
            throw err;
          }
          attempt++;
        }

        const isSuccess = Boolean(finalResult?.success);
        task.status = isSuccess ? 'completed' : 'failed';
        task.result = finalResult?.output;
        task.error = finalResult?.error;
        task.completedAt = new Date().toISOString();
        if (finalResult?.metadata) {
          task.metadata = { ...task.metadata, ...finalResult.metadata };
        }

        if (isSuccess) {
          completedTasks.add(task.taskId);
        } else {
          failedTasks.add(task.taskId);
        }

        await taskStore.updateTask(task.taskId, {
          status: task.status,
          result: task.result,
          error: task.error,
          completedAt: task.completedAt,
          metadata: task.metadata,
        });

        if (isSuccess) {
          onEvent?.({
            type: 'task_completed',
            taskId: task.taskId,
            sessionId,
            agentType: task.agentType,
            result: task.result,
            metadata: task.metadata,
            timestamp: new Date().toISOString(),
          });
        } else {
          onEvent?.({
            type: 'task_updated',
            taskId: task.taskId,
            sessionId,
            agentType: task.agentType,
            status: 'failed',
            error: task.error,
            metadata: task.metadata,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        const isCancelled = taskAbort.signal.aborted || sessionAbort.signal.aborted;
        task.status = isCancelled ? 'cancelled' : 'failed';
        task.error = err instanceof Error ? err.message : String(err);
        task.completedAt = new Date().toISOString();
        failedTasks.add(task.taskId);

        await taskStore.updateTask(task.taskId, {
          status: task.status,
          error: task.error,
          completedAt: task.completedAt,
        });

        onEvent?.({
          type: 'task_updated',
          taskId: task.taskId,
          sessionId,
          agentType: task.agentType,
          status: task.status,
          error: task.error,
          timestamp: new Date().toISOString(),
        });
      } finally {
        sessionAbort.signal.removeEventListener('abort', onSessionAbort);
        this.activeControllers.delete(task.taskId);
      }
    };

    // Kick off scheduler with concurrent tasks
    scheduleNextTasks();

    // Wait until all tasks have settled
    while (completedTasks.size + failedTasks.size < tasksMap.size && !sessionAbort.signal.aborted) {
      await Promise.race(Array.from(taskPromises.values())).catch(() => {});
      scheduleNextTasks();
      await new Promise((r) => setTimeout(r, 50));
    }

    if (sessionAbort.signal.aborted) {
      for (const [taskId, task] of tasksMap.entries()) {
        if (task.status === 'queued' || task.status === 'running') {
          task.status = 'cancelled';
          task.error = 'Session was cancelled';
          task.completedAt = new Date().toISOString();
          taskStore.updateTask(taskId, {
            status: 'cancelled',
            error: task.error,
            completedAt: task.completedAt,
            cancellationState: { cancelled: true, reason: 'Session cancelled' },
          });
          onEvent?.({
            type: 'task_updated',
            taskId,
            sessionId,
            agentType: task.agentType,
            status: 'cancelled',
            error: task.error,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Clean up session controllers
    this.sessionControllers.delete(sessionId);

    // Compute final synthesized output
    const tasksArray = Array.from(tasksMap.values());
    const synthesisTask = tasksArray.slice().reverse().find((t) => t.agentType === 'synthesis' && t.status === 'completed');
    const finalOutput = synthesisTask?.result || tasksArray.map((t) => `**[${t.agentType}]**: ${t.result || t.error || 'N/A'}`).join('\n\n');

    return {
      isMultiAgent: true,
      plan,
      tasks: tasksArray,
      finalOutput,
    };
  }

  private async dispatchToAgent(
    task: OrchestratorTask,
    sessionId: string,
    dependencyResults: Map<string, string>,
    signal: AbortSignal,
    onActivity: (activity: string) => void
  ) {
    const ctx = {
      task,
      sessionId,
      dependencyResults,
      signal,
      onActivity,
    };

    switch (task.agentType) {
      case 'research':
        return await runResearchAgent(ctx);
      case 'browser':
        return await runBrowserAgent(ctx);
      case 'coding':
        return await runCodingAgent(ctx);
      case 'analysis':
        return await runAnalysisAgent(ctx);
      case 'synthesis':
        return await runSynthesisAgent(ctx);
      default:
        return await runResearchAgent(ctx);
    }
  }

  cancelTask(taskId: string, reason = 'Cancelled by user') {
    const ctrl = this.activeControllers.get(taskId);
    if (ctrl) {
      ctrl.abort();
      this.activeControllers.delete(taskId);
    }
    taskStore.updateTask(taskId, {
      status: 'cancelled',
      cancellationState: { cancelled: true, reason },
      completedAt: new Date().toISOString(),
    });
  }

  async cancelSession(sessionId: string, reason = 'Session cancelled') {
    const ctrl = this.sessionControllers.get(sessionId);
    if (ctrl) {
      ctrl.abort();
      this.sessionControllers.delete(sessionId);
    }
    // Cancel all tasks belonging to this session in active memory
    for (const [taskId, c] of this.activeControllers.entries()) {
      c.abort();
      this.activeControllers.delete(taskId);
    }
    // And mark session tasks as cancelled in persistent taskStore
    const sessionTasks = await taskStore.getSessionTasks(sessionId);
    for (const t of sessionTasks) {
      if (t.status !== 'completed' && t.status !== 'failed') {
        await taskStore.updateTask(t.taskId, {
          status: 'cancelled',
          cancellationState: { cancelled: true, reason },
          completedAt: new Date().toISOString(),
        });
      }
    }
  }
}

export const orchestrator = new MultiAgentOrchestrator();
