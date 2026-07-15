import { PrismaClient, type GameServerCommandType } from '@prisma/client';
import { config as loadDotEnv } from 'dotenv';
import { randomBytes } from 'node:crypto';
import { logger } from '../config/logger.js';
import { loadCs2WorkerConfig, type Cs2WorkerConfig } from './cs2-worker.config.js';
import { DockerCs2Provider } from './docker-cs2-provider.js';
import { SecretBox } from './secret-box.js';

loadDotEnv({ quiet: true });

const commandMap: Record<Exclude<GameServerCommandType, 'RELEASE'>, string> = {
  PAUSE: 'mp_pause_match',
  UNPAUSE: 'mp_unpause_match',
  RESTART: 'mp_restartgame 1',
};

class Cs2Orchestrator {
  private readonly secrets: SecretBox;
  private readonly provider: DockerCs2Provider;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: Cs2WorkerConfig,
  ) {
    this.secrets = new SecretBox(config.secretKey);
    this.provider = new DockerCs2Provider({
      publicHost: config.publicHost,
      image: config.image,
      secretDirectory: config.secretDirectory,
      gamePort: config.gamePort,
      rconPort: config.rconPort,
      gslt: config.gslt,
    });
  }

  async tick(): Promise<void> {
    await this.provisionOne();
    await this.reconcileOne();
    await this.processCommandOne();
  }

  private async provisionOne(): Promise<void> {
    const active = await this.prisma.gameServerAllocation.count({
      where: { status: { in: ['PROVISIONING', 'READY', 'LIVE', 'RELEASING'] } },
    });
    if (active > 0) return;
    const allocation = await this.prisma.gameServerAllocation.findFirst({
      where: { status: 'REQUESTED' },
      orderBy: { createdAt: 'asc' },
    });
    if (!allocation) return;
    const claimed = await this.prisma.gameServerAllocation.updateMany({
      where: { id: allocation.id, status: 'REQUESTED' },
      data: { status: 'PROVISIONING', provider: 'docker' },
    });
    if (claimed.count !== 1) return;

    const password = randomBytes(18).toString('base64url');
    const rconPassword = randomBytes(24).toString('base64url');
    try {
      const server = await this.provider.provision({
        allocationId: allocation.id,
        matchId: allocation.matchId,
        map: 'de_dust2',
        password,
        rconPassword,
      });
      await this.prisma.$transaction([
        this.prisma.gameServerAllocation.update({
          where: { id: allocation.id },
          data: {
            providerServerId: server.providerServerId,
            publicHost: server.publicHost,
            gamePort: server.gamePort,
            rconPort: server.rconPort,
            secretRef: server.secretRef,
            encryptedPassword: this.secrets.encrypt(password),
            encryptedRconPassword: this.secrets.encrypt(rconPassword),
          },
        }),
        this.prisma.auditEntry.create({
          data: {
            action: 'match.server_container_started',
            resourceType: 'match',
            resourceId: allocation.matchId,
            metadata: { allocationId: allocation.id, provider: 'docker' },
          },
        }),
      ]);
      logger.info({ allocationId: allocation.id }, 'CS2 container started; waiting for RCON');
    } catch (error) {
      try {
        await this.provider.cleanupFailedProvision(allocation.id);
      } catch (cleanupError) {
        logger.warn({ err: cleanupError, allocationId: allocation.id }, 'CS2 failed-provision cleanup failed');
      }
      await this.failProvision(allocation.id, allocation.matchId, 'CONTAINER_START_FAILED');
      logger.error({ err: error, allocationId: allocation.id }, 'CS2 container start failed');
    }
  }

  private async reconcileOne(): Promise<void> {
    const allocation = await this.prisma.gameServerAllocation.findFirst({
      where: { status: 'PROVISIONING', providerServerId: { not: null } },
      orderBy: { createdAt: 'asc' },
    });
    if (!allocation?.providerServerId || !allocation.encryptedRconPassword) return;
    const running = await this.provider.isRunning(allocation.providerServerId);
    const expired = Date.now() - allocation.createdAt.getTime() > this.config.provisionTimeoutMs;
    if (!running || expired) {
      try {
        await this.provider.release(allocation.providerServerId, allocation.secretRef);
      } catch (error) {
        logger.warn({ err: error, allocationId: allocation.id }, 'CS2 timed-out container cleanup failed');
      }
      await this.failProvision(
        allocation.id,
        allocation.matchId,
        running ? 'SERVER_START_TIMEOUT' : 'CONTAINER_STOPPED',
      );
      return;
    }
    try {
      await this.provider.sendRcon(this.secrets.decrypt(allocation.encryptedRconPassword), 'status');
    } catch {
      return;
    }
    await this.prisma.$transaction([
      this.prisma.gameServerAllocation.update({
        where: { id: allocation.id },
        data: { status: 'READY', lastHeartbeatAt: new Date() },
      }),
      this.prisma.gameMatch.update({
        where: { id: allocation.matchId },
        data: { status: 'READY', version: { increment: 1 } },
      }),
      this.prisma.auditEntry.create({
        data: {
          action: 'match.server_ready',
          resourceType: 'match',
          resourceId: allocation.matchId,
          metadata: { allocationId: allocation.id },
        },
      }),
    ]);
    logger.info({ allocationId: allocation.id }, 'CS2 server is ready');
  }

  private async processCommandOne(): Promise<void> {
    const command = await this.prisma.gameServerCommand.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { allocation: true },
    });
    if (!command) return;
    const claimed = await this.prisma.gameServerCommand.updateMany({
      where: { id: command.id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count !== 1) return;
    const allocation = command.allocation;

    try {
      if (command.type === 'RELEASE') {
        await this.prisma.$transaction([
          this.prisma.gameServerAllocation.update({ where: { id: allocation.id }, data: { status: 'RELEASING' } }),
          this.prisma.gameMatch.update({ where: { id: allocation.matchId }, data: { status: 'RELEASING', version: { increment: 1 } } }),
        ]);
        if (allocation.providerServerId) {
          await this.provider.release(allocation.providerServerId, allocation.secretRef);
        }
        await this.prisma.$transaction([
          this.prisma.gameServerAllocation.update({
            where: { id: allocation.id },
            data: {
              status: 'RELEASED',
              releasedAt: new Date(),
              secretRef: null,
              encryptedPassword: null,
              encryptedRconPassword: null,
            },
          }),
          this.prisma.gameMatch.update({ where: { id: allocation.matchId }, data: { status: 'RELEASED', version: { increment: 1 } } }),
        ]);
      } else {
        if (!allocation.encryptedRconPassword) throw new Error('Allocation has no RCON credential.');
        await this.provider.sendRcon(
          this.secrets.decrypt(allocation.encryptedRconPassword),
          commandMap[command.type],
        );
        await this.prisma.gameServerAllocation.update({
          where: { id: allocation.id },
          data: { lastHeartbeatAt: new Date() },
        });
      }
      await this.prisma.$transaction([
        this.prisma.gameServerCommand.update({
          where: { id: command.id },
          data: { status: 'SUCCEEDED', processedAt: new Date(), errorCode: null },
        }),
        this.prisma.auditEntry.create({
          data: {
            actorId: command.requestedById,
            action: 'match.server_command_succeeded',
            resourceType: 'match',
            resourceId: allocation.matchId,
            metadata: { allocationId: allocation.id, commandType: command.type },
          },
        }),
      ]);
    } catch (error) {
      await this.prisma.gameServerCommand.update({
        where: { id: command.id },
        data: { status: 'FAILED', processedAt: new Date(), errorCode: 'PROVIDER_COMMAND_FAILED' },
      });
      logger.error({ err: error, commandId: command.id }, 'CS2 server command failed');
    }
  }

  private async failProvision(allocationId: string, matchId: string, errorCode: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.gameServerAllocation.update({ where: { id: allocationId }, data: { status: 'FAILED' } }),
      this.prisma.gameMatch.update({ where: { id: matchId }, data: { status: 'FAILED', version: { increment: 1 } } }),
      this.prisma.auditEntry.create({
        data: {
          action: 'match.server_failed',
          resourceType: 'match',
          resourceId: matchId,
          metadata: { allocationId, errorCode },
        },
      }),
    ]);
  }
}

async function main(): Promise<void> {
  const config = loadCs2WorkerConfig();
  const prisma = new PrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  const orchestrator = new Cs2Orchestrator(prisma, config);
  let stopping = false;
  const stop = (): void => { stopping = true; };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  logger.info('CS2 orchestrator worker started');
  while (!stopping) {
    try {
      await orchestrator.tick();
    } catch (error) {
      logger.error({ err: error }, 'CS2 orchestrator tick failed');
    }
    await new Promise(resolve => setTimeout(resolve, config.pollMs));
  }
  await prisma.$disconnect();
}

main().catch(error => {
  logger.fatal({ err: error }, 'CS2 orchestrator startup failed');
  process.exit(1);
});
