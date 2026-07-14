CREATE TYPE "TeamMemberRole" AS ENUM ('CAPTAIN', 'VICE_CAPTAIN', 'PLAYER', 'RESERVE');
CREATE TYPE "MarketplaceSellerCategory" AS ENUM ('SPONSOR', 'STREAMER', 'MERCHANT', 'AGENCY');
CREATE TYPE "MarketplaceListingKind" AS ENUM ('SPONSORSHIP', 'STREAMER_SERVICE', 'PRODUCT');
CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "teams" (
  "id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "tag" VARCHAR(12) NOT NULL,
  "description" TEXT,
  "region" VARCHAR(80) NOT NULL,
  "captain_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_members" (
  "id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "TeamMemberRole" NOT NULL DEFAULT 'PLAYER',
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_messages" (
  "id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_sellers" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "store_name" VARCHAR(100) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "category" "MarketplaceSellerCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "website_url" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "marketplace_sellers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_listings" (
  "id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "kind" "MarketplaceListingKind" NOT NULL,
  "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
  "title" VARCHAR(140) NOT NULL,
  "description" TEXT NOT NULL,
  "game" VARCHAR(60) NOT NULL,
  "audience" VARCHAR(80),
  "price_cents" INTEGER NOT NULL,
  "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  "image_url" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_orders" (
  "id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "buyer_user_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "total_cents" INTEGER NOT NULL,
  "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING',
  "brief" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");
CREATE INDEX "teams_captain_user_id_idx" ON "teams"("captain_user_id");
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");
CREATE INDEX "team_messages_team_id_created_at_idx" ON "team_messages"("team_id", "created_at");
CREATE UNIQUE INDEX "marketplace_sellers_user_id_key" ON "marketplace_sellers"("user_id");
CREATE UNIQUE INDEX "marketplace_sellers_slug_key" ON "marketplace_sellers"("slug");
CREATE INDEX "marketplace_listings_status_kind_created_at_idx" ON "marketplace_listings"("status", "kind", "created_at");
CREATE INDEX "marketplace_listings_seller_id_status_idx" ON "marketplace_listings"("seller_id", "status");
CREATE INDEX "marketplace_orders_seller_id_status_created_at_idx" ON "marketplace_orders"("seller_id", "status", "created_at");
CREATE INDEX "marketplace_orders_buyer_user_id_created_at_idx" ON "marketplace_orders"("buyer_user_id", "created_at");

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "marketplace_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
