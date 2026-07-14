export type SellerCategory = 'SPONSOR' | 'STREAMER' | 'MERCHANT' | 'AGENCY';
export type ListingKind = 'SPONSORSHIP' | 'STREAMER_SERVICE' | 'PRODUCT';
export type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';

export type SellerView = {
  id: string;
  storeName: string;
  slug: string;
  category: SellerCategory;
  description: string;
  websiteUrl: string | null;
  verified: boolean;
};

export type ListingView = {
  id: string;
  kind: ListingKind;
  status: ListingStatus;
  title: string;
  description: string;
  game: string;
  audience: string | null;
  priceCents: number;
  stockQuantity: number;
  imageUrl: string | null;
  seller: SellerView;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderView = {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerUserId: string;
  buyerDisplayName: string;
  quantity: number;
  totalCents: number;
  status: OrderStatus;
  brief: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SellerDashboard = {
  seller: SellerView | null;
  listings: ListingView[];
  orders: OrderView[];
  metrics: {
    totalListings: number;
    publishedListings: number;
    pendingOrders: number;
    completedRevenueCents: number;
  };
};

export type SellerProfileInput = {
  storeName: string;
  category: SellerCategory;
  description: string;
  websiteUrl: string | null;
};

export type ListingInput = {
  kind: ListingKind;
  title: string;
  description: string;
  game: string;
  audience: string | null;
  priceCents: number;
  stockQuantity: number;
  imageUrl: string | null;
};

export interface MarketplaceRepository {
  listPublished(filters: { kind?: ListingKind; game?: string; query?: string }): Promise<ListingView[]>;
  upsertSeller(userId: string, input: SellerProfileInput): Promise<SellerView>;
  getDashboard(userId: string): Promise<SellerDashboard>;
  createListing(userId: string, input: ListingInput): Promise<ListingView>;
  updateListingStatus(userId: string, listingId: string, status: ListingStatus): Promise<ListingView>;
  createOrder(buyerUserId: string, listingId: string, quantity: number, brief: string): Promise<OrderView>;
  updateOrderStatus(userId: string, orderId: string, status: OrderStatus): Promise<OrderView>;
}
