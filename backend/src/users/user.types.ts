export type PublicUser = {
  id: string;
  steamId64: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string;
  steamLevel: number | null;
  visibilityState: number | null;
  profileState: number | null;
  personaState: number | null;
  countryCode: string | null;
  stateCode: string | null;
  steamCreatedAt: Date | null;
  lastLogoffAt: Date | null;
  role: 'PLAYER' | 'ORGANIZER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SteamProfileInput = Pick<
  PublicUser,
  | 'steamId64'
  | 'displayName'
  | 'avatarUrl'
  | 'profileUrl'
  | 'steamLevel'
  | 'visibilityState'
  | 'profileState'
  | 'personaState'
  | 'countryCode'
  | 'stateCode'
  | 'steamCreatedAt'
  | 'lastLogoffAt'
>;

export interface UserRepository {
  upsertFromSteam(profile: SteamProfileInput): Promise<PublicUser>;
  findById(id: string): Promise<PublicUser | null>;
}
