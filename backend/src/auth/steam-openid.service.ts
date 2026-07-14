import openid from 'openid';
import type { RelyingParty } from 'openid';
import { AppError } from '../errors/app-error.js';
import type { SteamProfileInput } from '../users/user.types.js';

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const STEAM_CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

export function extractVerifiedSteamId(authenticated: boolean, claimedIdentifier: string): string {
  const match = authenticated ? STEAM_CLAIMED_ID.exec(claimedIdentifier) : null;
  if (!match?.[1]) throw new AppError(401, 'INVALID_STEAM_ID', 'Steam returned an invalid identity.');
  return match[1];
}

export interface SteamAuthService {
  createLoginUrl(): string;
  verifyAndFetchProfile(callbackUrl: string): Promise<SteamProfileInput>;
}

type OpenIdResult = { authenticated?: boolean; claimedIdentifier?: string | undefined };

function boundedInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function epochSeconds(value: unknown): Date | null {
  const seconds = boundedInteger(value, 1);
  if (seconds === null) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapSteamProfile(
  steamId64: string,
  player: Record<string, unknown>,
  steamLevelValue: unknown,
): SteamProfileInput {
  if (player['steamid'] !== steamId64) {
    throw new AppError(502, 'STEAM_PROFILE_NOT_FOUND', 'Steam profile was not returned.');
  }
  const displayName = typeof player['personaname'] === 'string' ? player['personaname'].trim().slice(0, 100) : '';
  const profileUrl = typeof player['profileurl'] === 'string' ? player['profileurl'] : '';
  const avatarUrl = typeof player['avatarfull'] === 'string' && player['avatarfull'] ? player['avatarfull'] : null;
  if (!displayName || !profileUrl.startsWith('https://steamcommunity.com/')) {
    throw new AppError(502, 'INVALID_STEAM_PROFILE', 'Steam returned an invalid profile.');
  }
  const country = typeof player['loccountrycode'] === 'string' && /^[A-Z]{2}$/.test(player['loccountrycode'])
    ? player['loccountrycode']
    : null;
  const state = typeof player['locstatecode'] === 'string' && player['locstatecode'].length <= 10
    ? player['locstatecode']
    : null;
  return {
    steamId64,
    displayName,
    avatarUrl,
    profileUrl,
    steamLevel: boundedInteger(steamLevelValue, 0),
    visibilityState: boundedInteger(player['communityvisibilitystate'], 0, 3),
    profileState: boundedInteger(player['profilestate'], 0, 1),
    personaState: boundedInteger(player['personastate'], 0, 6),
    countryCode: country,
    stateCode: state,
    steamCreatedAt: epochSeconds(player['timecreated']),
    lastLogoffAt: epochSeconds(player['lastlogoff']),
  };
}

export class SteamOpenIdService implements SteamAuthService {
  private readonly relyingParty: RelyingParty;

  constructor(
    private readonly returnUrl: string,
    private readonly realm: string,
    private readonly apiKey: string | undefined,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.relyingParty = new openid.RelyingParty(returnUrl, realm, true, false, []);
  }

  createLoginUrl(): string {
    const url = new URL(STEAM_OPENID_ENDPOINT);
    url.search = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': this.returnUrl,
      'openid.realm': this.realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    }).toString();
    return url.toString();
  }

  async verifyAndFetchProfile(callbackUrl: string): Promise<SteamProfileInput> {
    const result = await new Promise<OpenIdResult>((resolve, reject) => {
      this.relyingParty.verifyAssertion(callbackUrl, (error, verification) => {
        if (error) reject(error instanceof Error ? error : new Error('OpenID verification failed'));
        else resolve(verification ?? {});
      });
    }).catch(() => {
      throw new AppError(401, 'INVALID_STEAM_CALLBACK', 'Steam authentication could not be verified.');
    });

    const steamId64 = extractVerifiedSteamId(Boolean(result.authenticated), result.claimedIdentifier ?? '');
    if (!this.apiKey) {
      throw new AppError(503, 'STEAM_PROFILE_UNAVAILABLE', 'Steam profile lookup is not configured.');
    }
    const summaryUrl = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
    summaryUrl.searchParams.set('key', this.apiKey);
    summaryUrl.searchParams.set('steamids', steamId64);
    const levelUrl = new URL('https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/');
    levelUrl.searchParams.set('key', this.apiKey);
    levelUrl.searchParams.set('steamid', steamId64);
    const [summaryResponse, levelResponse] = await Promise.all([
      this.fetcher(summaryUrl, { headers: { accept: 'application/json' } }),
      this.fetcher(levelUrl, { headers: { accept: 'application/json' } }),
    ]);
    if (!summaryResponse.ok || !levelResponse.ok) {
      throw new AppError(502, 'STEAM_API_ERROR', 'Steam profile service is unavailable.');
    }
    const summary = (await summaryResponse.json()) as { response?: { players?: Array<Record<string, unknown>> } };
    const level = (await levelResponse.json()) as { response?: { player_level?: unknown } };
    const player = summary.response?.players?.[0];
    if (!player) throw new AppError(502, 'STEAM_PROFILE_NOT_FOUND', 'Steam profile was not returned.');
    return mapSteamProfile(steamId64, player, level.response?.player_level);
  }
}
