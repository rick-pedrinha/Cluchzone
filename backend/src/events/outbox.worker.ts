import { PrismaClient } from '@prisma/client';
import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { OutboxDispatcher } from './outbox-dispatcher.js';
import { PrismaOutboxRepository } from './prisma-outbox.repository.js';
import { RabbitMqEventPublisher } from './rabbitmq-event.publisher.js';

loadDotEnv({ quiet: true });

const workerEnvSchema = z.object({
  DATABASE_URL: z.string().refine(value => /^postgres(ql)?:\/\//.test(value), 'must be PostgreSQL'),
  EVENT_BROKER_URL: z.string().refine(value => /^amqps?:\/\//.test(value), 'must be AMQP'),
  OUTBOX_EXCHANGE: z.string().trim().min(1).max(120),
  EVENT_MATCH_QUEUE: z.string().trim().min(1).max(120),
  OUTBOX_WORKER_ID: z.string().trim().min(1).max(100),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  OUTBOX_LEASE_MS: z.coerce.number().int().min(5000).max(300000).default(30000),
  OUTBOX_POLL_MS: z.coerce.number().int().min(100).max(60000).default(1000),
});

const delay = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds));

async function main(): Promise<void> {
  const parsed = workerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing outbox worker environment variables: ${names}`);
  }
  const env = parsed.data;
  const prisma = new PrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  const publisher = await RabbitMqEventPublisher.create(env.EVENT_BROKER_URL, env.OUTBOX_EXCHANGE, env.EVENT_MATCH_QUEUE);
  const dispatcher = new OutboxDispatcher(
    new PrismaOutboxRepository(prisma),
    publisher,
    env.OUTBOX_WORKER_ID,
    env.OUTBOX_BATCH_SIZE,
    env.OUTBOX_LEASE_MS,
  );
  let stopping = false;
  const stop = (signal: string): void => {
    logger.info({ signal }, 'outbox worker stopping');
    stopping = true;
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  logger.info({ workerId: env.OUTBOX_WORKER_ID }, 'outbox worker started');

  try {
    while (!stopping) {
      try {
        const published = await dispatcher.dispatchOnce();
        if (published === 0) await delay(env.OUTBOX_POLL_MS);
      } catch (error) {
        logger.error({ err: error }, 'outbox publish failed');
        await delay(env.OUTBOX_POLL_MS);
      }
    }
  } finally {
    await Promise.allSettled([publisher.close(), prisma.$disconnect()]);
  }
}

main().catch(error => {
  logger.fatal({ err: error }, 'outbox worker startup failed');
  process.exit(1);
});
