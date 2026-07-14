import { Prisma, type PrismaClient } from '@prisma/client';
import type { ClientRateLimitInfo, Store } from 'express-rate-limit';

type RateRow = { count: number; reset_at: Date };

export class PrismaRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;

  constructor(private readonly prisma: PrismaClient, prefix = 'rl:') {
    this.prefix = prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const reset = new Date(Date.now() + this.windowMs);
    const rows = await this.prisma.$queryRaw<RateRow[]>(Prisma.sql`
      INSERT INTO "rate_limits" ("key", "count", "reset_at", "updated_at")
      VALUES (${this.prefix + key}, 1, ${reset}, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limits"."reset_at" <= NOW() THEN 1 ELSE "rate_limits"."count" + 1 END,
        "reset_at" = CASE WHEN "rate_limits"."reset_at" <= NOW() THEN ${reset} ELSE "rate_limits"."reset_at" END,
        "updated_at" = NOW()
      RETURNING "count", "reset_at"
    `);
    const row = rows[0];
    if (!row) throw new Error('Rate limit update failed');
    return { totalHits: row.count, resetTime: row.reset_at };
  }

  async decrement(key: string): Promise<void> {
    await this.prisma.rateLimit.updateMany({ where: { key: this.prefix + key, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
  }

  async resetKey(key: string): Promise<void> {
    await this.prisma.rateLimit.deleteMany({ where: { key: this.prefix + key } });
  }
}
