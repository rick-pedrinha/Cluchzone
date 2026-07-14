import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { platformRegions, type ActorRole, type CreateMatchInput, type LatencySample, type MatchRepository, type MatchView } from './match.types.js';
import { selectBalancedRegion } from './region-selector.js';

const matchInclude = { participants: { orderBy: { createdAt: 'asc' as const } } } satisfies Prisma.GameMatchInclude;
type DatabaseMatch = Prisma.GameMatchGetPayload<{ include: typeof matchInclude }>;

function toMatchView(match: DatabaseMatch): MatchView {
  return {
    id: match.id,
    tournamentRef: match.tournamentRef,
    createdById: match.createdById,
    format: match.format,
    status: match.status,
    regionCode: match.regionCode,
    scheduledAt: match.scheduledAt,
    version: match.version,
    participants: match.participants.map(participant => ({
      userId: participant.userId,
      teamRef: participant.teamRef,
      role: participant.role,
      checkedInAt: participant.checkedInAt,
    })),
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
}

function missingMatch(): AppError {
  return new AppError(404, 'MATCH_NOT_FOUND', 'Match was not found.');
}

function assertParticipant(match: DatabaseMatch, actorId: string): void {
  if (!match.participants.some(participant => participant.userId === actorId)) throw missingMatch();
}

function assertOperator(match: DatabaseMatch, actorId: string, actorRole: ActorRole): void {
  if (actorRole !== 'ADMIN' && match.createdById !== actorId) {
    throw new AppError(403, 'MATCH_OPERATION_FORBIDDEN', 'You cannot operate this match.');
  }
}

export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMatchInput): Promise<MatchView> {
    const uniqueUsers = [...new Set(input.participants.map(participant => participant.userId))];
    const uniqueTeams = new Set(input.participants.map(participant => participant.teamRef));
    if (uniqueUsers.length !== input.participants.length || uniqueTeams.size !== 2) {
      throw new AppError(400, 'INVALID_MATCH_ROSTER', 'A match requires unique players from exactly two teams.');
    }

    return this.prisma.$transaction(async transaction => {
      const activeUsers = await transaction.user.count({ where: { id: { in: uniqueUsers }, status: 'ACTIVE' } });
      if (activeUsers !== uniqueUsers.length) {
        throw new AppError(400, 'INVALID_MATCH_ROSTER', 'Every match participant must be an active ClutchZone user.');
      }

      const match = await transaction.gameMatch.create({
        data: {
          tournamentRef: input.tournamentRef,
          createdById: input.createdById,
          format: input.format,
          scheduledAt: input.scheduledAt,
          participants: { create: input.participants },
        },
        include: matchInclude,
      });
      await transaction.auditEntry.create({
        data: {
          actorId: input.createdById,
          action: 'match.created',
          resourceType: 'match',
          resourceId: match.id,
          metadata: { format: match.format, participantCount: match.participants.length },
        },
      });
      return toMatchView(match);
    });
  }

  async findAuthorized(matchId: string, actorId: string, actorRole: ActorRole): Promise<MatchView> {
    const match = await this.prisma.gameMatch.findUnique({ where: { id: matchId }, include: matchInclude });
    if (!match) throw missingMatch();
    if (actorRole !== 'ADMIN' && match.createdById !== actorId) assertParticipant(match, actorId);
    return toMatchView(match);
  }

  async recordLatencies(matchId: string, actorId: string, samples: LatencySample[]): Promise<MatchView> {
    return this.prisma.$transaction(async transaction => {
      const match = await transaction.gameMatch.findUnique({ where: { id: matchId }, include: matchInclude });
      if (!match) throw missingMatch();
      assertParticipant(match, actorId);
      if (!['SCHEDULED', 'CHECK_IN', 'VETO'].includes(match.status)) {
        throw new AppError(409, 'MATCH_PING_CLOSED', 'Latency measurements are closed for this match.');
      }

      const measuredAt = new Date();
      for (const sample of samples) {
        await transaction.matchLatency.upsert({
          where: { matchId_userId_regionCode: { matchId, userId: actorId, regionCode: sample.regionCode } },
          create: { matchId, userId: actorId, regionCode: sample.regionCode, latencyMs: sample.latencyMs, measuredAt },
          update: { latencyMs: sample.latencyMs, measuredAt },
        });
      }
      if (match.status === 'SCHEDULED') {
        await transaction.gameMatch.update({ where: { id: matchId }, data: { status: 'CHECK_IN', version: { increment: 1 } } });
      }
      await transaction.auditEntry.create({
        data: {
          actorId,
          action: 'match.latency_recorded',
          resourceType: 'match',
          resourceId: matchId,
          metadata: { regions: samples.map(sample => sample.regionCode) },
        },
      });
      const updated = await transaction.gameMatch.findUnique({ where: { id: matchId }, include: matchInclude });
      if (!updated) throw missingMatch();
      return toMatchView(updated);
    });
  }

  async checkIn(matchId: string, actorId: string): Promise<MatchView> {
    return this.prisma.$transaction(async transaction => {
      const match = await transaction.gameMatch.findUnique({ where: { id: matchId }, include: matchInclude });
      if (!match) throw missingMatch();
      assertParticipant(match, actorId);
      if (!['SCHEDULED', 'CHECK_IN', 'VETO'].includes(match.status)) {
        throw new AppError(409, 'MATCH_CHECK_IN_CLOSED', 'Check-in is closed for this match.');
      }

      const participant = match.participants.find(item => item.userId === actorId);
      if (!participant?.checkedInAt) {
        await transaction.matchParticipant.update({
          where: { matchId_userId: { matchId, userId: actorId } },
          data: { checkedInAt: new Date() },
        });
      }
      const pending = await transaction.matchParticipant.count({ where: { matchId, checkedInAt: null } });
      const nextStatus = pending === 0 ? 'VETO' : 'CHECK_IN';
      if (match.status !== nextStatus) {
        await transaction.gameMatch.update({ where: { id: matchId }, data: { status: nextStatus, version: { increment: 1 } } });
      }
      if (pending === 0) {
        await transaction.outboxEvent.upsert({
          where: { idempotencyKey: `match:${matchId}:check-in-completed` },
          update: {},
          create: {
            aggregateType: 'match',
            aggregateId: matchId,
            eventType: 'match.check_in.completed',
            idempotencyKey: `match:${matchId}:check-in-completed`,
            payload: { matchId },
          },
        });
      }
      await transaction.auditEntry.create({
        data: { actorId, action: 'match.player_checked_in', resourceType: 'match', resourceId: matchId, metadata: {} },
      });
      const updated = await transaction.gameMatch.findUnique({ where: { id: matchId }, include: matchInclude });
      if (!updated) throw missingMatch();
      return toMatchView(updated);
    });
  }

  async requestProvision(matchId: string, actorId: string, actorRole: ActorRole, idempotencyKey: string): Promise<MatchView> {
    return this.prisma.$transaction(async transaction => {
      const eventKey = `match:${matchId}:provision:${idempotencyKey}`;
      const match = await transaction.gameMatch.findUnique({ where: { id: matchId }, include: matchInclude });
      if (!match) throw missingMatch();
      assertOperator(match, actorId, actorRole);

      const existingEvent = await transaction.outboxEvent.findUnique({ where: { idempotencyKey: eventKey } });
      if (existingEvent && match.status === 'PROVISIONING') return toMatchView(match);
      if (!['VETO', 'RETRYING'].includes(match.status)) {
        throw new AppError(409, 'MATCH_NOT_READY_FOR_PROVISIONING', 'The match is not ready for provisioning.');
      }
      if (match.participants.some(participant => participant.checkedInAt === null)) {
        throw new AppError(409, 'MATCH_CHECK_IN_INCOMPLETE', 'Every participant must check in before provisioning.');
      }

      const latencies = await transaction.matchLatency.findMany({ where: { matchId } });
      const region = selectBalancedRegion(platformRegions, match.participants.map(participant => ({
        userId: participant.userId,
        samples: latencies
          .filter(sample => sample.userId === participant.userId)
          .map(sample => ({ regionCode: sample.regionCode as LatencySample['regionCode'], latencyMs: sample.latencyMs })),
      })));
      if (!region) {
        throw new AppError(409, 'REGION_LATENCY_INCOMPLETE', 'Latency measurements are incomplete for this match.');
      }

      const allocation = await transaction.gameServerAllocation.create({
        data: { matchId, provider: 'unassigned', regionCode: region.regionCode, status: 'REQUESTED' },
      });
      const changed = await transaction.gameMatch.updateMany({
        where: { id: matchId, version: match.version },
        data: { status: 'PROVISIONING', regionCode: region.regionCode, version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw new AppError(409, 'MATCH_CONCURRENT_UPDATE', 'The match changed while provisioning was requested.');
      }
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'match',
          aggregateId: matchId,
          eventType: 'match.provisioning.requested',
          idempotencyKey: eventKey,
          payload: {
            matchId,
            allocationId: allocation.id,
            format: match.format,
            regionCode: region.regionCode,
          },
        },
      });
      await transaction.auditEntry.create({
        data: {
          actorId,
          action: 'match.provisioning_requested',
          resourceType: 'match',
          resourceId: matchId,
          metadata: { allocationId: allocation.id, regionCode: region.regionCode },
        },
      });
      const updated = await transaction.gameMatch.findUnique({ where: { id: matchId }, include: matchInclude });
      if (!updated) throw missingMatch();
      return toMatchView(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
