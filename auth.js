/* ═══════════════════════════════════════════════════════════════
   CLUCHZONE — AUTH SYSTEM JS
   Login via Steam, Supercell, Riot + Email/Password
   Simulates OAuth flow with realistic loading screens
   ═══════════════════════════════════════════════════════════════ */
(function () {

  /* ─── PROVIDER CONFIGS ─────────────────────────────────────── */
  const PROVIDERS = {
    steam: {
      name: 'Steam',
      label: 'Entrar com a Steam',
      badge: 'STEAM',
      badgeClass: 'badge-steam',
      btnClass: 'btn-steam',
      tag: 'steam',
      games: ['PUBG', 'CS2'],
      loadMsg: 'Conectando à Steam...',
      loadSub: 'Redirecionando para autenticação OpenID',
      icon: `<svg viewBox="0 0 233 233" xmlns="http://www.w3.org/2000/svg" fill="#66c0f4">
        <path d="M116.5 0C52.2 0 0 52.2 0 116.5c0 55.4 38.7 101.8 90.6 113.5l30.6-73.6c-2.1.2-4.2.3-6.4.3-25.4 0-46-20.6-46-46s20.6-46 46-46 46 20.6 46 46c0 3-.3 5.9-.9 8.7l-72.9 31.1c5.3 19.3 23 33.5 44 33.5 25.4 0 46-20.6 46-46 0-.5 0-1-.1-1.4L233 97.4C224.4 41.4 175.4 0 116.5 0z"/>
        <circle cx="114.8" cy="110.5" r="27.7"/>
      </svg>`,
      avatarUrl: null,
      mockNick: 'xDROPx_Steam',
    },
    supercell: {
      name: 'Supercell',
      label: 'Entrar com Supercell ID',
      badge: 'BRAWL / CLASH',
      badgeClass: 'badge-supercell',
      btnClass: 'btn-supercell',
      tag: 'supercell',
      games: ['Brawl Stars'],
      loadMsg: 'Conectando ao Supercell ID...',
      loadSub: 'Verificando sua conta Brawl Stars / Clash of Clans',
      icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="18" fill="#004B8D"/>
        <text x="50" y="68" text-anchor="middle" font-size="54" font-family="Arial Black,sans-serif" font-weight="900" fill="#FF6B00">SC</text>
      </svg>`,
      avatarUrl: null,
      mockNick: 'BrawlKing_48k',
    },
    riot: {
      name: 'Riot Games',
      label: 'Entrar com Riot Games',
      badge: 'VALORANT / LoL',
      badgeClass: 'badge-riot',
      btnClass: 'btn-riot',
      tag: 'riot',
      games: ['Valorant', 'League of Legends'],
      loadMsg: 'Conectando à Riot Games...',
      loadSub: 'Autenticando com sua conta Riot',
      icon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="4" fill="#1a1a2e"/>
        <text x="50" y="68" text-anchor="middle" font-size="40" font-family="Arial Black,sans-serif" font-weight="900" fill="#FF4655">RIOT</text>
      </svg>`,
      avatarUrl: null,
      mockNick: 'ValorantAce#BR1',
    },
  };

  /* ─── STATE ──────────────────────────────────────────────── */
  const STATE_KEY = 'cluchzone_auth';
  let authState = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');

  /* ─── BUILD MODAL ──────────────────────────────────────────── */
  function buildModal() {
    const html = `
    <div id="auth-overlay" role="dialog" aria-modal="true" aria-label="Login CLUCHZONE">
      <div class="auth-box">

        <!-- Loading screen -->
        <div class="auth-loading" id="auth-loading">
          <div class="auth-loading-icon" id="loading-icon">⚡</div>
          <div class="auth-loading-title" id="loading-title">Conectando...</div>
          <div class="auth-loading-sub"  id="loading-sub">Aguarde</div>
          <div class="auth-loading-bar"><div class="auth-loading-fill"></div></div>
        </div>

        <!-- Header -->
        <div class="auth-header">
          <div class="auth-logo">CLUCHZONE</div>
          <div class="auth-title" id="auth-modal-title">Bem-vindo de volta</div>
          <div class="auth-sub" id="auth-modal-sub">Escolha como deseja acessar a plataforma</div>
          <button class="auth-close" id="auth-close-btn" aria-label="Fechar">✕</button>
        </div>

        <!-- Tabs -->
        <div class="auth-tabs">
          <button class="auth-tab-btn active" data-atab="login">Entrar</button>
          <button class="auth-tab-btn" data-atab="register">Criar Conta</button>
        </div>

        <!-- Body -->
        <div class="auth-body">

          <!-- Social providers -->
          <div class="auth-providers">

            <!-- STEAM -->
            <button class="btn-provider btn-steam" id="btn-login-steam" data-provider="steam">
              <div class="provider-icon">${PROVIDERS.steam.icon}</div>
              <span class="provider-label">Entrar com a Steam</span>
              <span class="provider-badge badge-steam">STEAM</span>
            </button>

            <!-- SUPERCELL -->
            <button class="btn-provider btn-supercell" id="btn-login-supercell" data-provider="supercell">
              <div class="provider-icon">${PROVIDERS.supercell.icon}</div>
              <span class="provider-label">Entrar com Supercell ID</span>
              <span class="provider-badge badge-supercell">BRAWL / CLASH</span>
            </button>

            <!-- RIOT -->
            <button class="btn-provider btn-riot" id="btn-login-riot" data-provider="riot">
              <div class="provider-icon">${PROVIDERS.riot.icon}</div>
              <span class="provider-label">Entrar com Riot Games</span>
              <span class="provider-badge badge-riot">VALORANT / LoL</span>
            </button>

          </div>

          <!-- Divider -->
          <div class="auth-divider">ou continue com email</div>

          <!-- Email form -->
          <form class="auth-form" id="auth-email-form" autocomplete="on">
            <div class="form-field">
              <label for="auth-email">E-mail</label>
              <input type="email" id="auth-email" name="email" placeholder="seu@email.com" required autocomplete="email"/>
            </div>
            <div class="form-field">
              <label for="auth-password">Senha</label>
              <input type="password" id="auth-password" name="password" placeholder="••••••••" required autocomplete="current-password"/>
            </div>
            <button type="submit" class="btn-auth-submit">ENTRAR NA ARENA →</button>
            <div class="auth-footer">
              <a id="auth-forgot">Esqueceu a senha?</a> &nbsp;·&nbsp;
              Não tem conta? <a id="auth-switch-register">Criar agora</a>
            </div>
          </form>

        </div>

        <div class="auth-terms">
          Ao entrar você concorda com os <a href="#">Termos de Uso</a> e a
          <a href="#">Política de Privacidade</a> do CLUCHZONE.
        </div>
      </div>
    </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
  }

  /* ─── OPEN / CLOSE ──────────────────────────────────────── */
  function openAuth(tab = 'login') {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    switchTab(tab);
    document.body.style.overflow = 'hidden';
  }
  function closeAuth() {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    hideLoading();
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.atab === tab);
    });
    const title = document.getElementById('auth-modal-title');
    const sub   = document.getElementById('auth-modal-sub');
    const submit = document.querySelector('.btn-auth-submit');
    const pw    = document.getElementById('auth-password');
    if (tab === 'login') {
      if (title)  title.textContent  = 'Bem-vindo de volta';
      if (sub)    sub.textContent    = 'Escolha como deseja acessar a plataforma';
      if (submit) submit.textContent = 'ENTRAR NA ARENA →';
      if (pw)     pw.setAttribute('autocomplete', 'current-password');
    } else {
      if (title)  title.textContent  = 'Criar sua conta';
      if (sub)    sub.textContent    = 'Junte-se a milhares de jogadores no CLUCHZONE';
      if (submit) submit.textContent = 'CRIAR CONTA GRÁTIS →';
      if (pw)     pw.setAttribute('autocomplete', 'new-password');
    }
  }

  /* ─── LOADING ──────────────────────────────────────────── */
  function showLoading(providerKey) {
    const p = PROVIDERS[providerKey] || { loadMsg: 'Autenticando...', loadSub: 'Aguarde', name: '' };
    document.getElementById('loading-title').textContent = p.loadMsg;
    document.getElementById('loading-sub').textContent   = p.loadSub;
    const icons = { steam: '🎮', supercell: '⭐', riot: '⚔️', email: '✉️' };
    document.getElementById('loading-icon').textContent = icons[providerKey] || '⚡';
    document.getElementById('auth-loading').classList.add('show');
  }
  function hideLoading() {
    document.getElementById('auth-loading')?.classList.remove('show');
  }

  /* ─── SIMULATE OAUTH ────────────────────────────────────── */
  function simulateOAuth(providerKey, customNick) {
    showLoading(providerKey);
    const p = PROVIDERS[providerKey];
    const steps = [
      { delay: 600,  msg: p.loadMsg,                              sub: 'Iniciando handshake...' },
      { delay: 1200, msg: 'Verificando credenciais...',           sub: 'Conectando ao servidor de autenticação' },
      { delay: 1900, msg: 'Carregando perfil...',                 sub: `Buscando dados de ${p.name}` },
      { delay: 2500, msg: 'Quase lá!',                           sub: 'Sincronizando estatísticas de jogo' },
    ];
    steps.forEach(s => setTimeout(() => {
      const el = document.getElementById('loading-title');
      const sub = document.getElementById('loading-sub');
      if (el) el.textContent = s.msg;
      if (sub) sub.textContent = s.sub;
    }, s.delay));

    setTimeout(() => {
      const nick = customNick || p.mockNick;
      loginUser({ provider: providerKey, nick, games: p.games });
    }, 3100);
  }

  /* ─── LOGIN USER ────────────────────────────────────────── */
  function loginUser(data) {
    authState = data;
    localStorage.setItem(STATE_KEY, JSON.stringify(data));
    closeAuth();
    updateNavForUser(data);
    showToast(`✅ Bem-vindo, ${data.nick}! Você entrou via ${PROVIDERS[data.provider]?.name || 'Email'}.`, '#00e676');

    // If on passport page, update avatar/nick display
    const nickEl = document.querySelector('.profile-nick');
    if (nickEl && nickEl.firstChild) {
      nickEl.firstChild.textContent = data.nick;
    }
  }

  /* ─── LOGOUT ────────────────────────────────────────────── */
  function logoutUser() {
    authState = null;
    localStorage.removeItem(STATE_KEY);
    updateNavForGuest();
    showToast('Você saiu da sua conta. Até logo!', '#ff4654');
  }

  /* ─── UPDATE NAV ────────────────────────────────────────── */
  function updateNavForUser(data) {
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;

    // remove old login/register buttons
    actions.querySelectorAll('.btn-nav-login, .btn-nav-register, .nav-user-wrapper').forEach(el => el.remove());

    const initial = data.nick.charAt(0).toUpperCase();
    const provTag = `<span class="provider-tag ${data.provider}">${PROVIDERS[data.provider]?.name || 'Email'}</span>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'nav-user-wrapper';
    wrapper.innerHTML = `
      <div class="nav-user-pill" title="${data.nick}">
        <div class="nav-user-avatar">${initial}</div>
        <div>
          <div class="nav-user-name">${data.nick}</div>
          <div class="nav-user-source">${provTag}</div>
        </div>
      </div>
      <div class="nav-user-dropdown">
        <a href="passport.html" class="dropdown-item">🛂 Passaporte</a>
        <a class="dropdown-item" id="dd-premium">👑 Premium</a>
        <div class="dropdown-sep"></div>
        <div class="dropdown-item" id="dd-settings">⚙️ Configurações</div>
        <div class="dropdown-item danger" id="dd-logout">⟵ Sair</div>
      </div>`;
    actions.appendChild(wrapper);

    document.getElementById('dd-logout')?.addEventListener('click', logoutUser);
    document.getElementById('dd-premium')?.addEventListener('click', () => {
      closeAuth();
      window.openPremiumModal?.();
    });
  }

  function updateNavForGuest() {
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;
    actions.querySelectorAll('.btn-nav-login, .btn-nav-register, .nav-user-wrapper').forEach(el => el.remove());

    const loginBtn = document.createElement('button');
    loginBtn.className = 'btn-nav-login';
    loginBtn.textContent = 'Entrar';
    loginBtn.addEventListener('click', () => openAuth('login'));

    const regBtn = document.createElement('button');
    regBtn.className = 'btn-nav-register';
    regBtn.textContent = 'Criar Conta';
    regBtn.addEventListener('click', () => openAuth('register'));

    actions.appendChild(loginBtn);
    actions.appendChild(regBtn);
  }

  /* ─── TOAST ─────────────────────────────────────────────── */
  function showToast(msg, color = '#00d4ff') {
    const tc = document.getElementById('toast-container') || (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;';
      document.body.appendChild(el);
      return el;
    })();
    const t = document.createElement('div');
    t.style.cssText = `padding:13px 24px;border-radius:10px;font-weight:700;font-size:14px;
      background:rgba(10,13,20,.97);border:1px solid ${color};color:${color};
      box-shadow:0 4px 24px rgba(0,0,0,.7);white-space:nowrap;font-family:'Rajdhani',sans-serif;`;
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(() => t.remove(), 400); }, 4000);
  }

  /* ─── INIT ───────────────────────────────────────────────── */
  function init() {
    buildModal();

    // Hook existing nav buttons
    const overlay = document.getElementById('auth-overlay');

    // Tabs
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.atab));
    });

    // Close
    document.getElementById('auth-close-btn')?.addEventListener('click', closeAuth);
    overlay?.addEventListener('click', e => { if (e.target === overlay) closeAuth(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuth(); });

    // Provider buttons
    document.querySelectorAll('[data-provider]').forEach(btn => {
      btn.addEventListener('click', () => simulateOAuth(btn.dataset.provider));
    });

    // Email form
    document.getElementById('auth-email-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('auth-email')?.value || '';
      const nick  = email.split('@')[0] || 'Jogador';
      simulateOAuth('email', nick);
    });

    // Switch links
    document.getElementById('auth-switch-register')?.addEventListener('click', () => switchTab('register'));
    document.getElementById('auth-forgot')?.addEventListener('click', () => {
      showToast('📧 Link de recuperação enviado para seu email!', '#00d4ff');
      closeAuth();
    });

    // Intercept existing login/register buttons in nav
    function hookNavButtons() {
      document.querySelectorAll('.btn-nav-login, #btn-login').forEach(btn => {
        btn.addEventListener('click', () => openAuth('login'));
      });
      document.querySelectorAll('.btn-nav-register, #btn-register').forEach(btn => {
        btn.addEventListener('click', () => openAuth('register'));
      });
    }
    hookNavButtons();

    // Restore session
    if (authState) {
      updateNavForUser(authState);
    }

    // Expose globals
    window.openAuthModal   = openAuth;
    window.closeAuthModal  = closeAuth;
    window.logoutUser      = logoutUser;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
