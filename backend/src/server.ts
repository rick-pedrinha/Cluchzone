import { PrismaClient } from '@prisma/client';
import connectPgSimple from 'connect-pg-simple';
import { config as loadDotEnv } from 'dotenv';
import session from 'express-session';
import pg from 'pg';
import { createApp } from './app.js';
import { SteamOpenIdService } from './auth/steam-openid.service.js';
import { loadConfig } from './config/env.js';
import { logger } from './config/logger.js';
import { SteamWebApiFriendsService } from './friends/steam-friends.service.js';
import { SteamCommunityCs2InventoryService } from './inventory/cs2-inventory.service.js';
import { PrismaMatchRepository } from './matches/prisma-match.repository.js';
import { PrismaMarketplaceRepository } from './marketplace/prisma-marketplace.repository.js';
import { PrismaDirectMessageRepository } from './messages/prisma-direct-message.repository.js';
import { PrismaRateLimitStore } from './middleware/prisma-rate-limit.store.js';
import { PrismaUserRepository } from './users/prisma-user.repository.js';
import { PrismaStateRepository } from './state/state.repository.js';
import { PrismaTeamRepository } from './teams/prisma-team.repository.js';

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
    steamFriends: new SteamWebApiFriendsService(config.steamApiKey),
    inventory: new SteamCommunityCs2InventoryService(),
    sessionStore,
    rateLimitStore: new PrismaRateLimitStore(prisma),
    friendsRateLimitStore: new PrismaRateLimitStore(prisma, 'steam-friends:'),
    inventoryRateLimitStore: new PrismaRateLimitStore(prisma, 'cs2-inventory:'),
    showcaseRateLimitStore: new PrismaRateLimitStore(prisma, 'player-showcase:'),
    matchesRateLimitStore: new PrismaRateLimitStore(prisma, 'matches:'),
    marketplaceRateLimitStore: new PrismaRateLimitStore(prisma, 'marketplace:'),
    sellerRateLimitStore: new PrismaRateLimitStore(prisma, 'seller:'),
    teamsRateLimitStore: new PrismaRateLimitStore(prisma, 'teams:'),
    messagesRateLimitStore: new PrismaRateLimitStore(prisma, 'messages:'),
    logger,
    states: new PrismaStateRepository(prisma),
    matches: new PrismaMatchRepository(prisma),
    marketplace: new PrismaMarketplaceRepository(prisma),
    teams: new PrismaTeamRepository(prisma),
    messages: new PrismaDirectMessageRepository(prisma),
    readiness: async () => { await prisma.$queryRaw`SELECT 1`; },
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
