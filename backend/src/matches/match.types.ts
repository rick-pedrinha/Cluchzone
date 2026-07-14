export const platformRegions = [
  'sao-paulo',
  'virginia',
  'frankfurt',
  'london',
  'singapore',
  'sydney',
] as const;

export type PlatformRegion = (typeof platformRegions)[number];
export type MatchFormat = 'BEST_OF_1' | 'BEST_OF_3';
export type MatchStatus =
  | 'SCHEDULED'
  | 'CHECK_IN'
  | 'VETO'
  | 'PROVISIONING'
  | 'READY'
  | 'LIVE'
  | 'COMPLETED'
  | 'RELEASING'
  | 'RELEASED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED';
export type MatchParticipantRole = 'PLAYER' | 'CAPTAIN' | 'COACH';
export type ActorRole = 'PLAYER' | 'ORGANIZER' | 'ADMIN';

export type MatchParticipantView = {
  userId: string;
  teamRef: string;
  role: MatchParticipantRole;
  checkedInAt: Date | null;
};

export type MatchView = {
  id: string;
  tournamentRef: string | null;
  createdById: string;
  format: MatchFormat;
  status: MatchStatus;
  regionCode: string | null;
  scheduledAt: Date;
  version: number;
  participants: MatchParticipantView[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateMatchInput = {
  tournamentRef: string | null;
  createdById: string;
  format: MatchFormat;
  scheduledAt: Date;
  participants: Array<{
    userId: string;
    teamRef: string;
    role: MatchParticipantRole;
  }>;
};

export type LatencySample = {
  regionCode: PlatformRegion;
  latencyMs: number;
};

export interface MatchRepository {
  create(input: CreateMatchInput): Promise<MatchView>;
  findAuthorized(matchId: string, actorId: string, actorRole: ActorRole): Promise<MatchView>;
  recordLatencies(matchId: string, actorId: string, samples: LatencySample[]): Promise<MatchView>;
  checkIn(matchId: string, actorId: string): Promise<MatchView>;
  requestProvision(matchId: string, actorId: string, actorRole: ActorRole, idempotencyKey: string): Promise<MatchView>;
}
