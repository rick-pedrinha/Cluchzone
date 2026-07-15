import { describe, expect, it } from 'vitest';
import { loadCs2WorkerConfig } from '../src/matches/cs2-worker.config.js';
import { SecretBox } from '../src/matches/secret-box.js';

describe('CS2 automation secrets', () => {
  it('encrypts room credentials with authenticated encryption', () => {
    const box = new SecretBox('a'.repeat(64));
    const encrypted = box.encrypt('temporary-room-password');
    expect(encrypted).not.toContain('temporary-room-password');
    expect(box.decrypt(encrypted)).toBe('temporary-room-password');
    expect(() => box.decrypt(`${encrypted.slice(0, -1)}x`)).toThrow();
  });

  it('requires GSLT, database, image, public host and encryption key for the worker', () => {
    expect(() => loadCs2WorkerConfig({})).toThrow(/CS2 worker environment variables/);
    const config = loadCs2WorkerConfig({
      DATABASE_URL: 'postgresql://user:pass@db:5432/clutchzone',
      CS2_SECRET_KEY: 'b'.repeat(64),
      CS2_GSLT: '01234567890123456789012345678901',
      CS2_PUBLIC_HOST: 'cs2.example.com',
      CS2_SERVER_IMAGE: 'clutchzone/cs2-server:local',
      CS2_SECRET_DIR: '/var/lib/clutchzone/cs2-secrets',
    });
    expect(config.gamePort).toBe(27015);
    expect(config.rconPort).toBe(27015);
  });
});
