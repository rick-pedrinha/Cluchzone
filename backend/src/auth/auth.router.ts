import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../users/user.types.js';
import { requireAuth } from './auth.middleware.js';
import type { SteamAuthService } from './steam-openid.service.js';

const loginQuery = z.object({ returnTo: z.string().max(500).optional() });

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Session store operation failed');
}

function safeReturnPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/';
  return value;
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(asError(error)) : resolve())),
  );
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save((error) => (error ? reject(asError(error)) : resolve())),
  );
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.destroy((error) => (error ? reject(asError(error)) : resolve())),
  );
}

export function createAuthRouter(
  config: AppConfig,
  users: UserRepository,
  steam: SteamAuthService,
): Router {
  const router = Router();
  const usesCrossSiteSession =
    config.nodeEnv === 'production' &&
    new URL(config.frontendUrl).origin !== new URL(config.backendUrl).origin;

  router.get('/steam', (req, res, next) => {
    const parsed = loginQuery.safeParse(req.query);
    if (!parsed.success) return next(new AppError(400, 'INVALID_INPUT', 'Invalid login request.'));
    req.session.loginReturnPath = safeReturnPath(parsed.data.returnTo);
    req.session.save((error) => (error ? next(error) : res.redirect(303, steam.createLoginUrl())));
  });

  router.get('/steam/callback', async (req, res, next) => {
    try {
      const callbackUrl = `${new URL(config.backendUrl).origin}${req.originalUrl}`;
      const profile = await steam.verifyAndFetchProfile(callbackUrl);
      const user = await users.upsertFromSteam(profile);
      if (user.status !== 'ACTIVE')
        throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is not active.');
      const returnPath = safeReturnPath(req.session.loginReturnPath);
      await regenerateSession(req);
      req.session.userId = user.id;
      await saveSession(req);
      res.redirect(303, new URL(returnPath, config.frontendUrl).toString());
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const user = await users.findById(req.session.userId!);
      if (!user || user.status !== 'ACTIVE') {
        await destroySession(req);
        throw new AppError(401, 'INVALID_SESSION', 'The session is no longer valid.');
      }
      res.set('Cache-Control', 'no-store').json({ ok: true, user });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      await destroySession(req);
      res.clearCookie('clutchzone.sid', {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: usesCrossSiteSession ? 'none' : 'lax',
        path: '/',
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
