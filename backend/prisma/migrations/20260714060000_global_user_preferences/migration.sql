ALTER TABLE "users"
  ADD COLUMN "preferred_locale" VARCHAR(16),
  ADD COLUMN "time_zone" VARCHAR(64),
  ADD COLUMN "currency_code" VARCHAR(3),
  ADD COLUMN "region_code" VARCHAR(32);

ALTER TABLE "marketplace_sellers"
  ADD COLUMN "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL';

ALTER TABLE "marketplace_listings"
  ADD COLUMN "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL';

ALTER TABLE "marketplace_orders"
  ADD COLUMN "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL';
