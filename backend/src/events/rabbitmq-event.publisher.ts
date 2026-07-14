import { once } from 'node:events';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import type { EventPublisher, OutboxMessage } from './outbox.types.js';

export class RabbitMqEventPublisher implements EventPublisher {
  private constructor(
    private readonly connection: ChannelModel,
    private readonly channel: ConfirmChannel,
    private readonly exchange: string,
  ) {}

  static async create(url: string, exchange: string, matchQueue: string): Promise<RabbitMqEventPublisher> {
    const connection = await connect(url);
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(matchQueue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
    await channel.bindQueue(matchQueue, exchange, 'match.#');
    return new RabbitMqEventPublisher(connection, channel, exchange);
  }

  async publishBatch(events: OutboxMessage[]): Promise<void> {
    for (const event of events) {
      const accepted = this.channel.publish(
        this.exchange,
        event.eventType,
        Buffer.from(JSON.stringify({
          id: event.id,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          type: event.eventType,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
        })),
        {
          appId: 'clutchzone-backend',
          contentType: 'application/json',
          deliveryMode: 2,
          messageId: event.id,
          timestamp: Math.floor(event.occurredAt.getTime() / 1000),
          type: event.eventType,
        },
      );
      if (!accepted) await once(this.channel, 'drain');
    }
    await this.channel.waitForConfirms();
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
