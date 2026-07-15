CREATE TABLE "direct_messages" (
  "id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "direct_messages_sender_id_recipient_id_created_at_idx"
  ON "direct_messages"("sender_id", "recipient_id", "created_at");
CREATE INDEX "direct_messages_recipient_id_sender_id_created_at_idx"
  ON "direct_messages"("recipient_id", "sender_id", "created_at");

ALTER TABLE "direct_messages"
  ADD CONSTRAINT "direct_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_messages"
  ADD CONSTRAINT "direct_messages_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
