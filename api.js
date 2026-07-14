'use strict';

window.CluchAPI = (() => {
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const baseUrl = String(window.CLUCHZONE_BACKEND_URL || (isLocal ? 'http://localhost:3001' : '')).replace(/\/$/, '');
  const listeners = new Map();

  function localRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function localWrite(key, value) {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  async function request(path, options = {}) {
    if (!baseUrl) throw new Error('Backend não configurado.');
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/json', ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    return payload;
  }

  async function getStore(key, fallback = null) {
    try {
      const payload = await request(`/api/store/${encodeURIComponent(key)}`);
      if (payload.value !== null && payload.value !== undefined) {
        localWrite(key, payload.value);
        return payload.value;
      }
    } catch (error) {
      console.warn('[CluchAPI] leitura offline:', error.message);
    }
    return localRead(key, fallback);
  }

  async function setStore(key, value) {
    if (key === 'cluchzone_auth') throw new Error('O estado de autenticação não pode ser gravado pelo frontend.');
    localWrite(key, value);
    try {
      await request(`/api/store/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify({ value }) });
    } catch (error) {
      console.warn('[CluchAPI] alteração mantida somente no cache local:', error.message);
    }
    return value;
  }

  async function removeStore(key) { return setStore(key, null); }

  async function onStoreChange(key, callback) {
    listeners.get(key)?.();
    let active = true;
    let previous = JSON.stringify(await getStore(key, null));
    const timer = window.setInterval(async () => {
      if (!active || document.hidden) return;
      const value = await getStore(key, null);
      const serialized = JSON.stringify(value);
      if (serialized !== previous) {
        previous = serialized;
        callback(value);
      }
    }, 10000);
    const unsubscribe = () => { active = false; window.clearInterval(timer); };
    listeners.set(key, unsubscribe);
    return unsubscribe;
  }

  async function auth(action) {
    if (action === 'logout') { await window.ClutchAuth?.logout(); return { ok: true }; }
    await window.ClutchAuth?.ready;
    return { ok: true, user: window.ClutchAuth?.getUser() || null };
  }

  return { getStore, setStore, removeStore, onStoreChange, auth, online: Boolean(baseUrl) };
})();
