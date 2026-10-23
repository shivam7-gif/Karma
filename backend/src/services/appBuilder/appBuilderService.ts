import { buildAppSpecification, isAppBuildingPrompt } from './specificationBuilder.js';
import { providerSelector } from './providerSelector.js';
import type { AppBuilderProviderId, AppBuildSpecification, BuildTaskResult } from './types.js';
import { taskStore } from '../../agent/orchestrator/taskStore.js';
import { logger } from '../../lib/logger.js';

export interface ExecuteAppBuildOptions {
  sessionId: string;
  userId: string;
  providerOverride?: AppBuilderProviderId | string | undefined;
  signal?: AbortSignal | undefined;
  onProgress?: ((event: {
    status: string;
    message: string;
    data?: unknown;
  }) => void) | undefined;
  maxPollAttempts?: number | undefined;
  pollIntervalMs?: number | undefined;
}

export class AppBuilderService {
  /**
   * Evaluates if a prompt is an app building task.
   */
  shouldHandlePrompt(prompt: string): boolean {
    return isAppBuildingPrompt(prompt);
  }

  /**
   * Executes the end-to-end app builder workflow.
   */
  async buildApp(
    prompt: string,
    options: ExecuteAppBuildOptions
  ): Promise<{
    specification: AppBuildSpecification;
    result: BuildTaskResult;
    formattedChatResponse: string;
    selectedProviderName: string;
    selectionReason: string;
  }> {
    const { sessionId, userId, signal, onProgress, providerOverride } = options;

    onProgress?.({
      status: 'planning',
      message: 'Classifying request and generating production application specification...',
    });

    // 1. Generate full 10-part specification
    const specification = buildAppSpecification(prompt);

    // 2. Smart provider selection
    const selection = await providerSelector.selectProvider(prompt, providerOverride);
    const provider = selection.provider;

    onProgress?.({
      status: 'planning',
      message: `Selected ${provider.name} (${selection.reason})`,
      data: {
        providerId: provider.id,
        providerName: provider.name,
        selectionReason: selection.reason,
      },
    });

    let finalResult: BuildTaskResult;
    const karmaTaskId = `appbuild-${Date.now()}`;

    try {
      // 3. Create project
      const project = await provider.createProject({
        name: specification.title,
        specification,
        sessionId,
        userId,
      });

      // 4. Submit build task to provider
      onProgress?.({
        status: 'executing_tool',
        message: `Submitting project brief to ${provider.name}...`,
      });

      const submission = await provider.submitBuildTask(project.projectId, specification, {
        signal,
        onProgress: (p) => {
          onProgress?.({
            status: p.status,
            message: p.message,
            data: p.data,
          });
        },
      });

      // 5. Register in Karma task store for dashboard visibility
      await taskStore.saveTask({
        taskId: karmaTaskId,
        sessionId,
        agentType: 'coding',
        description: `[${provider.name}] ${specification.title}`,
        status: submission.initialStatus === 'completed' ? 'completed' : 'running',
        dependencies: [],
        createdAt: new Date().toISOString(),
        metadata: {
          provider: provider.id,
          providerName: provider.name,
          projectId: project.projectId,
          taskId: submission.taskId,
          summary: specification.summary,
        },
      });

      // 6. Bounded polling if provider task is asynchronous (e.g. Manus)
      const maxPolls = options.maxPollAttempts ?? (provider.id === 'manus' ? 6 : 1);
      const pollInterval = options.pollIntervalMs ?? 3000;

      let currentStatus = submission.initialStatus;
      let pollCount = 0;

      while (pollCount < maxPolls && currentStatus === 'running') {
        if (signal?.aborted) break;
        await new Promise((r) => setTimeout(r, pollInterval));
        pollCount++;

        try {
          const statusCheck = await provider.getTaskStatus(submission.taskId);
          currentStatus = statusCheck.status;

          onProgress?.({
            status: statusCheck.status,
            message: statusCheck.message || `Polled ${provider.name} (attempt ${pollCount}/${maxPolls})`,
            data: {
              creditsUsed: statusCheck.creditsUsed,
              previewUrl: statusCheck.previewUrl,
            },
          });

          if (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'waiting') {
            break;
          }
        } catch (pollErr) {
          logger.warn({ pollErr, taskId: submission.taskId }, 'Error polling app builder task');
        }
      }

      finalResult = await provider.getTaskResult(submission.taskId);

      // Update Karma task store with final outcome
      await taskStore.updateTask(karmaTaskId, {
        status: finalResult.status === 'completed' ? 'completed' : finalResult.status === 'failed' ? 'failed' : 'completed',
        result: finalResult.outputSummary,
        metadata: {
          previewUrl: finalResult.previewUrl,
          projectUrl: finalResult.projectUrl,
          continueUrl: finalResult.continueActionUrl,
        },
      });
    } catch (providerErr: any) {
      logger.error({ err: providerErr, provider: provider.id }, 'App builder provider execution failed; generating graceful fallback response');

      const replitFallbackUrl = 'https://replit.com/new/react-vite-ts';
      finalResult = {
        taskId: karmaTaskId,
        provider: provider.id,
        providerName: provider.name,
        status: 'manual_action_required',
        statusMessage: `Provider error encountered: ${providerErr.message || 'Service unreachable'}. Karma generated your complete specification and prepared a Replit workspace fallback.`,
        outputSummary: `Execution via ${provider.name} failed (${providerErr.message}). You can seamlessly proceed by opening the pre-configured project template in Replit.`,
        continueActionUrl: replitFallbackUrl,
        continueActionLabel: 'Continue with Replit Workspace Fallback',
        manualActionsRemaining: [
          'Open the Replit workspace link below.',
          'Paste the generated architecture brief into Replit Agent.',
          'Run the application and return the Repl URL to Karma chat.',
        ],
        error: providerErr.message,
      };

      await taskStore.saveTask({
        taskId: karmaTaskId,
        sessionId,
        agentType: 'coding',
        description: `[${provider.name} (Fallback)] ${specification.title}`,
        status: 'failed',
        dependencies: [],
        createdAt: new Date().toISOString(),
        result: finalResult.outputSummary,
      });
    }

    // 7. Format unified markdown response for the existing chat stream
    const formattedChatResponse = this.formatChatResponse({
      specification,
      result: finalResult,
      providerName: provider.name,
      selectionReason: selection.reason,
    });

    return {
      specification,
      result: finalResult,
      formattedChatResponse,
      selectedProviderName: provider.name,
      selectionReason: selection.reason,
    };
  }

