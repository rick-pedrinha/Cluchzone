import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit, { type Store } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import path from 'node:path';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { createAuthRouter } from './auth/auth.router.js';
import type { SteamAuthService } from './auth/steam-openid.service.js';
import type { AppConfig } from './config/env.js';
import { logger as defaultLogger } from './config/logger.js';
import { AppError } from './errors/app-error.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { createSteamFriendsRouter } from './friends/steam-friends.router.js';
import type { SteamFriendsService } from './friends/steam-friends.service.js';
import { createGlobalizationRouter } from './global/globalization.router.js';
import { createCs2InventoryRouter } from './inventory/cs2-inventory.router.js';
import type { SteamGameInventoryService } from './inventory/cs2-inventory.service.js';
import { createPlayerShowcaseRouter } from './inventory/player-showcase.router.js';
import { createMatchRouter } from './matches/match.router.js';
import type { MatchRepository } from './matches/match.types.js';
import { createMarketplaceRouter } from './marketplace/marketplace.router.js';
import type { MarketplaceRepository } from './marketplace/marketplace.types.js';
import { createSellerRouter } from './marketplace/seller.router.js';
import { createDirectMessageRouter } from './messages/direct-message.router.js';
import type { DirectMessageRepository } from './messages/direct-message.types.js';
import { createStateRouter } from './state/state.router.js';
import { createTeamRouter } from './teams/team.router.js';
import type { TeamRepository } from './teams/team.types.js';
import type { StateRepository } from './state/state.repository.js';
import type { UserRepository } from './users/user.types.js';

export type AppDependencies = {
  config: AppConfig;
  users: UserRepository;
  steam: SteamAuthService;
  steamFriends: SteamFriendsService;
  inventory?: SteamGameInventoryService;
  sessionStore: session.Store;
  rateLimitStore?: Store;
  friendsRateLimitStore?: Store;
  inventoryRateLimitStore?: Store;
  showcaseRateLimitStore?: Store;
  matchesRateLimitStore?: Store;
  marketplaceRateLimitStore?: Store;
  sellerRateLimitStore?: Store;
  teamsRateLimitStore?: Store;
  messagesRateLimitStore?: Store;
  logger?: Logger;
  states?: StateRepository;
  matches?: MatchRepository;
  marketplace?: MarketplaceRepository;
  teams?: TeamRepository;
  messages?: DirectMessageRepository;
  frontendDirectory?: string;
  readiness?: () => Promise<void>;
};

export function createApp(deps: AppDependencies): Express {
  const { config } = deps;
  const usesCrossSiteSession =
    config.nodeEnv === 'production' &&
    new URL(config.frontendUrl).origin !== new URL(config.backendUrl).origin;
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(pinoHttp({ logger: deps.logger ?? defaultLogger }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
        else callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed.'));
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(
    session({
      name: 'clutchzone.sid',
      secret: config.sessionSecret,
      store: deps.sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: usesCrossSiteSession ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      },
    }),
  );

  // Limit only the Steam handshake. Session status is read on every page and
  // must remain available while an authenticated user navigates the app.
  app.use(
    '/auth/steam',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      ...(deps.rateLimitStore ? { store: deps.rateLimitStore } : {}),
      handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
    }),
  );

  app.use(
    '/api/friends',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      ...(deps.friendsRateLimitStore ? { store: deps.friendsRateLimitStore } : {}),
      handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
    }),
  );

  app.get('/health', (_req, res) =>
    res.status(200).json({ ok: true, service: 'clutchzone-backend' }),
  );
  app.get('/ready', async (_req, res) => {
    try {
      await deps.readiness?.();
      res.status(200).json({ ok: true, service: 'clutchzone-backend' });
    } catch {
      res.status(503).json({ ok: false, service: 'clutchzone-backend' });
    }
  });
  app.use('/auth', createAuthRouter(config, deps.users, deps.steam));
  app.use('/api/global', createGlobalizationRouter(deps.users));
  app.use('/api/friends', createSteamFriendsRouter(deps.users, deps.steamFriends));
  if (deps.messages) {
    app.use(
      '/api/messages',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 180,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...(deps.messagesRateLimitStore ? { store: deps.messagesRateLimitStore } : {}),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
      }),
    );
    app.use(
      '/api/messages',
      createDirectMessageRouter(deps.users, deps.messages, deps.steamFriends),
    );
  }
  if (deps.inventory) {
    app.use(
      '/api/players',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 60,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...(deps.showcaseRateLimitStore ? { store: deps.showcaseRateLimitStore } : {}),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
      }),
    );
    app.use('/api/players', createPlayerShowcaseRouter(deps.users, deps.inventory));
  }
  if (deps.states && deps.inventory) {
    app.use(
      '/api/tournaments',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 60,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...(deps.inventoryRateLimitStore ? { store: deps.inventoryRateLimitStore } : {}),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
      }),
    );
    app.use('/api/tournaments', createCs2InventoryRouter(deps.users, deps.states, deps.inventory));
  }
  if (deps.states) app.use('/api/store', createStateRouter(deps.states));
  if (deps.teams) {
    app.use(
      '/api/teams',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 180,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...(deps.teamsRateLimitStore ? { store: deps.teamsRateLimitStore } : {}),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
      }),
    );
    app.use('/api/teams', createTeamRouter(deps.teams));
  }
  if (deps.marketplace) {
    app.use(
      '/api/marketplace',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 120,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...(deps.marketplaceRateLimitStore ? { store: deps.marketplaceRateLimitStore } : {}),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
      }),
    );
    app.use(
      '/api/seller',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 120,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...(deps.sellerRateLimitStore ? { store: deps.sellerRateLimitStore } : {}),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
      }),
    );
    app.use('/api/marketplace', createMarketplaceRouter(deps.marketplace));
    app.use('/api/seller', createSellerRouter(deps.marketplace));
  }
  if (deps.matches) {
    app.use(
      '/api/matches',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 120,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        ...(deps.matchesRateLimitStore ? { store: deps.matchesRateLimitStore } : {}),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
      }),
    );
    app.use('/api/matches', createMatchRouter(deps.users, deps.matches));
  }
  if (deps.frontendDirectory) {
    app.use(
      express.static(deps.frontendDirectory, {
        fallthrough: true,
        index: 'index.html',
        setHeaders(res, filePath) {
          const extension = path.extname(filePath).toLowerCase();
          res.removeHeader('Content-Security-Policy');
          if (['.html', '.css', '.js'].includes(extension)) {
            res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=300');
          }
        },
      }),
    );
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
