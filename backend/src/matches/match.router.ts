import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../users/user.types.js';
import { platformRegions, type ActorRole, type MatchRepository } from './match.types.js';
import {
  serverCommandTypes,
  type Cs2ServerControl,
} from './cs2-server.types.js';

const matchIdSchema = z.string().uuid();
const participantSchema = z.object({
  userId: z.string().uuid(),
  teamRef: z.string().trim().min(1).max(100),
  role: z.enum(['PLAYER', 'CAPTAIN', 'COACH']),
}).strict();
const createSchema = z.object({
  tournamentRef: z.string().trim().min(1).max(100).nullable().optional(),
  format: z.enum(['BEST_OF_1', 'BEST_OF_3']),
  scheduledAt: z.iso.datetime(),
  participants: z.array(participantSchema).min(2).max(64),
}).strict();
const latencySchema = z.object({
  samples: z.array(z.object({
    regionCode: z.enum(platformRegions),
    latencyMs: z.number().int().min(1).max(2000),
  }).strict()).length(platformRegions.length),
}).strict().superRefine((value, context) => {
  const regions = new Set(value.samples.map(sample => sample.regionCode));
  if (regions.size !== platformRegions.length) context.addIssue({ code: 'custom', message: 'Every platform region must be measured exactly once.' });
});
const idempotencySchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const serverCommandSchema = z.object({ type: z.enum(serverCommandTypes) }).strict();

function validationError(): AppError {
  return new AppError(400, 'INVALID_MATCH_INPUT', 'Invalid match request.');
}

async function loadActor(users: UserRepository, userId: string): Promise<{ id: string; role: ActorRole }> {
  const user = await users.findById(userId);
  if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return { id: user.id, role: user.role };
}

export function createMatchRouter(
  users: UserRepository,
  matches: MatchRepository,
  cs2Servers?: Cs2ServerControl,
): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/', async (req, res, next) => {
    try {
      const actor = await loadActor(users, req.session.userId!);
      if (actor.role !== 'ORGANIZER' && actor.role !== 'ADMIN') {
        throw new AppError(403, 'MATCH_CREATION_FORBIDDEN', 'Only organizers and administrators can create matches.');
      }
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) throw validationError();
      const match = await matches.create({
        tournamentRef: parsed.data.tournamentRef ?? null,
        createdById: actor.id,
        format: parsed.data.format,
        scheduledAt: new Date(parsed.data.scheduledAt),
        participants: parsed.data.participants,
      });
      res.status(201).json({ ok: true, match });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:matchId', async (req, res, next) => {
    try {
      const matchId = matchIdSchema.safeParse(req.params.matchId);
      if (!matchId.success) throw validationError();
      const actor = await loadActor(users, req.session.userId!);
      const match = await matches.findAuthorized(matchId.data, actor.id, actor.role);
      res.set('Cache-Control', 'no-store').json({ ok: true, match });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:matchId/ping', async (req, res, next) => {
    try {
      const matchId = matchIdSchema.safeParse(req.params.matchId);
      const body = latencySchema.safeParse(req.body);
      if (!matchId.success || !body.success) throw validationError();
      const actor = await loadActor(users, req.session.userId!);
      const match = await matches.recordLatencies(matchId.data, actor.id, body.data.samples);
      res.json({ ok: true, match });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:matchId/check-in', async (req, res, next) => {
    try {
      const matchId = matchIdSchema.safeParse(req.params.matchId);
      if (!matchId.success) throw validationError();
      const actor = await loadActor(users, req.session.userId!);
      const match = await matches.checkIn(matchId.data, actor.id);
      res.json({ ok: true, match });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:matchId/provision', async (req, res, next) => {
    try {
      const matchId = matchIdSchema.safeParse(req.params.matchId);
      const idempotencyKey = idempotencySchema.safeParse(req.get('Idempotency-Key'));
      if (!matchId.success || !idempotencyKey.success) throw validationError();
      const actor = await loadActor(users, req.session.userId!);
      const match = await matches.requestProvision(matchId.data, actor.id, actor.role, idempotencyKey.data);
      res.status(202).json({ ok: true, match });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:matchId/room', async (req, res, next) => {
    try {
      if (!cs2Servers) {
        throw new AppError(503, 'CS2_AUTOMATION_UNAVAILABLE', 'CS2 server automation is not configured.');
      }
      const matchId = matchIdSchema.safeParse(req.params.matchId);
      if (!matchId.success) throw validationError();
      const actor = await loadActor(users, req.session.userId!);
      const room = await cs2Servers.getRoom(matchId.data, actor.id, actor.role);
      res.set('Cache-Control', 'no-store').json({ ok: true, room });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:matchId/server/actions', async (req, res, next) => {
    try {
      if (!cs2Servers) {
        throw new AppError(503, 'CS2_AUTOMATION_UNAVAILABLE', 'CS2 server automation is not configured.');
      }
      const matchId = matchIdSchema.safeParse(req.params.matchId);
      const body = serverCommandSchema.safeParse(req.body);
      const idempotencyKey = idempotencySchema.safeParse(req.get('Idempotency-Key'));
      if (!matchId.success || !body.success || !idempotencyKey.success) throw validationError();
      const actor = await loadActor(users, req.session.userId!);
      const command = await cs2Servers.requestCommand(
        matchId.data,
        actor.id,
        actor.role,
        body.data.type,
        idempotencyKey.data,
      );
      res.status(202).json({ ok: true, command });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
