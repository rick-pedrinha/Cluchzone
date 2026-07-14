// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Central Type Definitions
// ═══════════════════════════════════════════════════════════

export type UserRole = 'admin' | 'organizer' | 'captain' | 'player' | 'guest';
export type PixStatus = 'pendente' | 'enviado' | 'pago';
export type TournamentStatus = 'Registros Abertos' | 'Em Andamento' | 'Finalizado';
export type PaymentStatus = 'pending' | 'sent' | 'confirmed' | 'rejected';
export type EliminationFormat = 'single' | 'double' | 'swiss' | 'round-robin';

export interface User {
  uid: string;
  nick: string;
  email: string;
  provider: 'email' | 'steam' | 'riot' | 'supercell' | 'google';
  role: UserRole;
  games: string[];
  premium: boolean;
  avatar?: string;
  steamId64?: string;
  profileUrl?: string;
  steamLevel?: number | null;
  visibilityState?: number | null;
  profileState?: number | null;
  personaState?: number | null;
  countryCode?: string | null;
  stateCode?: string | null;
  steamCreatedAt?: string | null;
  lastLogoffAt?: string | null;
  createdAt: string;
  lastLogin?: string;
}

export interface Team {
  id: string;
  name: string;
  captain: string;
  vice?: string;
  members: string[];
  reserves: string[];
  logo: string;
  banner: string;
  stats: string;
  ranking: number;
  points: number;
  region: string;
  history: MatchResult[];
  createdAt: string;
  updatedAt?: string;
}

export interface MatchResult {
  opponent: string;
  result: 'W' | 'L' | 'D';
  score: string;
  date: string;
  tournamentId?: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  team1?: string;
  team2?: string;
  winner?: string;
  score?: string;
  scheduledAt?: string;
}

export interface Bracket {
  rounds: BracketMatch[][];
  format: EliminationFormat;
  generatedAt: string;
}

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  game: string;
  organizer: string;
  maxTeams: number;
  prize: string;
  region: string;
  format: string;
  elimination?: string;
  rules?: string;
  description?: string;
  banner?: string;
  registeredTeams: string[];
  pendingApprovals: string[];
  rejectedTeams: string[];
  soloPlayers: string[];
  pixStatus: Record<string, PixStatus>;
  playerPixStatus: Record<string, Record<string, PixStatus>>;
  bracket?: Bracket;
  server?: ServerConfig;
  steamLobby?: SteamLobbyConfig;
  date?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServerConfig {
  active: boolean;
  ip?: string;
  port?: string;
  password?: string;
}

export interface SteamLobbyConfig {
  active: boolean;
  invite: string;
  instructions?: string;
}

export interface Payment {
  id: string;
  teamName: string;
  tournamentId: string;
  playerNick?: string;
  amount: number;
  status: PaymentStatus;
  pixKey: string;
  receiptUrl?: string;
  confirmedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: string | number;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface FeedItem {
  id: string | number;
  user: string;
  action: string;
  detail?: string;
  icon?: string;
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  isPremium: boolean;
  teams: Team[];
  tournaments: Tournament[];
  notifications: Notification[];
  feedItems: FeedItem[];
}
