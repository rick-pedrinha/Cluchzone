// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Auth Service
// Wraps localStorage auth + prepares for Firebase Auth migration
// ═══════════════════════════════════════════════════════════

import type { User } from '../../types/index.js';
import { userStore, premiumStore } from '../store/app-store.js';
import { resolveRole } from './rbac.js';
import { STORAGE_KEYS } from '../store/keys.js';

class AuthService {
  private static _instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService._instance) AuthService._instance = new AuthService();
    return AuthService._instance;
  }

  // ── Load session from localStorage ───────────────────
  init(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTH);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<User>;
      const user: User = {
        uid: parsed.uid ?? crypto.randomUUID(),
        nick: parsed.nick ?? 'Visitante',
        email: parsed.email ?? '',
        provider: parsed.provider ?? 'email',
        role: resolveRole(parsed.nick ?? '', parsed.role),
        games: parsed.games ?? [],
        premium: parsed.premium ?? false,
        avatar: parsed.avatar,
        createdAt: parsed.createdAt ?? new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      userStore.set(user);
      premiumStore.set(localStorage.getItem(STORAGE_KEYS.PREMIUM) === 'true' || user.premium);
      return user;
    } catch {
      return null;
    }
  }

  // ── Get current user (sync) ───────────────────────────
  getCurrentUser(): User | null {
    return userStore.value;
  }

  // ── Guest session ─────────────────────────────────────
  getGuestUser(): User {
    return {
      uid: 'guest',
      nick: 'Visitante',
      email: '',
      provider: 'email',
      role: 'guest',
      games: [],
      premium: false,
      createdAt: new Date().toISOString(),
    };
  }

  // ── Check role ────────────────────────────────────────
  isOrganizer(): boolean {
    const user = userStore.value;
    if (!user) return false;
    return user.role === 'admin' || user.role === 'organizer';
  }

  isAdmin(): boolean {
    return userStore.value?.role === 'admin';
  }

  isCaptain(): boolean {
    const role = userStore.value?.role;
    return role === 'captain' || role === 'organizer' || role === 'admin';
  }

  // ── Logout ────────────────────────────────────────────
  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    userStore.set(null);
    premiumStore.set(false);
  }
}

export const authService = AuthService.getInstance();
