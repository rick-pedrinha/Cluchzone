import type { StorageKey } from '../store/keys.js';

type Unsubscribe = () => void;
const API_BASE = String(import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

class BackendClient {
  private static instance: BackendClient;
  private listeners = new Map<string, Unsubscribe>();

  static getInstance(): BackendClient {
    BackendClient.instance ??= new BackendClient();
    return BackendClient.instance;
  }

  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/json', ...options.headers },
    });
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (!response.ok) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
    return payload;
  }

  async get<T>(key: StorageKey, fallback: T): Promise<T> {
    try {
      const payload = await this.request(`/api/store/${encodeURIComponent(key)}`) as { value: T | null };
      if (payload.value !== null) {
        this.writeLocal(key, payload.value);
        return payload.value;
      }
    } catch (error) {
      console.warn('[BackendClient] read fallback:', error);
    }
    return this.readLocal<T>(key) ?? fallback;
  }

  async set<T>(key: StorageKey, value: T): Promise<void> {
    this.writeLocal(key, value);
    try {
      await this.request(`/api/store/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify({ value }) });
    } catch (error) {
      console.warn('[BackendClient] write cached locally:', error);
    }
  }

  listen<T>(key: StorageKey, callback: (value: T) => void): Unsubscribe {
    this.listeners.get(key)?.();
    let previous = JSON.stringify(this.readLocal<T>(key));
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void this.get<T | null>(key, null).then(value => {
        const serialized = JSON.stringify(value);
        if (value !== null && serialized !== previous) {
          previous = serialized;
          callback(value);
        }
      });
    }, 10000);
    const unsubscribe = () => window.clearInterval(timer);
    this.listeners.set(key, unsubscribe);
    return unsubscribe;
  }

  private readLocal<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }

  private writeLocal<T>(key: string, value: T): void {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  destroyAll(): void {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
  }
}

export const db = BackendClient.getInstance();
