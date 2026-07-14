import type { User, UserRole } from '../../types/index.js';
import { premiumStore, userStore } from '../store/app-store.js';

type BackendUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  steamId64: string;
  profileUrl: string;
  steamLevel: number | null;
  visibilityState: number | null;
  profileState: number | null;
  personaState: number | null;
  countryCode: string | null;
  stateCode: string | null;
  steamCreatedAt: string | null;
  lastLogoffAt: string | null;
  role: string;
  createdAt: string;
  lastLoginAt: string;
};

const API_BASE = String(import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

function normalizeRole(value: string): UserRole {
  const role = value.toLowerCase();
  return role === 'admin' || role === 'organizer' || role === 'player' ? role : 'player';
}

class AuthService {
  private static instance: AuthService;
  private initialization: Promise<User | null> | null = null;

  static getInstance(): AuthService {
    AuthService.instance ??= new AuthService();
    return AuthService.instance;
  }

  init(): Promise<User | null> {
    this.initialization ??= this.loadSession();
    return this.initialization;
  }

  private async loadSession(): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include', headers: { accept: 'application/json' } });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error('Authentication backend unavailable');
      const payload = await response.json() as { user: BackendUser };
      const backend = payload.user;
      const user: User = {
        uid: backend.id,
        nick: backend.displayName,
        email: '',
        provider: 'steam',
        role: normalizeRole(backend.role),
        games: ['CS2', 'PUBG'],
        premium: false,
        ...(backend.avatarUrl ? { avatar: backend.avatarUrl } : {}),
        steamId64: backend.steamId64,
        profileUrl: backend.profileUrl,
        steamLevel: backend.steamLevel,
        visibilityState: backend.visibilityState,
        profileState: backend.profileState,
        personaState: backend.personaState,
        countryCode: backend.countryCode,
        stateCode: backend.stateCode,
        steamCreatedAt: backend.steamCreatedAt,
        lastLogoffAt: backend.lastLogoffAt,
        createdAt: backend.createdAt,
        lastLogin: backend.lastLoginAt,
      };
      userStore.set(user);
      premiumStore.set(false);
      return user;
    } catch (error) {
      console.error('[Auth] Session check failed', error);
      return null;
    }
  }

  getCurrentUser(): User | null { return userStore.value; }

  getGuestUser(): User {
    return { uid: 'guest', nick: 'Visitante', email: '', provider: 'steam', role: 'guest', games: [], premium: false, createdAt: new Date().toISOString() };
  }

  beginSteamLogin(returnTo = window.location.pathname): void {
    window.location.assign(`${API_BASE}/auth/steam?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    userStore.set(null);
    premiumStore.set(false);
  }

  isOrganizer(): boolean { return ['admin', 'organizer'].includes(userStore.value?.role ?? ''); }
  isAdmin(): boolean { return userStore.value?.role === 'admin'; }
  isCaptain(): boolean { return ['admin', 'organizer', 'captain'].includes(userStore.value?.role ?? ''); }
}

export const authService = AuthService.getInstance();
