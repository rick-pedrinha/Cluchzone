import express from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AppError } from '../src/errors/app-error.js';
import { createCs2InventoryRouter, isRegisteredCs2Participant } from '../src/inventory/cs2-inventory.router.js';
import {
  mapPublicCs2Inventory,
  SteamCommunityCs2InventoryService,
  type Cs2Inventory,
  type Cs2InventoryService,
} from '../src/inventory/cs2-inventory.service.js';
import { errorHandler } from '../src/middleware/error.middleware.js';
import type { StateRepository } from '../src/state/state.repository.js';
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
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const inventoryResult: Cs2Inventory = {
  total: 1,
  loaded: 1,
  truncated: false,
  synchronizedAt: new Date('2026-07-14T00:00:00.000Z'),
  items: [{
    assetId: '1',
    classId: '10',
    name: 'AK-47 | Redline',
    marketHashName: 'AK-47 | Redline (Field-Tested)',
    type: 'Classified Rifle',
    category: 'weapon',
    imageUrl: 'https://community.fastly.steamstatic.com/economy/image/token/360fx360f',
    rarity: 'Classificado',
    rarityColor: '#d32ce6',
    exterior: 'Testada em Campo',
    tradable: true,
    marketable: true,
    quantity: 1,
  }],
};

class MemoryStates implements StateRepository {
  constructor(private readonly values: Record<string, unknown>) {}
  async get(key: string): Promise<unknown> { return this.values[key] ?? null; }
  async set(key: string, value: unknown): Promise<unknown> { this.values[key] = value; return value; }
}

class InventoryUsers implements UserRepository {
  async upsertFromSteam(): Promise<PublicUser> { return player; }
  async findById(): Promise<PublicUser | null> { return player; }
  async findActiveBySteamIds(): Promise<PublicUser[]> { return [player]; }
  async findActiveByDisplayName(displayName: string): Promise<PublicUser | null> {
    return displayName.toLowerCase() === player.displayName.toLowerCase() ? player : null;
  }
  async updateShowcaseVisibility(id: string, visible: boolean): Promise<PublicUser | null> {
    return id === player.id ? { ...player, showcaseVisible: visible } : null;
  }
}

class FakeInventory implements Cs2InventoryService {
  requestedSteamId: string | null = null;
  async getPublicInventory(steamId64: string): Promise<Cs2Inventory> {
    this.requestedSteamId = steamId64;
    return inventoryResult;
  }
}

function inventoryApp(states: StateRepository, inventory: Cs2InventoryService) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.use('/api/tournaments', createCs2InventoryRouter(new InventoryUsers(), states, inventory));
  app.use(errorHandler);
  return app;
}

describe('CS2 public inventory mapping', () => {
  it('maps Steam assets, presentation metadata, and category without exposing raw payloads', () => {
    const result = mapPublicCs2Inventory({
      success: 1,
      total_inventory_count: 1,
      assets: [{ assetid: '1', classid: '10', instanceid: '0', amount: '1' }],
      descriptions: [{
        classid: '10',
        instanceid: '0',
        market_name: '★ Karambit | Doppler',
        type: 'Covert Knife',
        icon_url: 'safe_steam_image_token',
        tradable: 1,
        marketable: 1,
        tags: [
          { category: 'Rarity', internal_name: 'Rarity_Ancient_Weapon', localized_tag_name: 'Extraordinário', color: 'eb4b4b' },
          { category: 'Exterior', internal_name: 'WearCategory0', localized_tag_name: 'Nova de Fábrica' },
        ],
      }],
    });
    expect(result.items[0]).toMatchObject({
      category: 'knife',
      rarity: 'Extraordinário',
      rarityColor: '#eb4b4b',
      exterior: 'Nova de Fábrica',
      tradable: true,
    });
  });

  it('caches a public inventory and maps private inventory to a safe error', async () => {
    let calls = 0;
    const publicFetcher = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ success: 1, total_inventory_count: 0, assets: [], descriptions: [] }), { status: 200 });
    }) as typeof fetch;
    const service = new SteamCommunityCs2InventoryService(publicFetcher);
    await service.getPublicInventory(player.steamId64);
    await service.getPublicInventory(player.steamId64);
    expect(calls).toBe(1);

    const privateService = new SteamCommunityCs2InventoryService(async () => new Response(null, { status: 403 }));
    await expect(privateService.getPublicInventory(player.steamId64)).rejects.toMatchObject<AppError>({
      statusCode: 403,
      code: 'STEAM_INVENTORY_PRIVATE',
    });
  });
});

describe('CS2 tournament inventory route', () => {
  const tournaments = [{ id: 'camp-1', registeredTeams: ['Team One'], pendingApprovals: ['Pending Team'], soloPlayers: ['Solo Player'] }];
  const teams = [
    { name: 'Team One', captain: 'Player One', members: ['Player One', 'Player Two'], reserves: [] },
    { name: 'Pending Team', captain: 'Pending Player', members: ['Pending Player'], reserves: [] },
  ];

  it('recognizes only approved roster members and declared solo players', () => {
    expect(isRegisteredCs2Participant('camp-1', 'Player One', tournaments, teams)).toBe(true);
    expect(isRegisteredCs2Participant('camp-1', 'Solo Player', tournaments, teams)).toBe(true);
    expect(isRegisteredCs2Participant('camp-1', 'Pending Player', tournaments, teams)).toBe(false);
    expect(isRegisteredCs2Participant('camp-1', 'Outsider', tournaments, teams)).toBe(false);
  });

  it('resolves the registered user on the backend and ignores a SteamID from the browser', async () => {
    const states = new MemoryStates({ cluchzone_cs2_camps: tournaments, cluchzone_cs2_teams: teams });
    const inventory = new FakeInventory();
    const response = await request(inventoryApp(states, inventory))
      .get('/api/tournaments/camp-1/players/Player%20One/cs2-inventory?steamId64=76561198999999999');
    expect(response.status).toBe(200);
    expect(inventory.requestedSteamId).toBe(player.steamId64);
    expect(response.body).toMatchObject({
      player: { displayName: 'Player One' },
      inventory: { total: 1, items: [{ name: 'AK-47 | Redline' }] },
    });
  });

  it('does not expose inventory for a player outside the approved roster', async () => {
    const states = new MemoryStates({ cluchzone_cs2_camps: tournaments, cluchzone_cs2_teams: teams });
    const response = await request(inventoryApp(states, new FakeInventory()))
      .get('/api/tournaments/camp-1/players/Outsider/cs2-inventory');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('TOURNAMENT_PLAYER_NOT_FOUND');
  });
});
