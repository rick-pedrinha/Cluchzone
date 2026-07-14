import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import { slugify } from '../shared/slug.js';
import type { CreateTeamInput, TeamMessageView, TeamRepository, TeamView } from './team.types.js';

const teamInclude = { members: { orderBy: { joinedAt: 'asc' as const } } } satisfies Prisma.TeamInclude;
type DatabaseTeam = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private async mapTeam(team: DatabaseTeam): Promise<TeamView> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: team.members.map(member => member.userId) }, status: 'ACTIVE' },
    });
    const usersById = new Map(users.map(user => [user.id, user]));
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      tag: team.tag,
      description: team.description,
      region: team.region,
      captainUserId: team.captainUserId,
      members: team.members.flatMap(member => {
        const user = usersById.get(member.userId);
        return user ? [{ userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, role: member.role }] : [];
      }),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  async create(captainUserId: string, input: CreateTeamInput): Promise<TeamView> {
    const captain = await this.prisma.user.findFirst({ where: { id: captainUserId, status: 'ACTIVE' } });
    if (!captain) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');

    const resolved = [];
    for (const requested of input.members) {
      const matches = await this.prisma.user.findMany({
        where: { displayName: { equals: requested.displayName, mode: 'insensitive' }, status: 'ACTIVE' },
        take: 2,
      });
      if (matches.length !== 1) {
        throw new AppError(400, 'TEAM_MEMBER_NOT_FOUND', `The player ${requested.displayName} could not be resolved uniquely.`);
      }
      const member = matches[0];
      if (member && member.id !== captainUserId) resolved.push({ userId: member.id, role: requested.role });
    }
    const uniqueMembers = new Map(resolved.map(member => [member.userId, member]));
    const slug = slugify(input.name);
    if (!slug) throw new AppError(400, 'INVALID_TEAM_NAME', 'Invalid team name.');

    try {
      const team = await this.prisma.$transaction(async transaction => {
        const created = await transaction.team.create({
          data: {
            name: input.name,
            slug,
            tag: input.tag,
            description: input.description,
            region: input.region,
            captainUserId,
            members: {
              create: [
                { userId: captainUserId, role: 'CAPTAIN' },
                ...uniqueMembers.values(),
              ],
            },
          },
          include: teamInclude,
        });
        await transaction.auditEntry.create({
          data: {
            actorId: captainUserId,
            action: 'team.created',
            resourceType: 'team',
            resourceId: created.id,
            metadata: { memberCount: created.members.length },
          },
        });
        return created;
      });
      return this.mapTeam(team);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'TEAM_NAME_TAKEN', 'This team name is already in use.');
      }
      throw error;
    }
  }

  async listMine(userId: string): Promise<TeamView[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: { include: teamInclude } },
      orderBy: { joinedAt: 'desc' },
    });
    return Promise.all(memberships.map(membership => this.mapTeam(membership.team)));
  }

  private async requireMembership(teamId: string, userId: string): Promise<void> {
    const membership = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
    if (!membership) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team was not found.');
  }

  async listMessages(teamId: string, userId: string): Promise<TeamMessageView[]> {
    await this.requireMembership(teamId, userId);
    const messages = (await this.prisma.teamMessage.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })).reverse();
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(messages.map(message => message.userId))] } } });
    const usersById = new Map(users.map(user => [user.id, user]));
    return messages.flatMap(message => {
      const author = usersById.get(message.userId);
      return author ? [{
        id: message.id,
        teamId: message.teamId,
        userId: message.userId,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        text: message.body,
        createdAt: message.createdAt,
      }] : [];
    });
  }

  async sendMessage(teamId: string, userId: string, text: string): Promise<TeamMessageView> {
    await this.requireMembership(teamId, userId);
    const author = await this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' } });
    if (!author) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    const message = await this.prisma.teamMessage.create({ data: { teamId, userId, body: text } });
    return {
      id: message.id,
      teamId,
      userId,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      text: message.body,
      createdAt: message.createdAt,
    };
  }
}
