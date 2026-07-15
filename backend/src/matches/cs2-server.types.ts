import type { ActorRole, MatchStatus } from './match.types.js';

export const serverCommandTypes = ['PAUSE', 'UNPAUSE', 'RESTART', 'RELEASE'] as const;
export type ServerCommandType = (typeof serverCommandTypes)[number];

export type ServerRoomView = {
  matchId: string;
  matchStatus: MatchStatus;
  allocationStatus: string | null;
  regionCode: string | null;
  canOperate: boolean;
  endpoint: string | null;
  password: string | null;
  connectCommand: string | null;
};

export type ServerCommandView = {
  id: string;
  type: ServerCommandType;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  createdAt: Date;
  processedAt: Date | null;
};

export interface Cs2ServerControl {
  getRoom(matchId: string, actorId: string, actorRole: ActorRole): Promise<ServerRoomView>;
  requestCommand(
    matchId: string,
    actorId: string,
    actorRole: ActorRole,
    type: ServerCommandType,
    idempotencyKey: string,
  ): Promise<ServerCommandView>;
}
