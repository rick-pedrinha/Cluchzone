import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import type { PublicUser, SteamProfileInput, UserRepository } from './user.types.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertFromSteam(profile: SteamProfileInput): Promise<PublicUser> {
    try {
      return await this.prisma.user.upsert({
        where: { steamId64: profile.steamId64 },
        create: { ...profile, lastLoginAt: new Date() },
        update: { ...profile, lastLoginAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'STEAM_ID_CONFLICT', 'This Steam account is already linked.');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findActiveBySteamIds(steamIds: string[]): Promise<PublicUser[]> {
    if (steamIds.length === 0) return [];
    return this.prisma.user.findMany({
      where: { steamId64: { in: steamIds }, status: 'ACTIVE' },
    });
  }

  async findActiveByDisplayName(displayName: string): Promise<PublicUser | null> {
    const matches = await this.prisma.user.findMany({
      where: { displayName: { equals: displayName, mode: 'insensitive' }, status: 'ACTIVE' },
      orderBy: { lastLoginAt: 'desc' },
      take: 2,
    });
    if (matches.length > 1) {
      throw new AppError(409, 'PLAYER_IDENTITY_AMBIGUOUS', 'More than one Clutchzone account uses this display name.');
    }
    return matches[0] ?? null;
  }

  async updateShowcaseVisibility(id: string, visible: boolean): Promise<PublicUser | null> {
    const result = await this.prisma.user.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { showcaseVisible: visible },
    });
    return result.count === 1 ? this.findById(id) : null;
  }
}
