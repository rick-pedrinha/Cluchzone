import type { EventPublisher, OutboxRepository } from './outbox.types.js';

export class OutboxDispatcher {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly publisher: EventPublisher,
    private readonly workerId: string,
    private readonly batchSize: number,
    private readonly leaseMs: number,
  ) {}

  async dispatchOnce(): Promise<number> {
    const events = await this.repository.claimBatch(this.workerId, this.batchSize, this.leaseMs);
    if (events.length === 0) return 0;
    const eventIds = events.map(event => event.id);
    try {
      await this.publisher.publishBatch(events);
      await this.repository.markPublished(this.workerId, eventIds);
      return events.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown event publishing failure';
      await this.repository.releaseFailed(this.workerId, eventIds, message);
      throw error;
    }
  }
}
