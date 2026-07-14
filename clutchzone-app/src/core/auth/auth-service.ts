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

type SharedAuthUser = {
  id: string;
  uid: string;
  displayName: string;
  nick: string;
  avatarUrl: string | null;
  avatar: string | null;
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
  lastLogin: string;
};

type SharedAuthBridge = {
  ready: Promise<SharedAuthUser | null>;
  getUser: () => SharedAuthUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const localBackendUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:3001' : '';
const API_BASE = String(import.meta.env.VITE_BACKEND_URL || localBackendUrl).replace(/\/$/, '');

function sharedAuth(): SharedAuthBridge | null {
  return ((window as typeof window & { ClutchAuth?: SharedAuthBridge }).ClutchAuth ?? null);
}

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
      const bridge = sharedAuth();
      if (bridge) {
        await bridge.ready;
        const shared = bridge.getUser();
        if (!shared) {
          userStore.set(null);
          premiumStore.set(false);
          return null;
        }
        return this.storeUser({
          id: shared.id || shared.uid,
          displayName: shared.displayName || shared.nick,
          avatarUrl: shared.avatarUrl || shared.avatar,
          steamId64: shared.steamId64,
          profileUrl: shared.profileUrl,
          steamLevel: shared.steamLevel,
          visibilityState: shared.visibilityState,
          profileState: shared.profileState,
          personaState: shared.personaState,
          countryCode: shared.countryCode,
          stateCode: shared.stateCode,
          steamCreatedAt: shared.steamCreatedAt,
          lastLogoffAt: shared.lastLogoffAt,
          role: shared.role,
          createdAt: shared.createdAt,
          lastLoginAt: shared.lastLogin,
        });
      }

      const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include', headers: { accept: 'application/json' } });
      if (response.status === 401) {
        userStore.set(null);
        premiumStore.set(false);
        return null;
      }
      if (!response.ok) throw new Error('Authentication backend unavailable');
      const payload = await response.json() as { user: BackendUser };
      return this.storeUser(payload.user);
    } catch (error) {
      console.error('[Auth] Session check failed', error);
      userStore.set(null);
      premiumStore.set(false);
      return null;
    }
  }

  private storeUser(backend: BackendUser): User {
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
  }

  getCurrentUser(): User | null { return userStore.value; }

  beginSteamLogin(returnTo = window.location.pathname): void {
    const bridge = sharedAuth();
    if (bridge) {
      void bridge.login();
      return;
    }
    window.location.assign(`${API_BASE}/auth/steam?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async logout(): Promise<void> {
    const bridge = sharedAuth();
    if (bridge) {
      await bridge.logout();
      userStore.set(null);
      premiumStore.set(false);
      return;
    }
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    userStore.set(null);
    premiumStore.set(false);
  }

  isOrganizer(): boolean { return ['admin', 'organizer'].includes(userStore.value?.role ?? ''); }
  isAdmin(): boolean { return userStore.value?.role === 'admin'; }
  isCaptain(): boolean { return ['admin', 'organizer', 'captain'].includes(userStore.value?.role ?? ''); }
}

export const authService = AuthService.getInstance();
