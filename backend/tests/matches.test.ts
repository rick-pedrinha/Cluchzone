import express from 'express';
import session from 'express-session';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler, notFound } from '../src/middleware/error.middleware.js';
import { createMatchRouter } from '../src/matches/match.router.js';
import type {
  Cs2ServerControl,
  ServerCommandType,
  ServerCommandView,
  ServerRoomView,
} from '../src/matches/cs2-server.types.js';
import { platformRegions, type ActorRole, type CreateMatchInput, type LatencySample, type MatchRepository, type MatchView } from '../src/matches/match.types.js';
import { selectBalancedRegion } from '../src/matches/region-selector.js';
import type { PublicUser, SteamProfileInput, UserRepository } from '../src/users/user.types.js';

const organizerId = '10000000-0000-4000-8000-000000000001';
const playerId = '10000000-0000-4000-8000-000000000002';
const opponentId = '10000000-0000-4000-8000-000000000003';
const matchId = '20000000-0000-4000-8000-000000000001';

function user(id: string, role: ActorRole): PublicUser {
  const now = new Date();
  return {
    id,
    steamId64: id === organizerId ? '76561198000000001' : id === playerId ? '76561198000000002' : '76561198000000003',
    displayName: role,
    avatarUrl: null,
    profileUrl: 'https://steamcommunity.com/',
    steamLevel: null,
    visibilityState: 3,
    profileState: 1,
    personaState: 1,
    countryCode: 'BR',
    stateCode: 'SP',
    steamCreatedAt: null,
    lastLogoffAt: null,
    role,
    status: 'ACTIVE',
    showcaseVisible: true,
    preferredLocale: null,
    timeZone: null,
    currencyCode: null,
    regionCode: null,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

class MatchUsers implements UserRepository {
  private readonly users = new Map([
    [organizerId, user(organizerId, 'ORGANIZER')],
    [playerId, user(playerId, 'PLAYER')],
    [opponentId, user(opponentId, 'PLAYER')],
  ]);

  async upsertFromSteam(profile: SteamProfileInput): Promise<PublicUser> { void profile; throw new Error('not used'); }
  async findById(id: string): Promise<PublicUser | null> { return this.users.get(id) ?? null; }
  async findActiveBySteamIds(): Promise<PublicUser[]> { return []; }
  async findActiveByDisplayName(): Promise<PublicUser | null> { return null; }
  async updateShowcaseVisibility(): Promise<PublicUser | null> { return null; }
  async updatePreferences(): Promise<PublicUser | null> { return null; }
}

const baseMatch: MatchView = {
  id: matchId,
  tournamentRef: 'cup-1',
  createdById: organizerId,
  format: 'BEST_OF_1',
  status: 'CHECK_IN',
  regionCode: null,
  scheduledAt: new Date('2026-07-20T20:00:00.000Z'),
  version: 1,
  participants: [
    { userId: playerId, teamRef: 'team-a', role: 'CAPTAIN', checkedInAt: null },
    { userId: opponentId, teamRef: 'team-b', role: 'CAPTAIN', checkedInAt: null },
  ],
  createdAt: new Date('2026-07-14T00:00:00.000Z'),
  updatedAt: new Date('2026-07-14T00:00:00.000Z'),
};

class MemoryMatches implements MatchRepository {
  created: CreateMatchInput | null = null;
  latencyActor: string | null = null;
  provisionActor: string | null = null;
  provisionKey: string | null = null;

  async create(input: CreateMatchInput): Promise<MatchView> {
    this.created = input;
    return { ...baseMatch, createdById: input.createdById, format: input.format, participants: input.participants.map(item => ({ ...item, checkedInAt: null })) };
  }
  async findAuthorized(): Promise<MatchView> { return baseMatch; }
  async recordLatencies(_matchId: string, actorId: string, samples: LatencySample[]): Promise<MatchView> {
    void samples;
    this.latencyActor = actorId;
    return baseMatch;
  }
  async checkIn(): Promise<MatchView> { return baseMatch; }
  async requestProvision(_matchId: string, actorId: string, _actorRole: ActorRole, idempotencyKey: string): Promise<MatchView> {
    this.provisionActor = actorId;
    this.provisionKey = idempotencyKey;
    return { ...baseMatch, status: 'PROVISIONING', regionCode: 'sao-paulo' };
  }
}

class MemoryCs2Servers implements Cs2ServerControl {
  roomActor: string | null = null;
  commandActor: string | null = null;
  commandType: ServerCommandType | null = null;

  async getRoom(_matchId: string, actorId: string): Promise<ServerRoomView> {
    this.roomActor = actorId;
    return {
      matchId,
      matchStatus: 'READY',
      allocationStatus: 'READY',
      regionCode: 'sao-paulo',
      canOperate: actorId === organizerId,
      endpoint: 'cs2.example.com:27015',
      password: 'temporary-password',
      connectCommand: 'connect cs2.example.com:27015; password temporary-password',
    };
  }

  async requestCommand(
    _matchId: string,
    actorId: string,
    _actorRole: ActorRole,
    type: ServerCommandType,
  ): Promise<ServerCommandView> {
    this.commandActor = actorId;
    this.commandType = type;
    return { id: matchId, type, status: 'PENDING', createdAt: new Date(), processedAt: null };
  }
}

function app(matches = new MemoryMatches(), servers?: Cs2ServerControl) {
  const target = express();
  target.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  target.use(express.json());
  target.use(session({ secret: 'match-tests-secret-that-is-long-enough', resave: false, saveUninitialized: false }));
  target.post('/test-login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    res.sendStatus(204);
  });
  target.use('/api/matches', createMatchRouter(new MatchUsers(), matches, servers));
  target.use(notFound);
  target.use(errorHandler);
  return target;
}

describe('balanced region selection', () => {
  it('minimizes the worst player latency before average latency', () => {
    const result = selectBalancedRegion(['sao-paulo', 'virginia'], [
      { userId: playerId, samples: [{ regionCode: 'sao-paulo', latencyMs: 20 }, { regionCode: 'virginia', latencyMs: 80 }] },
      { userId: opponentId, samples: [{ regionCode: 'sao-paulo', latencyMs: 180 }, { regionCode: 'virginia', latencyMs: 90 }] },
    ]);
    expect(result).toEqual({ regionCode: 'virginia', maximumLatencyMs: 90, averageLatencyMs: 85 });
  });

  it('does not choose a region without measurements from every player', () => {
    expect(selectBalancedRegion(['sao-paulo'], [
      { userId: playerId, samples: [{ regionCode: 'sao-paulo', latencyMs: 20 }] },
      { userId: opponentId, samples: [] },
    ])).toBeNull();
  });
});

describe('match API authorization', () => {
  it('requires a backend session', async () => {
    const response = await request(app()).post(`/api/matches/${matchId}/check-in`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('uses the organizer identity from the session when creating a match', async () => {
    const matches = new MemoryMatches();
    const agent = request.agent(app(matches));
    await agent.post(`/test-login/${organizerId}`);
    const response = await agent.post('/api/matches').set('Content-Type', 'application/json').send(JSON.stringify({
      tournamentRef: 'cup-1',
      format: 'BEST_OF_1',
      scheduledAt: '2026-07-20T20:00:00.000Z',
      participants: [
        { userId: playerId, teamRef: 'team-a', role: 'CAPTAIN' },
        { userId: opponentId, teamRef: 'team-b', role: 'CAPTAIN' },
      ],
    }));
    expect(response.status).toBe(201);
    expect(matches.created?.createdById).toBe(organizerId);
  });

  it('records ping for the session player and requires an idempotency key for provisioning', async () => {
    const matches = new MemoryMatches();
    const player = request.agent(app(matches));
    await player.post(`/test-login/${playerId}`);
    const samples = platformRegions.map((regionCode, index) => ({ regionCode, latencyMs: 20 + index }));
    const ping = await player
      .post(`/api/matches/${matchId}/ping?userId=${opponentId}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ samples }));
    expect(ping.status).toBe(200);
    expect(matches.latencyActor).toBe(playerId);

    const organizer = request.agent(app(matches));
    await organizer.post(`/test-login/${organizerId}`);
    expect((await organizer.post(`/api/matches/${matchId}/provision`)).status).toBe(400);
    const provision = await organizer.post(`/api/matches/${matchId}/provision`).set('Idempotency-Key', 'provision-request-1');
    expect(provision.status).toBe(202);
    expect(matches.provisionActor).toBe(organizerId);
    expect(matches.provisionKey).toBe('provision-request-1');
  });

  it('returns protected connection data and queues only predefined RCON actions', async () => {
    const servers = new MemoryCs2Servers();
    const organizer = request.agent(app(new MemoryMatches(), servers));
    await organizer.post(`/test-login/${organizerId}`);

    const room = await organizer.get(`/api/matches/${matchId}/room`);
    expect(room.status).toBe(200);
    expect(room.body.room.password).toBe('temporary-password');
    expect(servers.roomActor).toBe(organizerId);

    const invalid = await organizer
      .post(`/api/matches/${matchId}/server/actions`)
      .set('Idempotency-Key', 'server-command-1')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'exec arbitrary' }));
    expect(invalid.status).toBe(400);

    const pause = await organizer
      .post(`/api/matches/${matchId}/server/actions`)
      .set('Idempotency-Key', 'server-command-2')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'PAUSE' }));
    expect(pause.status).toBe(202);
    expect(servers.commandActor).toBe(organizerId);
    expect(servers.commandType).toBe('PAUSE');
  });
});
