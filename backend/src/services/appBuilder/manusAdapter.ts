import type {
  AppBuilderProvider,
  AppBuildSpecification,
  BuildProjectRequest,
  BuildTaskResult,
  BuildTaskStatus,
} from './types.js';
import { logger } from '../../lib/logger.js';

export class ManusAppBuilderAdapter implements AppBuilderProvider {
  public readonly id = 'manus';
  public readonly name = 'Manus AI';
  public readonly description = 'Autonomous AI agent platform for end-to-end software and web application scaffolding.';

  private baseUrl = 'https://api.manus.ai/v2';

  private getApiKey(): string | undefined {
    return process.env.MANUS_API_KEY?.trim() || undefined;
  }

  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    const key = this.getApiKey();
    if (!key) {
      return {
        available: false,
        reason: 'MANUS_API_KEY is not set in backend/.env. Please configure your key from https://open.manus.ai to enable direct Manus API task execution.',
      };
    }

    if (!key.startsWith('manus_') && key.length < 15) {
      return {
        available: false,
        reason: 'MANUS_API_KEY in backend/.env appears invalid (expected API key from open.manus.ai).',
      };
    }

    return { available: true };
  }

  async createProject(request: BuildProjectRequest): Promise<{ projectId: string; projectUrl?: string }> {
    const sanitizedName = request.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);
    const projectId = `manus-prj-${sanitizedName}-${Date.now().toString(36)}`;
    return {
      projectId,
      projectUrl: `https://manus.im/app/${projectId}`,
    };
  }

  async submitBuildTask(
    projectId: string,
    specification: AppBuildSpecification,
    options?: {
      signal?: AbortSignal | undefined;
      onProgress?: ((event: { status: BuildTaskStatus; message: string; data?: unknown }) => void) | undefined;
    } | undefined
  ): Promise<{ taskId: string; initialStatus: BuildTaskStatus; message?: string | undefined }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('MANUS_API_KEY is missing. Cannot submit build task to Manus API.');
    }

    options?.onProgress?.({
      status: 'planning',
      message: 'Dispatching full project brief to Manus AI v2 task.create endpoint...',
    });

    const requestBody = {
      message: {
        content: [
          {
            type: 'text',
            text: specification.fullMarkdownBrief,
            visibility: 'visible',
          },
        ],
      },
      agent_profile: 'standard',
      share_visibility: 'private',
    };

    const response = await fetch(`${this.baseUrl}/task.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-manus-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      ...(options?.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      let parsedMsg = `Manus API returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errBody);
        parsedMsg = parsed.error?.message || parsed.message || parsedMsg;
      } catch {}
      logger.error({ status: response.status, errBody }, 'Manus task.create failed');
      throw new Error(`Manus API task creation failed: ${parsedMsg}`);
    }

    const data = await response.json();
    const taskId = data.task_id || data.id || `task_${Date.now()}`;
    const taskUrl = data.task_url || `https://manus.im/app/${taskId}`;

    options?.onProgress?.({
      status: 'running',
      message: `Manus task created successfully (ID: ${taskId}). Agent execution initiated.`,
      data: { taskId, taskUrl },
    });

    return {
      taskId,
      initialStatus: 'running',
      message: `Manus agent is building application. Live task session: ${taskUrl}`,
    };
  }

  async getTaskStatus(taskId: string): Promise<{
    status: BuildTaskStatus;
    message?: string;
    previewUrl?: string;
    projectUrl?: string;
    creditsUsed?: number;
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        status: 'failed',
        message: 'MANUS_API_KEY missing.',
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/task.detail?task_id=${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          'x-manus-api-key': apiKey,
        },
      });

      if (!res.ok) {
        return {
          status: 'failed',
          message: `Manus task.detail check failed (HTTP ${res.status})`,
        };
      }

      const body = await res.json();
      const task = body.task || body;
      const rawStatus = String(task.status || '').toLowerCase();
      const projectUrl = task.task_url || `https://manus.im/app/${taskId}`;
      const creditsUsed = typeof task.credit_usage === 'number' ? task.credit_usage : undefined;

      let status: BuildTaskStatus = 'running';
      let message = 'Manus agent is executing build steps...';

      if (rawStatus === 'stopped') {
        status = 'completed';
        message = 'Manus task finished execution.';
      } else if (rawStatus === 'waiting') {
        status = 'waiting';
        message = 'Manus task is waiting for user confirmation in web console.';
      } else if (rawStatus === 'error') {
        status = 'failed';
        message = 'Manus task encountered an execution error.';
      } else if (rawStatus === 'running') {
        status = 'running';
        message = `Manus agent actively building (Credits: ${creditsUsed ?? 0}).`;
      }

      return {
        status,
        message,
        projectUrl,
        creditsUsed,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: 'running',
        message: `Status poll attempt: ${msg}`,
      };
    }
  }

  async getTaskResult(taskId: string): Promise<BuildTaskResult> {
    const apiKey = this.getApiKey();
    const taskStatus = await this.getTaskStatus(taskId);
    let outputSummary = 'Manus AI Agent completed task execution.';
    let previewUrl: string | undefined;
    let repoUrl: string | undefined;

    if (apiKey) {
      try {
        const msgRes = await fetch(`${this.baseUrl}/task.listMessages?task_id=${encodeURIComponent(taskId)}`, {
          method: 'GET',
          headers: {
            'x-manus-api-key': apiKey,
          },
        });

        if (msgRes.ok) {
          const msgBody = await msgRes.json();
          const messages = msgBody.messages || msgBody.data || [];
          if (Array.isArray(messages) && messages.length > 0) {
            // Find assistant outputs
            const lastMsg = [...messages].reverse().find((m) => m.role === 'assistant' || m.type === 'assistant');
            if (lastMsg) {
              const textContent =
                typeof lastMsg.content === 'string'
                  ? lastMsg.content
                  : Array.isArray(lastMsg.content)
                  ? lastMsg.content.map((c: any) => c.text || '').join('\n')
                  : '';
              if (textContent) {
                outputSummary = textContent;

                // Extract preview URL or repo link from text if emitted by Manus
                const urlMatch = textContent.match(/https?:\/\/[^\s)"]+(?:\.vercel\.app|\.netlify\.app|\.onrender\.com|github\.com\/[^\s)"]+)/i);
                if (urlMatch) {
                  if (urlMatch[0].includes('github.com')) {
                    repoUrl = urlMatch[0];
                  } else {
                    previewUrl = urlMatch[0];
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        logger.warn({ err, taskId }, 'Failed to list messages from Manus task');
      }
    }

    return {
      taskId,
      provider: 'manus',
      providerName: 'Manus AI',
      status: taskStatus.status,
      statusMessage: taskStatus.message || 'Manus build completed.',
      previewUrl,
      projectUrl: taskStatus.projectUrl || `https://manus.im/app/${taskId}`,
      repoUrl,
      outputSummary,
      creditsUsed: taskStatus.creditsUsed,
      manualActionsRemaining: [
        `Access full agent step-by-step logs and artifact downloads at: ${taskStatus.projectUrl || `https://manus.im/app/${taskId}`}`,
        'Download generated repository files to run locally with `npm install && npm run dev` if external cloud deployment was not requested.',
      ],
      continueActionUrl: taskStatus.projectUrl || `https://manus.im/app/${taskId}`,
      continueActionLabel: 'Open Session in Manus Console',
    };
  }

  async cancelTask(taskId: string): Promise<boolean> {
    logger.info({ taskId }, 'Requested cancellation for Manus task');
    return true;
  }
}

export const manusAdapter = new ManusAppBuilderAdapter();
