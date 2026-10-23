import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '../lib/auth.js';
import { workspaceService } from '../services/workspaceService.js';
import { codingWorkflowService } from '../services/codingWorkflowService.js';
import { terminalService } from '../services/terminalService.js';
import { logger } from '../lib/logger.js';

export const vscodeRouter = Router();
vscodeRouter.use(authMiddleware);

export const PROTOCOL_VERSION = '1.0.0';

interface VscodeSession {
  sessionId: string;
  connectedAt: string;
  workspaceRoot: string;
  activeFile?: string;
  diagnostics?: Array<{ file: string; line: number; message: string; severity: string }>;
}

const activeSessions: Map<string, VscodeSession> = new Map();
const taskProgressEmitters: Map<string, Array<(event: Record<string, unknown>) => void>> = new Map();

function pathSanitize(p: string): string {
  return p.replace(/\\/g, '/');
}

// 1. Handshake & Protocol Version Check
vscodeRouter.post('/handshake', async (req: Request, res: Response) => {
  const { clientVersion, workspaceRoot, clientName } = req.body;

  const sessionId = `vsc_sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const root = workspaceRoot ? pathSanitize(workspaceRoot) : workspaceService.getRoot();

  if (workspaceRoot && workspaceService.setRoot(workspaceRoot)) {
    logger.info({ workspaceRoot }, 'Synchronized workspace root from VS Code');
  }

  const projectScan = await workspaceService.scanProject();

  const session: VscodeSession = {
    sessionId,
    connectedAt: new Date().toISOString(),
    workspaceRoot: workspaceService.getRoot(),
  };
  activeSessions.set(sessionId, session);

  res.json({
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    status: 'connected',
    serverTime: new Date().toISOString(),
    workspace: {
      root: session.workspaceRoot,
      projectName: projectScan.name,
      stack: projectScan.stack,
      scripts: projectScan.scripts,
    },
    capabilities: [
      'workspace_tree',
      'file_sync',
      'patch_review',
      'diff_generation',
      'task_streaming',
      'diagnostics_feedback',
    ],
  });
});

// 2. Sync Active Context (File, Cursor, Diagnostics)
vscodeRouter.post('/context/sync', (req: Request, res: Response) => {
  const { sessionId, activeFile, selectedText, diagnostics } = req.body;
  const session = activeSessions.get(sessionId);

  if (session) {
    if (activeFile) session.activeFile = activeFile;
    if (diagnostics) session.diagnostics = diagnostics;
  }

  res.json({
    success: true,
    sessionId,
    synced: {
      activeFile: session?.activeFile,
      diagnosticsCount: session?.diagnostics?.length || 0,
    },
  });
});

// 3. Dispatch Coding Task (Explain, Fix, Refactor, Generate Tests, or Custom Prompt)
vscodeRouter.post('/task/start', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      actionType,
      activeFile,
      selectedText,
      diagnostics,
      autoRunTests,
    } = req.body;

    if (!prompt && !actionType) {
      res.status(400).json({ error: 'Prompt or actionType is required' });
      return;
    }

    const taskId = `vsc_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    taskProgressEmitters.set(taskId, []);

    let composedPrompt = prompt || '';
    if (actionType) {
      switch (actionType) {
        case 'explain':
          composedPrompt = `Explain this code snippet in depth, identifying potential pitfalls:\n${selectedText}`;
          break;
        case 'fix':
          composedPrompt = `Fix the errors in ${activeFile || 'the code'}. Diagnostics:\n${JSON.stringify(diagnostics || [])}\nSnippet:\n${selectedText}`;
          break;
        case 'refactor':
          composedPrompt = `Refactor the following selection for better readability, performance, and adherence to clean architecture:\n${selectedText}`;
          break;
        case 'tests':
          composedPrompt = `Generate comprehensive unit tests for this code:\n${selectedText || activeFile}`;
          break;
        case 'review':
          composedPrompt = `Review recent changes and highlight bugs, anti-patterns, or missing tests.`;
          break;
      }
    }

    // Fire asynchronous workflow execution
    setTimeout(async () => {
      try {
        const emitProgress = (msg: string) => {
          const listeners = taskProgressEmitters.get(taskId) || [];
          for (const listener of listeners) {
            listener({ type: 'progress', message: msg, timestamp: new Date().toISOString() });
          }
        };

        const workflowOpts: { targetFiles?: string[]; activeCodeSnippet?: string; onProgress?: (msg: string) => void; autoRunTests?: boolean } = {
          onProgress: emitProgress,
          autoRunTests: !!autoRunTests,
        };
        if (activeFile) workflowOpts.targetFiles = [activeFile];
        if (selectedText) workflowOpts.activeCodeSnippet = selectedText;

        const result = await codingWorkflowService.runCodingWorkflow(taskId, composedPrompt, workflowOpts);

        const listeners = taskProgressEmitters.get(taskId) || [];
        for (const listener of listeners) {
          listener({
            type: 'done',
            taskId,
            plan: result.plan,
            proposals: result.proposals,
            reviewerNotes: result.reviewerNotes,
            testPassed: result.testPassed,
            testOutput: result.testOutput,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const listeners = taskProgressEmitters.get(taskId) || [];
        for (const listener of listeners) {
          listener({ type: 'error', error: msg });
        }
      }
    }, 10);

    res.json({
      taskId,
      status: 'started',
      streamUrl: `/api/vscode/task/stream/${taskId}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 4. SSE Stream for Task Progress and Proposals
vscodeRouter.get('/task/stream/:taskId', (req: Request, res: Response) => {
  const taskId = String(req.params.taskId || '');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const listener = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'done' || event.type === 'error') {
      res.end();
    }
  };

  const listeners = taskProgressEmitters.get(taskId) || [];
  listeners.push(listener);
  taskProgressEmitters.set(taskId, listeners);

  req.on('close', () => {
    const current = taskProgressEmitters.get(taskId) || [];
    taskProgressEmitters.set(taskId, current.filter((l) => l !== listener));
  });
});

// 5. Apply or Reject Proposed Patch
vscodeRouter.post('/patch/apply', async (req: Request, res: Response) => {
  try {
    const { patchId } = req.body;
    if (!patchId) {
      res.status(400).json({ error: 'Field "patchId" is required' });
      return;
    }

    const result = await codingWorkflowService.applyPatch(patchId);
    res.json({
      success: true,
      patchId,
      newHash: result.hash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('Stale write') ? 409 : 400;
    res.status(status).json({ error: msg });
  }
});

vscodeRouter.post('/patch/reject', (req: Request, res: Response) => {
  const { patchId } = req.body;
  if (!patchId) {
    res.status(400).json({ error: 'Field "patchId" is required' });
    return;
  }
  const ok = codingWorkflowService.rejectPatch(patchId);
  res.json({ success: ok, patchId });
});

// 6. Diagnostics & Test Results Return to Session
vscodeRouter.post('/diagnostics/report', (req: Request, res: Response) => {
  const { sessionId, diagnostics, testResults } = req.body;
  const session = activeSessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  session.diagnostics = diagnostics;
  logger.info({ sessionId, count: diagnostics?.length }, 'Received diagnostics from VS Code');
  res.json({ success: true, count: diagnostics?.length || 0 });
});
