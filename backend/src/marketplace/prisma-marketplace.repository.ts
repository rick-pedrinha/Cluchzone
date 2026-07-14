import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { slugify } from '../shared/slug.js';
import type { ListingInput, ListingStatus, ListingView, MarketplaceRepository, OrderStatus, OrderView, SellerDashboard, SellerProfileInput, SellerView } from './marketplace.types.js';

const listingInclude = { seller: true } satisfies Prisma.MarketplaceListingInclude;
type DatabaseListing = Prisma.MarketplaceListingGetPayload<{ include: typeof listingInclude }>;
type DatabaseSeller = Prisma.MarketplaceSellerGetPayload<Record<string, never>>;

function mapSeller(seller: DatabaseSeller): SellerView {
  return {
    id: seller.id,
    storeName: seller.storeName,
    slug: seller.slug,
    category: seller.category,
    description: seller.description,
    websiteUrl: seller.websiteUrl,
    currencyCode: seller.currencyCode,
    verified: seller.verified,
  };
}

function mapListing(listing: DatabaseListing): ListingView {
  return {
    id: listing.id,
    kind: listing.kind,
    status: listing.status,
    title: listing.title,
    description: listing.description,
    game: listing.game,
    audience: listing.audience,
    priceCents: listing.priceCents,
    currencyCode: listing.currencyCode,
    stockQuantity: listing.stockQuantity,
    imageUrl: listing.imageUrl,
    seller: mapSeller(listing.seller),
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

export class PrismaMarketplaceRepository implements MarketplaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listPublished(filters: { kind?: ListingView['kind']; game?: string; query?: string }): Promise<ListingView[]> {
    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: 'PUBLISHED',
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.game ? { game: { equals: filters.game, mode: 'insensitive' } } : {}),
        ...(filters.query ? {
          OR: [
            { title: { contains: filters.query, mode: 'insensitive' } },
            { description: { contains: filters.query, mode: 'insensitive' } },
            { seller: { storeName: { contains: filters.query, mode: 'insensitive' } } },
          ],
        } : {}),
      },
      include: listingInclude,
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    return listings.map(mapListing);
  }

  async upsertSeller(userId: string, input: SellerProfileInput): Promise<SellerView> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' } });
    if (!user) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    const slugBase = slugify(input.storeName);
    if (!slugBase) throw new AppError(400, 'INVALID_SELLER_NAME', 'Invalid seller name.');
    const existing = await this.prisma.marketplaceSeller.findUnique({ where: { userId } });
    const slug = existing?.slug ?? `${slugBase}-${userId.slice(0, 8)}`;
    const seller = await this.prisma.marketplaceSeller.upsert({
      where: { userId },
      create: { userId, slug, ...input },
      update: input,
    });
    await this.prisma.auditEntry.create({
      data: { actorId: userId, action: 'seller.profile_saved', resourceType: 'marketplace_seller', resourceId: seller.id, metadata: { category: seller.category } },
    });
    return mapSeller(seller);
  }

  async getDashboard(userId: string): Promise<SellerDashboard> {
    const seller = await this.prisma.marketplaceSeller.findUnique({ where: { userId } });
    if (!seller) {
      return { seller: null, listings: [], orders: [], metrics: { totalListings: 0, publishedListings: 0, pendingOrders: 0, completedRevenueCents: 0, completedRevenueByCurrency: [] } };
    }
    const [listings, orders, revenueByCurrency] = await Promise.all([
      this.prisma.marketplaceListing.findMany({ where: { sellerId: seller.id }, include: listingInclude, orderBy: { createdAt: 'desc' } }),
      this.prisma.marketplaceOrder.findMany({ where: { sellerId: seller.id }, include: { listing: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.marketplaceOrder.groupBy({ by: ['currencyCode'], where: { sellerId: seller.id, status: 'COMPLETED' }, _sum: { totalCents: true } }),
    ]);
    const buyers = await this.prisma.user.findMany({ where: { id: { in: [...new Set(orders.map(order => order.buyerUserId))] } } });
    const buyersById = new Map(buyers.map(buyer => [buyer.id, buyer.displayName]));
    return {
      seller: mapSeller(seller),
      listings: listings.map(mapListing),
      orders: orders.map(order => ({
        id: order.id,
        listingId: order.listingId,
        listingTitle: order.listing.title,
        buyerUserId: order.buyerUserId,
        buyerDisplayName: buyersById.get(order.buyerUserId) ?? 'Jogador ClutchZone',
        quantity: order.quantity,
        totalCents: order.totalCents,
        currencyCode: order.currencyCode,
        status: order.status,
        brief: order.brief,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      metrics: {
        totalListings: listings.length,
        publishedListings: listings.filter(listing => listing.status === 'PUBLISHED').length,
        pendingOrders: orders.filter(order => order.status === 'PENDING').length,
        completedRevenueCents: revenueByCurrency.find(item => item.currencyCode === seller.currencyCode)?._sum.totalCents ?? 0,
        completedRevenueByCurrency: revenueByCurrency.map(item => ({ currencyCode: item.currencyCode, totalCents: item._sum.totalCents ?? 0 })),
      },
    };
  }

  async createListing(userId: string, input: ListingInput): Promise<ListingView> {
    const seller = await this.prisma.marketplaceSeller.findUnique({ where: { userId } });
    if (!seller) throw new AppError(409, 'SELLER_PROFILE_REQUIRED', 'Create your seller profile before publishing listings.');
    const listing = await this.prisma.marketplaceListing.create({ data: { sellerId: seller.id, currencyCode: seller.currencyCode, ...input }, include: listingInclude });
    await this.prisma.auditEntry.create({
      data: { actorId: userId, action: 'marketplace.listing_created', resourceType: 'marketplace_listing', resourceId: listing.id, metadata: { kind: listing.kind } },
    });
    return mapListing(listing);
  }

  async updateListingStatus(userId: string, listingId: string, status: ListingStatus): Promise<ListingView> {
    const listing = await this.prisma.marketplaceListing.findUnique({ where: { id: listingId }, include: listingInclude });
    if (!listing || listing.seller.userId !== userId) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing was not found.');
    const transitions: Record<ListingStatus, ListingStatus[]> = {
      DRAFT: ['PUBLISHED', 'ARCHIVED'],
      PUBLISHED: ['PAUSED', 'ARCHIVED'],
      PAUSED: ['PUBLISHED', 'ARCHIVED'],
      ARCHIVED: [],
    };
    if (!transitions[listing.status].includes(status)) throw new AppError(409, 'INVALID_LISTING_TRANSITION', 'Invalid listing status transition.');
    const updated = await this.prisma.$transaction(async transaction => {
      const changed = await transaction.marketplaceListing.update({ where: { id: listingId }, data: { status }, include: listingInclude });
      await transaction.auditEntry.create({
        data: { actorId: userId, action: 'marketplace.listing_status_changed', resourceType: 'marketplace_listing', resourceId: listingId, metadata: { from: listing.status, to: status } },
      });
      return changed;
    });
    return mapListing(updated);
  }

  async createOrder(buyerUserId: string, listingId: string, quantity: number, brief: string): Promise<OrderView> {
    return this.prisma.$transaction(async transaction => {
      const buyer = await transaction.user.findFirst({ where: { id: buyerUserId, status: 'ACTIVE' } });
      if (!buyer) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
      const listing = await transaction.marketplaceListing.findUnique({ where: { id: listingId }, include: listingInclude });
      if (!listing || listing.status !== 'PUBLISHED') throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing was not found.');
      if (listing.seller.userId === buyerUserId) throw new AppError(409, 'OWN_LISTING_ORDER', 'You cannot order your own listing.');
      if (listing.kind === 'PRODUCT' && listing.stockQuantity < quantity) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock.');
      if (listing.kind !== 'PRODUCT' && quantity !== 1) throw new AppError(400, 'INVALID_ORDER_QUANTITY', 'Partnership requests must use quantity one.');
      const order = await transaction.marketplaceOrder.create({
        data: { listingId, sellerId: listing.sellerId, buyerUserId, quantity, totalCents: listing.priceCents * quantity, currencyCode: listing.currencyCode, brief },
      });
      await transaction.auditEntry.create({
        data: { actorId: buyerUserId, action: 'marketplace.order_created', resourceType: 'marketplace_order', resourceId: order.id, metadata: { listingId } },
      });
      return {
        id: order.id,
        listingId,
        listingTitle: listing.title,
        buyerUserId,
        buyerDisplayName: buyer.displayName,
        quantity,
        totalCents: order.totalCents,
        currencyCode: order.currencyCode,
        status: order.status,
        brief: order.brief,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });
  }

  async updateOrderStatus(userId: string, orderId: string, status: OrderStatus): Promise<OrderView> {
    return this.prisma.$transaction(async transaction => {
      const seller = await transaction.marketplaceSeller.findUnique({ where: { userId } });
      const order = seller ? await transaction.marketplaceOrder.findFirst({ where: { id: orderId, sellerId: seller.id }, include: { listing: true } }) : null;
      if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order was not found.');
      const allowed = order.status === 'PENDING' ? ['ACCEPTED', 'CANCELLED'] : order.status === 'ACCEPTED' ? ['COMPLETED', 'CANCELLED'] : [];
      if (!allowed.includes(status)) throw new AppError(409, 'INVALID_ORDER_TRANSITION', 'Invalid order status transition.');
      if (status === 'ACCEPTED' && order.listing.kind === 'PRODUCT') {
        const stock = await transaction.marketplaceListing.updateMany({
          where: { id: order.listingId, stockQuantity: { gte: order.quantity } },
          data: { stockQuantity: { decrement: order.quantity } },
        });
        if (stock.count !== 1) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock.');
      }
      if (status === 'CANCELLED' && order.status === 'ACCEPTED' && order.listing.kind === 'PRODUCT') {
        await transaction.marketplaceListing.update({
          where: { id: order.listingId },
          data: { stockQuantity: { increment: order.quantity } },
        });
      }
      const updated = await transaction.marketplaceOrder.update({ where: { id: order.id }, data: { status } });
      await transaction.auditEntry.create({
        data: { actorId: userId, action: 'marketplace.order_status_changed', resourceType: 'marketplace_order', resourceId: order.id, metadata: { from: order.status, to: status } },
      });
      const buyer = await transaction.user.findUnique({ where: { id: order.buyerUserId } });
      return {
        id: updated.id,
        listingId: updated.listingId,
        listingTitle: order.listing.title,
        buyerUserId: updated.buyerUserId,
        buyerDisplayName: buyer?.displayName ?? 'Jogador ClutchZone',
        quantity: updated.quantity,
        totalCents: updated.totalCents,
        currencyCode: updated.currencyCode,
        status: updated.status,
        brief: updated.brief,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
