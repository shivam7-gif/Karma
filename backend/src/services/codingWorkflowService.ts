import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { workspaceService, type WorkspaceFileContent } from './workspaceService.js';
import { terminalService } from './terminalService.js';
import { callAgentLLM } from '../agent/orchestrator/llmHelper.js';
import { logger } from '../lib/logger.js';

export interface PatchProposal {
  patchId: string;
  taskId: string;
  filePath: string;
  description: string;
  originalHash: string;
  originalContent: string;
  proposedContent: string;
  diff: string;
  status: 'pending' | 'applied' | 'rejected';
  createdAt: string;
}

export interface CodingWorkflowResult {
  taskId: string;
  plan: string;
  proposals: PatchProposal[];
  investigatorReport: string;
  reviewerNotes?: string;
  testPassed?: boolean;
  testOutput?: string;
  error?: string;
}

export class CodingWorkflowService {
  private patches: Map<string, PatchProposal> = new Map();

  generateDiff(original: string, proposed: string, filePath: string): string {
    const origLines = original.split('\n');
    const propLines = proposed.split('\n');
    const diffLines: string[] = [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      `@@ -1,${origLines.length} +1,${propLines.length} @@`,
    ];

    const max = Math.max(origLines.length, propLines.length);
    for (let i = 0; i < max; i++) {
      const o = origLines[i];
      const p = propLines[i];
      if (o === p) {
        if (o !== undefined) diffLines.push(` ${o}`);
      } else {
        if (o !== undefined) diffLines.push(`-${o}`);
        if (p !== undefined) diffLines.push(`+${p}`);
      }
    }
    return diffLines.join('\n');
  }

