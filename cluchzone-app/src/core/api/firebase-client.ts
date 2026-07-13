/// <reference types="vite/client" />

// ═══════════════════════════════════════════════════════════════
// CLUTCHZONE — Firebase Client (Singleton)
// Single access point to Firestore — replaces all saveData()
// duplicates across csgo.js, teams.js, organizer-panel.js
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  enableIndexedDbPersistence,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { StorageKey } from '../store/keys.js';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

class FirebaseClient {
  private static _instance: FirebaseClient | null = null;
  private _app: FirebaseApp;
  private _db: Firestore;
  private _listeners = new Map<string, Unsubscribe>();

  private constructor() {
    this._app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    this._db = getFirestore(this._app);
    enableIndexedDbPersistence(this._db).catch(() => {
      // Offline persistence not available in this context — OK
    });
  }

  static getInstance(): FirebaseClient {
    if (!FirebaseClient._instance) {
      FirebaseClient._instance = new FirebaseClient();
    }
    return FirebaseClient._instance;
  }

  // ── Read ──────────────────────────────────────────────────
  async get<T>(key: StorageKey, fallback: T): Promise<T> {
    try {
      const ref = doc(this._db, 'cluchzone_store', key);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const val = snap.data()['value'] as T;
        this._writeLocal(key, val);
        return val;
      }
      return this._readLocal<T>(key) ?? fallback;
    } catch {
      return this._readLocal<T>(key) ?? fallback;
    }
  }

  // ── Write ─────────────────────────────────────────────────
  async set<T>(key: StorageKey, value: T): Promise<void> {
    this._writeLocal(key, value);
    try {
      const ref = doc(this._db, 'cluchzone_store', key);
      if (value === null || value === undefined) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { value, updatedAt: Date.now() });
      }
    } catch (err) {
      console.warn('[FirebaseClient] set failed:', key, err);
    }
  }

  // ── Real-time listener ────────────────────────────────────
  listen<T>(key: StorageKey, callback: (value: T) => void): Unsubscribe {
    this._listeners.get(key)?.();

    const ref = doc(this._db, 'cluchzone_store', key);
    const unsubscribe = onSnapshot(
      ref,
      snap => {
        if (snap.exists()) {
          const val = snap.data()['value'] as T;
          this._writeLocal(key, val);
          callback(val);
        }
      },
      err => console.warn('[FirebaseClient] listener error:', key, err)
    );

    this._listeners.set(key, unsubscribe);
    return unsubscribe;
  }

  // ── Local cache helpers ───────────────────────────────────
  private _readLocal<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (raw === 'true') return true as T;
    if (raw === 'false') return false as T;
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }

  private _writeLocal<T>(key: string, value: T): void {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  // ── Destroy all listeners (call on page unload) ───────────
  destroyAll(): void {
    this._listeners.forEach(unsub => unsub());
    this._listeners.clear();
  }
}

export const db = FirebaseClient.getInstance();
