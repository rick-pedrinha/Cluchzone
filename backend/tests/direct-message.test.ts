import express from 'express';
import session from 'express-session';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { SteamFriendProfile, SteamFriendsService } from '../src/friends/steam-friends.service.js';
import { createDirectMessageRouter } from '../src/messages/direct-message.router.js';
import type { DirectMessageRepository, DirectMessageView } from '../src/messages/direct-message.types.js';
import { errorHandler, notFound } from '../src/middleware/error.middleware.js';
import type { PublicUser, SteamProfileInput, UserPreferencesInput, UserRepository } from '../src/users/user.types.js';

const currentId = '10000000-0000-4000-8000-000000000001';
const friendId = '10000000-0000-4000-8000-000000000002';
const currentSteamId = '76561198000000000';
const friendSteamId = '76561198000000001';

function user(id: string, steamId64: string, displayName: string): PublicUser {
  const now = new Date('2026-07-15T00:00:00.000Z');
  return {
    id, steamId64, displayName, avatarUrl: null,
    profileUrl: `https://steamcommunity.com/profiles/${steamId64}/`,
    steamLevel: null, visibilityState: 3, profileState: 1, personaState: 1,
    countryCode: 'BR', stateCode: null, steamCreatedAt: null, lastLogoffAt: null,
    role: 'PLAYER', status: 'ACTIVE', showcaseVisible: true,
    preferredLocale: null, timeZone: null, currencyCode: null, regionCode: null,
    lastLoginAt: now, createdAt: now, updatedAt: now,
  };
}

class MemoryUsers implements UserRepository {
  private readonly users = new Map([
    [currentId, user(currentId, currentSteamId, 'Current Player')],
    [friendId, user(friendId, friendSteamId, 'Steam Friend')],
  ]);
  async upsertFromSteam(profile: SteamProfileInput): Promise<PublicUser> { void profile; throw new Error('not used'); }
  async findById(id: string): Promise<PublicUser | null> { return this.users.get(id) ?? null; }
  async findActiveBySteamIds(ids: string[]): Promise<PublicUser[]> { return [...this.users.values()].filter(item => ids.includes(item.steamId64)); }
  async findActiveByDisplayName(name: string): Promise<PublicUser | null> { return [...this.users.values()].find(item => item.displayName === name) ?? null; }
  async updateShowcaseVisibility(id: string, visible: boolean): Promise<PublicUser | null> { void id; void visible; throw new Error('not used'); }
  async updatePreferences(id: string, input: UserPreferencesInput): Promise<PublicUser | null> { void id; void input; throw new Error('not used'); }
}

class MemoryMessages implements DirectMessageRepository {
  senderId: string | null = null;
  peerId: string | null = null;
  async listConversation(userId: string, peerId: string): Promise<DirectMessageView[]> {
    this.senderId = userId; this.peerId = peerId; return [];
  }
  async sendMessage(senderId: string, recipientId: string, text: string): Promise<DirectMessageView> {
    this.senderId = senderId; this.peerId = recipientId;
    return { id: '20000000-0000-4000-8000-000000000001', senderId, recipientId, displayName: 'Current Player', avatarUrl: null, text, createdAt: new Date() };
  }
}

class FakeSteamFriends implements SteamFriendsService {
  constructor(private readonly isFriend = true) {}
  async listFriends(): Promise<SteamFriendProfile[]> {
    return this.isFriend ? [{ steamId64: friendSteamId, displayName: 'Steam Friend', avatarUrl: null, profileUrl: `https://steamcommunity.com/profiles/${friendSteamId}/`, personaState: 1, friendSince: null }] : [];
  }
}

function app(messages = new MemoryMessages(), steamFriends = new FakeSteamFriends()) {
  const target = express();
  target.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  target.use(express.json());
  target.use(session({ secret: 'direct-message-tests-secret-long-enough', resave: false, saveUninitialized: false }));
  target.post('/test-login/:userId', (req, res) => { req.session.userId = req.params.userId; res.sendStatus(204); });
  target.use('/api/messages', createDirectMessageRouter(new MemoryUsers(), messages, steamFriends));
  target.use(notFound);
  target.use(errorHandler);
  return target;
}

describe('Steam friend direct messages', () => {
  it('requires an authenticated Steam session', async () => {
    expect((await request(app()).get(`/api/messages/${friendId}`)).status).toBe(401);
  });

  it('uses the session identity and keeps the conversation inside Clutchzone', async () => {
    const messages = new MemoryMessages();
    const agent = request.agent(app(messages));
    await agent.post(`/test-login/${currentId}`);
    const response = await agent
      .post(`/api/messages/${friendId}?senderId=attacker`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'Fala pelo CLUTCHZONE!' }));
    expect(response.status).toBe(201);
    expect(messages.senderId).toBe(currentId);
    expect(messages.peerId).toBe(friendId);
  });

  it('rejects messages to users who are not Steam friends', async () => {
    const agent = request.agent(app(new MemoryMessages(), new FakeSteamFriends(false)));
    await agent.post(`/test-login/${currentId}`);
    expect((await agent
      .post(`/api/messages/${friendId}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'Olá' }))).status).toBe(403);
  });
});
