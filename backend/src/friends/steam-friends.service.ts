import { AppError } from '../errors/app-error.js';

const STEAM_USER_ID = /^7656119\d{10}$/;
const FRIENDS_URL = 'https://api.steampowered.com/ISteamUser/GetFriendList/v1/';
const SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
const PROFILE_BATCH_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;

export type SteamFriendProfile = {
  steamId64: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string;
  personaState: number | null;
  friendSince: Date | null;
};

export interface SteamFriendsService {
  listFriends(steamId64: string): Promise<SteamFriendProfile[]>;
}

type FriendReference = { steamId64: string; friendSince: Date | null };
type CacheEntry = { expiresAt: number; friends: SteamFriendProfile[] };

function integerInRange(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function parseFriendSince(value: unknown): Date | null {
  const seconds = integerInRange(value, 1, Number.MAX_SAFE_INTEGER);
  if (seconds === null) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseFriendReferences(payload: unknown): FriendReference[] {
  const friends = (payload as { friendslist?: { friends?: unknown } } | null)?.friendslist?.friends;
  if (!Array.isArray(friends)) return [];
  const unique = new Map<string, FriendReference>();
  for (const item of friends) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const steamId64 = typeof record['steamid'] === 'string' ? record['steamid'] : '';
    if (!STEAM_USER_ID.test(steamId64) || record['relationship'] !== 'friend') continue;
    unique.set(steamId64, { steamId64, friendSince: parseFriendSince(record['friend_since']) });
  }
  return [...unique.values()];
}

export function mapFriendProfiles(
  references: FriendReference[],
  players: Array<Record<string, unknown>>,
): SteamFriendProfile[] {
  const bySteamId = new Map(players.map(player => [player['steamid'], player]));
  return references.map(reference => {
    const player = bySteamId.get(reference.steamId64);
    const name = typeof player?.['personaname'] === 'string' ? player['personaname'].trim().slice(0, 100) : '';
    const profileUrlValue = typeof player?.['profileurl'] === 'string' ? player['profileurl'] : '';
    const avatarValue = typeof player?.['avatarfull'] === 'string' ? player['avatarfull'] : '';
    return {
      steamId64: reference.steamId64,
      displayName: name || `Steam ${reference.steamId64.slice(-6)}`,
      avatarUrl: avatarValue.startsWith('https://') ? avatarValue : null,
      profileUrl: profileUrlValue.startsWith('https://steamcommunity.com/')
        ? profileUrlValue
        : `https://steamcommunity.com/profiles/${reference.steamId64}/`,
      personaState: integerInRange(player?.['personastate'], 0, 6),
      friendSince: reference.friendSince,
    };
  });
}

export class SteamWebApiFriendsService implements SteamFriendsService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<SteamFriendProfile[]>>();

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async listFriends(steamId64: string): Promise<SteamFriendProfile[]> {
    if (!STEAM_USER_ID.test(steamId64)) {
      throw new AppError(400, 'INVALID_STEAM_ID', 'The authenticated account has an invalid Steam identity.');
    }
    if (!this.apiKey) {
      throw new AppError(503, 'STEAM_FRIENDS_UNAVAILABLE', 'Steam friends synchronization is not configured.');
    }
    const cached = this.cache.get(steamId64);
    if (cached && cached.expiresAt > Date.now()) return cached.friends;
    const activeRequest = this.pending.get(steamId64);
    if (activeRequest) return activeRequest;

    const request = this.fetchFriends(steamId64);
    this.pending.set(steamId64, request);
    try {
      const friends = await request;
      this.cache.set(steamId64, { expiresAt: Date.now() + CACHE_TTL_MS, friends });
      return friends;
    } finally {
      this.pending.delete(steamId64);
    }
  }

  private async fetchFriends(steamId64: string): Promise<SteamFriendProfile[]> {
    const url = new URL(FRIENDS_URL);
    url.searchParams.set('key', this.apiKey!);
    url.searchParams.set('steamid', steamId64);
    url.searchParams.set('relationship', 'friend');
    const response = await this.fetchSafely(url);
    if (response.status === 401 || response.status === 403) {
      throw new AppError(403, 'STEAM_FRIENDS_PRIVATE', 'Your Steam friends list is private.');
    }
    if (!response.ok) throw new AppError(502, 'STEAM_API_ERROR', 'Steam friends service is unavailable.');
    const references = parseFriendReferences(await this.readJson(response));
    if (references.length === 0) return [];

    const players: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < references.length; offset += PROFILE_BATCH_SIZE) {
      const batch = references.slice(offset, offset + PROFILE_BATCH_SIZE);
      const summariesUrl = new URL(SUMMARIES_URL);
      summariesUrl.searchParams.set('key', this.apiKey!);
      summariesUrl.searchParams.set('steamids', batch.map(friend => friend.steamId64).join(','));
      const summariesResponse = await this.fetchSafely(summariesUrl);
      if (!summariesResponse.ok) throw new AppError(502, 'STEAM_API_ERROR', 'Steam profile service is unavailable.');
      const payload = await this.readJson(summariesResponse) as { response?: { players?: unknown } };
      if (Array.isArray(payload.response?.players)) {
        players.push(...payload.response.players.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>>);
      }
    }
    return mapFriendProfiles(references, players);
  }

  private async fetchSafely(url: URL): Promise<Response> {
    try {
      return await this.fetcher(url, { headers: { accept: 'application/json' } });
    } catch {
      throw new AppError(502, 'STEAM_API_ERROR', 'Steam friends service is unavailable.');
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new AppError(502, 'INVALID_STEAM_RESPONSE', 'Steam returned an invalid response.');
    }
  }
}
