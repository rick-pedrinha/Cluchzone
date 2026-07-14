import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import { communityRegionCodes } from '../global/globalization.catalog.js';
import type { TeamRepository } from './team.types.js';

const teamIdSchema = z.string().uuid();
const createTeamSchema = z.object({
  name: z.string().trim().min(3).max(100),
  tag: z.string().trim().min(2).max(12).transform(value => value.toUpperCase()),
  description: z.string().trim().max(1000).nullable().optional(),
  region: z.enum(communityRegionCodes),
  members: z.array(z.object({
    displayName: z.string().trim().min(1).max(100),
    role: z.enum(['VICE_CAPTAIN', 'PLAYER', 'RESERVE']),
  }).strict()).max(15).default([]),
}).strict();
const messageSchema = z.object({ text: z.string().trim().min(1).max(500) }).strict();

function invalidInput(): AppError {
  return new AppError(400, 'INVALID_TEAM_INPUT', 'Invalid team request.');
}

export function createTeamRouter(teams: TeamRepository): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/mine', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store').json({ ok: true, teams: await teams.listMine(req.session.userId!) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = createTeamSchema.safeParse(req.body);
      if (!body.success) throw invalidInput();
      const team = await teams.create(req.session.userId!, {
        ...body.data,
        description: body.data.description ?? null,
      });
      res.status(201).json({ ok: true, team });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:teamId/messages', async (req, res, next) => {
    try {
      const teamId = teamIdSchema.safeParse(req.params.teamId);
      if (!teamId.success) throw invalidInput();
      res.set('Cache-Control', 'no-store').json({ ok: true, messages: await teams.listMessages(teamId.data, req.session.userId!) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:teamId/messages', async (req, res, next) => {
    try {
      const teamId = teamIdSchema.safeParse(req.params.teamId);
      const body = messageSchema.safeParse(req.body);
      if (!teamId.success || !body.success) throw invalidInput();
      const message = await teams.sendMessage(teamId.data, req.session.userId!, body.data.text);
      res.status(201).json({ ok: true, message });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
