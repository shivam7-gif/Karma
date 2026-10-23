import { Router } from 'express';
import type { Request, Response } from 'express';
import { terminalService } from '../services/terminalService.js';
import { authMiddleware } from '../lib/auth.js';

export const terminalRouter = Router();
terminalRouter.use(authMiddleware);

// 1. Run Command in Integrated Terminal
terminalRouter.post('/run', (req: Request, res: Response) => {
  try {
    const { command, cwd } = req.body;
    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: 'Field "command" is required' });
      return;
    }

    const proc = terminalService.startProcess(command, { cwd });
    res.json({
      processId: proc.processId,
      command: proc.command,
      startTime: proc.startTime,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// 2. List Processes
terminalRouter.get('/list', (_req: Request, res: Response) => {
  const processes = terminalService.listProcesses();
  res.json({ processes });
});

// 3. Send Input to Process (stdin)
terminalRouter.post('/input', (req: Request, res: Response) => {
  const { processId, input } = req.body;
  if (!processId || input === undefined) {
    res.status(400).json({ error: 'Fields "processId" and "input" are required' });
    return;
  }
  const ok = terminalService.sendInput(processId, input);
  if (!ok) {
    res.status(404).json({ error: 'Process not found or already terminated' });
    return;
  }
  res.json({ success: true });
});

// 4. Stop Process
terminalRouter.post('/stop', (req: Request, res: Response) => {
  const { processId } = req.body;
  if (!processId) {
    res.status(400).json({ error: 'Field "processId" is required' });
    return;
  }
  const ok = terminalService.stopProcess(processId);
  if (!ok) {
    res.status(404).json({ error: 'Process not found or already terminated' });
    return;
  }
  res.json({ success: true });
});

// 5. SSE Output Stream
terminalRouter.get('/stream/:processId', (req: Request, res: Response) => {
  const processId = String(req.params.processId || '');
  const proc = terminalService.getProcess(processId);

  if (!proc) {
    res.status(404).json({ error: 'Process not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial buffer
  for (const line of proc.outputBuffer) {
    res.write(`data: ${JSON.stringify({ type: 'history', data: line })}\n\n`);
  }

  // If already exited, send exit and close
  if (proc.exitCode !== null) {
    res.write(`data: ${JSON.stringify({ type: 'exit', data: `Exited with code ${proc.exitCode}` })}\n\n`);
    res.end();
    return;
  }

  const listener = (chunk: { type: 'stdout' | 'stderr' | 'exit'; data: string }) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    if (chunk.type === 'exit') {
      res.end();
    }
  };

  proc.listeners.push(listener);

  req.on('close', () => {
    proc.listeners = proc.listeners.filter((l) => l !== listener);
  });
});
