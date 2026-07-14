import type { PrismaClient } from '@prisma/client';

export interface StateRepository {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
}

export class PrismaStateRepository implements StateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string): Promise<unknown> {
    return (await this.prisma.appState.findUnique({ where: { key } }))?.value ?? null;
  }

  async set(key: string, value: unknown): Promise<unknown> {
    const json = JSON.parse(JSON.stringify(value)) as object;
    const record = await this.prisma.appState.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
    return record.value;
  }
}
