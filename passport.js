/* ═══════════════════════════════════════════════════════════════
   CLUTCHZONE — PASSPORT GAME ENGINE JS
   Manages player profile statistics, Chart.js updates,
   multi-platform connections (Steam, Supercell, Riot)
   and dynamic profile mapping based on connected profiles.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  await window.ClutchAuth?.ready;

  const STORAGE_KEY_AUTH = 'cluchzone_auth';
  const STORAGE_KEY_CONN = 'cluchzone_connections';
  const STORAGE_KEY_PREMIUM = 'cluchzone_premium';
  const STORAGE_KEY_PROFILE = 'cluchzone_profile';

  // 1. Recover auth state
  let authState = window.ClutchAuth?.getUser() || null;
  let isPremium = localStorage.getItem(STORAGE_KEY_PREMIUM) === 'true';
  let profileState = JSON.parse(localStorage.getItem(STORAGE_KEY_PROFILE) || '{}');

  // If not logged in, block content and show platforms login requirement
  if (!authState) {
    injectAuthGateOverlay();
    return;
  }

  // Helper to block profile with dynamic connection prompt
  function injectAuthGateOverlay() {
    const mainSection = document.querySelector('.passport-profile-section');
    const contentSection = document.querySelector('.passport-content');
    const tabsSection = document.querySelector('.passport-tabs');
    if (mainSection) mainSection.style.filter = 'blur(10px)';
    if (contentSection) contentSection.style.filter = 'blur(10px)';
    if (tabsSection) tabsSection.style.filter = 'blur(10px)';

    const gate = document.createElement('div');
    gate.style.cssText = `
      position: fixed; inset: 0; z-index: 5000;
      background: rgba(5, 8, 17, 0.88); backdrop-filter: blur(15px);
      display: flex; align-items: center; justify-content: center; padding: 24px;
      font-family: 'Rajdhani', sans-serif;
    `;
    gate.innerHTML = `
      <div class="pp-card" style="max-width: 440px; width: 100%; text-align: center; border: 1px solid var(--border-glow); box-shadow: var(--shadow-glow); background: rgba(13,17,28,.95);">
        <div style="font-size: 40px; margin-bottom: 12px;">🛂</div>
        <h2 style="font-family: 'Orbitron', sans-serif; font-size: 20px; font-weight: 900; color: #fff; letter-spacing: 1px; margin-bottom: 8px;">PASSAPORTE RESTRITO</h2>
        <p style="font-size: 13px; color: #a0aec0; margin-bottom: 24px; line-height: 1.5;">Vincule ou acesse sua conta em uma das plataformas abaixo para visualizar seu histórico de eSports, troféus e métricas de jogo.</p>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="btn-provider btn-steam" onclick="window.openAuthModal('login')" style="height: 48px; border-radius: 8px; justify-content: center; font-weight: 700; width: 100%;">
            Entrar com a Steam
          </button>
          <button class="btn-provider btn-supercell" onclick="window.openAuthModal('login')" style="height: 48px; border-radius: 8px; justify-content: center; font-weight: 700; width: 100%;">
            Entrar com Supercell ID
          </button>
          <button class="btn-provider btn-riot" onclick="window.openAuthModal('login')" style="height: 48px; border-radius: 8px; justify-content: center; font-weight: 700; width: 100%;">
            Entrar com Riot Games
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(gate);
  }

  // 2. Load connected platforms list
  let connectedPlatforms = JSON.parse(localStorage.getItem(STORAGE_KEY_CONN)) || [];
  
  // Make sure the login provider itself is automatically connected
  if (authState.provider && !connectedPlatforms.includes(authState.provider)) {
    connectedPlatforms.push(authState.provider);
    localStorage.setItem(STORAGE_KEY_CONN, JSON.stringify(connectedPlatforms));
  }

  // Legacy game statistics remain separate; Steam identity fields below are always API-backed.
  const MOCK_PLATFORM_DATA = {
    steam: {
      nick: authState.displayName || authState.nick,
      avatar: '🎮',
      level: Number.isInteger(authState.steamLevel) ? `Nível ${authState.steamLevel}` : 'Nível privado',
      rank: authState.visibilityState === 3 ? 'Perfil público' : 'Perfil privado',
      hours: 'Steam conectada',
      stats: {
        cs2: { kd: '1.42', winrate: '58%', matches: '512 partidas', label: 'Conectado via Steam' },
        pubg: { kd: '3.20', winrate: '18%', matches: '284 partidas', label: 'Conectado via Steam' }
      }
    },
    supercell: {
      nick: 'BrawlKing_48k',
      avatar: '⭐',
      level: 'LVL 120',
      rank: 'Mítico III',
      hours: '340 hrs',
      stats: {
        brawl: { trophies: '48.210', winrate: '61%', matches: '1.240 batalhas', label: 'Conectado via Supercell ID' }
      }
    },
    riot: {
      nick: 'ValorantAce#BR1',
      avatar: '⚔️',
      level: 'LVL 84',
      rank: 'Radiante',
      hours: '780 hrs',
      stats: {
        valorant: { kd: '1.24', winrate: '55%', matches: '390 partidas', label: 'Conectado via Riot Client' }
      }
    }
  };

  const PERSONA_STATES = ['Offline', 'Online', 'Ocupado', 'Ausente', 'Soneca', 'Quer trocar', 'Quer jogar'];

  function formatSteamDate(value, includeTime = false) {
    if (!value) return 'Não informado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Não informado';
    return new Intl.DateTimeFormat('pt-BR', includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { month: 'short', year: 'numeric' }).format(date);
  }

  function renderSteamInformation() {
    const values = {
      'steam-info-level': Number.isInteger(authState.steamLevel) ? String(authState.steamLevel) : 'Não público',
      'steam-info-status': PERSONA_STATES[authState.personaState] || 'Não informado',
      'steam-info-visibility': authState.visibilityState === 3 ? 'Público' : authState.visibilityState === 1 ? 'Privado' : 'Não informado',
      'steam-info-location': [authState.countryCode, authState.stateCode].filter(Boolean).join(' - ') || 'Não informada',
      'steam-info-created': formatSteamDate(authState.steamCreatedAt),
      'steam-info-logoff': formatSteamDate(authState.lastLogoffAt, true),
      'steam-info-id': `SteamID64: ${authState.steamId64 || 'Não informado'}`,
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
    const profileLink = document.getElementById('steam-profile-link');
    if (profileLink) {
      const validProfileUrl = typeof authState.profileUrl === 'string' && /^https:\/\/steamcommunity\.com\//.test(authState.profileUrl);
      profileLink.href = validProfileUrl ? authState.profileUrl : '#';
      profileLink.hidden = !validProfileUrl;
    }
  }

  /* ─── RENDER MULTIPLATFORM DATA ─── */
  function renderProfileHeader() {
    const avatarImg = document.getElementById('pass-avatar-img');
    const avatarText = document.getElementById('pass-avatar-txt');
    const nickText = document.getElementById('pass-nick-text');
    const handleText = document.getElementById('pass-handle-text');
    const badgeRow = document.getElementById('pass-badge-row');
    const levelBadge = document.getElementById('pass-level-badge');
    const premiumStar = document.getElementById('pass-premium-star');

    // Premium status toggle
    if (premiumStar) premiumStar.style.display = isPremium ? 'inline-flex' : 'none';

    // Steam-authoritative name and source
    if (nickText) {
      const displayName = authState.displayName || authState.nick;
      nickText.replaceChildren(document.createTextNode(displayName));
      if (isPremium) {
        const premium = document.createElement('span');
        premium.className = 'premium-star';
        premium.id = 'pass-premium-star';
        premium.textContent = '👑 PREMIUM';
        nickText.append(' ', premium);
      }
    }

    if (handleText) {
      const location = [authState.countryCode, authState.stateCode].filter(Boolean).join(' - ');
      handleText.textContent = `Steam · Conta desde ${formatSteamDate(authState.steamCreatedAt)}${location ? ` · ${location}` : ''}`;
    }

    // Set avatar based on primary provider
    if (avatarImg && avatarText) {
      if (authState.avatarUrl && /^https:\/\//.test(authState.avatarUrl)) {
        avatarImg.src = authState.avatarUrl;
        avatarImg.style.display = 'block';
        avatarText.style.display = 'none';
      } else if (authState.provider === 'steam') {
        avatarImg.style.display = 'none';
        avatarText.textContent = '🎮';
        avatarText.style.display = 'flex';
        if (levelBadge) levelBadge.textContent = Number.isInteger(authState.steamLevel) ? `STEAM ${authState.steamLevel}` : 'STEAM --';
      } else if (authState.provider === 'supercell') {
        avatarImg.style.display = 'none';
        avatarText.textContent = '⭐';
        avatarText.style.display = 'flex';
        if (levelBadge) levelBadge.textContent = 'LVL 120';
      } else if (authState.provider === 'riot') {
        avatarImg.style.display = 'none';
        avatarText.textContent = '⚔️';
        avatarText.style.display = 'flex';
        if (levelBadge) levelBadge.textContent = 'LVL 84';
      } else {
        // Email or custom
        avatarImg.style.display = 'block';
        avatarText.style.display = 'none';
        if (levelBadge) levelBadge.textContent = 'LVL 42';
      }
    }

    if (levelBadge) levelBadge.textContent = Number.isInteger(authState.steamLevel) ? `STEAM ${authState.steamLevel}` : 'STEAM --';
    renderSteamInformation();

    // Dynamic stats strip update
    updateStatsStrip();
  }

  function updateStatsStrip() {
    const countCamps = document.getElementById('strip-camps-count');
    const countWins = document.getElementById('strip-wins-count');
    const rankTitle = document.getElementById('strip-rank-title');
    const revenueCount = document.getElementById('strip-revenue-count');

    let totalCamps = 0;
    let totalWins = 0;
    let rank = 'Bronze';
    let earnings = 'R$ 0';

    if (connectedPlatforms.includes('steam')) {
      totalCamps += 24;
      totalWins += 8;
      rank = 'Global Elite';
      earnings = 'R$ 1.300';
    }
    if (connectedPlatforms.includes('supercell')) {
      totalCamps += 12;
      totalWins += 3;
      rank = 'Mítico III';
      earnings = 'R$ 600';
    }
    if (connectedPlatforms.includes('riot')) {
      totalCamps += 11;
      totalWins += 4;
      rank = 'Radiante';
      earnings = 'R$ 500';
    }

    if (connectedPlatforms.length === 0 || (connectedPlatforms.length === 1 && connectedPlatforms.includes('email'))) {
      totalCamps = 47;
      totalWins = 12;
      rank = 'Diamond II';
      earnings = 'R$ 2.400';
    }

    if (countCamps) countCamps.textContent = totalCamps;
    if (countWins) countWins.textContent = totalWins;
    if (rankTitle) rankTitle.textContent = rank;
    if (revenueCount) revenueCount.textContent = earnings;
  }

  function renderAvatarPreview(source) {
    const preview = document.getElementById('pass-profile-avatar-preview');
    if (!preview) return;
    preview.innerHTML = source ? `<img src="${source}" alt="Prévia da foto de perfil">` : '👤';
  }

  // Mantém o nome público igual em todas as equipes das quais o jogador participa.
  function syncProfileNameAcrossTeams(previousNames, nextName) {
    const aliases = new Set(previousNames.map(name => String(name || '').trim().toLowerCase()).filter(Boolean));
    if (!aliases.size) return;

    const replaceName = value => aliases.has(String(value || '').trim().toLowerCase()) ? nextName : value;
    const updateStore = async (key, fallback, transform) => {
      let value = fallback;
      try { value = await window.CluchAPI?.getStore(key, fallback) ?? fallback; } catch (_) { /* usa cache local */ }
      if (!Array.isArray(value)) return;
      const updated = transform(value);
      if (JSON.stringify(updated) === JSON.stringify(value)) return;
      localStorage.setItem(key, JSON.stringify(updated));
      window.CluchAPI?.setStore(key, updated);
    };

    const localTeams = JSON.parse(localStorage.getItem('cluchzone_cs2_teams') || '[]');
    const localInvites = JSON.parse(localStorage.getItem('cluchzone_team_invites') || '[]');
    const localPlayers = JSON.parse(localStorage.getItem('cluchzone_cs2_players') || '[]');

    void updateStore('cluchzone_cs2_teams', localTeams, teams => teams.map(team => ({
      ...team,
      captain: replaceName(team.captain),
      vice: replaceName(team.vice),
      members: Array.isArray(team.members) ? team.members.map(replaceName) : team.members,
      reserves: Array.isArray(team.reserves) ? team.reserves.map(replaceName) : team.reserves
    })));

    void updateStore('cluchzone_team_invites', localInvites, invites => invites.map(invite => ({
      ...invite,
      captain: replaceName(invite.captain),
      invitee: replaceName(invite.invitee)
    })));

    void updateStore('cluchzone_cs2_players', localPlayers, players => players.map(player => ({
      ...player,
      nick: replaceName(player.nick)
    })));
  }

  function setupProfileEditor() {
    const openButton = document.getElementById('pass-edit-profile-btn');
    const modal = document.getElementById('pass-edit-profile-modal');
    const form = document.getElementById('pass-edit-profile-form');
    const nameInput = document.getElementById('pass-profile-name-input');
    const avatarInput = document.getElementById('pass-profile-avatar-input');
    const cancelButton = document.getElementById('pass-profile-cancel');
    const quickAvatarTrigger = document.getElementById('pass-avatar-upload-trigger');
    const quickAvatarInput = document.getElementById('pass-avatar-quick-input');
    if (!openButton || !modal || !form || !nameInput || !avatarInput) return;
    if (authState.provider === 'steam') {
      openButton.hidden = true;
      quickAvatarTrigger?.removeAttribute('role');
      quickAvatarTrigger?.removeAttribute('tabindex');
      quickAvatarTrigger?.setAttribute('aria-label', 'Avatar sincronizado da Steam');
      if (quickAvatarTrigger) {
        quickAvatarTrigger.style.cursor = 'default';
        quickAvatarTrigger.classList.add('steam-synced');
      }
      return;
    }

    const saveQuickAvatar = file => {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Escolha uma imagem de até 2 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = event => {
        profileState = { ...profileState, avatar: event.target.result };
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profileState));
        renderProfileHeader();
      };
      reader.readAsDataURL(file);
    };

    quickAvatarTrigger?.addEventListener('click', () => quickAvatarInput?.click());
    quickAvatarTrigger?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        quickAvatarInput?.click();
      }
    });
    quickAvatarInput?.addEventListener('change', () => {
      saveQuickAvatar(quickAvatarInput.files?.[0]);
      quickAvatarInput.value = '';
    });

    openButton.addEventListener('click', () => {
      nameInput.value = profileState.displayName || authState.nick || '';
      avatarInput.value = '';
      renderAvatarPreview(profileState.avatar);
      modal.classList.add('open');
      nameInput.focus();
    });
    const close = () => modal.classList.remove('open');
    cancelButton?.addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Escolha uma imagem de até 2 MB.');
        avatarInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = event => renderAvatarPreview(event.target.result);
      reader.readAsDataURL(file);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const displayName = nameInput.value.trim();
      if (!displayName) return;
      const save = avatar => {
        const previousNames = [authState.nick, profileState.displayName];
        profileState = { displayName, avatar: avatar ?? profileState.avatar ?? '' };
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profileState));
        // Display preferences are local only; authenticated identity remains Steam-authoritative.
        window.dispatchEvent(new Event('cluchzone-profile-updated'));
        renderProfileHeader();
        close();
      };
      const file = avatarInput.files?.[0];
      if (!file) return save();
      const reader = new FileReader();
      reader.onload = event => save(event.target.result);
      reader.readAsDataURL(file);
    });
  }

  /* ─── RENDER PLATFORM INTEGRATIONS (CONNECTIONS TAB) ─── */
  function renderPlatformConnections() {
    const connContainer = document.getElementById('platform-connections-list');
    if (!connContainer) return;
    connContainer.innerHTML = '';

    const list = [
      { key: 'steam', name: 'Steam', desc: 'Sincroniza inventários e estatísticas de PUBG e CS2.', icon: '🎮', color: '#1b2838' },
      { key: 'supercell', name: 'Supercell ID', desc: 'Sincroniza troféus e brawlers de Brawl Stars.', icon: '⭐', color: '#004B8D' },
      { key: 'riot', name: 'Riot Games', desc: 'Sincroniza elo e partidas de Valorant e League of Legends.', icon: '⚔️', color: '#1a1a2e' }
    ];

    list.forEach(p => {
      const isLinked = connectedPlatforms.includes(p.key);
      const card = document.createElement('div');
      card.className = 'pp-card';
      card.style.borderLeft = `4px solid ${isLinked ? '#00e676' : 'rgba(255,255,255,0.05)'}`;
      
      const pData = MOCK_PLATFORM_DATA[p.key];

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="font-size:32px; background:${p.color}; width:54px; height:54px; border-radius:10px; display:flex; align-items:center; justify-content:center;">${p.icon}</div>
            <div>
              <strong style="font-size:16px; color:#fff;">${p.name}</strong>
              <div style="font-size:11px; color:#718096; margin-top:2px;">${p.desc}</div>
              ${isLinked ? `<div style="font-size:12px; color:#00ff88; font-weight:700; margin-top:4px;">✓ Conectado como ${pData.nick} (${pData.level})</div>` : ''}
            </div>
          </div>
          <div>
            ${isLinked ? 
              `<button class="cs2-btn cs2-btn-secondary" style="border-color:#ff3333; color:#ff3333;" onclick="disconnectPlatform('${p.key}')">Desconectar</button>` : 
              `<button class="cs2-btn cs2-btn-primary" onclick="connectPlatform('${p.key}')">🔌 Conectar</button>`
            }
          </div>
        </div>
      `;
      connContainer.appendChild(card);
    });

    // Refresh game-specific stats list as well
    renderGameStatsPane();
  }

  window.connectPlatform = (platformKey) => {
    // Open auth system with that provider
    showToast(`🔌 Iniciando conexão simulada com ${platformKey.toUpperCase()}...`, '#00d4ff');
    
    setTimeout(() => {
      if (!connectedPlatforms.includes(platformKey)) {
        connectedPlatforms.push(platformKey);
        localStorage.setItem(STORAGE_KEY_CONN, JSON.stringify(connectedPlatforms));
      }
      addNotification(`Conta ${platformKey.toUpperCase()} conectada ao seu Passaporte CLUTCHZONE!`);
      showToast(`✓ Conta ${platformKey.toUpperCase()} vinculada com sucesso!`, '#00e676');
      
      renderProfileHeader();
      renderPlatformConnections();
    }, 1500);
  };

  window.disconnectPlatform = (platformKey) => {
    if (platformKey === authState.provider) {
      showToast('⚠️ Você não pode desconectar a plataforma que usou para fazer login!', '#ff3333');
      return;
    }
    if (confirm(`Deseja realmente remover a integração com ${platformKey.toUpperCase()}?`)) {
      connectedPlatforms = connectedPlatforms.filter(p => p !== platformKey);
      localStorage.setItem(STORAGE_KEY_CONN, JSON.stringify(connectedPlatforms));
      showToast(`❌ Conta ${platformKey.toUpperCase()} desvinculada.`, '#ff3333');
      
      renderProfileHeader();
      renderPlatformConnections();
    }
  };

  /* ─── RENDER STATISTICS BY GAME ─── */
  function renderGameStatsPane() {
    const cs2Container = document.getElementById('stat-pane-cs2');
    const pubgContainer = document.getElementById('stat-pane-pubg');
    const brawlContainer = document.getElementById('stat-pane-brawl');
    const valContainer = document.getElementById('stat-pane-val');

    // 1. CS2 & PUBG stats (Steam)
    const isSteamConnected = connectedPlatforms.includes('steam');
    if (cs2Container) {
      if (isSteamConnected) {
        cs2Container.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">CS2</div><div class="game-stat-sub">Sincronizado via Steam ID</div></div>
          <div class="game-stat-vals">
            <div class="stat-chip"><div class="stat-chip-num">1.42</div><div class="stat-chip-lbl">K/D</div></div>
            <div class="stat-chip"><div class="stat-chip-num">58%</div><div class="stat-chip-lbl">Win %</div></div>
            <div class="stat-chip"><div class="stat-chip-num">210</div><div class="stat-chip-lbl">ADR</div></div>
          </div>
        `;
      } else {
        cs2Container.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">CS2</div><div class="game-stat-sub" style="color:#ff3333;">Desconectado</div></div>
          <button class="cs2-btn cs2-btn-primary" style="padding:4px 10px; font-size:11px;" onclick="connectPlatform('steam')">Conectar Steam</button>
        `;
      }
    }

    if (pubgContainer) {
      if (isSteamConnected) {
        pubgContainer.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">PUBG</div><div class="game-stat-sub">Sincronizado via Steam ID</div></div>
          <div class="game-stat-vals">
            <div class="stat-chip"><div class="stat-chip-num">3.20</div><div class="stat-chip-lbl">K/D</div></div>
            <div class="stat-chip"><div class="stat-chip-num">18%</div><div class="stat-chip-lbl">Win %</div></div>
            <div class="stat-chip"><div class="stat-chip-num">147</div><div class="stat-chip-lbl">TOP10</div></div>
          </div>
        `;
      } else {
        pubgContainer.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">PUBG</div><div class="game-stat-sub" style="color:#ff3333;">Desconectado</div></div>
          <button class="cs2-btn cs2-btn-primary" style="padding:4px 10px; font-size:11px;" onclick="connectPlatform('steam')">Conectar Steam</button>
        `;
      }
    }

    // 2. Brawl Stars stats (Supercell)
    const isSupercellConnected = connectedPlatforms.includes('supercell');
    if (brawlContainer) {
      if (isSupercellConnected) {
        brawlContainer.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">Brawl Stars</div><div class="game-stat-sub">Sincronizado via Supercell ID</div></div>
          <div class="game-stat-vals">
            <div class="stat-chip"><div class="stat-chip-num">48.2K</div><div class="stat-chip-lbl">Troféus</div></div>
            <div class="stat-chip"><div class="stat-chip-num">61%</div><div class="stat-chip-lbl">Win %</div></div>
            <div class="stat-chip"><div class="stat-chip-num">14</div><div class="stat-chip-lbl">Brawlers</div></div>
          </div>
        `;
      } else {
        brawlContainer.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">Brawl Stars</div><div class="game-stat-sub" style="color:#ff3333;">Desconectado</div></div>
          <button class="cs2-btn cs2-btn-primary" style="padding:4px 10px; font-size:11px;" onclick="connectPlatform('supercell')">Conectar Supercell ID</button>
        `;
      }
    }

    // 3. Valorant stats (Riot)
    const isRiotConnected = connectedPlatforms.includes('riot');
    if (valContainer) {
      if (isRiotConnected) {
        valContainer.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">Valorant</div><div class="game-stat-sub">Sincronizado via Riot Account</div></div>
          <div class="game-stat-vals">
            <div class="stat-chip"><div class="stat-chip-num">1.24</div><div class="stat-chip-lbl">K/D</div></div>
            <div class="stat-chip"><div class="stat-chip-num">55%</div><div class="stat-chip-lbl">Win %</div></div>
            <div class="stat-chip"><div class="stat-chip-num">Radiante</div><div class="stat-chip-lbl">Elo</div></div>
          </div>
        `;
      } else {
        valContainer.innerHTML = `
          <div class="game-stat-info"><div class="game-stat-name">Valorant</div><div class="game-stat-sub" style="color:#ff3333;">Desconectado</div></div>
          <button class="cs2-btn cs2-btn-primary" style="padding:4px 10px; font-size:11px;" onclick="connectPlatform('riot')">Conectar Riot Games</button>
        `;
      }
    }
  }

  // Hook tab triggers (overview, stats, integrations, etc.)
  const tabs = document.querySelectorAll('.passport-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const paneId = 'pane-' + tab.dataset.tab;
      const targetPane = document.getElementById(paneId);
      if (targetPane) targetPane.classList.add('active');

      if (tab.dataset.tab === 'connections') {
        renderPlatformConnections();
      }
    });
  });

  // Init
  // Corrige dados criados antes desta sincronização ao abrir o perfil.
  const savedDisplayName = String(profileState.displayName || '').trim();
  if (savedDisplayName && savedDisplayName !== authState.nick) {
    // Never replace the authenticated Steam identity with browser-controlled profile data.
  }

  renderProfileHeader();
  setupProfileEditor();
  renderGameStatsPane();

});
