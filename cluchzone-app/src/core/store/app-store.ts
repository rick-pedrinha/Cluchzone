// ═══════════════════════════════════════════════════════════
// ClutchZone — Global Application State Store
// Reactive state management using EventTarget pattern
// ═══════════════════════════════════════════════════════════

import type { User, Team, Tournament, Notification, FeedItem } from '../../types/index.js';

type Listener<T> = (value: T) => void;

class Store<T> {
  private _value: T;
  private _listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this._value = initial;
  }

  get value(): T {
    return this._value;
  }

  set(next: T): void {
    this._value = next;
    this._listeners.forEach(fn => fn(next));
  }

  update(updater: (prev: T) => T): void {
    this.set(updater(this._value));
  }

  subscribe(listener: Listener<T>): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}

// ── Singleton stores ──
export const userStore = new Store<User | null>(null);
export const teamsStore = new Store<Team[]>([]);
export const tournamentsStore = new Store<Tournament[]>([]);
export const notificationsStore = new Store<Notification[]>([]);
export const feedStore = new Store<FeedItem[]>([]);
export const premiumStore = new Store<boolean>(false);

export const appStore = {
  user: userStore,
  teams: teamsStore,
  tournaments: tournamentsStore,
  notifications: notificationsStore,
  feed: feedStore,
  premium: premiumStore,
};
