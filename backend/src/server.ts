import { PrismaClient } from '@prisma/client';
import connectPgSimple from 'connect-pg-simple';
import { config as loadDotEnv } from 'dotenv';
import session from 'express-session';
import pg from 'pg';
import { createApp } from './app.js';
import { SteamOpenIdService } from './auth/steam-openid.service.js';
import { loadConfig } from './config/env.js';
import { logger } from './config/logger.js';
import { PrismaRateLimitStore } from './middleware/prisma-rate-limit.store.js';
import { PrismaUserRepository } from './users/prisma-user.repository.js';
import { PrismaStateRepository } from './state/state.repository.js';

loadDotEnv({ quiet: true });

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({ pool, tableName: 'session', createTableIfMissing: false });
  const callbackUrl = new URL('/auth/steam/callback', config.backendUrl).toString();
  const steam = new SteamOpenIdService(callbackUrl, new URL(config.backendUrl).origin, config.steamApiKey);
  const app = createApp({
    config,
    users: new PrismaUserRepository(prisma),
    steam,
    sessionStore,
    rateLimitStore: new PrismaRateLimitStore(prisma),
    logger,
    states: new PrismaStateRepository(prisma),
  });
  const server = app.listen(config.port, () => logger.info({ port: config.port }, 'server started'));

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await Promise.all([prisma.$disconnect(), pool.end()]);
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
  logger.fatal({ err: error }, 'startup failed');
  process.exit(1);
});
