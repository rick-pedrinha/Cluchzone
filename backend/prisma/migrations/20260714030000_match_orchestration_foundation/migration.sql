CREATE TYPE "MatchFormat" AS ENUM ('BEST_OF_1', 'BEST_OF_3');
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'CHECK_IN', 'VETO', 'PROVISIONING', 'READY', 'LIVE', 'COMPLETED', 'RELEASING', 'RELEASED', 'FAILED', 'RETRYING', 'CANCELLED');
CREATE TYPE "MatchParticipantRole" AS ENUM ('PLAYER', 'CAPTAIN', 'COACH');
CREATE TYPE "GameServerStatus" AS ENUM ('REQUESTED', 'PROVISIONING', 'READY', 'LIVE', 'RELEASING', 'RELEASED', 'FAILED');

CREATE TABLE "matches" (
  "id" UUID NOT NULL,
  "tournament_ref" VARCHAR(100),
  "created_by_id" UUID NOT NULL,
  "format" "MatchFormat" NOT NULL,
  "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "region_code" VARCHAR(32),
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_participants" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "team_ref" VARCHAR(100) NOT NULL,
  "role" "MatchParticipantRole" NOT NULL DEFAULT 'PLAYER',
  "checked_in_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_latencies" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "region_code" VARCHAR(32) NOT NULL,
  "latency_ms" INTEGER NOT NULL,
  "measured_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "match_latencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_server_allocations" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "provider_server_id" VARCHAR(255),
  "region_code" VARCHAR(32) NOT NULL,
  "status" "GameServerStatus" NOT NULL DEFAULT 'REQUESTED',
  "secret_ref" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "released_at" TIMESTAMPTZ(3),
  CONSTRAINT "game_server_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "aggregate_type" VARCHAR(80) NOT NULL,
  "aggregate_id" VARCHAR(100) NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "idempotency_key" VARCHAR(180) NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(3),
  "locked_until" TIMESTAMPTZ(3),
  "locked_by" VARCHAR(100),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_entries" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "resource_type" VARCHAR(80) NOT NULL,
  "resource_id" VARCHAR(100) NOT NULL,
  "metadata" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "matches_status_scheduled_at_idx" ON "matches"("status", "scheduled_at");
CREATE INDEX "matches_created_by_id_idx" ON "matches"("created_by_id");
CREATE UNIQUE INDEX "match_participants_match_id_user_id_key" ON "match_participants"("match_id", "user_id");
CREATE INDEX "match_participants_user_id_idx" ON "match_participants"("user_id");
CREATE UNIQUE INDEX "match_latencies_match_id_user_id_region_code_key" ON "match_latencies"("match_id", "user_id", "region_code");
CREATE INDEX "match_latencies_match_id_region_code_idx" ON "match_latencies"("match_id", "region_code");
CREATE INDEX "game_server_allocations_status_created_at_idx" ON "game_server_allocations"("status", "created_at");
CREATE INDEX "game_server_allocations_match_id_idx" ON "game_server_allocations"("match_id");
CREATE UNIQUE INDEX "outbox_events_idempotency_key_key" ON "outbox_events"("idempotency_key");
CREATE INDEX "outbox_events_published_at_locked_until_occurred_at_idx" ON "outbox_events"("published_at", "locked_until", "occurred_at");
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");
CREATE INDEX "audit_entries_resource_type_resource_id_occurred_at_idx" ON "audit_entries"("resource_type", "resource_id", "occurred_at");
CREATE INDEX "audit_entries_actor_id_occurred_at_idx" ON "audit_entries"("actor_id", "occurred_at");

ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_latencies" ADD CONSTRAINT "match_latencies_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_server_allocations" ADD CONSTRAINT "game_server_allocations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
