import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.'));
    return;
  }
  next();
}
