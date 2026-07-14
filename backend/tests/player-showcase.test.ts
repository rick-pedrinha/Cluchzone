import express from 'express';
import session from 'express-session';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  classifyCs2Item,
  MIN_SHOWCASE_PRICE_MINOR,
  parseSteamBrlPrice,
  SteamCommunityCs2InventoryService,
  type Cs2Inventory,
  type Cs2InventoryItem,
  type SteamInventoryHighlight,
  type SteamGameInventoryService,
  type SteamInventoryGameKey,
} from '../src/inventory/cs2-inventory.service.js';
import { createPlayerShowcaseRouter } from '../src/inventory/player-showcase.router.js';
import { errorHandler } from '../src/middleware/error.middleware.js';
import type { PublicUser, UserRepository } from '../src/users/user.types.js';

const player: PublicUser = {
  id: 'player-id',
  steamId64: '76561198000000000',
  displayName: 'Player One',
  avatarUrl: 'https://avatars.steamstatic.com/player.jpg',
  profileUrl: 'https://steamcommunity.com/profiles/76561198000000000/',
  steamLevel: 20,
  visibilityState: 3,
  profileState: 1,
  personaState: 1,
  countryCode: 'BR',
  stateCode: 'SP',
  steamCreatedAt: null,
  lastLogoffAt: null,
  role: 'PLAYER',
  status: 'ACTIVE',
  showcaseVisible: true,
  preferredLocale: null,
  timeZone: null,
  currencyCode: null,
  regionCode: null,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const inventoryResult: Cs2Inventory = {
  total: 0,
  loaded: 0,
  truncated: false,
  items: [],
  synchronizedAt: new Date('2026-07-14T00:00:00.000Z'),
};

class ShowcaseUsers implements UserRepository {
  lastVisibilityUserId: string | null = null;
  constructor(private result: PublicUser | null = player) {}
  async upsertFromSteam(): Promise<PublicUser> { return player; }
  async findById(): Promise<PublicUser | null> { return this.result; }
  async findActiveBySteamIds(): Promise<PublicUser[]> { return this.result ? [this.result] : []; }
  async findActiveByDisplayName(): Promise<PublicUser | null> { return this.result; }
  async updateShowcaseVisibility(id: string, visible: boolean): Promise<PublicUser | null> {
    this.lastVisibilityUserId = id;
    if (!this.result || this.result.id !== id || this.result.status !== 'ACTIVE') return null;
    this.result = { ...this.result, showcaseVisible: visible };
    return this.result;
  }
  async updatePreferences(): Promise<PublicUser | null> { return this.result; }
}

class FakeInventory implements SteamGameInventoryService {
  requestedSteamId: string | null = null;
  requestedGame: SteamInventoryGameKey | null = null;
  async getPublicInventory(steamId64: string): Promise<Cs2Inventory> {
    return this.getPublicGameInventory(steamId64, 'cs2');
  }
  async getPublicGameInventory(steamId64: string, game: SteamInventoryGameKey): Promise<Cs2Inventory> {
    this.requestedSteamId = steamId64;
    this.requestedGame = game;
    return inventoryResult;
  }
  async getPublicGameHighlights(): Promise<SteamInventoryHighlight[]> { return []; }
}

function showcaseApp(users: UserRepository, inventory: SteamGameInventoryService) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.use(express.json());
  app.use(session({ secret: 'showcase-test-secret-at-least-32-characters', resave: false, saveUninitialized: false }));
  app.get('/test-login/:userId', (req, res) => {
    req.session.userId = req.params.userId;
    res.status(204).end();
  });
  app.use('/api/players', createPlayerShowcaseRouter(users, inventory));
  app.use(errorHandler);
  return app;
}

