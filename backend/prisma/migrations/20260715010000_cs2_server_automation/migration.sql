-- Additive CS2 dedicated-server orchestration metadata.
CREATE TYPE "GameServerCommandType" AS ENUM ('PAUSE', 'UNPAUSE', 'RESTART', 'RELEASE');
CREATE TYPE "GameServerCommandStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "game_server_allocations"
  ADD COLUMN "public_host" VARCHAR(255),
  ADD COLUMN "game_port" INTEGER,
  ADD COLUMN "rcon_port" INTEGER,
  ADD COLUMN "encrypted_password" TEXT,
  ADD COLUMN "encrypted_rcon_password" TEXT,
  ADD COLUMN "last_heartbeat_at" TIMESTAMPTZ(3);

CREATE TABLE "game_server_commands" (
  "id" UUID NOT NULL,
  "allocation_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "type" "GameServerCommandType" NOT NULL,
  "status" "GameServerCommandStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" VARCHAR(180) NOT NULL,
  "error_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(3),
  CONSTRAINT "game_server_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_server_commands_idempotency_key_key" ON "game_server_commands"("idempotency_key");
CREATE INDEX "game_server_commands_status_created_at_idx" ON "game_server_commands"("status", "created_at");
CREATE INDEX "game_server_commands_allocation_id_created_at_idx" ON "game_server_commands"("allocation_id", "created_at");

ALTER TABLE "game_server_commands"
  ADD CONSTRAINT "game_server_commands_allocation_id_fkey"
  FOREIGN KEY ("allocation_id") REFERENCES "game_server_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_server_commands"
  ADD CONSTRAINT "game_server_commands_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
