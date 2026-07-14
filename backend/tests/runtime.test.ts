import { describe, expect, it } from 'vitest';
import { SteamOpenIdService } from '../src/auth/steam-openid.service.js';

describe('runtime module compatibility', () => {
  it('constructs the CommonJS OpenID client and starts login without a Web API key', () => {
    const service = new SteamOpenIdService(
      'http://localhost:3001/auth/steam/callback',
      'http://localhost:3001',
      undefined,
    );
    const loginUrl = service.createLoginUrl();
    expect(loginUrl).toContain('steamcommunity.com/openid/login');
    expect(loginUrl).toContain(encodeURIComponent('http://localhost:3001/auth/steam/callback'));
  });
});
