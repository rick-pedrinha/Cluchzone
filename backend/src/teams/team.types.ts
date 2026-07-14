export type TeamMemberRole = 'CAPTAIN' | 'VICE_CAPTAIN' | 'PLAYER' | 'RESERVE';

export type TeamMemberView = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: TeamMemberRole;
};

export type TeamView = {
  id: string;
  name: string;
  slug: string;
  tag: string;
  description: string | null;
  region: string;
  captainUserId: string;
  members: TeamMemberView[];
  createdAt: Date;
  updatedAt: Date;
};

export type TeamMessageView = {
  id: string;
  teamId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  createdAt: Date;
};

export type CreateTeamInput = {
  name: string;
  tag: string;
  description: string | null;
  region: string;
  members: Array<{ displayName: string; role: Exclude<TeamMemberRole, 'CAPTAIN'> }>;
};

export interface TeamRepository {
  create(captainUserId: string, input: CreateTeamInput): Promise<TeamView>;
  listMine(userId: string): Promise<TeamView[]>;
  listMessages(teamId: string, userId: string): Promise<TeamMessageView[]>;
  sendMessage(teamId: string, userId: string, text: string): Promise<TeamMessageView>;
}
