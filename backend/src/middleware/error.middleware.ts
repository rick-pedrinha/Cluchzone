import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next;
  const known = error instanceof AppError;
  req.log.error({ err: known ? { name: error.name, code: error.code } : error }, 'request failed');
  res.status(known ? error.statusCode : 500).json({
    ok: false,
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'An unexpected error occurred.',
    },
  });
};
