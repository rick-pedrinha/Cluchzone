import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import type { UserRepository } from '../users/user.types.js';
import {
  communityRegionCodes,
  communityRegions,
  isValidTimeZone,
  localeCodes,
  matchRegions,
  supportedCurrencyCodes,
  supportedLocales,
} from './globalization.catalog.js';

const preferencesSchema = z.object({
  preferredLocale: z.enum(localeCodes),
  timeZone: z.string().trim().min(1).max(64).refine(isValidTimeZone),
  currencyCode: z.enum(supportedCurrencyCodes),
  regionCode: z.enum(communityRegionCodes),
}).strict();

function unavailable(): AppError {
  return new AppError(401, 'INVALID_SESSION', 'The session is no longer valid.');
}

export function createGlobalizationRouter(users: UserRepository): Router {
  const router = Router();

  router.get('/catalog', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').json({
      ok: true,
      locales: supportedLocales,
      currencies: supportedCurrencyCodes,
      communityRegions,
      matchRegions,
    });
  });

  router.get('/preferences', requireAuth, async (req, res, next) => {
    try {
      const user = await users.findById(req.session.userId!);
      if (!user || user.status !== 'ACTIVE') throw unavailable();
      res.set('Cache-Control', 'no-store').json({
        ok: true,
        preferences: {
          preferredLocale: user.preferredLocale,
          timeZone: user.timeZone,
          currencyCode: user.currencyCode,
          regionCode: user.regionCode,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/preferences', requireAuth, async (req, res, next) => {
    try {
      const body = preferencesSchema.safeParse(req.body);
      if (!body.success) throw new AppError(400, 'INVALID_GLOBAL_PREFERENCES', 'Invalid global preferences.');
      const user = await users.updatePreferences(req.session.userId!, body.data);
      if (!user) throw unavailable();
      res.set('Cache-Control', 'no-store').json({
        ok: true,
        preferences: {
          preferredLocale: user.preferredLocale,
          timeZone: user.timeZone,
          currencyCode: user.currencyCode,
          regionCode: user.regionCode,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
