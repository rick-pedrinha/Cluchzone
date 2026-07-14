import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import type { StateRepository } from './state.repository.js';

const keySchema = z.string().regex(/^cluchzone_[a-z0-9_]{1,80}$/).refine(key => key !== 'cluchzone_auth');
const bodySchema = z.object({ value: z.unknown() }).strict();

export function createStateRouter(states: StateRepository): Router {
  const router = Router();
  router.get('/:key', async (req, res, next) => {
    try {
      const key = keySchema.parse(req.params.key);
      res.set('Cache-Control', 'no-store').json({ ok: true, key, value: await states.get(key) });
    } catch (error) {
      next(error instanceof z.ZodError ? new AppError(400, 'INVALID_STATE_KEY', 'Invalid state key.') : error);
    }
  });
  router.post('/:key', requireAuth, async (req, res, next) => {
    try {
      const key = keySchema.parse(req.params.key);
      const { value } = bodySchema.parse(req.body);
      res.json({ ok: true, key, value: await states.set(key, value) });
    } catch (error) {
      next(error instanceof z.ZodError ? new AppError(400, 'INVALID_INPUT', 'Invalid state payload.') : error);
    }
  });
  return router;
}
