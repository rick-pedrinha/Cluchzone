import { describe, expect, it } from 'vitest';
import { OutboxDispatcher } from '../src/events/outbox-dispatcher.js';
import type { EventPublisher, OutboxMessage, OutboxRepository } from '../src/events/outbox.types.js';

const event: OutboxMessage = {
  id: '30000000-0000-4000-8000-000000000001',
  aggregateType: 'match',
  aggregateId: '20000000-0000-4000-8000-000000000001',
  eventType: 'match.provisioning.requested',
  payload: { regionCode: 'sao-paulo' },
  occurredAt: new Date('2026-07-14T00:00:00.000Z'),
  attempts: 1,
};

class MemoryOutbox implements OutboxRepository {
  published: string[] = [];
  released: string[] = [];
  constructor(private readonly events: OutboxMessage[]) {}
  async claimBatch(): Promise<OutboxMessage[]> { return this.events; }
  async markPublished(_workerId: string, eventIds: string[]): Promise<void> { this.published = eventIds; }
  async releaseFailed(_workerId: string, eventIds: string[]): Promise<void> { this.released = eventIds; }
}

class MemoryPublisher implements EventPublisher {
  received: OutboxMessage[] = [];
  constructor(private readonly failure: Error | null = null) {}
  async publishBatch(events: OutboxMessage[]): Promise<void> {
    if (this.failure) throw this.failure;
    this.received = events;
  }
  async close(): Promise<void> {}
}

describe('transactional outbox dispatcher', () => {
  it('marks events only after the publisher confirms the batch', async () => {
    const repository = new MemoryOutbox([event]);
    const publisher = new MemoryPublisher();
    const dispatcher = new OutboxDispatcher(repository, publisher, 'worker-1', 50, 30000);

    expect(await dispatcher.dispatchOnce()).toBe(1);
    expect(publisher.received).toEqual([event]);
    expect(repository.published).toEqual([event.id]);
    expect(repository.released).toEqual([]);
  });

  it('releases the lease for retry when publishing fails', async () => {
    const repository = new MemoryOutbox([event]);
    const dispatcher = new OutboxDispatcher(repository, new MemoryPublisher(new Error('broker unavailable')), 'worker-1', 50, 30000);

    await expect(dispatcher.dispatchOnce()).rejects.toThrow('broker unavailable');
    expect(repository.published).toEqual([]);
    expect(repository.released).toEqual([event.id]);
  });
});
