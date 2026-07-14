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
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `HTTP ${response.status}`);
      error.code = payload?.error?.code || 'REQUEST_FAILED';
      error.status = response.status;
      throw error;
    }
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

  async function getSteamFriends() {
    const payload = await request('/api/friends/steam');
    return Array.isArray(payload?.friends) ? payload.friends : [];
  }

  async function getMyTeams() {
    const payload = await request('/api/teams/mine');
    return Array.isArray(payload?.teams) ? payload.teams : [];
  }

  async function createTeam(input) {
    const payload = await request('/api/teams', { method: 'POST', body: JSON.stringify(input) });
    return payload?.team || null;
  }

  async function getTeamMessages(teamId) {
    const payload = await request(`/api/teams/${encodeURIComponent(teamId)}/messages`);
    return Array.isArray(payload?.messages) ? payload.messages : [];
  }

  async function sendTeamMessage(teamId, text) {
    const payload = await request(`/api/teams/${encodeURIComponent(teamId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return payload?.message || null;
  }

  async function getGlobalCatalog() {
    const payload = await request('/api/global/catalog');
    return payload || null;
  }

  async function getGlobalPreferences() {
    const payload = await request('/api/global/preferences');
    return payload?.preferences || null;
  }

  async function saveGlobalPreferences(input) {
    const payload = await request('/api/global/preferences', { method: 'PUT', body: JSON.stringify(input) });
    return payload?.preferences || null;
  }

  async function getMarketplaceListings(filters = {}) {
    const query = new URLSearchParams();
    if (filters.kind) query.set('kind', filters.kind);
    if (filters.game) query.set('game', filters.game);
    if (filters.q) query.set('q', filters.q);
    const suffix = query.toString() ? `?${query}` : '';
    const payload = await request(`/api/marketplace/listings${suffix}`);
    return Array.isArray(payload?.listings) ? payload.listings : [];
  }

  async function createMarketplaceOrder(listingId, input) {
    const payload = await request(`/api/marketplace/listings/${encodeURIComponent(listingId)}/orders`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload?.order || null;
  }

  async function getSellerDashboard() {
    const payload = await request('/api/seller/dashboard');
    return payload?.dashboard || null;
  }

  async function saveSellerProfile(input) {
    const payload = await request('/api/seller/profile', { method: 'PUT', body: JSON.stringify(input) });
    return payload?.seller || null;
  }

  async function createSellerListing(input) {
    const payload = await request('/api/seller/listings', { method: 'POST', body: JSON.stringify(input) });
    return payload?.listing || null;
  }

  async function updateSellerListingStatus(listingId, status) {
    const payload = await request(`/api/seller/listings/${encodeURIComponent(listingId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return payload?.listing || null;
  }

  async function updateSellerOrderStatus(orderId, status) {
    const payload = await request(`/api/seller/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return payload?.order || null;
  }

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

  return {
    getStore,
    setStore,
    removeStore,
    getSteamFriends,
    getMyTeams,
    createTeam,
    getTeamMessages,
    sendTeamMessage,
    getGlobalCatalog,
    getGlobalPreferences,
    saveGlobalPreferences,
    getMarketplaceListings,
    createMarketplaceOrder,
    getSellerDashboard,
    saveSellerProfile,
    createSellerListing,
    updateSellerListingStatus,
    updateSellerOrderStatus,
    onStoreChange,
    auth,
    online: Boolean(baseUrl),
  };
})();
