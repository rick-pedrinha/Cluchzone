import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import type { MarketplaceRepository } from './marketplace.types.js';

const listingIdSchema = z.string().uuid();
const filtersSchema = z.object({
  kind: z.enum(['SPONSORSHIP', 'STREAMER_SERVICE', 'PRODUCT']).optional(),
  game: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
const orderSchema = z.object({
  quantity: z.number().int().min(1).max(100).default(1),
  brief: z.string().trim().min(10).max(500),
}).strict();

function invalidInput(): AppError {
  return new AppError(400, 'INVALID_MARKETPLACE_INPUT', 'Invalid marketplace request.');
}

export function createMarketplaceRouter(marketplace: MarketplaceRepository): Router {
  const router = Router();
  router.get('/listings', async (req, res, next) => {
    try {
      const filters = filtersSchema.safeParse(req.query);
      if (!filters.success) throw invalidInput();
      const listings = await marketplace.listPublished({
        ...(filters.data.kind ? { kind: filters.data.kind } : {}),
        ...(filters.data.game ? { game: filters.data.game } : {}),
        ...(filters.data.q ? { query: filters.data.q } : {}),
      });
      res.set('Cache-Control', 'public, max-age=30').json({ ok: true, listings });
    } catch (error) {
      next(error);
    }
  });

  router.post('/listings/:listingId/orders', requireAuth, async (req, res, next) => {
    try {
      const listingId = listingIdSchema.safeParse(req.params.listingId);
      const body = orderSchema.safeParse(req.body);
      if (!listingId.success || !body.success) throw invalidInput();
      const order = await marketplace.createOrder(req.session.userId!, listingId.data, body.data.quantity, body.data.brief);
      res.status(201).json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
