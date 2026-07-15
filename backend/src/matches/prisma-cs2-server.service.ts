import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import type { ActorRole } from './match.types.js';
import type {
  Cs2ServerControl,
  ServerCommandType,
  ServerCommandView,
  ServerRoomView,
} from './cs2-server.types.js';
import type { SecretBox } from './secret-box.js';

const accessInclude = {
  participants: { select: { userId: true } },
  allocations: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.GameMatchInclude;

function missingMatch(): AppError {
  return new AppError(404, 'MATCH_NOT_FOUND', 'Match was not found.');
}

function canOperate(createdById: string, actorId: string, actorRole: ActorRole): boolean {
  return actorRole === 'ADMIN' || createdById === actorId;
}

function commandView(command: {
  id: string;
  type: ServerCommandType;
  status: ServerCommandView['status'];
  createdAt: Date;
  processedAt: Date | null;
}): ServerCommandView {
  return { ...command };
}

export class PrismaCs2ServerService implements Cs2ServerControl {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly secrets: SecretBox,
  ) {}

  async getRoom(matchId: string, actorId: string, actorRole: ActorRole): Promise<ServerRoomView> {
    const match = await this.prisma.gameMatch.findUnique({ where: { id: matchId }, include: accessInclude });
    if (!match) throw missingMatch();
    const operator = canOperate(match.createdById, actorId, actorRole);
    if (!operator && !match.participants.some(participant => participant.userId === actorId)) {
      throw missingMatch();
    }

    const allocation = match.allocations[0];
    const isConnectable = allocation?.status === 'READY' || allocation?.status === 'LIVE';
    const hasRoom = Boolean(
      isConnectable &&
      allocation?.publicHost &&
      allocation.gamePort &&
      allocation.encryptedPassword,
    );
    const password = hasRoom ? this.secrets.decrypt(allocation!.encryptedPassword!) : null;
    const endpoint = hasRoom ? `${allocation!.publicHost!}:${allocation!.gamePort!}` : null;

    return {
      matchId,
      matchStatus: match.status,
      allocationStatus: allocation?.status ?? null,
      regionCode: allocation?.regionCode ?? match.regionCode,
      canOperate: operator,
      endpoint,
      password,
      connectCommand: endpoint && password ? `connect ${endpoint}; password ${password}` : null,
    };
  }

  async requestCommand(
    matchId: string,
    actorId: string,
    actorRole: ActorRole,
    type: ServerCommandType,
    idempotencyKey: string,
  ): Promise<ServerCommandView> {
    return this.prisma.$transaction(async transaction => {
      const match = await transaction.gameMatch.findUnique({ where: { id: matchId }, include: accessInclude });
      if (!match) throw missingMatch();
      if (!canOperate(match.createdById, actorId, actorRole)) {
        throw new AppError(403, 'MATCH_OPERATION_FORBIDDEN', 'You cannot operate this match.');
      }
      const allocation = match.allocations[0];
      if (!allocation) {
        throw new AppError(409, 'SERVER_NOT_ALLOCATED', 'This match has no allocated server.');
      }
      const allowed = type === 'RELEASE'
        ? ['READY', 'LIVE', 'FAILED'].includes(allocation.status)
        : ['READY', 'LIVE'].includes(allocation.status);
      if (!allowed) {
        throw new AppError(409, 'SERVER_COMMAND_UNAVAILABLE', 'The server cannot accept this command now.');
      }

      const scopedKey = `match:${matchId}:server:${idempotencyKey}`;
      const existing = await transaction.gameServerCommand.findUnique({ where: { idempotencyKey: scopedKey } });
      if (existing) return commandView(existing);
      const command = await transaction.gameServerCommand.create({
        data: {
          allocationId: allocation.id,
          requestedById: actorId,
          type,
          idempotencyKey: scopedKey,
        },
      });
      await transaction.auditEntry.create({
        data: {
          actorId,
          action: 'match.server_command_requested',
          resourceType: 'match',
          resourceId: matchId,
          metadata: { allocationId: allocation.id, commandType: type },
        },
      });
      return commandView(command);
    });
  }
}
