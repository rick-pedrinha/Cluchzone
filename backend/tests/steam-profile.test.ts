import { describe, expect, it } from 'vitest';
import { mapSteamProfile } from '../src/auth/steam-openid.service.js';

describe('Steam public profile mapping', () => {
  it('maps level and basic public information from Steam', () => {
    const result = mapSteamProfile(
      '76561198000000000',
      {
        steamid: '76561198000000000',
        personaname: 'Player One',
        profileurl: 'https://steamcommunity.com/profiles/76561198000000000/',
        avatarfull: 'https://avatars.steamstatic.com/player.jpg',
        communityvisibilitystate: 3,
        profilestate: 1,
        personastate: 1,
        loccountrycode: 'BR',
        locstatecode: 'SP',
        timecreated: 1325376000,
        lastlogoff: 1783987200,
      },
      57,
    );

    expect(result).toMatchObject({
      steamLevel: 57,
      visibilityState: 3,
      profileState: 1,
      personaState: 1,
      countryCode: 'BR',
      stateCode: 'SP',
    });
    expect(result.steamCreatedAt?.toISOString()).toBe('2012-01-01T00:00:00.000Z');
  });

  it('uses null for optional information hidden by a private profile', () => {
    const result = mapSteamProfile(
      '76561198000000000',
      {
        steamid: '76561198000000000',
        personaname: 'Private Player',
        profileurl: 'https://steamcommunity.com/profiles/76561198000000000/',
        communityvisibilitystate: 1,
        personastate: 0,
      },
      undefined,
    );

    expect(result.steamLevel).toBeNull();
    expect(result.countryCode).toBeNull();
    expect(result.steamCreatedAt).toBeNull();
  });
});