  private formatChatResponse(params: {
    specification: AppBuildSpecification;
    result: BuildTaskResult;
    providerName: string;
    selectionReason: string;
  }): string {
    const { specification, result, providerName, selectionReason } = params;

    let text = `### 🚀 AI App Builder: ${specification.title}\n\n`;

    // Provider & Status Badges
    text += `| Parameter | Details |\n`;
    text += `| :--- | :--- |\n`;
    text += `| **Selected Provider** | \`${providerName}\` |\n`;
    text += `| **Selection Rationale** | ${selectionReason} |\n`;
    text += `| **Build Status** | \`${result.status.toUpperCase()}\` — ${result.statusMessage} |\n`;
    if (result.previewUrl) {
      text += `| **Live Preview URL** | [🔗 Open Application Preview](${result.previewUrl}) |\n`;
    }
    if (result.projectUrl) {
      text += `| **Workspace / Session URL** | [🛠️ View Project in ${providerName}](${result.projectUrl}) |\n`;
    }
    if (result.repoUrl) {
      text += `| **Source Repository** | [📂 View Repository](${result.repoUrl}) |\n`;
    }
    text += `\n---\n\n`;

    // Primary Action Callout
    if (result.continueActionUrl) {
      text += `> 👉 **Next Step (${result.continueActionLabel || 'Open Workspace'}):**  \n`;
      text += `> [**${result.continueActionLabel || 'Launch in ' + providerName}**](${result.continueActionUrl})\n\n`;
    }

    // Specification Highlights
    text += `#### 📋 Generated Architecture & Feature Brief\n`;
    text += `**Platform Target:** \`${specification.targetPlatform}\` | **Stack:** ${specification.technicalStackPreference}\n\n`;

    text += `**Included Modules:**\n`;
    text += `- **Customer-Facing UI:** ${specification.features.customerFacing[0]}\n`;
    text += `- **Authentication:** ${specification.features.authentication[0]}\n`;
    text += `- **Restaurant Listings & Search:** ${specification.features.restaurantListingsAndSearch[0]}\n`;
    text += `- **Cart & Checkout:** ${specification.features.cartAndCheckout[0]}\n`;
    text += `- **Live Order Tracking:** ${specification.features.orderStatusAndTracking[0]}\n`;
    text += `- **Admin & Restaurant Dashboard:** ${specification.features.adminAndRestaurantDashboard[0]}\n`;
    text += `- **Database & Schema:** Relational models for Users, Restaurants, MenuItems, and Orders.\n\n`;

    // Safeguard Notice
    text += `> 🛡️ **Payment & Order Safeguard:**  \n`;
    text += `> ${specification.mockPaymentNotice}\n\n`;

    // Manual steps if applicable
    if (result.manualActionsRemaining && result.manualActionsRemaining.length > 0) {
      text += `#### 🛠️ Instructions to Run & Deploy\n`;
      for (const step of result.manualActionsRemaining) {
        text += `- ${step}\n`;
      }
      text += `\n`;
    }

    // Recommended Environment Setup
    text += `#### ⚙️ Environment Configuration\n`;
    text += `\`\`\`env\n${specification.setupAndEnvVars.join('\n')}\n\`\`\`\n\n`;

    text += `*Karma will continue tracking this project. You can paste any updated Repl or deployment URL into the chat anytime to refresh preview telemetry.*`;

    return text;
  }
}

export const appBuilderService = new AppBuilderService();
