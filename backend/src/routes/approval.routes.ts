import { Router } from 'express';
import type { Request, Response } from 'express';
import { approvalService } from '../services/approval.service.js';

export const approvalRouter = Router();

// GET /api/approval/pending/:sessionId?
approvalRouter.get('/pending', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  const pending = approvalService.getPending(sessionId);
  res.json({ pending });
});

// POST /api/approval/:id/respond
approvalRouter.post('/:id/respond', (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  const { decision } = req.body;

  if (decision !== 'approve' && decision !== 'reject') {
    res.status(400).json({ error: 'decision must be either "approve" or "reject"' });
    return;
  }

  const success = approvalService.respond(id, decision);
  if (!success) {
    res.status(404).json({ error: 'Approval request not found' });
    return;
  }

  res.json({ success: true, status: decision === 'approve' ? 'approved' : 'rejected' });
});

// POST /api/approval/create (for testing or manual action triggers)
approvalRouter.post('/create', (req: Request, res: Response) => {
  const { sessionId, taskId, actionType, title, description, amountINR, details } = req.body;
  if (!sessionId || !title || !actionType) {
    res.status(400).json({ error: 'sessionId, title, and actionType are required' });
    return;
  }

  const request = approvalService.createRequest({
    sessionId,
    taskId,
    actionType,
    title,
    description: description || title,
    amountINR,
    details,
  });

  res.status(201).json({ request });
});
