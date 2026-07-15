import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import type { SteamFriendsService } from '../friends/steam-friends.service.js';
import type { UserRepository } from '../users/user.types.js';
import type { DirectMessageRepository } from './direct-message.types.js';

const peerIdSchema = z.string().uuid();
const messageSchema = z.object({ text: z.string().trim().min(1).max(500) }).strict();

export function createDirectMessageRouter(
  users: UserRepository,
  messages: DirectMessageRepository,
  steamFriends: SteamFriendsService,
): Router {
  const router = Router();
  router.use(requireAuth);

  async function requireSteamContact(userId: string, peerId: string): Promise<void> {
    if (userId === peerId) throw new AppError(400, 'INVALID_MESSAGE_TARGET', 'Choose another player.');
    const [currentUser, peer] = await Promise.all([users.findById(userId), users.findById(peerId)]);
    if (!currentUser || currentUser.status !== 'ACTIVE') {
      throw new AppError(401, 'INVALID_SESSION', 'The session is no longer valid.');
    }
    if (!peer || peer.status !== 'ACTIVE') {
      throw new AppError(404, 'CONTACT_NOT_AVAILABLE', 'This Steam friend has not joined Clutchzone yet.');
    }
    const friends = await steamFriends.listFriends(currentUser.steamId64);
    if (!friends.some(friend => friend.steamId64 === peer.steamId64)) {
      throw new AppError(403, 'STEAM_FRIEND_REQUIRED', 'Direct messages are available only between Steam friends.');
    }
  }

  router.get('/:peerId', async (req, res, next) => {
    try {
      const peerId = peerIdSchema.safeParse(req.params.peerId);
      if (!peerId.success) throw new AppError(400, 'INVALID_MESSAGE_TARGET', 'Invalid message target.');
      await requireSteamContact(req.session.userId!, peerId.data);
      const conversation = await messages.listConversation(req.session.userId!, peerId.data);
      res.set('Cache-Control', 'no-store').json({ ok: true, messages: conversation });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:peerId', async (req, res, next) => {
    try {
      const peerId = peerIdSchema.safeParse(req.params.peerId);
      const body = messageSchema.safeParse(req.body);
      if (!peerId.success || !body.success) throw new AppError(400, 'INVALID_MESSAGE_INPUT', 'Invalid message request.');
      await requireSteamContact(req.session.userId!, peerId.data);
      const message = await messages.sendMessage(req.session.userId!, peerId.data, body.data.text);
      res.status(201).json({ ok: true, message });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
