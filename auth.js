'use strict';

(function () {
  if (window.ClutchAuth?.ready) return;

  const configuredUrl = String(window.CLUCHZONE_BACKEND_URL || document.querySelector('meta[name="clutchzone-backend-url"]')?.content || '').trim();
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const backendUrl = (configuredUrl || (isLocal ? 'http://localhost:3001' : '')).replace(/\/$/, '');
  let currentUser = null;
  let authState = 'loading';
  let recoveryTimer = null;
  let recoveryAttempt = 0;
  let refreshPromise = null;

  const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

  function dispatchAuthChanged() {
    window.dispatchEvent(new CustomEvent('clutchzone-auth-changed', { detail: currentUser }));
  }

  function clearRecovery() {
    if (recoveryTimer) window.clearTimeout(recoveryTimer);
    recoveryTimer = null;
    recoveryAttempt = 0;
  }

  function scheduleRecovery() {
    if (recoveryTimer || document.visibilityState === 'hidden') return;
    const delay = Math.min(30000, 2000 * (2 ** recoveryAttempt));
    recoveryAttempt += 1;
    recoveryTimer = window.setTimeout(async () => {
      recoveryTimer = null;
      await refresh();
      if (authState === 'unavailable') scheduleRecovery();
    }, delay);
  }

  function normalizeUser(user) {
    return {
      uid: user.id,
      id: user.id,
      steamId64: user.steamId64,
      nick: user.displayName,
      displayName: user.displayName,
      avatar: user.avatarUrl,
      avatarUrl: user.avatarUrl,
      profileUrl: user.profileUrl,
      steamLevel: user.steamLevel,
      visibilityState: user.visibilityState,
      profileState: user.profileState,
      personaState: user.personaState,
      countryCode: user.countryCode,
      stateCode: user.stateCode,
      steamCreatedAt: user.steamCreatedAt,
      lastLogoffAt: user.lastLogoffAt,
      provider: 'steam',
      role: String(user.role || 'PLAYER').toLowerCase(),
      status: user.status,
      showcaseVisible: user.showcaseVisible !== false,
      preferredLocale: user.preferredLocale,
      timeZone: user.timeZone,
      currencyCode: user.currencyCode,
      regionCode: user.regionCode,
      premium: false,
      games: ['CS2', 'PUBG'],
      createdAt: user.createdAt,
      lastLogin: user.lastLoginAt,
    };
  }

  async function api(path, options = {}) {
    if (!backendUrl) throw new Error('Backend de autenticação não configurado.');
    const response = await fetch(`${backendUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: { accept: 'application/json', ...(options.headers || {}) },
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || 'Falha na autenticação.');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function loadUser() {
    const retryDelays = [0, 250, 800, 1600];
    let lastError = null;
    for (const delay of retryDelays) {
      if (delay) await wait(delay);
      try {
        const payload = await api('/auth/me');
        currentUser = normalizeUser(payload.user);
        authState = 'authenticated';
        clearRecovery();
        dispatchAuthChanged();
        return currentUser;
      } catch (error) {
        lastError = error;
        if (error?.status === 401) {
          currentUser = null;
          authState = 'anonymous';
          clearRecovery();
          dispatchAuthChanged();
          return null;
        }
        const transient = !error?.status || error.status === 429 || error.status >= 500;
        if (!transient) break;
      }
    }
    console.warn('[ClutchAuth] A sessão será sincronizada novamente em segundo plano.', lastError?.message || lastError);
    authState = currentUser ? 'authenticated' : 'unavailable';
    scheduleRecovery();
    dispatchAuthChanged();
    return currentUser;
  }

  async function login() {
    if (!backendUrl) {
      showError('Configure CLUCHZONE_BACKEND_URL antes de usar a autenticação.');
      return;
    }
    try {
      const health = await fetch(`${backendUrl}/health`, { headers: { accept: 'application/json' } });
      if (!health.ok) throw new Error(`HTTP ${health.status}`);
    } catch (_) {
      showError('O backend de autenticação não está disponível na porta 3001. Configure backend/.env, PostgreSQL e execute npm run dev dentro de backend/.');
      return;
    }
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`${backendUrl}/auth/steam?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      currentUser = null;
      window.location.reload();
    } catch (error) {
      showError(error.message);
    }
  }

  function buildModal() {
    if (document.getElementById('auth-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Entrar no CLUTCHZONE');
    overlay.innerHTML = `
      <div class="auth-box">
        <div class="auth-header">
          <div class="auth-logo">CLUTCHZONE</div>
          <div class="auth-title">Entre com sua conta Steam</div>
          <div class="auth-sub">Sua senha é informada somente à Steam e nunca passa pelo CLUTCHZONE.</div>
          <button class="auth-close" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="auth-body">
          <button class="btn-provider btn-steam" type="button" id="btn-login-steam">
            <span class="provider-icon" aria-hidden="true">🎮</span>
            <span class="provider-label">Entrar com a Steam</span>
            <span class="provider-badge badge-steam">OPENID</span>
          </button>
          <p id="auth-error" role="alert" style="display:none;color:#ff6b6b;margin-top:14px"></p>
        </div>
        <div class="auth-terms">A identidade é validada no backend pelo fluxo oficial Steam OpenID.</div>
      </div>`;
    overlay.querySelector('.auth-close').addEventListener('click', closeModal);
    overlay.querySelector('#btn-login-steam').addEventListener('click', login);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
  }

  function openModal() {
    buildModal();
    document.getElementById('auth-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.getElementById('auth-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showError(message) {
    openModal();
    const error = document.getElementById('auth-error');
    if (error) {
      error.textContent = String(message || 'Não foi possível autenticar.');
      error.style.display = 'block';
    }
  }

  function renderNavigation() {
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;
    actions.querySelectorAll('.btn-nav-login, .btn-nav-register, .btn-login, .btn-register, .btn-nav-session-error, .btn-nav-session-sync, .nav-user-wrapper').forEach(element => element.remove());
    if (!currentUser) {
      const button = document.createElement('button');
      button.type = 'button';
      if (authState === 'unavailable' || authState === 'loading') {
        button.className = 'btn-nav-session-sync';
        button.textContent = 'Sincronizando Steam…';
        button.title = 'A sessão será restaurada automaticamente assim que o backend responder.';
        button.disabled = true;
        button.setAttribute('aria-live', 'polite');
      } else {
        button.className = 'btn-nav-login';
        button.textContent = 'Entrar com Steam';
        button.addEventListener('click', openModal);
      }
      actions.appendChild(button);
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-user-wrapper';
    const pill = document.createElement('div');
    pill.className = 'nav-user-pill';
    const avatar = document.createElement('div');
    avatar.className = 'nav-user-avatar';
    if (currentUser.avatarUrl && /^https:\/\//.test(currentUser.avatarUrl)) {
      const image = document.createElement('img');
      image.src = currentUser.avatarUrl;
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      avatar.appendChild(image);
    } else {
      avatar.textContent = currentUser.displayName.charAt(0).toUpperCase();
    }
    const name = document.createElement('span');
    name.className = 'nav-user-name';
    name.textContent = currentUser.displayName;
    pill.append(avatar, name);
    const menu = document.createElement('div');
    menu.className = 'nav-user-dropdown';
    const profile = document.createElement('a');
    profile.className = 'dropdown-item';
    profile.href = 'passport.html';
    profile.textContent = 'Passaporte';
    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'dropdown-item';
    logoutButton.textContent = 'Sair';
    logoutButton.addEventListener('click', logout);
    menu.append(profile, logoutButton);
    wrapper.append(pill, menu);
    actions.appendChild(wrapper);
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise;
    if (!currentUser) authState = 'loading';
    refreshPromise = loadUser().then(user => {
      renderNavigation();
      return user;
    }).finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  const ready = loadUser();
  window.ClutchAuth = {
    ready,
    getUser: () => currentUser,
    getState: () => authState,
    refresh,
    login,
    logout,
    open: openModal,
    backendUrl,
  };
  window.openAuthModal = openModal;
  window.logoutUser = logout;

  window.addEventListener('online', () => { void refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) void refresh(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && authState === 'unavailable') void refresh();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    buildModal();
    await ready;
    renderNavigation();
    document.querySelectorAll('#btn-login, #btn-register, .btn-login, .btn-register').forEach(button => button.addEventListener('click', openModal));
  });
})();
