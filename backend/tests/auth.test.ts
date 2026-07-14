import session from 'express-session';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { extractVerifiedSteamId, type SteamAuthService } from '../src/auth/steam-openid.service.js';
import type { AppConfig } from '../src/config/env.js';
import { AppError } from '../src/errors/app-error.js';
import type { SteamFriendProfile, SteamFriendsService } from '../src/friends/steam-friends.service.js';
import type { PublicUser, SteamProfileInput, UserRepository } from '../src/users/user.types.js';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  sessionSecret: 'test-secret-that-is-at-least-32-characters',
  steamApiKey: 'test-key',
  frontendUrl: 'http://frontend.test',
  backendUrl: 'http://backend.test',
  corsOrigins: ['http://frontend.test'],
  trustProxy: false,
};

const profile: SteamProfileInput = {
  steamId64: '76561198000000000',
  displayName: 'Safe Player',
  avatarUrl: 'https://avatars.steamstatic.com/avatar.jpg',
  profileUrl: 'https://steamcommunity.com/profiles/76561198000000000/',
  steamLevel: 42,
  visibilityState: 3,
  profileState: 1,
  personaState: 1,
  countryCode: 'BR',
  stateCode: 'SP',
  steamCreatedAt: new Date('2012-01-01T00:00:00.000Z'),
  lastLogoffAt: new Date('2026-07-14T00:00:00.000Z'),
};

class MemoryUsers implements UserRepository {
  readonly bySteamId = new Map<string, PublicUser>();
  readonly byId = new Map<string, PublicUser>();

