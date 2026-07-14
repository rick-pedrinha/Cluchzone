ALTER TABLE "users"
  ADD COLUMN "steam_level" INTEGER,
  ADD COLUMN "visibility_state" INTEGER,
  ADD COLUMN "profile_state" INTEGER,
  ADD COLUMN "persona_state" INTEGER,
  ADD COLUMN "country_code" VARCHAR(2),
  ADD COLUMN "state_code" VARCHAR(10),
  ADD COLUMN "steam_created_at" TIMESTAMPTZ(3),
  ADD COLUMN "last_logoff_at" TIMESTAMPTZ(3);

ALTER TABLE "users"
  ADD CONSTRAINT "users_steam_level_check" CHECK ("steam_level" IS NULL OR "steam_level" >= 0),
  ADD CONSTRAINT "users_visibility_state_check" CHECK ("visibility_state" IS NULL OR "visibility_state" BETWEEN 0 AND 3),
  ADD CONSTRAINT "users_persona_state_check" CHECK ("persona_state" IS NULL OR "persona_state" BETWEEN 0 AND 6);
