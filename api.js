'use strict';

/* ═══════════════════════════════════════════════════════════════
   ClutchZone API — Firebase Firestore Real-time Backend
   Substitua o objeto FIREBASE_CONFIG com suas credenciais.
   ═══════════════════════════════════════════════════════════════ */

/* eslint-disable */
// ── Firebase config ─────────────────────────────────────────────
// NOTE: In the new Vite app, credentials come from .env.local
// This legacy config is kept for backward compatibility only.
// ⚠️  Never commit real API keys to version control.
window.CLUCH_FIREBASE_CONFIG = (function () {
  // If the Vite app has injected the config, use it
  if (window.__CLUCH_ENV_CONFIG__) return window.__CLUCH_ENV_CONFIG__;
  // Fallback: read from a non-committed config file injected by the server
  // If neither is available, Firebase will not initialize (offline mode)
  return {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  };
})();

window.CluchAPI = (() => {
  // ── Internal state ──
  let db = null;
  let firebaseReady = false;
  const listeners = {}; // key → unsubscribe fn
  const localCache = {};

  // ── Bootstrap Firebase ──
  function initFirebase() {
    return new Promise((resolve) => {
      if (firebaseReady) return resolve(true);

      const cfg = window.CLUCH_FIREBASE_CONFIG;
      if (!cfg || !cfg.apiKey || cfg.apiKey === 'COLE_AQUI') {
        console.warn('[CluchAPI] Firebase não configurado — usando localStorage.');
        return resolve(false);
      }

      // Load Firebase SDKs dynamically
      const VERSION = '10.12.2';
      const BASE = `https://www.gstatic.com/firebasejs/${VERSION}`;

      const loadScript = (src) => new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) return res();
        const s = document.createElement('script');
        s.type = 'module';
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });

      // Use inline module to import Firebase
      const initScript = document.createElement('script');
      initScript.type = 'module';
      initScript.textContent = `
        import { initializeApp, getApps } from '${BASE}/firebase-app.js';
        import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, enableIndexedDbPersistence } from '${BASE}/firebase-firestore.js';

        const cfg = window.CLUCH_FIREBASE_CONFIG;
        const app = getApps().length ? getApps()[0] : initializeApp(cfg);
        const firestore = getFirestore(app);

        // Enable offline persistence
        enableIndexedDbPersistence(firestore).catch(() => {});

        window.__cluchFirestore = firestore;
        window.__cluchFirestoreModules = { doc, getDoc, setDoc, deleteDoc, onSnapshot };
        window.dispatchEvent(new Event('cluch-firebase-ready'));
      `;
      document.head.appendChild(initScript);

      window.addEventListener('cluch-firebase-ready', () => {
        db = window.__cluchFirestore;
        firebaseReady = true;
        resolve(true);
      }, { once: true });

      // Timeout fallback
      setTimeout(() => resolve(false), 5000);
    });
  }

  // ── Helpers ──
  function localRead(key, fallback = null) {
    if (localCache[key] !== undefined) return localCache[key];
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }

  function localWrite(key, value) {
    localCache[key] = value;
    if (value === null) { localStorage.removeItem(key); return; }
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  // ── Public API ──

  async function getStore(key, fallback = null) {
    // Always return local immediately for speed
    const localVal = localRead(key, null);

    const ready = await initFirebase();
    if (!ready || !db) return localVal ?? fallback;

    try {
      const { doc, getDoc } = window.__cluchFirestoreModules;
      const snap = await getDoc(doc(db, 'cluchzone_store', key));
      if (snap.exists()) {
        const val = snap.data().value;
        localWrite(key, val); // sync local
        return val;
      }
      return localVal ?? fallback;
    } catch (err) {
      console.warn('[CluchAPI] getStore fallback:', key, err.message);
      return localVal ?? fallback;
    }
  }

  async function setStore(key, value) {
    localWrite(key, value); // write local immediately

    const ready = await initFirebase();
    if (!ready || !db) return value;

    try {
      const { doc, setDoc, deleteDoc } = window.__cluchFirestoreModules;
      if (value === null) {
        await deleteDoc(doc(db, 'cluchzone_store', key));
      } else {
        await setDoc(doc(db, 'cluchzone_store', key), {
          value,
          updatedAt: Date.now()
        });
      }
    } catch (err) {
      console.warn('[CluchAPI] setStore error:', key, err.message);
    }
    return value;
  }

  async function removeStore(key) {
    return setStore(key, null);
  }

  /**
   * onStoreChange(key, callback)
   * Real-time listener — fires whenever another user changes this key in Firestore.
   * Returns an unsubscribe function.
   */
  async function onStoreChange(key, callback) {
    const ready = await initFirebase();
    if (!ready || !db) return () => {};

    // Unsubscribe previous listener for this key if any
    if (listeners[key]) listeners[key]();

    const { doc, onSnapshot } = window.__cluchFirestoreModules;
    const unsubscribe = onSnapshot(doc(db, 'cluchzone_store', key), (snap) => {
      if (snap.exists()) {
        const val = snap.data().value;
        localWrite(key, val);
        callback(val);
      }
    }, (err) => {
      console.warn('[CluchAPI] onStoreChange error:', key, err.message);
    });

    listeners[key] = unsubscribe;
    return unsubscribe;
  }

  // Legacy auth helper (keeps compatibility)
  async function auth(action, data = {}) {
    // Auth is handled locally via localStorage for now
    if (action === 'login') {
      localWrite('cluchzone_auth', data.user || data);
      return { ok: true, user: data.user || data };
    }
    if (action === 'logout') {
      localWrite('cluchzone_auth', null);
      return { ok: true };
    }
    return { ok: false, error: 'Ação desconhecida' };
  }

  // Eagerly start Firebase
  initFirebase();

  return { getStore, setStore, removeStore, onStoreChange, auth, online: true };
})();
