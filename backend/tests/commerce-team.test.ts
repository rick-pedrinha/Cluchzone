import express from 'express';
import session from 'express-session';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createMarketplaceRouter } from '../src/marketplace/marketplace.router.js';
import { createSellerRouter } from '../src/marketplace/seller.router.js';
import type { ListingInput, ListingStatus, ListingView, MarketplaceRepository, OrderStatus, OrderView, SellerDashboard, SellerProfileInput, SellerView } from '../src/marketplace/marketplace.types.js';
import { errorHandler, notFound } from '../src/middleware/error.middleware.js';
import { createTeamRouter } from '../src/teams/team.router.js';
import type { CreateTeamInput, TeamMessageView, TeamRepository, TeamView } from '../src/teams/team.types.js';

const userId = '40000000-0000-4000-8000-000000000001';
const teamId = '50000000-0000-4000-8000-000000000001';
const listingId = '60000000-0000-4000-8000-000000000001';

const team: TeamView = {
  id: teamId,
  name: 'Clutch Squad',
  slug: 'clutch-squad',
  tag: 'C4',
  description: null,
  region: 'Brasil',
  captainUserId: userId,
  members: [{ userId, displayName: 'Captain', avatarUrl: null, role: 'CAPTAIN' }],
  createdAt: new Date('2026-07-14T00:00:00.000Z'),
  updatedAt: new Date('2026-07-14T00:00:00.000Z'),
};

class MemoryTeams implements TeamRepository {
  listUserId: string | null = null;
  messageUserId: string | null = null;
  async create(captainUserId: string, input: CreateTeamInput): Promise<TeamView> { void captainUserId; void input; return team; }
  async listMine(targetUserId: string): Promise<TeamView[]> { this.listUserId = targetUserId; return [team]; }
  async listMessages(): Promise<TeamMessageView[]> { return []; }
  async sendMessage(targetTeamId: string, targetUserId: string, text: string): Promise<TeamMessageView> {
    this.messageUserId = targetUserId;
    return { id: '70000000-0000-4000-8000-000000000001', teamId: targetTeamId, userId: targetUserId, displayName: 'Captain', avatarUrl: null, text, createdAt: new Date() };
  }
}

const seller: SellerView = { id: '80000000-0000-4000-8000-000000000001', storeName: 'Clutch Store', slug: 'clutch-store', category: 'MERCHANT', description: 'Equipamentos competitivos selecionados.', websiteUrl: null, verified: false };
const listing: ListingView = { id: listingId, kind: 'PRODUCT', status: 'PUBLISHED', title: 'Mouse competitivo', description: 'Sensor profissional para jogadores competitivos.', game: 'CS2', audience: 'FPS', priceCents: 29990, stockQuantity: 10, imageUrl: null, seller, createdAt: new Date(), updatedAt: new Date() };

class MemoryMarketplace implements MarketplaceRepository {
  dashboardUserId: string | null = null;
  orderBuyerId: string | null = null;
  async listPublished(): Promise<ListingView[]> { return [listing]; }
  async upsertSeller(targetUserId: string, input: SellerProfileInput): Promise<SellerView> { void targetUserId; void input; return seller; }
  async getDashboard(targetUserId: string): Promise<SellerDashboard> {
    this.dashboardUserId = targetUserId;
    return { seller, listings: [listing], orders: [], metrics: { totalListings: 1, publishedListings: 1, pendingOrders: 0, completedRevenueCents: 0 } };
  }
  async createListing(targetUserId: string, input: ListingInput): Promise<ListingView> { void targetUserId; void input; return listing; }
  async updateListingStatus(targetUserId: string, targetListingId: string, status: ListingStatus): Promise<ListingView> { void targetUserId; void targetListingId; void status; return listing; }
  async createOrder(buyerUserId: string, targetListingId: string, quantity: number, brief: string): Promise<OrderView> {
    this.orderBuyerId = buyerUserId;
    return { id: '90000000-0000-4000-8000-000000000001', listingId: targetListingId, listingTitle: listing.title, buyerUserId, buyerDisplayName: 'Buyer', quantity, totalCents: listing.priceCents, status: 'PENDING', brief, createdAt: new Date(), updatedAt: new Date() };
  }
  async updateOrderStatus(targetUserId: string, orderId: string, status: OrderStatus): Promise<OrderView> { void targetUserId; void orderId; void status; throw new Error('not used'); }
}

function app(teams = new MemoryTeams(), marketplace = new MemoryMarketplace()) {
  const target = express();
  target.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  target.use(express.json());
  target.use(session({ secret: 'commerce-tests-secret-that-is-long-enough', resave: false, saveUninitialized: false }));
  target.post('/test-login/:userId', (req, res) => { req.session.userId = req.params.userId; res.sendStatus(204); });
  target.use('/api/teams', createTeamRouter(teams));
  target.use('/api/marketplace', createMarketplaceRouter(marketplace));
  target.use('/api/seller', createSellerRouter(marketplace));
  target.use(notFound);
  target.use(errorHandler);
  return target;
}

describe('private team chat', () => {
  it('requires a backend session to discover team membership', async () => {
    const response = await request(app()).get('/api/teams/mine');
    expect(response.status).toBe(401);
  });

  it('uses only the session user for teams and messages', async () => {
    const teams = new MemoryTeams();
    const agent = request.agent(app(teams));
    await agent.post(`/test-login/${userId}`);
    expect((await agent.get('/api/teams/mine?userId=attacker')).status).toBe(200);
    const sent = await agent
      .post(`/api/teams/${teamId}/messages?userId=attacker`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'Vamos treinar às 20h.' }));
    expect(sent.status).toBe(201);
    expect(teams.listUserId).toBe(userId);
    expect(teams.messageUserId).toBe(userId);
  });
});

describe('marketplace and seller ERP', () => {
  it('keeps the published marketplace public', async () => {
    const response = await request(app()).get('/api/marketplace/listings?kind=PRODUCT');
    expect(response.status).toBe(200);
    expect(response.body.listings[0].title).toBe('Mouse competitivo');
  });

  it('requires a session for partnership requests and the seller dashboard', async () => {
    const target = app();
    expect((await request(target).get('/api/seller/dashboard')).status).toBe(401);
    const order = await request(target)
      .post(`/api/marketplace/listings/${listingId}/orders`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ quantity: 1, brief: 'Quero negociar esta oportunidade para meu time.' }));
    expect(order.status).toBe(401);
  });

  it('attributes dashboard and order mutations to the session user', async () => {
    const marketplace = new MemoryMarketplace();
    const agent = request.agent(app(new MemoryTeams(), marketplace));
    await agent.post(`/test-login/${userId}`);
    expect((await agent.get('/api/seller/dashboard?userId=attacker')).status).toBe(200);
    const order = await agent
      .post(`/api/marketplace/listings/${listingId}/orders?buyerUserId=attacker`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ quantity: 1, brief: 'Quero negociar esta oportunidade para meu time.' }));
    expect(order.status).toBe(201);
    expect(marketplace.dashboardUserId).toBe(userId);
    expect(marketplace.orderBuyerId).toBe(userId);
  });
});
