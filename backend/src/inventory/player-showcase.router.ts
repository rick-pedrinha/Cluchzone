import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../users/user.types.js';
import {
  STEAM_INVENTORY_GAMES,
  type SteamGameInventoryService,
} from './cs2-inventory.service.js';

const paramsSchema = z.object({
  userId: z.string().trim().min(1).max(100),
  game: z.enum(['cs2', 'pubg']),
});
const visibilitySchema = z.object({ visible: z.boolean() }).strict();

export function createPlayerShowcaseRouter(
  users: UserRepository,
  inventory: SteamGameInventoryService,
): Router {
  const router = Router();

  router.get('/me/showcase-visibility', requireAuth, async (req, res, next) => {
    try {
      const user = await users.findById(req.session.userId!);
      if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'INVALID_SESSION', 'The session is no longer valid.');
      res.set('Cache-Control', 'no-store').json({ ok: true, visible: user.showcaseVisible });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/me/showcase-visibility', requireAuth, async (req, res, next) => {
    try {
      const parsed = visibilitySchema.safeParse(req.body);
      if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Invalid showcase visibility.');
      const user = await users.updateShowcaseVisibility(req.session.userId!, parsed.data.visible);
      if (!user) throw new AppError(401, 'INVALID_SESSION', 'The session is no longer valid.');
      res.set('Cache-Control', 'no-store').json({ ok: true, visible: user.showcaseVisible });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:userId/showcases/:game/inventory', async (req, res, next) => {
    try {
      const parsed = paramsSchema.safeParse(req.params);
      if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Invalid player showcase request.');
      const { userId, game } = parsed.data;
      const user = await users.findById(userId);
      if (!user || user.status !== 'ACTIVE') {
        throw new AppError(404, 'PLAYER_NOT_FOUND', 'Player profile was not found.');
      }

      if (!user.showcaseVisible) {
        res.set('Cache-Control', 'no-store').json({
          ok: true,
          showcaseVisible: false,
          highlights: [],
        });
        return;
      }

      const result = await inventory.getPublicGameInventory(user.steamId64, game);
      const highlights = await inventory.getPublicGameHighlights(result.items, game);
      const gameDefinition = STEAM_INVENTORY_GAMES[game];
      res.set('Cache-Control', 'no-store').json({
        ok: true,
        game: {
          key: gameDefinition.key,
          name: gameDefinition.name,
          shortName: gameDefinition.shortName,
          appId: gameDefinition.appId,
        },
        showcaseVisible: true,
        player: {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          profileUrl: user.profileUrl,
          steamLevel: user.steamLevel,
          personaState: user.personaState,
        },
        showcaseAvailable: highlights.length === 4,
        highlights,
        inventory: result,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
