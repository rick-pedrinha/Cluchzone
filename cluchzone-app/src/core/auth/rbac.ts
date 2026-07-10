// ═══════════════════════════════════════════════════════════
// CLUCHZONE — Role-Based Access Control
// Defines what each role can do
// ═══════════════════════════════════════════════════════════

import type { UserRole } from '../../types/index.js';

export type Permission =
  | 'view:tournaments'
  | 'create:tournament'
  | 'edit:tournament'
  | 'delete:tournament'
  | 'approve:team'
  | 'reject:team'
  | 'create:team'
  | 'edit:team'
  | 'join:team'
  | 'invite:player'
  | 'confirm:payment'
  | 'reject:payment'
  | 'view:adminPanel'
  | 'ban:user'
  | 'manage:roles';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  guest: ['view:tournaments'],
  player: ['view:tournaments', 'join:team'],
  captain: [
    'view:tournaments',
    'create:team',
    'edit:team',
    'join:team',
    'invite:player',
  ],
  organizer: [
    'view:tournaments',
    'create:tournament',
    'edit:tournament',
    'approve:team',
    'reject:team',
    'confirm:payment',
    'reject:payment',
    'view:adminPanel',
    'create:team',
    'edit:team',
    'join:team',
    'invite:player',
  ],
  admin: [
    'view:tournaments',
    'create:tournament',
    'edit:tournament',
    'delete:tournament',
    'approve:team',
    'reject:team',
    'create:team',
    'edit:team',
    'join:team',
    'invite:player',
    'confirm:payment',
    'reject:payment',
    'view:adminPanel',
    'ban:user',
    'manage:roles',
  ],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAll(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => can(role, p));
}

export function canAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => can(role, p));
}

// Admin nicks — transitional until Firebase Auth custom claims are set
export const ADMIN_NICKS = new Set([
  'admin',
  'staff_cs2',
  'staff_pubg',
  'staff_brawl',
  'xdropx_steam',
  'xdropx',
  'rique',
  'rick'
]);

export function resolveRole(nick: string, explicitRole?: UserRole): UserRole {
  if (explicitRole && explicitRole !== 'guest') return explicitRole;
  if (ADMIN_NICKS.has(String(nick).trim().toLowerCase())) return 'admin';
  return 'player';
}
