export type OutboxMessage = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  occurredAt: Date;
  attempts: number;
};

export interface OutboxRepository {
  claimBatch(workerId: string, limit: number, leaseMs: number): Promise<OutboxMessage[]>;
  markPublished(workerId: string, eventIds: string[]): Promise<void>;
  releaseFailed(workerId: string, eventIds: string[], error: string): Promise<void>;
}

export interface EventPublisher {
  publishBatch(events: OutboxMessage[]): Promise<void>;
  close(): Promise<void>;
}
