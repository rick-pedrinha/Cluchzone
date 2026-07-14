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
}
