import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../users/user.types.js';
import type { SteamFriendsService } from './steam-friends.service.js';

export function createSteamFriendsRouter(users: UserRepository, steam: SteamFriendsService): Router {
  const router = Router();

  router.get('/steam', requireAuth, async (req, res, next) => {
    try {
      const currentUser = await users.findById(req.session.userId!);
      if (!currentUser || currentUser.status !== 'ACTIVE') {
        throw new AppError(401, 'INVALID_SESSION', 'The session is no longer valid.');
      }
      const friends = await steam.listFriends(currentUser.steamId64);
      const members = await users.findActiveBySteamIds(friends.map(friend => friend.steamId64));
      const memberBySteamId = new Map(members.map(member => [member.steamId64, member]));
      res.set('Cache-Control', 'private, max-age=60').json({
        ok: true,
        friends: friends.map(friend => {
          const member = memberBySteamId.get(friend.steamId64);
          return {
            ...friend,
            clutchzoneUser: member ? {
              id: member.id,
              displayName: member.displayName,
              avatarUrl: member.avatarUrl,
            } : null,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
