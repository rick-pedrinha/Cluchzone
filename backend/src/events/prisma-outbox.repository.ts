import { Prisma, type PrismaClient } from '@prisma/client';
import type { OutboxMessage, OutboxRepository } from './outbox.types.js';

type ClaimedOutboxRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  occurredAt: Date;
  attempts: number;
};

export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async claimBatch(workerId: string, limit: number, leaseMs: number): Promise<OutboxMessage[]> {
    return this.prisma.$transaction(async transaction => transaction.$queryRaw<ClaimedOutboxRow[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "outbox_events"
        WHERE "published_at" IS NULL
          AND ("locked_until" IS NULL OR "locked_until" < NOW())
        ORDER BY "occurred_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "outbox_events" AS event
      SET "locked_by" = ${workerId},
          "locked_until" = NOW() + (${leaseMs} * INTERVAL '1 millisecond'),
          "attempts" = event."attempts" + 1
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id",
                event."aggregate_type" AS "aggregateType",
                event."aggregate_id" AS "aggregateId",
                event."event_type" AS "eventType",
                event."payload",
                event."occurred_at" AS "occurredAt",
                event."attempts"
    `));
  }

  async markPublished(workerId: string, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: eventIds }, lockedBy: workerId, publishedAt: null },
      data: { publishedAt: new Date(), lockedBy: null, lockedUntil: null, lastError: null },
    });
  }

  async releaseFailed(workerId: string, eventIds: string[], error: string): Promise<void> {
    if (eventIds.length === 0) return;
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: eventIds }, lockedBy: workerId, publishedAt: null },
      data: { lockedBy: null, lockedUntil: null, lastError: error.slice(0, 2000) },
    });
  }
}
