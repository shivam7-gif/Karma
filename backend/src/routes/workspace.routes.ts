import { Router } from 'express';
import type { Request, Response } from 'express';
import { workspaceService } from '../services/workspaceService.js';
import { terminalService } from '../services/terminalService.js';
import { authMiddleware } from '../lib/auth.js';

export const workspaceRouter = Router();
workspaceRouter.use(authMiddleware);

// 1. Get Workspace Tree
workspaceRouter.get('/tree', (req: Request, res: Response) => {
  try {
    const subPath = typeof req.query.path === 'string' ? req.query.path : '';
    const maxDepth = typeof req.query.depth === 'string' ? parseInt(req.query.depth, 10) : 4;
    const tree = workspaceService.getTree(subPath, maxDepth);
    res.json({
      root: workspaceService.getRoot(),
      tree,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// 2. Read File
workspaceRouter.get('/file', async (req: Request, res: Response) => {
  try {
    const filePath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!filePath) {
      res.status(400).json({ error: 'Query parameter "path" is required' });
      return;
    }
    const file = await workspaceService.readFile(filePath);
    res.json(file);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: msg });
  }
});

// 3. Write / Save File (with stale check)
workspaceRouter.post('/file', async (req: Request, res: Response) => {
  try {
    const { path: filePath, content, expectedHash } = req.body;
    if (!filePath || content === undefined) {
      res.status(400).json({ error: 'Fields "path" and "content" are required' });
      return;
    }
    const result = await workspaceService.writeFile(filePath, content, expectedHash);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('Stale write') ? 409 : 400;
    res.status(status).json({ error: msg });
  }
});

// 4. Create File or Directory
workspaceRouter.post('/create', async (req: Request, res: Response) => {
  try {
    const { path: targetPath, type } = req.body;
    if (!targetPath || !type) {
      res.status(400).json({ error: 'Fields "path" and "type" ("file"|"directory") are required' });
      return;
    }
    await workspaceService.createEntry(targetPath, type);
    res.json({ success: true, path: targetPath, type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// 5. Rename Entry
workspaceRouter.post('/rename', async (req: Request, res: Response) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      res.status(400).json({ error: 'Fields "oldPath" and "newPath" are required' });
      return;
    }
    await workspaceService.renameEntry(oldPath, newPath);
    res.json({ success: true, oldPath, newPath });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// 6. Delete Entry
workspaceRouter.post('/delete', async (req: Request, res: Response) => {
  try {
    const { path: targetPath } = req.body;
    if (!targetPath) {
      res.status(400).json({ error: 'Field "path" is required' });
      return;
    }
    const success = await workspaceService.deleteEntry(targetPath);
    res.json({ success, path: targetPath });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// 7. Git Status & Diff
workspaceRouter.get('/git/status', async (_req: Request, res: Response) => {
  const status = await workspaceService.getGitStatus();
  res.json(status);
});

workspaceRouter.get('/git/diff', async (req: Request, res: Response) => {
  const filePath = typeof req.query.path === 'string' ? req.query.path : undefined;
  const diff = await workspaceService.getGitDiff(filePath);
  res.json({ diff });
});

// 8. Root Management
workspaceRouter.get('/root', (_req: Request, res: Response) => {
  res.json({ root: workspaceService.getRoot() });
});

workspaceRouter.post('/root', (req: Request, res: Response) => {
  const { path: newRoot } = req.body;
  if (!newRoot) {
    res.status(400).json({ error: 'Field "path" is required' });
    return;
  }
  const ok = workspaceService.setRoot(newRoot);
  if (!ok) {
    res.status(400).json({ error: 'Invalid workspace path or directory does not exist' });
    return;
  }
  res.json({ success: true, root: workspaceService.getRoot() });
});

// 9. Live Preview Port Detection
workspaceRouter.get('/preview/ports', async (_req: Request, res: Response) => {
  const activePorts = await terminalService.detectLivePorts();
  res.json({ ports: activePorts });
});
