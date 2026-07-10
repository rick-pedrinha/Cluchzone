// ═══════════════════════════════════════════════════════════
// CLUCHZONE — Centralized Storage Keys
// Single source of truth — eliminates string literal duplication
// ═══════════════════════════════════════════════════════════

export const STORAGE_KEYS = {
  AUTH: 'cluchzone_auth',
  PREMIUM: 'cluchzone_premium',
  ACTIVE_TEAM: 'cluchzone_active_team',
  TEAMS: 'cluchzone_cs2_teams',
  TOURNAMENTS: 'cluchzone_cs2_camps',
  PLAYERS: 'cluchzone_cs2_players',
  FEED: 'cluchzone_cs2_feed',
  NOTIFICATIONS: 'cluchzone_cs2_notifs',
  PUBG_TOURNAMENTS: 'cluchzone_pubg_tournaments',
  BRAWL_TEAMS: 'cluchzone_brawl_teams',
  CONNECTED_PLATFORMS: 'cluchzone_connected_platforms',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
