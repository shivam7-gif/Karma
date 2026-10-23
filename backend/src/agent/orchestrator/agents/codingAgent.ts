import path from 'node:path';
import type { AgentContext, AgentResult } from '../types.js';
import { workspaceService } from '../../../services/workspaceService.js';
import { codingWorkflowService } from '../../../services/codingWorkflowService.js';
import { callAgentLLM } from '../llmHelper.js';
import { logger } from '../../../lib/logger.js';

export async function runCodingAgent(ctx: AgentContext): Promise<AgentResult> {
  const { task, signal, onActivity, dependencyResults } = ctx;
  onActivity('Validating workspace boundaries and scanning project...');

  if (signal.aborted) {
    throw new Error('Coding task cancelled');
  }

  // 1. Scan project architecture
  const projectScan = await workspaceService.scanProject();

  // 2. Identify referenced files in task description
  const fileMatches = task.description.match(/[\w./\\-]+\.(?:ts|tsx|js|jsx|json|md|css|html|py)/g) || [];
  const safeFiles: string[] = [];

  for (const relPath of fileMatches) {
    if (!workspaceService.isPathSafe(relPath)) {
      return {
        success: false,
        output: `Security Violation: Target path is outside workspace sandbox: ${relPath}`,
        error: 'ACCESS_DENIED_SANDBOX',
      };
    }
    safeFiles.push(relPath);
  }

  // 3. Compile context from dependency results
  let dependencyContext = '';
  if (dependencyResults.size > 0) {
    dependencyContext += '\nContext from prior investigation/research tasks:\n';
    for (const [depId, res] of dependencyResults.entries()) {
      dependencyContext += `[Task ${depId}]: ${res}\n`;
    }
  }

  onActivity('Invoking Coding Engine (Investigator -> Implementer -> Reviewer)...');

  try {
    const workflowOptions: { targetFiles?: string[]; onProgress?: (msg: string) => void } = {
      onProgress: (msg: string) => onActivity(msg),
    };
    if (safeFiles.length > 0) {
      workflowOptions.targetFiles = safeFiles;
    }

    const workflow = await codingWorkflowService.runCodingWorkflow(
      task.taskId,
      `${task.description}\n${dependencyContext}`,
      workflowOptions
    );

    let outputSummary = `### Coding Engine Execution Summary\n\n`;
    outputSummary += `**Investigator Plan:**\n${workflow.plan}\n\n`;

    if (workflow.proposals.length > 0) {
      outputSummary += `**Proposed Patches (${workflow.proposals.length}):**\n`;
      for (const p of workflow.proposals) {
        outputSummary += `- **${p.filePath}** (Patch ID: \`${p.patchId}\`)\n\`\`\`diff\n${p.diff.slice(0, 1000)}\n\`\`\`\n`;
      }
    }

    if (workflow.reviewerNotes) {
      outputSummary += `\n**Reviewer Notes:**\n${workflow.reviewerNotes}\n`;
    }

    return {
      success: true,
      output: outputSummary,
      metadata: {
        filesInspected: safeFiles,
        proposalsCount: workflow.proposals.length,
        patchIds: workflow.proposals.map((p) => p.patchId),
        stack: projectScan.stack,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, taskId: task.taskId }, 'Coding workflow execution failed');
    return {
      success: false,
      output: `Coding Engine failed: ${msg}`,
      error: 'CODING_WORKFLOW_ERROR',
    };
  }
}
