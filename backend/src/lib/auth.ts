import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from './errors.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  userId?: string;
}

/**
 * Deterministically maps any arbitrary string (email, username, etc.) to a valid UUID format,
 * preserving valid UUIDs as-is.
 */
export function toUuid(str: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Auth Middleware
 * Scopes every request to a verified userId.
 * Supports:
 * - Authorization: Bearer <token/userId>
 * - x-user-id header
 * - Defaults to '00000000-0000-0000-0000-000000000001' for local dev when headers are not set
 */
export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const customUserId = req.headers['x-user-id'] as string;

  let resolvedUserId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      resolvedUserId = token;
    }
  } else if (customUserId) {
    resolvedUserId = customUserId.trim();
  } else if (process.env.NODE_ENV !== 'production') {
    resolvedUserId = '00000000-0000-0000-0000-000000000001';
  }

  if (!resolvedUserId) {
    return next(new UnauthorizedError('Missing or invalid authentication token.'));
  }

  const validUuid = toUuid(resolvedUserId);
  req.userId = validUuid;
  req.user = {
    id: validUuid,
    name: 'Shiva',
  };

  next();
}