  async upsertFromSteam(input: SteamProfileInput): Promise<PublicUser> {
    const current = this.bySteamId.get(input.steamId64);
    const now = new Date();
    const user: PublicUser = current
      ? { ...current, ...input, lastLoginAt: now, updatedAt: now }
      : { ...input, id: `user-${this.bySteamId.size + 1}`, role: 'PLAYER', status: 'ACTIVE', showcaseVisible: true, lastLoginAt: now, createdAt: now, updatedAt: now };
    this.bySteamId.set(input.steamId64, user);
    this.byId.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<PublicUser | null> {
    return this.byId.get(id) ?? null;
  }

  async findActiveBySteamIds(steamIds: string[]): Promise<PublicUser[]> {
    return steamIds.map(steamId => this.bySteamId.get(steamId)).filter((user): user is PublicUser => user?.status === 'ACTIVE');
  }

  async findActiveByDisplayName(displayName: string): Promise<PublicUser | null> {
    return [...this.byId.values()].find(user => user.status === 'ACTIVE' && user.displayName.toLowerCase() === displayName.toLowerCase()) ?? null;
  }

  async updateShowcaseVisibility(id: string, visible: boolean): Promise<PublicUser | null> {
    const user = this.byId.get(id);
    if (!user || user.status !== 'ACTIVE') return null;
    const updated = { ...user, showcaseVisible: visible, updatedAt: new Date() };
    this.byId.set(id, updated);
    this.bySteamId.set(updated.steamId64, updated);
    return updated;
  }
}

class FakeSteam implements SteamAuthService {
  constructor(private readonly result: SteamProfileInput | Error = profile) {}
  createLoginUrl(): string { return 'https://steamcommunity.com/openid/login?test=1'; }
  async verifyAndFetchProfile(): Promise<SteamProfileInput> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

class FakeSteamFriends implements SteamFriendsService {
  requestedSteamId: string | null = null;
  constructor(private readonly result: SteamFriendProfile[] | Error = []) {}
  async listFriends(steamId64: string): Promise<SteamFriendProfile[]> {
    this.requestedSteamId = steamId64;
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

function app(users = new MemoryUsers(), steam = new FakeSteam(), steamFriends = new FakeSteamFriends()) {
  return createApp({
    config,
    users,
    steam,
    steamFriends,
    sessionStore: new session.MemoryStore(),
    logger: pino({ level: 'silent' }),
  });
}

describe('Steam authentication', () => {
  it('starts the official Steam OpenID redirect without accepting an identity from the frontend', async () => {
    const response = await request(app()).get('/auth/steam?steamId64=76561198000000000');
    expect(response.status).toBe(303);
    expect(response.headers.location).toMatch(/^https:\/\/steamcommunity\.com\/openid\/login/);
  });

  it('rejects an invalid callback safely', async () => {
    const steam = new FakeSteam(new AppError(401, 'INVALID_STEAM_CALLBACK', 'Steam authentication could not be verified.'));
    const response = await request(app(new MemoryUsers(), steam)).get('/auth/steam/callback?openid.mode=id_res');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_STEAM_CALLBACK');
  });

  it('rejects unverified and malformed SteamID values', () => {
    expect(() => extractVerifiedSteamId(false, 'https://steamcommunity.com/openid/id/76561198000000000')).toThrow(AppError);
    expect(() => extractVerifiedSteamId(true, 'https://evil.test/openid/id/76561198000000000')).toThrow(AppError);
    expect(extractVerifiedSteamId(true, 'https://steamcommunity.com/openid/id/76561198000000000')).toBe('76561198000000000');
  });

  it('creates the user idempotently, regenerates the session, and returns the authenticated user', async () => {
    const users = new MemoryUsers();
    const agent = request.agent(app(users));
    const start = await agent.get('/auth/steam?returnTo=/passport.html');
    const initialCookie = start.headers['set-cookie'];
    const callback = await agent.get('/auth/steam/callback?openid.mode=id_res');
    expect(callback.status).toBe(303);
    expect(callback.headers.location).toBe('http://frontend.test/passport.html');
    expect(callback.headers['set-cookie']).not.toEqual(initialCookie);
    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({
      steamId64: profile.steamId64,
      displayName: profile.displayName,
      steamLevel: 42,
      countryCode: 'BR',
      role: 'PLAYER',
    });
    await agent.get('/auth/steam/callback?openid.mode=id_res');
    expect(users.bySteamId.size).toBe(1);
  });

  it('keeps the Steam session authenticated while the user navigates between frontend pages', async () => {
    const agent = request.agent(app());
    await agent.get('/auth/steam/callback?openid.mode=id_res');

    const homeSession = await agent.get('/auth/me').set('Referer', 'http://frontend.test/');
    const arenaSession = await agent.get('/auth/me').set('Referer', 'http://frontend.test/csgo.html');

    expect(homeSession.status).toBe(200);
    expect(arenaSession.status).toBe(200);
    expect(arenaSession.body.user.steamId64).toBe(homeSession.body.user.steamId64);
  });

  it('blocks open redirects', async () => {
    const agent = request.agent(app());
    await agent.get('/auth/steam?returnTo=//evil.test/steal');
    const callback = await agent.get('/auth/steam/callback?openid.mode=id_res');
    expect(callback.headers.location).toBe('http://frontend.test/');
  });

  it('ends the session on logout', async () => {
    const agent = request.agent(app());
    await agent.get('/auth/steam/callback?openid.mode=id_res');
    expect((await agent.get('/auth/me')).status).toBe(200);
    expect((await agent.post('/auth/logout')).status).toBe(204);
    expect((await agent.get('/auth/me')).status).toBe(401);
  });
});

describe('security middleware', () => {
  it('protects authenticated routes', async () => {
    const response = await request(app()).get('/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('allows configured CORS origins and rejects other origins', async () => {
    const allowed = await request(app()).get('/health').set('Origin', 'http://frontend.test');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://frontend.test');
    const denied = await request(app()).get('/health').set('Origin', 'https://evil.test');
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('rate limits repeated authentication requests', async () => {
    const target = app();
    let response = await request(target).get('/auth/steam');
    for (let index = 1; index <= 100; index += 1) response = await request(target).get('/auth/steam');
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });

  it('does not rate limit session checks used while navigating between pages', async () => {
    const target = app();
    let response = await request(target).get('/auth/me');
    for (let index = 1; index <= 120; index += 1) response = await request(target).get('/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('does not expose unexpected error details', async () => {
    const users = new MemoryUsers();
    users.findById = async () => { throw new Error('database-password=super-secret'); };
    const agent = request.agent(app(users));
    await agent.get('/auth/steam/callback?openid.mode=id_res');
    const response = await agent.get('/auth/me');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('super-secret');
  });

  it('returns the health check without authentication', async () => {
    const response = await request(app()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: 'clutchzone-backend' });
  });

  it('returns readiness without exposing dependency details', async () => {
    const response = await request(app()).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: 'clutchzone-backend' });
  });

  it('keeps unknown routes behind the global 404 handler', async () => {
    const response = await request(app()).get('/route-that-does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('user uniqueness', () => {
  it('maps a duplicate SteamID conflict to a safe response', async () => {
    const users = new MemoryUsers();
    users.upsertFromSteam = async () => { throw new AppError(409, 'STEAM_ID_CONFLICT', 'This Steam account is already linked.'); };
    const response = await request(app(users)).get('/auth/steam/callback?openid.mode=id_res');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('STEAM_ID_CONFLICT');
  });
});

describe('Steam friends integration', () => {
  it('requires a backend session', async () => {
    const response = await request(app()).get('/api/friends/steam');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('uses the SteamID from the authenticated database user and identifies Clutchzone members', async () => {
    const users = new MemoryUsers();
    const steamFriends = new FakeSteamFriends([{
      steamId64: '76561198000000001',
      displayName: 'Steam Friend',
      avatarUrl: 'https://avatars.steamstatic.com/friend.jpg',
      profileUrl: 'https://steamcommunity.com/profiles/76561198000000001/',
      personaState: 1,
      friendSince: new Date('2020-01-01T00:00:00.000Z'),
    }]);
    await users.upsertFromSteam({ ...profile, steamId64: '76561198000000001', displayName: 'Clutch Friend' });
    const agent = request.agent(app(users, new FakeSteam(), steamFriends));
    await agent.get('/auth/steam/callback?openid.mode=id_res');
    const response = await agent.get('/api/friends/steam?steamId64=76561198999999999');
    expect(response.status).toBe(200);
    expect(steamFriends.requestedSteamId).toBe(profile.steamId64);
    expect(response.body.friends[0]).toMatchObject({
      steamId64: '76561198000000001',
      clutchzoneUser: { displayName: 'Clutch Friend' },
    });
  });
});
