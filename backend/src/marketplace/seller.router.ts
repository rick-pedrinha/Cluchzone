import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { AppError } from '../errors/app-error.js';
import { supportedCurrencyCodes } from '../global/globalization.catalog.js';
import type { MarketplaceRepository } from './marketplace.types.js';

const idSchema = z.string().uuid();
const sellerSchema = z.object({
  storeName: z.string().trim().min(3).max(100),
  category: z.enum(['SPONSOR', 'STREAMER', 'MERCHANT', 'AGENCY']),
  description: z.string().trim().min(20).max(1500),
  websiteUrl: z.url().max(500).nullable().optional(),
  currencyCode: z.enum(supportedCurrencyCodes),
}).strict();
const listingSchema = z.object({
  kind: z.enum(['SPONSORSHIP', 'STREAMER_SERVICE', 'PRODUCT']),
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(20).max(2500),
  game: z.string().trim().min(2).max(60),
  audience: z.string().trim().max(80).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  stockQuantity: z.number().int().min(0).max(1_000_000),
  imageUrl: z.url().max(1000).nullable().optional(),
}).strict();
const listingStatusSchema = z.object({ status: z.enum(['PUBLISHED', 'PAUSED', 'ARCHIVED']) }).strict();
const orderStatusSchema = z.object({ status: z.enum(['ACCEPTED', 'COMPLETED', 'CANCELLED']) }).strict();

function invalidInput(): AppError {
  return new AppError(400, 'INVALID_SELLER_INPUT', 'Invalid seller request.');
}

export function createSellerRouter(marketplace: MarketplaceRepository): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/dashboard', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store').json({ ok: true, dashboard: await marketplace.getDashboard(req.session.userId!) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/profile', async (req, res, next) => {
    try {
      const body = sellerSchema.safeParse(req.body);
      if (!body.success) throw invalidInput();
      const seller = await marketplace.upsertSeller(req.session.userId!, { ...body.data, websiteUrl: body.data.websiteUrl ?? null });
      res.json({ ok: true, seller });
    } catch (error) {
      next(error);
    }
  });

  router.post('/listings', async (req, res, next) => {
    try {
      const body = listingSchema.safeParse(req.body);
      if (!body.success) throw invalidInput();
      const listing = await marketplace.createListing(req.session.userId!, {
        ...body.data,
        audience: body.data.audience ?? null,
        imageUrl: body.data.imageUrl ?? null,
      });
      res.status(201).json({ ok: true, listing });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/listings/:listingId/status', async (req, res, next) => {
    try {
      const listingId = idSchema.safeParse(req.params.listingId);
      const body = listingStatusSchema.safeParse(req.body);
      if (!listingId.success || !body.success) throw invalidInput();
      res.json({ ok: true, listing: await marketplace.updateListingStatus(req.session.userId!, listingId.data, body.data.status) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/orders/:orderId/status', async (req, res, next) => {
    try {
      const orderId = idSchema.safeParse(req.params.orderId);
      const body = orderStatusSchema.safeParse(req.body);
      if (!orderId.success || !body.success) throw invalidInput();
      res.json({ ok: true, order: await marketplace.updateOrderStatus(req.session.userId!, orderId.data, body.data.status) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
