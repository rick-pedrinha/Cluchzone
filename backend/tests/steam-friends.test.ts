import { describe, expect, it } from 'vitest';
import type { AppError } from '../src/errors/app-error.js';
import {
  mapFriendProfiles,
  parseFriendReferences,
  SteamWebApiFriendsService,
} from '../src/friends/steam-friends.service.js';

describe('Steam friends service', () => {
  it('validates and deduplicates friend relationships returned by Steam', () => {
    const references = parseFriendReferences({ friendslist: { friends: [
      { steamid: '76561198000000001', relationship: 'friend', friend_since: 1577836800 },
      { steamid: '76561198000000001', relationship: 'friend', friend_since: 1577836800 },
      { steamid: '76561198000000002', relationship: 'blocked', friend_since: 1 },
      { steamid: 'not-a-steam-id', relationship: 'friend', friend_since: 1 },
    ] } });
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({ steamId64: '76561198000000001' });
    expect(references[0]?.friendSince?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });

  it('maps public profile data and uses a safe profile fallback', () => {
    const references = parseFriendReferences({ friendslist: { friends: [
      { steamid: '76561198000000001', relationship: 'friend' },
      { steamid: '76561198000000002', relationship: 'friend' },
    ] } });
    const friends = mapFriendProfiles(references, [{
      steamid: '76561198000000001',
      personaname: 'Friend One',
      avatarfull: 'https://avatars.steamstatic.com/friend.jpg',
      profileurl: 'https://steamcommunity.com/profiles/76561198000000001/',
      personastate: 1,
    }]);
    expect(friends[0]).toMatchObject({ displayName: 'Friend One', personaState: 1 });
    expect(friends[1]).toMatchObject({
      displayName: 'Steam 000002',
      profileUrl: 'https://steamcommunity.com/profiles/76561198000000002/',
    });
  });

  it('fetches friends and summaries on the backend, then serves the cached result', async () => {
    const calls: string[] = [];
    const fetcher = (async (input: URL | RequestInfo) => {
      const url = input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url;
      calls.push(url);
      if (url.includes('GetFriendList')) {
        return new Response(JSON.stringify({ friendslist: { friends: [
          { steamid: '76561198000000001', relationship: 'friend', friend_since: 1577836800 },
        ] } }), { status: 200 });
      }
      return new Response(JSON.stringify({ response: { players: [{
        steamid: '76561198000000001',
        personaname: 'Friend One',
        profileurl: 'https://steamcommunity.com/profiles/76561198000000001/',
        avatarfull: 'https://avatars.steamstatic.com/friend.jpg',
        personastate: 1,
      }] } }), { status: 200 });
    }) as typeof fetch;
    const service = new SteamWebApiFriendsService('server-only-key', fetcher);
    const first = await service.listFriends('76561198000000000');
    const second = await service.listFriends('76561198000000000');
    expect(first).toEqual(second);
    expect(first[0]?.displayName).toBe('Friend One');
    expect(calls).toHaveLength(2);
    expect(calls.every(url => url.includes('key=server-only-key'))).toBe(true);
  });

  it('reports a private Steam friends list without exposing response details', async () => {
    const fetcher = (async () => new Response(null, { status: 401 })) as typeof fetch;
    const service = new SteamWebApiFriendsService('server-only-key', fetcher);
    await expect(service.listFriends('76561198000000000')).rejects.toMatchObject<AppError>({
      statusCode: 403,
      code: 'STEAM_FRIENDS_PRIVATE',
    });
  });
});
