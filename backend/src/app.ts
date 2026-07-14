import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit, { type Store } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { createAuthRouter } from './auth/auth.router.js';
import type { SteamAuthService } from './auth/steam-openid.service.js';
import type { AppConfig } from './config/env.js';
import { logger as defaultLogger } from './config/logger.js';
import { AppError } from './errors/app-error.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { createStateRouter } from './state/state.router.js';
import type { StateRepository } from './state/state.repository.js';
import type { UserRepository } from './users/user.types.js';

export type AppDependencies = {
  config: AppConfig;
  users: UserRepository;
  steam: SteamAuthService;
  sessionStore: session.Store;
  rateLimitStore?: Store;
  logger?: Logger;
  states?: StateRepository;
};

export function createApp(deps: AppDependencies): Express {
  const { config } = deps;
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(pinoHttp({ logger: deps.logger ?? defaultLogger }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
      else callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed.'));
    },
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(session({
    name: 'clutchzone.sid',
    secret: config.sessionSecret,
    store: deps.sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    },
  }));

  app.use('/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(deps.rateLimitStore ? { store: deps.rateLimitStore } : {}),
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')),
  }));

  app.get('/health', (_req, res) => res.status(200).json({ ok: true, service: 'clutchzone-backend' }));
  app.use('/auth', createAuthRouter(config, deps.users, deps.steam));
  if (deps.states) app.use('/api/store', createStateRouter(deps.states));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