describe('public Steam inventory showcases', () => {
  it('shows exactly the four most expensive eligible items and never lets graffiti replace a weapon', async () => {
    const base = {
      assetId: '1', classId: '1', name: 'Item', marketHashName: 'Item', type: null, category: 'other', imageUrl: null,
      rarity: null, rarityColor: null, exterior: null, tradable: true, marketable: true, quantity: 1,
    } satisfies Cs2InventoryItem;
    const prices = new Map([
      ['Karambit | Doppler', 'R$ 2.500,00'],
      ['Sport Gloves | Vice', 'R$ 1.800,00'],
      ['AWP | Asiimov', 'R$ 900,00'],
      ['AK-47 | Redline', 'R$ 450,00'],
      ['M4A1-S | Decimator', 'R$ 300,00'],
      ['Recoil Case', 'R$ 80,00'],
      ['Graffiti | Recoil', 'R$ 9.999,00'],
    ]);
    const requestedNames: string[] = [];
    const fetcher: typeof fetch = async input => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const name = url.searchParams.get('market_hash_name') ?? '';
      requestedNames.push(name);
      return new Response(JSON.stringify({ success: true, lowest_price: prices.get(name) }), { status: 200 });
    };
    const service = new SteamCommunityCs2InventoryService(fetcher);
    const items = [...prices.keys()].map((name, index) => ({
      ...base,
      assetId: String(index),
      classId: String(index),
      name,
      marketHashName: name,
      category: name.startsWith('Graffiti') ? 'graffiti' as const
        : name.includes('Karambit') ? 'knife' as const
          : name.includes('Gloves') ? 'glove' as const
            : name.includes('Case') ? 'container' as const
              : 'weapon' as const,
    }));
    const highlights = await service.getPublicGameHighlights(items, 'cs2');

    expect(highlights.map(item => item.name)).toEqual([
      'Karambit | Doppler',
      'Sport Gloves | Vice',
      'AWP | Asiimov',
      'AK-47 | Redline',
    ]);
    expect(highlights.map(item => item.marketPrice.amountMinor)).toEqual([250_000, 180_000, 90_000, 45_000]);
    expect(requestedNames).not.toContain('Graffiti | Recoil');
  });

  it('hides a game without four items above the expensive-item threshold', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      success: true,
      lowest_price: `R$ ${(MIN_SHOWCASE_PRICE_MINOR / 100 - 1).toFixed(2).replace('.', ',')}`,
    }), { status: 200 });
    const service = new SteamCommunityCs2InventoryService(fetcher);
    const items = Array.from({ length: 4 }, (_, index) => ({
      assetId: String(index), classId: String(index), name: `Weapon ${index}`, marketHashName: `Weapon ${index}`,
      type: 'Rifle', category: 'weapon' as const, imageUrl: null, rarity: null, rarityColor: null,
      exterior: null, tradable: true, marketable: true, quantity: 1,
    }));
    expect(await service.getPublicGameHighlights(items, 'cs2')).toEqual([]);
  });

  it('parses Brazilian market prices and classifies Steam graffiti explicitly', () => {
    expect(parseSteamBrlPrice('R$ 1.234,56')).toBe(123_456);
    expect(classifyCs2Item('Grafite Lacrado | Karambit', 'Graffiti', [])).toBe('graffiti');
  });

  it('resolves the Steam identity from the Clutchzone user id for every supported game', async () => {
    const inventory = new FakeInventory();
    const response = await request(showcaseApp(new ShowcaseUsers(), inventory))
      .get('/api/players/player-id/showcases/pubg/inventory?steamId64=76561198999999999');

    expect(response.status).toBe(200);
    expect(inventory.requestedSteamId).toBe(player.steamId64);
    expect(inventory.requestedGame).toBe('pubg');
    expect(response.body).toMatchObject({
      game: { key: 'pubg', appId: 578080 },
      player: { id: player.id, displayName: player.displayName },
      showcaseAvailable: false,
      highlights: [],
      inventory: { total: 0, items: [] },
    });
  });

  it('lets only the authenticated owner change showcase visibility', async () => {
    const users = new ShowcaseUsers();
    const target = showcaseApp(users, new FakeInventory());
    const anonymous = await request(target)
      .patch('/api/players/me/showcase-visibility')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ visible: false }));
    expect(anonymous.status).toBe(401);

    const agent = request.agent(target);
    await agent.get(`/test-login/${player.id}`);
    const hidden = await agent
      .patch('/api/players/me/showcase-visibility?userId=another-player')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ visible: false }));
    expect(hidden.status).toBe(200);
    expect(hidden.body).toEqual({ ok: true, visible: false });
    expect(users.lastVisibilityUserId).toBe(player.id);
    expect((await agent.get('/api/players/me/showcase-visibility')).body.visible).toBe(false);
  });

  it('does not fetch or expose inventory when the player hides the public showcase', async () => {
    const inventory = new FakeInventory();
    const response = await request(showcaseApp(new ShowcaseUsers({ ...player, showcaseVisible: false }), inventory))
      .get(`/api/players/${player.id}/showcases/cs2/inventory`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, showcaseVisible: false, highlights: [] });
    expect(inventory.requestedSteamId).toBeNull();
  });

  it('rejects unsupported games and inactive player profiles', async () => {
    const inventory = new FakeInventory();
    const unsupported = await request(showcaseApp(new ShowcaseUsers(), inventory))
      .get('/api/players/player-id/showcases/unknown/inventory');
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe('INVALID_INPUT');

    const inactive = await request(showcaseApp(new ShowcaseUsers({ ...player, status: 'SUSPENDED' }), inventory))
      .get('/api/players/player-id/showcases/cs2/inventory');
    expect(inactive.status).toBe(404);
    expect(inactive.body.error.code).toBe('PLAYER_NOT_FOUND');
  });

  it('queries the configured Steam Community inventory for PUBG', async () => {
    let requestedUrl = '';
    const fetcher: typeof fetch = async input => {
      requestedUrl = input instanceof Request ? input.url : input.toString();
      return new Response(JSON.stringify({ success: 1, total_inventory_count: 0, assets: [], descriptions: [] }), { status: 200 });
    };
    const service = new SteamCommunityCs2InventoryService(fetcher);

    await service.getPublicGameInventory(player.steamId64, 'pubg');
    expect(requestedUrl).toContain(`/inventory/${player.steamId64}/578080/2`);
  });
});
