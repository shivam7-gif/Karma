import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../../db/index.js';
import { orchestratorTasks } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { OrchestratorTask } from './types.js';
import { logger } from '../../lib/logger.js';

export class TaskStore {
  private filePath: string;
  private cache: Map<string, OrchestratorTask> = new Map();
  private isDbAvailable: boolean | null = null;

  constructor(storageDir?: string) {
    const dir = storageDir || path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Fallback to temp
      }
    }
    this.filePath = path.join(dir, 'orchestrator_tasks.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: OrchestratorTask[] = JSON.parse(raw);
        for (const t of list) {
          this.cache.set(t.taskId, t);
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to load orchestrator tasks from disk');
    }
  }

  private flushToDisk() {
    try {
      const list = Array.from(this.cache.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      logger.warn({ err }, 'Failed to persist orchestrator tasks to disk');
    }
  }

  async saveTask(task: OrchestratorTask): Promise<void> {
    this.cache.set(task.taskId, { ...task });
    this.flushToDisk();

    // Persist to Neon DB if available
    try {
      const db = getDb();
      await db
        .insert(orchestratorTasks)
        .values({
          taskId: task.taskId,
          sessionId: task.sessionId,
          parentTaskId: task.parentTaskId || null,
          agentType: task.agentType,
          description: task.description,
          status: task.status,
          dependencies: task.dependencies,
          result: task.result || null,
          error: task.error || null,
          metadata: task.metadata || {},
          startedAt: task.startedAt ? new Date(task.startedAt) : null,
          completedAt: task.completedAt ? new Date(task.completedAt) : null,
          createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [orchestratorTasks.sessionId, orchestratorTasks.taskId],
          set: {
            status: task.status,
            result: task.result || null,
            error: task.error || null,
            startedAt: task.startedAt ? new Date(task.startedAt) : null,
            completedAt: task.completedAt ? new Date(task.completedAt) : null,
            updatedAt: new Date(),
          },
        });
      this.isDbAvailable = true;
    } catch {
      // Graceful fallback to file cache
      this.isDbAvailable = false;
    }
  }

  async updateTask(
    taskId: string,
    patch: Partial<OrchestratorTask>
  ): Promise<OrchestratorTask | null> {
    const existing = this.cache.get(taskId);
    if (!existing) {
      return null;
    }

    const updated: OrchestratorTask = {
      ...existing,
      ...patch,
      metadata: { ...existing.metadata, ...patch.metadata },
    };
    this.cache.set(taskId, updated);
    this.flushToDisk();

    try {
      const db = getDb();
      await db
        .update(orchestratorTasks)
        .set({
          status: updated.status,
          result: updated.result || null,
          error: updated.error || null,
          startedAt: updated.startedAt ? new Date(updated.startedAt) : null,
          completedAt: updated.completedAt ? new Date(updated.completedAt) : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orchestratorTasks.taskId, taskId),
            eq(orchestratorTasks.sessionId, updated.sessionId)
          )
        );
    } catch {
      // Local cache already updated
    }

    return updated;
  }

  async getTask(taskId: string): Promise<OrchestratorTask | null> {
    if (this.cache.has(taskId)) {
      return this.cache.get(taskId)!;
    }
    return null;
  }

  async getSessionTasks(sessionId: string): Promise<OrchestratorTask[]> {
    return Array.from(this.cache.values()).filter((t) => t.sessionId === sessionId);
  }

  /**
   * Recovers tasks interrupted across restarts.
   * Tasks that were in 'running' or 'planning' status when the server restarted
   * are flagged as 'failed' with reason 'Interrupted by server restart'.
   */
  async recoverInterruptedTasks(): Promise<OrchestratorTask[]> {
    const recovered: OrchestratorTask[] = [];
    for (const [taskId, task] of this.cache.entries()) {
      if (task.status === 'running' || task.status === 'planning') {
        task.status = 'failed';
        task.error = 'Task interrupted by system restart';
        task.completedAt = new Date().toISOString();
        this.cache.set(taskId, task);
        recovered.push(task);
      }
    }
    if (recovered.length > 0) {
      this.flushToDisk();
      logger.info({ count: recovered.length }, 'Recovered interrupted tasks on restart');
    }
    return recovered;
  }

  clear() {
    this.cache.clear();
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch {}
  }
}

export const taskStore = new TaskStore();
