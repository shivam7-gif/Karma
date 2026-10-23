import { logger } from '../lib/logger.js';

export type ApprovalActionType =
  | 'hotel_reservation'
  | 'transport_booking'
  | 'financial_transaction'
  | 'external_message'
  | 'cart_checkout';

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  taskId?: string | undefined;
  actionType: ApprovalActionType;
  title: string;
  description: string;
  amountINR?: number | undefined;
  details: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string | undefined;
}

class ApprovalService {
  private requests: Map<string, ApprovalRequest> = new Map();
  private resolvers: Map<string, (approved: boolean) => void> = new Map();

  createRequest(data: {
    sessionId: string;
    taskId?: string | undefined;
    actionType: ApprovalActionType;
    title: string;
    description: string;
    amountINR?: number | undefined;
    details?: Record<string, unknown> | undefined;
  }): ApprovalRequest {
    const id = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const request: ApprovalRequest = {
      id,
      sessionId: data.sessionId,
      taskId: data.taskId,
      actionType: data.actionType,
      title: data.title,
      description: data.description,
      amountINR: data.amountINR,
      details: data.details || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.requests.set(id, request);
    logger.info({ approvalId: id, actionType: data.actionType, title: data.title }, 'Approval request created');
    return request;
  }

  async waitForDecision(id: string, timeoutMs = 60000): Promise<boolean> {
    const req = this.requests.get(id);
    if (!req) return false;
    if (req.status === 'approved') return true;
    if (req.status === 'rejected') return false;

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.resolvers.delete(id);
        if (req.status === 'pending') {
          req.status = 'rejected';
          req.decidedAt = new Date().toISOString();
        }
        resolve(false);
      }, timeoutMs);

      this.resolvers.set(id, (approved) => {
        clearTimeout(timer);
        this.resolvers.delete(id);
        resolve(approved);
      });
    });
  }

  respond(id: string, decision: 'approve' | 'reject'): boolean {
    const req = this.requests.get(id);
    if (!req) return false;

    req.status = decision === 'approve' ? 'approved' : 'rejected';
    req.decidedAt = new Date().toISOString();

    const resolver = this.resolvers.get(id);
    if (resolver) {
      resolver(decision === 'approve');
    }
    return true;
  }

  getPending(sessionId?: string): ApprovalRequest[] {
    const all = Array.from(this.requests.values());
    return all.filter((r) => r.status === 'pending' && (!sessionId || r.sessionId === sessionId));
  }

  getById(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }
}

export const approvalService = new ApprovalService();
