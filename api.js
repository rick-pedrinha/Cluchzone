'use strict';

window.CluchAPI = (() => {
  const online = location.protocol === 'http:' || location.protocol === 'https:';

  async function request(path, options = {}) {
    if (!online) throw new Error('Backend indisponivel ao abrir por arquivo.');
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Erro HTTP ${response.status}`);
    }
    return payload;
  }

  async function getStore(key, fallback = null) {
    try {
      const payload = await request(`/api/store/${encodeURIComponent(key)}`);
      return payload.value == null ? fallback : payload.value;
    } catch (error) {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      try { return JSON.parse(raw); } catch (_) { return raw; }
    }
  }

  async function setStore(key, value) {
    if (typeof value === 'string') localStorage.setItem(key, value);
    else localStorage.setItem(key, JSON.stringify(value));

    try {
      await request(`/api/store/${encodeURIComponent(key)}`, {
        method: 'POST',
        body: JSON.stringify({ value })
      });
    } catch (error) {
      console.warn('[CluchAPI] sync pendente:', key, error.message);
    }
    return value;
  }

  async function removeStore(key) {
    localStorage.removeItem(key);
    return setStore(key, null);
  }

  async function auth(action, data = {}) {
    const payload = await request(`/api/auth/${action}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (payload.user) {
      localStorage.setItem('cluchzone_auth', JSON.stringify(payload.user));
    }
    return payload;
  }

  return {
    online,
    request,
    getStore,
    setStore,
    removeStore,
    auth
  };
})();