  async runCodingWorkflow(
    taskId: string,
    prompt: string,
    options?: {
      targetFiles?: string[];
      activeCodeSnippet?: string;
      onProgress?: (msg: string) => void;
      autoRunTests?: boolean;
    }
  ): Promise<CodingWorkflowResult> {
    const notify = (msg: string) => options?.onProgress?.(msg);
    notify('Step 1: Inspecting project architecture and dependencies...');

    const projectScan = await workspaceService.scanProject();
    let relevantFilesContent = '';
    const filesToRead = options?.targetFiles || [];

    for (const f of filesToRead) {
      try {
        const fileData = await workspaceService.readFile(f);
        relevantFilesContent += `\n--- File: ${f} (SHA256: ${fileData.hash.slice(0, 8)}) ---\n${fileData.content.slice(0, 4000)}\n`;
      } catch (err) {
        logger.warn({ err, file: f }, 'Could not read target file for workflow');
      }
    }

    if (options?.activeCodeSnippet) {
      relevantFilesContent += `\n--- User Active Selection / Snippet ---\n${options.activeCodeSnippet}\n`;
    }

    // Role 1: Investigator Agent
    notify('Step 2: Investigator agent analyzing problem and designing implementation plan...');
    const investigatorPrompt = `You are the Lead Investigator Agent in Karma's Coding Engine.
Project Stack: ${projectScan.stack.join(', ') || 'Node/TypeScript'}
Task Description: "${prompt}"

Context Files:
${relevantFilesContent || 'No explicit files provided. Determine target files from task.'}

Analyze the problem. Output your response with:
1. Executive Summary & Root Cause
2. Targeted File List (workspace-relative paths)
3. Step-by-Step Implementation Strategy`;

    const investigatorResp = await callAgentLLM(
      [{ role: 'system', content: 'You are Karma Lead Investigator Agent.' }, { role: 'user', content: investigatorPrompt }],
      undefined,
      { temperature: 0.1 }
    );
    const investigatorReport = investigatorResp.text;

    // Role 2: Implementer Agent
    notify('Step 3: Implementer agent generating targeted patch proposals...');
    const implementerPrompt = `You are the Implementer Agent in Karma's Coding Engine.
Investigation Plan:
${investigatorReport}

Task: "${prompt}"
Context:
${relevantFilesContent}

Generate the exact replacement code or new file content.
You MUST format every proposed file edit within a structured block:
<<<FILE: workspace-relative/path.ext>>>
[Full replacement content here]
<<<END_FILE>>>

Only generate modifications that directly address the task.`;

    const implementerResp = await callAgentLLM(
      [{ role: 'system', content: 'You are Karma Implementer Agent. Generate clean, robust code.' }, { role: 'user', content: implementerPrompt }],
      undefined,
      { temperature: 0.1 }
    );

    // Extract proposed files
    const proposals: PatchProposal[] = [];
    const fileRegex = /<<<FILE:\s*([^\n>]+)>>>([\s\S]*?)<<<END_FILE>>>/g;
    let match: RegExpExecArray | null;

    while ((match = fileRegex.exec(implementerResp.text)) !== null) {
      const relPath = match[1].trim();
      const proposedContent = match[2].trimStart();

      let originalContent = '';
      let originalHash = '';

      try {
        const existing = await workspaceService.readFile(relPath);
        originalContent = existing.content;
        originalHash = existing.hash;
      } catch {
        originalContent = '';
        originalHash = workspaceService.computeHash('');
      }

      const diff = this.generateDiff(originalContent, proposedContent, relPath);
      const patchId = `patch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const proposal: PatchProposal = {
        patchId,
        taskId,
        filePath: relPath,
        description: `Patch for ${relPath} (${prompt.slice(0, 60)})`,
        originalHash,
        originalContent,
        proposedContent,
        diff,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      this.patches.set(patchId, proposal);
      proposals.push(proposal);
    }

    // Role 3: Reviewer Agent
    notify('Step 4: Reviewer agent evaluating patch safety and edge cases...');
    const reviewerPrompt = `You are Karma's Senior Code Reviewer.
Review the following proposed patches:
${proposals.map((p) => `File: ${p.filePath}\nDiff:\n${p.diff.slice(0, 1500)}`).join('\n\n')}

Verify:
- Correctness & edge-case handling
- No syntax errors, accidental deletions, or security bypasses
- Summary for user approval`;

    const reviewerResp = await callAgentLLM(
      [{ role: 'system', content: 'You are Karma Senior Code Reviewer.' }, { role: 'user', content: reviewerPrompt }],
      undefined,
      { temperature: 0.1 }
    );

    let testOutput: string | undefined;
    let testPassed: boolean | undefined;

    // Optional Bounded Repair / Test Check
    if (options?.autoRunTests && projectScan.testCommand) {
      notify(`Step 5: Executing project test suite via ${projectScan.testCommand}...`);
      try {
        const proc = terminalService.startProcess(projectScan.testCommand);
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            terminalService.stopProcess(proc.processId);
            resolve();
          }, 20000);

          const checkDone = setInterval(() => {
            if (proc.exitCode !== null) {
              clearInterval(checkDone);
              clearTimeout(timeout);
              resolve();
            }
          }, 500);
        });

        testPassed = proc.exitCode === 0;
        testOutput = proc.outputBuffer.slice(-15).join('\n');
      } catch (err: unknown) {
        testPassed = false;
        testOutput = err instanceof Error ? err.message : String(err);
      }
    }

    notify('Coding workflow completed. Ready for user diff review.');

    return {
      taskId,
      plan: investigatorReport,
      proposals,
      investigatorReport,
      reviewerNotes: reviewerResp.text,
      testPassed,
      testOutput,
    };
  }

  getPatch(patchId: string): PatchProposal | null {
    return this.patches.get(patchId) || null;
  }

  listPatchesForTask(taskId: string): PatchProposal[] {
    return Array.from(this.patches.values()).filter((p) => p.taskId === taskId);
  }

  async applyPatch(patchId: string): Promise<{ success: boolean; hash: string }> {
    const proposal = this.patches.get(patchId);
    if (!proposal) {
      throw new Error(`Patch ${patchId} not found`);
    }

    if (proposal.status === 'applied') {
      throw new Error(`Patch ${patchId} has already been applied`);
    }

    const result = await workspaceService.writeFile(
      proposal.filePath,
      proposal.proposedContent,
      proposal.originalHash
    );

    proposal.status = 'applied';
    logger.info({ patchId, file: proposal.filePath }, 'Patch successfully applied to workspace');
    return result;
  }

  rejectPatch(patchId: string): boolean {
    const proposal = this.patches.get(patchId);
    if (!proposal) return false;
    proposal.status = 'rejected';
    return true;
  }
}

export const codingWorkflowService = new CodingWorkflowService();
