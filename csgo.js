/* ═══════════════════════════════════════════════════════════════
   CLUCHZONE — CS2 COMPETITIVE ARENA JS
   Full automated tournament engine, eSports brackets,
   organizer dashboard, match rooms, Steam feed, and notifications.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// Mantém os dados reais já cadastrados no navegador.
// Não remova equipes ou campeonatos automaticamente ao abrir a página.

document.addEventListener('DOMContentLoaded', () => {

  /* ─── DATA PERSISTENCE & INITIALIZATION ─── */
  const STORAGE_KEY_CAMPS = 'cluchzone_cs2_camps';
  const STORAGE_KEY_TEAMS = 'cluchzone_cs2_teams';
  const STORAGE_KEY_PLAYERS = 'cluchzone_cs2_players';
  const STORAGE_KEY_FEED = 'cluchzone_cs2_feed';
  const STORAGE_KEY_NOTIFS = 'cluchzone_cs2_notifs';
  const EVENT_BANNERS = {
    'copa deagle master': 'images/cs2_copa_deagle_master.jpg',
    'dust ii shootout tournament': 'images/cs2_dust2_shootout.jpg',
    'cs2 open pro': 'images/cs2_open_pro.jpg'
  };

  // 1. Recover current user session
  let currentUser = JSON.parse(localStorage.getItem('cluchzone_auth') || 'null');
  let isPremiumUser = localStorage.getItem('cluchzone_premium') === 'true';

  // Fallback guest session if not logged in — no permissions
  if (!currentUser) {
    currentUser = { nick: 'Visitante', provider: 'email', role: 'guest', games: [] };
  }

  // ── RBAC: Role-Based Access Control ──────────────────────
  const ADMIN_NICKS = new Set([
    'admin',
    'staff_cs2',
    'staff_pubg',
    'staff_brawl',
    'xdropx_steam',
    'xdropx',
    'rique',
    'rick'
  ]);

  function getUserRole() {
    if (!currentUser) return 'guest';
    if (currentUser.role && currentUser.role !== 'guest') return currentUser.role;
    if (ADMIN_NICKS.has(String(currentUser.nick).trim().toLowerCase())) return 'admin';
    return 'player';
  }

  function checkOrganizerPermission() {
    const role = getUserRole();
    return role === 'admin' || role === 'organizer';
  }

  function can(permission) {
    const role = getUserRole();
    const ROLE_PERMS = {
      guest:     ['view:tournaments'],
      player:    ['view:tournaments', 'join:team'],
      captain:   ['view:tournaments', 'create:team', 'edit:team', 'join:team', 'invite:player'],
      organizer: ['view:tournaments', 'create:tournament', 'edit:tournament', 'approve:team',
                  'reject:team', 'confirm:payment', 'reject:payment', 'view:adminPanel',
                  'create:team', 'edit:team', 'join:team', 'invite:player'],
      admin:     ['view:tournaments', 'create:tournament', 'edit:tournament', 'delete:tournament',
                  'approve:team', 'reject:team', 'create:team', 'edit:team', 'join:team',
                  'invite:player', 'confirm:payment', 'reject:payment', 'view:adminPanel',
                  'ban:user', 'manage:roles'],
    };
    return (ROLE_PERMS[role] || []).includes(permission);
  }

  // ── XSS Prevention helper ─────────────────────────────────
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // 2. Mock Data for Players
  const defaultPlayers = [
    { avatar: "🔫", nick: "Fallen_Fan", role: "AWPer", rank: "Global Elite", wins: 342, losses: 180, mvps: 24, kd: "1.42", points: 2850 },
    { avatar: "⚡", nick: "Cold_Clone", role: "Entry", rank: "Supreme Master", wins: 280, losses: 210, mvps: 18, kd: "1.21", points: 2430 },
    { avatar: "🎯", nick: "Zywoo_Step", role: "AWPer", rank: "Global Elite", wins: 412, losses: 160, mvps: 38, kd: "1.53", points: 3100 },
    { avatar: "👑", nick: "S1mple_Soul", role: "IGL", rank: "Global Elite", wins: 390, losses: 175, mvps: 31, kd: "1.48", points: 2980 },
    { avatar: "💥", nick: "Niko_Rifle", role: "Entry", rank: "Supreme Master", wins: 240, losses: 190, mvps: 22, kd: "1.32", points: 2150 },
    { avatar: "🛡️", nick: "Apex_Lead", role: "Support", rank: "Legendary Eagle", wins: 185, losses: 160, mvps: 12, kd: "0.94", points: 1720 },
    { avatar: "👤", nick: "Lurk_Star", role: "Lurker", rank: "Legendary Eagle", wins: 198, losses: 170, mvps: 14, kd: "1.08", points: 1810 },
    { avatar: "🎮", nick: "SnipeKing_BR", role: "AWPer", rank: "Global Elite", wins: 310, losses: 140, mvps: 27, kd: "1.38", points: 2790 }
  ];

  let players = JSON.parse(localStorage.getItem(STORAGE_KEY_PLAYERS)) || defaultPlayers;

  // 3. Mock Data for Teams
  const defaultTeams = [];
  let teams = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAMS)) || defaultTeams;

  // 4. Mock Data for Tournaments
  const defaultTournaments = [];
  let tournaments = JSON.parse(localStorage.getItem(STORAGE_KEY_CAMPS)) || defaultTournaments;

  // 5. Mock Data for Feed
  const defaultFeed = [
    { id: 1, user: "Imperial Esports", action: "Equipe Campeã", target: "Copa Deagle Master", time: "2 dias atrás", likes: 24, likedByMe: false, comments: [{ user: "Zywoo_Step", text: "GG WP! Mereceram demais." }] },
    { id: 2, user: "SnipeKing_BR", action: "Novo MVP do Torneio", target: "Dust II Shootout", time: "5 dias atrás", likes: 42, likedByMe: true, comments: [] },
    { id: 3, user: "Legacy Team", action: "Nova Equipe Cadastrada", target: "CLUCHZONE Arena", time: "1 semana atrás", likes: 12, likedByMe: false, comments: [] }
  ];

  let feedItems = JSON.parse(localStorage.getItem(STORAGE_KEY_FEED)) || defaultFeed;

  // 6. Mock Data for Notifications
  const defaultNotifs = [
    { id: 1, text: "Inscrição confirmada na Copa Deagle Master!", time: "10m atrás", read: false },
    { id: 2, text: "O Servidor do confronto Imperial vs RED Canids está disponível.", time: "1h atrás", read: true }
  ];

  let notifications = JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFS)) || defaultNotifs;

  let selectedCampId = null;

  /* ─── DOM ELEMENTS & EVENT BINDINGS ─── */
  const cursorGlow = document.getElementById('cursor-glow');
  const toursListContainer = document.getElementById('tours-list-container');
  const panelCreateTour = document.getElementById('panel-create-tour');
  const cs2CreateForm = document.getElementById('cs2-create-form');
  const btnExploreTours = document.getElementById('btn-explore-tours');
  const btnCreateTourHero = document.getElementById('btn-create-tour-hero');
  const activeTourLobby = document.getElementById('pane-lobby-details');
  const permWarning = document.getElementById('perm-warning');
  const btnRequestVerification = document.getElementById('btn-request-verification');
  const btnNotifBell = document.getElementById('btn-notif-bell');
  const notifDrawer = document.getElementById('notif-drawer');
  const notifList = document.getElementById('notif-list');
  const notifCount = document.getElementById('notif-count');
  
  // Stats Hero Counters
  const statActiveCamps = document.getElementById('stat-active-camps');
  const statRegisteredTeams = document.getElementById('stat-registered-teams');
  const statPlayersOnline = document.getElementById('stat-players-online');
  const statPrizeMonth = document.getElementById('stat-prize-month');

  const feeInput = document.getElementById('cs2-form-fee');
  const platformFeeInput = document.getElementById('cs2-form-platform-fee');
  const maxTeamsInput = document.getElementById('cs2-form-max-teams');
  const prizeInput = document.getElementById('cs2-form-prize');
  const grossRevenueOutput = document.getElementById('cs2-gross-revenue');
  const platformFeeOutput = document.getElementById('cs2-platform-fee');
  const platformRateLabel = document.getElementById('cs2-platform-rate-label');
  const netPrizeOutput = document.getElementById('cs2-net-prize');
  const distributionInputs = ['p1', 'p2', 'p3'].map(place => ({
    input: document.getElementById(`cs2-form-${place}`),
    value: document.getElementById(`cs2-form-${place}-value`)
  }));
  const PLAYERS_PER_TEAM = 5;

  function formatCurrency(value) {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function updatePrizeDistribution() {
    const prize = Math.max(Number(prizeInput?.value) || 0, 0);
    distributionInputs.forEach(({ input, value }) => {
      if (!input || !value) return;
      const percentage = Math.max(Number(input.value) || 0, 0);
      value.textContent = formatCurrency(prize * percentage / 100);
    });
  }

  function updateAutomaticPrize() {
    if (!feeInput || !maxTeamsInput || !prizeInput) return;
    const fee = Math.max(Number(feeInput.value) || 0, 0);
    const maxTeams = Math.max(Number(maxTeamsInput.value) || 0, 0);
    const platformRate = Math.min(Math.max(Number(platformFeeInput?.value) || 0, 0), 100);
    const grossRevenue = fee * maxTeams * PLAYERS_PER_TEAM;
    const platformFee = grossRevenue * platformRate / 100;
    const prize = grossRevenue - platformFee;
    prizeInput.value = prize.toFixed(2);
    if (grossRevenueOutput) grossRevenueOutput.textContent = formatCurrency(grossRevenue);
    if (platformFeeOutput) platformFeeOutput.textContent = formatCurrency(platformFee);
    if (platformRateLabel) platformRateLabel.textContent = platformRate.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (netPrizeOutput) netPrizeOutput.textContent = formatCurrency(prize);
    updatePrizeDistribution();
  }

  feeInput?.addEventListener('input', updateAutomaticPrize);
  platformFeeInput?.addEventListener('input', updateAutomaticPrize);
  maxTeamsInput?.addEventListener('change', updateAutomaticPrize);
  distributionInputs.forEach(({ input }) => input?.addEventListener('input', updatePrizeDistribution));
  updateAutomaticPrize();

  // Custom Cursor Glow follow mouse
  document.addEventListener('mousemove', (e) => {
    if (cursorGlow) {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    }
  });

  /* ─── NOTIFICATION DRAWER ─── */
  if (btnNotifBell && notifDrawer) {
    btnNotifBell.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDrawer.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      notifDrawer.classList.remove('open');
    });
  }

  function renderNotifications() {
    if (!notifList) return;
    notifList.innerHTML = '';
    
    let unreadCount = 0;
    notifications.forEach(n => {
      if (!n.read) unreadCount++;
      const el = document.createElement('div');
      el.className = 'dropdown-item';
      el.style.fontSize = '12px';
      el.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
      el.innerHTML = `
        <div style="font-weight: ${n.read ? 'normal' : '700'}; color: ${n.read ? '#a0aec0' : '#fff'};">${n.text}</div>
        <div style="font-size: 9px; color: #4a5568; margin-top: 2px;">${n.time}</div>
      `;
      el.addEventListener('click', () => {
        n.read = true;
        saveData(STORAGE_KEY_NOTIFS, notifications);
        renderNotifications();
      });
      notifList.appendChild(el);
    });

    if (notifCount) {
      notifCount.textContent = unreadCount;
      notifCount.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
  }

  function addNotification(text) {
    notifications.unshift({
      id: Date.now(),
      text: text,
      time: "Agora mesmo",
      read: false
    });
    saveData(STORAGE_KEY_NOTIFS, notifications);
    renderNotifications();
    showToast(`🔔 ${text}`, '#00d4ff');
  }

  /* ─── TOASTS ─── */
  function showToast(msg, color = '#00d4ff') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const t = document.createElement('div');
    t.style.cssText = `
      padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 13px;
      margin-bottom: 8px; background: rgba(10,13,22,0.98); border: 1px solid ${color};
      color: ${color}; box-shadow: 0 4px 20px rgba(0,0,0,0.6); font-family: 'Rajdhani', sans-serif;
      transition: all 0.3s ease; transform: translateY(20px); opacity: 0;
    `;
    t.textContent = msg;
    tc.appendChild(t);
    
    setTimeout(() => {
      t.style.transform = 'translateY(0)';
      t.style.opacity = '1';
    }, 50);

    setTimeout(() => {
      t.style.transform = 'translateY(-20px)';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  /* ─── DATA SYNC UTILS ─── */
  function saveData(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    window.CluchAPI?.setStore(key, val);
  }

  function resolveEventBanner(camp) {
    const normalizedName = String(camp?.name || '').trim().toLowerCase();
    if (EVENT_BANNERS[normalizedName]) return EVENT_BANNERS[normalizedName];
    if (String(camp?.banner || '').startsWith('images/')) return camp.banner;
    return 'images/cs2_open_pro.jpg';
  }

  async function syncInitialData() {
    if (!window.CluchAPI) return;

    currentUser = await CluchAPI.getStore('cluchzone_auth', currentUser);
    isPremiumUser = await CluchAPI.getStore('cluchzone_premium', isPremiumUser);
    tournaments = await CluchAPI.getStore(STORAGE_KEY_CAMPS, tournaments);
    teams = await CluchAPI.getStore(STORAGE_KEY_TEAMS, teams);
    players = await CluchAPI.getStore(STORAGE_KEY_PLAYERS, players);
    feedItems = await CluchAPI.getStore(STORAGE_KEY_FEED, feedItems);
    notifications = await CluchAPI.getStore(STORAGE_KEY_NOTIFS, notifications);

    if (!localStorage.getItem(STORAGE_KEY_CAMPS)) saveData(STORAGE_KEY_CAMPS, tournaments);
    if (!localStorage.getItem(STORAGE_KEY_TEAMS)) saveData(STORAGE_KEY_TEAMS, teams);
    if (!localStorage.getItem(STORAGE_KEY_PLAYERS)) saveData(STORAGE_KEY_PLAYERS, players);
    if (!localStorage.getItem(STORAGE_KEY_FEED)) saveData(STORAGE_KEY_FEED, feedItems);
    if (!localStorage.getItem(STORAGE_KEY_NOTIFS)) saveData(STORAGE_KEY_NOTIFS, notifications);
  }

  function updateHeroCounters() {
    if (statActiveCamps) statActiveCamps.textContent = tournaments.filter(t => t.status !== 'Finalizado').length;
    if (statRegisteredTeams) statRegisteredTeams.textContent = teams.length;
    if (statPlayersOnline) {
      const activeCount = 1200 + Math.floor(Math.random() * 80);
      statPlayersOnline.textContent = activeCount.toLocaleString('pt-BR');
    }
  }

  /* ─── PANE SWITCHING ─── */
  const tabButtons = document.querySelectorAll('.cs2-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'tab-active-lobby') return; // Handled by active tour selection
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${btn.dataset.pane}`);
      if (targetPane) targetPane.classList.add('active');

      // Hide active lobby tab when returning to other views
      document.getElementById('tab-active-lobby').style.display = 'none';

      if (btn.dataset.pane === 'leaderboards') renderRankings();
      if (btn.dataset.pane === 'feed') renderFeed();
      if (btn.dataset.pane === 'teams') renderTeams();
      if (btn.dataset.pane === 'camps') renderTournaments();
    });
  });

  /* ─── SUB-TABS (INSIDE LOBBY DETAILS) ─── */
  const btnSubtabBracket = document.getElementById('btn-subtab-bracket');
  const btnSubtabTeams = document.getElementById('btn-subtab-teams');
  const subtabContentBracket = document.getElementById('subtab-content-bracket');
  const subtabContentTeams = document.getElementById('subtab-content-teams');

  if (btnSubtabBracket && btnSubtabTeams) {
    btnSubtabBracket.addEventListener('click', () => {
      btnSubtabBracket.classList.add('active');
      btnSubtabTeams.classList.remove('active');
      subtabContentBracket.style.display = 'block';
      subtabContentTeams.style.display = 'none';
    });

    btnSubtabTeams.addEventListener('click', () => {
      btnSubtabBracket.classList.remove('active');
      btnSubtabTeams.classList.add('active');
      subtabContentBracket.style.display = 'none';
      subtabContentTeams.style.display = 'block';
      renderActiveTournamentTeams();
    });
  }

  /* ─── CAMPEONATOS COMPONENT ─── */
  function formatDateString(isoString) {
    if (!isoString) return 'A definir';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch (_) {
      return isoString;
    }
  }

  function renderTournaments() {
    if (!toursListContainer) return;
    toursListContainer.innerHTML = '';

    tournaments.forEach(camp => {
      const card = document.createElement('div');
      card.className = 'cs2-card';

      const isLive = camp.status === "Em Andamento";
      const isReg = camp.status === "Registros Abertos";
      
      let badgeClass = 'badge-reg';
      if (isLive) badgeClass = 'badge-live';
      if (camp.status === 'Finalizado') badgeClass = 'badge-done';

      const bannerImg = resolveEventBanner(camp);

      card.innerHTML = `
        <div class="cs2-card-banner" style="background-image: url('${bannerImg}')">
          <span class="cs2-card-badge ${badgeClass}">${camp.status}</span>
        </div>
        <div class="cs2-card-body">
          <h3>${camp.name}</h3>
          <div class="cs2-card-meta-list">
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Premiação</span>
              <span class="cs2-meta-val gold">${camp.prize}</span>
            </div>
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Inscrições</span>
              <span class="cs2-meta-val">${camp.registeredTeams.length}/${camp.maxTeams} Equipes</span>
            </div>
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Formato</span>
              <span class="cs2-meta-val">${camp.format} - ${camp.elimination}</span>
            </div>
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Região</span>
              <span class="cs2-meta-val">${camp.region}</span>
            </div>
            <div class="cs2-meta-item" style="grid-column: 1 / -1; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 8px; margin-top: 4px;">
              <span class="cs2-meta-label">📅 Data do Evento</span>
              <span class="cs2-meta-val" style="color: var(--cs-cyan, #00d4ff); font-weight: 700;">${formatDateString(camp.date)}</span>
            </div>
          </div>
          <button class="btn-card-action ${isReg ? 'btn-participar' : 'btn-ver-chaves'}" data-camp-id="${camp.id}" style="margin-bottom: ${checkOrganizerPermission() ? '8px' : '0'};">
            ${isReg ? 'Participar / Detalhes' : 'Visualizar Chaves'}
          </button>
          ${checkOrganizerPermission() ? `
          <button class="btn-manage-camp" data-camp-id="${camp.id}" style="
            width: 100%; font-family: 'Orbitron', sans-serif; font-size: 11px; font-weight: 900;
            color: #00d4ff; background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.3);
            padding: 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s; outline: none;
          " onmouseover="this.style.background='rgba(0,212,255,0.15)'" onmouseout="this.style.background='rgba(0,212,255,0.05)'">
            ⚙️ GERENCIAR CAMPEONATO
          </button>
          ` : ''}
        </div>
      `;

      card.querySelector('.btn-card-action').addEventListener('click', () => {
        window.location.href = `tournament-details.html?id=${encodeURIComponent(camp.id)}`;
      });
      
      if (checkOrganizerPermission()) {
        card.querySelector('.btn-manage-camp').addEventListener('click', () => {
          window.location.href = `organizer-panel.html?id=${encodeURIComponent(camp.id)}`;
        });
      }

      toursListContainer.appendChild(card);
    });
  }

  // Hero click bindings
  if (btnExploreTours) {
    btnExploreTours.addEventListener('click', () => {
      document.querySelector('[data-pane="camps"]').click();
      toursListContainer.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnCreateTourHero) {
    btnCreateTourHero.addEventListener('click', () => {
      document.querySelector('[data-pane="camps"]').click();
      if (!checkOrganizerPermission()) {
        permWarning.style.display = 'block';
        panelCreateTour.style.display = 'none';
        permWarning.scrollIntoView({ behavior: 'smooth' });
      } else {
        permWarning.style.display = 'none';
        panelCreateTour.style.display = 'block';
        panelCreateTour.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  if (btnRequestVerification) {
    btnRequestVerification.addEventListener('click', () => {
      showToast('📩 Solicitação de organizador enviado para análise da administração!', '#ffd700');
      btnRequestVerification.textContent = 'Aguardando Verificação...';
      btnRequestVerification.classList.add('disabled');
      btnRequestVerification.disabled = true;
    });
  }

  /* ─── CREATE TOURNAMENT LOGIC ─── */
  if (cs2CreateForm) {
    cs2CreateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const newCamp = {
        id: tournaments.length + 1,
        name: document.getElementById('cs2-form-name').value,
        banner: document.getElementById('cs2-form-banner').value || 'images/cs2_open_pro.jpg',
        status: "Registros Abertos",
        prize: `R$ ${parseFloat(document.getElementById('cs2-form-prize').value).toLocaleString('pt-BR')}`,
        feePerPlayer: Number(feeInput?.value) || 0,
        playersPerTeam: PLAYERS_PER_TEAM,
        platformFeeRate: Math.min(Math.max(Number(platformFeeInput?.value) || 0, 0), 100),
        grossRevenue: (Number(feeInput?.value) || 0) * Number(maxTeamsInput?.value || 0) * PLAYERS_PER_TEAM,
        platformFee: (Number(feeInput?.value) || 0) * Number(maxTeamsInput?.value || 0) * PLAYERS_PER_TEAM * Math.min(Math.max(Number(platformFeeInput?.value) || 0, 0), 100) / 100,
        p1: parseInt(document.getElementById('cs2-form-p1').value) || 60,
        p2: parseInt(document.getElementById('cs2-form-p2').value) || 30,
        p3: parseInt(document.getElementById('cs2-form-p3').value) || 10,
        maxTeams: parseInt(document.getElementById('cs2-form-max-teams').value),
        registeredTeams: [],
        pendingApprovals: [],
        format: document.getElementById('cs2-form-format').value,
        elimination: "Eliminatória simples",
        date: document.getElementById('cs2-form-date').value,
        region: document.getElementById('cs2-form-region').value,
        organizer: currentUser.nick,
        sponsors: document.getElementById('cs2-form-sponsors').value.split(',').map(s => s.trim()).filter(s => s !== ""),
        discord: document.getElementById('cs2-form-discord').value || "https://discord.gg/cluchzone",
        stream: document.getElementById('cs2-form-stream').value || "https://twitch.tv/cluchzone",
        rules: document.getElementById('cs2-form-rules').value || "Regras padrão aplicáveis.",
        server: { ip: "45.122.9.22", port: "27015", password: "password", active: false },
        bracket: { round1: [], round2: [], round3: [] }
      };

      tournaments.push(newCamp);
      saveData(STORAGE_KEY_CAMPS, tournaments);
      
      feedItems.unshift({
        id: Date.now(),
        user: currentUser.nick,
        action: "Novo campeonato criado",
        target: newCamp.name,
        time: "Agora mesmo",
        likes: 0,
        likedByMe: false,
        comments: []
      });
      saveData(STORAGE_KEY_FEED, feedItems);

      showToast("🏆 Torneio criado e publicado com sucesso!", "#00e676");
      cs2CreateForm.reset();
      panelCreateTour.style.display = 'none';
      renderTournaments();
      updateHeroCounters();
    });
  }

  /* ─── ACTIVE TOURNAMENT PAGE & REGISTER FLOW ─── */
  function openActiveTournamentLobby(campId) {
    selectedCampId = campId;
    const camp = tournaments.find(t => t.id === campId);
    if (!camp) return;

    // Show dynamic header info
    document.getElementById('active-camp-title').textContent = camp.name;
    document.getElementById('active-camp-org').textContent = camp.organizer;
    document.getElementById('active-camp-prize').textContent = camp.prize;
    document.getElementById('active-camp-slots').textContent = `${camp.registeredTeams.length}/${camp.maxTeams} equipes`;
    document.getElementById('active-camp-format').textContent = camp.format;
    document.getElementById('active-camp-sponsors').textContent = camp.sponsors.length > 0 ? camp.sponsors.join(', ') : 'Nenhum';

    // Show prize distribution details
    const totalVal = parseFloat(camp.prize.replace('R$', '').replace('.', '').trim()) || 1000;
    document.getElementById('val-prize-1').textContent = `R$ ${((totalVal * camp.p1) / 100).toLocaleString('pt-BR')}`;
    document.getElementById('val-prize-2').textContent = `R$ ${((totalVal * camp.p2) / 100).toLocaleString('pt-BR')}`;
    document.getElementById('val-prize-3').textContent = `R$ ${((totalVal * camp.p3) / 100).toLocaleString('pt-BR')}`;

    // Fill embedded form captain field with current user
    const emCaptain = document.getElementById('em-team-captain');
    if (emCaptain) emCaptain.value = currentUser.nick;

    // Toggle Tab view to show details
    const activeLobbyTab = document.getElementById('tab-active-lobby');
    activeLobbyTab.style.display = 'inline-block';
    activeLobbyTab.click();
    
    // Switch to bracket sub-tab initially
    if (btnSubtabBracket) btnSubtabBracket.click();

    updateJoinButtonStates(camp);

    // Server Info box logic
    const serverBox = document.getElementById('server-room-box');
    const userTeam = teams.find(t => t.captain === currentUser.nick || t.members.includes(currentUser.nick));
    if (camp.server && camp.server.active && userTeam && camp.registeredTeams.includes(userTeam.name)) {
      serverBox.style.display = 'block';
      document.getElementById('server-cmd-text').textContent = `connect ${camp.server.ip}:${camp.server.port}; password ${camp.server.password}`;
    } else {
      serverBox.style.display = 'none';
    }

    // Toggle Organizer panel (always visible for testing)
    const orgPanel = document.getElementById('organizer-control-panel');
    orgPanel.style.display = 'block';
    renderOrgPanelActions(camp);

    // Render Chaves (Bracket)
    renderTournamentBracket(camp);
  }

  function updateJoinButtonStates(camp) {
    const userTeams = teams.filter(t => t.captain === currentUser.nick || t.vice === currentUser.nick || t.members?.includes(currentUser.nick));
    const btnParticipate = document.getElementById('btn-participate-active');
    const btnLeave = document.getElementById('btn-leave-active');
    const btnToggleCreate = document.getElementById('btn-toggle-create-team-view');
    const actionTitle = document.getElementById('team-action-card-title');
    const existingTeamBox = document.getElementById('join-existing-team-box');
    const selectToRegister = document.getElementById('select-team-to-register');
    const emForm = document.getElementById('create-team-embedded-form');

    // Reset views
    existingTeamBox.style.display = 'none';
    emForm.style.display = 'none';
    btnToggleCreate.style.display = 'none';

    // Find if any user team is already in camp
    const registeredUserTeam = userTeams.find(t => camp.registeredTeams.includes(t.name) || camp.pendingApprovals.includes(t.name));

    if (registeredUserTeam) {
      const isPending = camp.pendingApprovals.includes(registeredUserTeam.name);
      btnParticipate.style.display = 'none';
      btnLeave.style.display = 'inline-block';
      btnLeave.textContent = isPending ? 'Inscrição Pendente (Cancelar)' : 'Cancelar Inscrição';
      actionTitle.textContent = isPending ? 'Inscrição em Análise' : `Inscrito: ${registeredUserTeam.name}`;
    } else {
      btnLeave.style.display = 'none';
      btnParticipate.style.display = 'inline-block';
      actionTitle.textContent = 'Inscrever Equipe no Torneio';

      if (userTeams.length > 0) {
        // User has teams, show selector
        existingTeamBox.style.display = 'block';
        btnToggleCreate.style.display = 'inline-block';
        
        // Populate selectToRegister
        selectToRegister.innerHTML = '<option value="">Selecione a equipe</option>';
        userTeams.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.name;
          opt.textContent = `${t.logo && !t.logo.includes('<img') ? t.logo : '🛡️'} ${t.name} [${t.tag || 'IMP'}]`;
          selectToRegister.appendChild(opt);
        });
      } else {
        // User has no teams, show creation form directly
        emForm.style.display = 'block';
      }
    }
  }

  // Hook toggle views
  const btnToggleCreateTeamView = document.getElementById('btn-toggle-create-team-view');
  const btnBackToSelect = document.getElementById('btn-back-to-select');
  const existingTeamBox = document.getElementById('join-existing-team-box');
  const emForm = document.getElementById('create-team-embedded-form');

  if (btnToggleCreateTeamView) {
    btnToggleCreateTeamView.addEventListener('click', () => {
      existingTeamBox.style.display = 'none';
      emForm.style.display = 'block';
      btnToggleCreateTeamView.style.display = 'none';
    });
  }

  if (btnBackToSelect) {
    btnBackToSelect.addEventListener('click', () => {
      existingTeamBox.style.display = 'block';
      emForm.style.display = 'none';
      btnToggleCreateTeamView.style.display = 'inline-block';
    });
  }

  function renderActiveTournamentTeams() {
    const activeTeamsList = document.getElementById('active-registered-teams-list');
    if (!activeTeamsList) return;
    activeTeamsList.innerHTML = '';

    const camp = tournaments.find(t => t.id === selectedCampId);
    if (!camp) return;

    const allCampTeams = [...camp.registeredTeams, ...camp.pendingApprovals];

    if (allCampTeams.length === 0) {
      activeTeamsList.innerHTML = `<div style="text-align:center; color:#4a5568; padding:20px 0; font-size:13px;">Nenhuma equipe inscrita ainda. Seja o primeiro!</div>`;
      return;
    }

    allCampTeams.forEach(teamName => {
      const team = teams.find(t => t.name === teamName);
      const isPending = camp.pendingApprovals.includes(teamName);
      const isAdmin = checkOrganizerPermission();
      
      const el = document.createElement('div');
      el.style.cssText = `
        background: rgba(255,255,255,0.02);
        border: 1px solid ${isPending ? 'rgba(222, 155, 53, 0.2)' : 'var(--cs-border)'};
        border-radius: 8px; padding: 12px;
        display: flex; align-items: center; justify-content: space-between;
      `;

      // Quick action controls for Admin/Organizer directly on list view
      let adminActions = '';
      if (isPending && isAdmin) {
        adminActions = `
          <div style="display:flex; gap:6px; margin-top: 6px; justify-content: flex-end;">
            <button class="cs2-btn cs2-btn-primary" style="padding:4px 10px; font-size:10px; border-radius:4px;" onclick="approveTeamAction('${teamName}')">✓ Aprovar</button>
            <button class="cs2-btn cs2-btn-secondary" style="padding:4px 10px; font-size:10px; border-radius:4px; border-color:#ff3333; color:#ff3333;" onclick="rejectTeamAction('${teamName}')">✕ Recusar</button>
          </div>
        `;
      }

      if (team) {
        el.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:24px; background:#07090e; width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; border:1px solid var(--cs-border);">${team.logo}</div>
            <div>
              <strong style="color:#fff; font-size:14px;">${team.name}</strong>
              <div style="font-size:11px; color:#718096; margin-top:2px;">Capitão: <strong style="color:var(--cs-gold);">${team.captain}</strong> | Região: SA</div>
            </div>
          </div>
          <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end;">
            <span class="hist-result ${isPending ? 'loss' : 'win'}" style="font-size:9px; padding:2px 8px;">${isPending ? 'PENDENTE' : 'INSCRITO'}</span>
            ${adminActions}
            <div style="font-size:10px; color:#4a5568; margin-top:4px;">${team.members.length} players</div>
          </div>
        `;
      } else {
        // Fallback for bot/simulated teams
        el.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:24px; background:#07090e; width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; border:1px solid var(--cs-border);">🤖</div>
            <div>
              <strong style="color:#fff; font-size:14px;">${teamName}</strong>
              <div style="font-size:11px; color:#718096; margin-top:2px;">Capitão: Bot_Captain | Região: SA</div>
            </div>
          </div>
          <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end;">
            <span class="hist-result win" style="font-size:9px; padding:2px 8px;">INSCRITO</span>
            ${adminActions}
            <div style="font-size:10px; color:#4a5568; margin-top:4px;">5 players</div>
          </div>
        `;
      }
      activeTeamsList.appendChild(el);
    });
  }

  // Handle embedded team creation form submission
  const embeddedTeamCreateForm = document.getElementById('embedded-team-create-form');
  let emLogoBase64 = "";
  let emBannerBase64 = "";

  // Binding Drag & Drop for embedded form in csgo.html
  function setupEmDragAndDrop(boxId, inputId, previewId, callback) {
    const box = document.getElementById(boxId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!box || !input) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      box.addEventListener(eventName, (e) => {
        e.preventDefault();
        box.style.borderColor = 'var(--tm-cyan)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      box.addEventListener(eventName, (e) => {
        e.preventDefault();
        box.style.borderColor = 'var(--cs-border)';
      }, false);
    });

    box.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        input.files = files;
        readEmFile(files[0], preview, callback);
      }
    }, false);

    input.addEventListener('change', () => {
      if (input.files.length > 0) {
        readEmFile(input.files[0], preview, callback);
      }
    });
  }

  function readEmFile(file, preview, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target.result;
      if (preview) {
        preview.src = b64;
        preview.style.display = 'block';
      }
      callback(b64);
    };
    reader.readAsDataURL(file);
  }

  setupEmDragAndDrop('em-logo-upload-box', 'em-team-logo-file', 'em-logo-preview-img', (b64) => { emLogoBase64 = b64; });
  setupEmDragAndDrop('em-banner-upload-box', 'em-team-banner-file', 'em-banner-preview-img', (b64) => { emBannerBase64 = b64; });

  if (embeddedTeamCreateForm) {
    embeddedTeamCreateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const teamName = document.getElementById('em-team-name').value;
      const viceCap = document.getElementById('em-team-vice').value;
      const memberList = document.getElementById('em-team-members').value.split(',').map(m => m.trim()).filter(m => m !== "");

      if (memberList.length < 4) {
        showToast("⚠️ Adicione no mínimo 4 jogadores para formar um time completo!", "#ffd700");
        return;
      }

      const newTeam = {
        logo: emLogoBase64 ? `<img src="${emLogoBase64}"/>` : "🛡️",
        banner: emBannerBase64 || "https://images.alphacoders.com/605/605592.jpg",
        name: teamName,
        captain: currentUser.nick,
        vice: viceCap,
        members: [currentUser.nick, viceCap, ...memberList],
        reserves: [],
        stats: "0-0",
        history: [],
        ranking: teams.length + 1,
        points: 1000
      };

      teams.push(newTeam);
      saveData(STORAGE_KEY_TEAMS, teams);

      // Now join the active tournament automatically
      const camp = tournaments.find(t => t.id === selectedCampId);
      if (camp) {
        showToast("💳 Processando pagamento da inscrição...", "#00d4ff");
        setTimeout(() => {
          camp.pendingApprovals.push(newTeam.name);
          saveData(STORAGE_KEY_CAMPS, tournaments);
          
          feedItems.unshift({
            id: Date.now(),
            user: newTeam.name,
            action: "Nova equipe tática criada",
            target: newTeam.captain,
            time: "Agora mesmo",
            likes: 0,
            likedByMe: false,
            comments: []
          });
          saveData(STORAGE_KEY_FEED, feedItems);

          addNotification(`Sua equipe ${newTeam.name} foi inscrita com sucesso!`);
          openActiveTournamentLobby(camp.id);
          renderActiveTournamentTeams();
        }, 1500);
      }
    });
  }

  // Handle register / cancel flows
  const btnParticipateActive = document.getElementById('btn-participate-active');
  const btnLeaveActive = document.getElementById('btn-leave-active');
  const btnBackCampsList = document.getElementById('btn-back-camps-list');

  if (btnBackCampsList) {
    btnBackCampsList.addEventListener('click', () => {
      document.getElementById('tab-active-lobby').style.display = 'none';
      document.querySelector('[data-pane="camps"]').click();
    });
  }

  if (btnParticipateActive) {
    btnParticipateActive.addEventListener('click', () => {
      const camp = tournaments.find(t => t.id === selectedCampId);
      if (!camp) return;

      const selectToRegister = document.getElementById('select-team-to-register');
      const selectedTeamNameForCamp = selectToRegister ? selectToRegister.value : null;

      if (!selectedTeamNameForCamp) {
        showToast("⚠️ Crie uma equipe abaixo para poder se inscrever!", "#ffd700");
        return;
      }

      if (camp.registeredTeams.includes(selectedTeamNameForCamp) || camp.pendingApprovals.includes(selectedTeamNameForCamp)) {
        showToast("⚠️ Esta equipe já está inscrita ou pendente!", "#ffd700");
        return;
      }

      showToast("💳 Processando pagamento da taxa...", "#00d4ff");
      setTimeout(() => {
        camp.pendingApprovals.push(selectedTeamNameForCamp);
        saveData(STORAGE_KEY_CAMPS, tournaments);
        addNotification(`Pagamento aprovado. Inscrição de ${selectedTeamNameForCamp} enviada ao organizador!`);
        openActiveTournamentLobby(camp.id);
        renderActiveTournamentTeams();
      }, 1500);
    });
  }

  if (btnLeaveActive) {
    btnLeaveActive.addEventListener('click', () => {
      const camp = tournaments.find(t => t.id === selectedCampId);
      if (!camp) return;

      const userTeams = teams.filter(t => t.captain === currentUser.nick || t.vice === currentUser.nick || t.members?.includes(currentUser.nick));
      const registeredUserTeam = userTeams.find(t => camp.registeredTeams.includes(t.name) || camp.pendingApprovals.includes(t.name));
      if (!registeredUserTeam) return;

      camp.registeredTeams = camp.registeredTeams.filter(t => t !== registeredUserTeam.name);
      camp.pendingApprovals = camp.pendingApprovals.filter(t => t !== registeredUserTeam.name);
      saveData(STORAGE_KEY_CAMPS, tournaments);
      
      showToast("❌ Inscrição cancelada com sucesso.", "#ff3333");
      openActiveTournamentLobby(camp.id);
      renderActiveTournamentTeams();
    });
  }

  // Copy server command to clipboard
  const btnCopyServerCmd = document.getElementById('btn-copy-server-cmd');
  if (btnCopyServerCmd) {
    btnCopyServerCmd.addEventListener('click', () => {
      const text = document.getElementById('server-cmd-text').textContent;
      navigator.clipboard.writeText(text).then(() => {
        showToast("📋 Comando copiado para a área de transferência!", "#00ff88");
      });
    });
  }

  /* ─── ORGANIZER PANEL ACTIONS ─── */
  const orgDynamicForm = document.getElementById('org-dynamic-form');

  function renderOrgPanelActions(camp) {
    const btnApprove = document.getElementById('btn-org-approve-teams');
    btnApprove.textContent = `Aprovar Equipes (${camp.pendingApprovals.length})`;

    btnApprove.onclick = () => {
      orgDynamicForm.style.display = 'block';
      orgDynamicForm.innerHTML = `
        <h4 style="font-family: 'Orbitron', sans-serif; font-size: 13px; color: #fff;">Aprovação de Equipes</h4>
        ${camp.pendingApprovals.length === 0 ? '<p style="font-size: 12px; color: #4a5568; margin-top: 8px;">Nenhuma equipe pendente de aprovação.</p>' : ''}
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          ${camp.pendingApprovals.map(teamName => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:6px;">
              <span>${teamName}</span>
              <div style="display:flex; gap:8px;">
                <button class="cs2-btn cs2-btn-primary" style="padding:6px 12px;" onclick="approveTeamAction('${teamName}')">Aprovar</button>
                <button class="cs2-btn cs2-btn-secondary" style="padding:6px 12px;" onclick="rejectTeamAction('${teamName}')">Rejeitar</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    document.getElementById('btn-org-view-receipts').onclick = () => {
      orgDynamicForm.style.display = 'block';
      orgDynamicForm.innerHTML = `
        <h4 style="font-family: 'Orbitron', sans-serif; font-size: 13px; color: #fff;">Comprovantes de Inscrição Pix</h4>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:6px; font-size:12px;">
            <div><strong>Equipe:</strong> Imperial Esports</div>
            <div><strong>Valor:</strong> R$ 50,00</div>
            <div><strong>ID Transação:</strong> PIX98427498274X912</div>
            <div style="color:#00ff88; margin-top:4px;">✓ Validado pelo CLUCHGUARD</div>
          </div>
          <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:6px; font-size:12px;">
            <div><strong>Equipe:</strong> FURIA Gaming</div>
            <div><strong>Valor:</strong> R$ 50,00</div>
            <div><strong>ID Transação:</strong> PIX12398471298X384</div>
            <div style="color:#00ff88; margin-top:4px;">✓ Validado pelo CLUCHGUARD</div>
          </div>
        </div>
      `;
    };

    document.getElementById('btn-org-edit-camp').onclick = () => {
      orgDynamicForm.style.display = 'block';
      orgDynamicForm.innerHTML = `
        <h4 style="font-family: 'Orbitron', sans-serif; font-size: 13px; color: #fff;">Editar Campeonato</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
          <div>
            <label style="font-size:10px; color:#4a5568;">ALTERAR DATA/HORA</label>
            <input class="form-input" id="edit-date" type="datetime-local" value="${camp.date}"/>
          </div>
          <div>
            <label style="font-size:10px; color:#4a5568;">PREMIAÇÃO TOTAL (R$)</label>
            <input class="form-input" id="edit-prize" type="text" value="${camp.prize}"/>
          </div>
        </div>
        <button class="cs2-btn cs2-btn-primary" style="margin-top:12px; padding:8px 16px;" onclick="saveEditCamp()">Salvar Alterações</button>
      `;
    };

    document.getElementById('btn-org-configure-server').onclick = () => {
      orgDynamicForm.style.display = 'block';
      orgDynamicForm.innerHTML = `
        <h4 style="font-family: 'Orbitron', sans-serif; font-size: 13px; color: #fff;">Configurar Servidor da Partida</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:10px;">
          <div>
            <label style="font-size:10px; color:#4a5568;">IP</label>
            <input class="form-input" id="srv-ip" type="text" value="${camp.server.ip}"/>
          </div>
          <div>
            <label style="font-size:10px; color:#4a5568;">PORTA</label>
            <input class="form-input" id="srv-port" type="text" value="${camp.server.port}"/>
          </div>
          <div>
            <label style="font-size:10px; color:#4a5568;">SENHA</label>
            <input class="form-input" id="srv-pass" type="text" value="${camp.server.password}"/>
          </div>
        </div>
        <button class="cs2-btn cs2-btn-primary" style="margin-top:12px; padding:8px 16px;" onclick="saveServerConfig()">Ativar Servidor & Notificar Equipes</button>
      `;
    };

    document.getElementById('btn-org-post-results').onclick = () => {
      orgDynamicForm.style.display = 'block';
      const pendingMatches = [...camp.bracket.round1, ...camp.bracket.round2, ...camp.bracket.round3].filter(m => m.status === 'Aguardando' && m.teamA !== 'Aguardando' && m.teamB !== 'Aguardando');
      
      orgDynamicForm.innerHTML = `
        <h4 style="font-family: 'Orbitron', sans-serif; font-size: 13px; color: #fff;">Lançar Resultados de Partidas</h4>
        ${pendingMatches.length === 0 ? '<p style="font-size:12px; color:#4a5568; margin-top:8px;">Nenhuma partida ativa pronta para placar.</p>' : ''}
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
          ${pendingMatches.map(m => `
            <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:6px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; font-weight:700;">
                <span>${m.teamA} vs ${m.teamB}</span>
                <span style="color:var(--cs-gold);">${m.maps.join(', ')}</span>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <input class="form-input" type="number" id="score-a-${m.id}" style="width:70px;" placeholder="Score A"/>
                <span>x</span>
                <input class="form-input" type="number" id="score-b-${m.id}" style="width:70px;" placeholder="Score B"/>
                <select class="form-select" id="mvp-${m.id}" style="flex:1;">
                  <option value="">Escolha o MVP...</option>
                  ${players.map(p => `<option value="${p.nick}">${p.nick}</option>`).join('')}
                </select>
                <button class="cs2-btn cs2-btn-primary" style="padding:8px 14px;" onclick="submitMatchResult(${m.id})">Confirmar</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    document.getElementById('btn-org-close-camp').onclick = () => {
      if (confirm("Deseja realmente finalizar o campeonato? O campeão será definido.")) {
        camp.status = 'Finalizado';
        saveData(STORAGE_KEY_CAMPS, tournaments);
        showToast("🏆 Campeonato finalizado! Estatísticas atualizadas.", "#00ff88");
        openActiveTournamentLobby(camp.id);
      }
    };

    document.getElementById('btn-org-generate-bracket').onclick = () => {
      if (camp.registeredTeams.length < 4) {
        showToast("⚠️ Mínimo de 4 equipes inscritas necessário para gerar chaves!", "#ffd700");
        return;
      }
      generateActiveBracket(camp);
    };
  }

  // Global Actions helper functions (exposed to window)
  window.approveTeamAction = (teamName) => {
    const camp = tournaments.find(t => t.id === selectedCampId);
    if (!camp) return;
    camp.pendingApprovals = camp.pendingApprovals.filter(t => t !== teamName);
    camp.registeredTeams.push(teamName);
    saveData(STORAGE_KEY_CAMPS, tournaments);
    showToast(`✓ Equipe ${teamName} aprovada no torneio!`, "#00ff88");
    addNotification(`Equipe ${teamName} teve sua inscrição confirmada!`);
    openActiveTournamentLobby(camp.id);
  };

  window.rejectTeamAction = (teamName) => {
    const camp = tournaments.find(t => t.id === selectedCampId);
    if (!camp) return;
    camp.pendingApprovals = camp.pendingApprovals.filter(t => t !== teamName);
    saveData(STORAGE_KEY_CAMPS, tournaments);
    showToast(`❌ Equipe ${teamName} rejeitada no torneio.`, "#ff3333");
    openActiveTournamentLobby(camp.id);
  };

  window.saveEditCamp = () => {
    const camp = tournaments.find(t => t.id === selectedCampId);
    if (!camp) return;
    camp.date = document.getElementById('edit-date').value;
    camp.prize = document.getElementById('edit-prize').value;
    saveData(STORAGE_KEY_CAMPS, tournaments);
    showToast("✓ Torneio atualizado!", "#00ff88");
    openActiveTournamentLobby(camp.id);
  };

  window.saveServerConfig = () => {
    const camp = tournaments.find(t => t.id === selectedCampId);
    if (!camp) return;
    camp.server.ip = document.getElementById('srv-ip').value;
    camp.server.port = document.getElementById('srv-port').value;
    camp.server.password = document.getElementById('srv-pass').value;
    camp.server.active = true;
    saveData(STORAGE_KEY_CAMPS, tournaments);
    showToast("✓ Servidor ativado e capitães notificados via WebSocket (Simulação)!", "#00ff88");
    
    // Auto notify captains
    camp.registeredTeams.forEach(teamName => {
      const team = teams.find(t => t.name === teamName);
      if (team) {
        addNotification(`[Capitão ${team.captain}] Servidor pronto: connect ${camp.server.ip}:${camp.server.port}; password ${camp.server.password}`);
      }
    });

    openActiveTournamentLobby(camp.id);
  };

  window.submitMatchResult = (matchId) => {
    const camp = tournaments.find(t => t.id === selectedCampId);
    if (!camp) return;

    const match = [...camp.bracket.round1, ...camp.bracket.round2, ...camp.bracket.round3].find(m => m.id === matchId);
    if (!match) return;

    const sA = parseInt(document.getElementById(`score-a-${matchId}`).value);
    const sB = parseInt(document.getElementById(`score-b-${matchId}`).value);
    const mvpUser = document.getElementById(`mvp-${matchId}`).value;

    if (isNaN(sA) || isNaN(sB)) {
      showToast("⚠️ Preencha os scores corretamente!", "#ffd700");
      return;
    }

    match.scoreA = sA;
    match.scoreB = sB;
    match.winner = sA > sB ? match.teamA : match.teamB;
    match.status = 'Finalizado';
    match.mapScores = `${sA}-${sB}`;
    match.mvp = mvpUser;

    const mvpPlayerObj = players.find(p => p.nick === mvpUser);
    if (mvpPlayerObj) {
      mvpPlayerObj.mvps += 1;
      mvpPlayerObj.points += 250;
      saveData(STORAGE_KEY_PLAYERS, players);
    }

    advanceWinnerInBracket(camp, match);

    saveData(STORAGE_KEY_CAMPS, tournaments);
    showToast(`✓ Partida #${matchId} encerrada. Vencedor: ${match.winner}`, "#00ff88");
    
    feedItems.unshift({
      id: Date.now(),
      user: match.winner,
      action: "Ganhou confronto",
      target: `${match.teamA} vs ${match.teamB} (${match.mapScores})`,
      time: "Agora mesmo",
      likes: 0,
      likedByMe: false,
      comments: []
    });
    saveData(STORAGE_KEY_FEED, feedItems);

    openActiveTournamentLobby(camp.id);
  };

  function advanceWinnerInBracket(camp, match) {
    const b = camp.bracket;
    if (match.id === 1 || match.id === 2) {
      const nextMatch = b.round2[0];
      if (match.id === 1) nextMatch.teamA = match.winner;
      else nextMatch.teamB = match.winner;
      nextMatch.status = (nextMatch.teamA !== 'Aguardando' && nextMatch.teamB !== 'Aguardando') ? 'Aguardando' : 'Pendente';
    }
    if (match.id === 3 || match.id === 4) {
      const nextMatch = b.round2[1];
      if (match.id === 3) nextMatch.teamA = match.winner;
      else nextMatch.teamB = match.winner;
      nextMatch.status = (nextMatch.teamA !== 'Aguardando' && nextMatch.teamB !== 'Aguardando') ? 'Aguardando' : 'Pendente';
    }
    if (match.id === 5 || match.id === 6) {
      const nextMatch = b.round3[0];
      if (match.id === 5) nextMatch.teamA = match.winner;
      else nextMatch.teamB = match.winner;
      nextMatch.status = (nextMatch.teamA !== 'Aguardando' && nextMatch.teamB !== 'Aguardando') ? 'Aguardando' : 'Pendente';
    }
  }

  function generateActiveBracket(camp) {
    const list = [...camp.registeredTeams];
    
    // Simulate lottery draw with shuffle
    showToast("🎲 Embaralhando e sorteando os confrontos...", "#ffd700");
    
    setTimeout(() => {
      // Fisher-Yates shuffle
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }

      while (list.length < 8) {
        list.push(`CluchGuard Bot Team ${list.length + 1}`);
      }
      
      camp.bracket.round1 = [
        { id: 1, teamA: list[0], teamB: list[7], scoreA: 0, scoreB: 0, winner: null, status: "Aguardando", time: "19:00", mapScores: "0-0", mvp: "", maps: ["Mirage", "Inferno"] },
        { id: 2, teamA: list[1], teamB: list[6], scoreA: 0, scoreB: 0, winner: null, status: "Aguardando", time: "19:30", mapScores: "0-0", mvp: "", maps: ["Anubis", "Ancient"] },
        { id: 3, teamA: list[2], teamB: list[5], scoreA: 0, scoreB: 0, winner: null, status: "Aguardando", time: "20:00", mapScores: "0-0", mvp: "", maps: ["Dust II", "Nuke"] },
        { id: 4, teamA: list[3], teamB: list[4], scoreA: 0, scoreB: 0, winner: null, status: "Aguardando", time: "20:30", mapScores: "0-0", mvp: "", maps: ["Vertigo", "Mirage"] }
      ];
      camp.bracket.round2 = [
        { id: 5, teamA: "Aguardando", teamB: "Aguardando", scoreA: 0, scoreB: 0, winner: null, status: "Pendente", time: "21:00", mapScores: "0-0", mvp: "", maps: [] },
        { id: 6, teamA: "Aguardando", teamB: "Aguardando", scoreA: 0, scoreB: 0, winner: null, status: "Pendente", time: "21:30", mapScores: "0-0", mvp: "", maps: [] }
      ];
      camp.bracket.round3 = [
        { id: 7, teamA: "Aguardando", teamB: "Aguardando", scoreA: 0, scoreB: 0, winner: null, status: "Pendente", time: "22:00", mapScores: "0-0", mvp: "", maps: [] }
      ];

      camp.status = "Em Andamento";
      saveData(STORAGE_KEY_CAMPS, tournaments);
      showToast("✓ Sorteio concluído! Chaves e confrontos gerados.", "#00ff88");
      openActiveTournamentLobby(camp.id);
    }, 2000);
  }

  /* ─── BRACKET RENDER ENGINE ─── */
  const bracketRoot = document.getElementById('bracket-root');

  function renderTournamentBracket(camp) {
    if (!bracketRoot) return;
    bracketRoot.innerHTML = '';

    const b = camp.bracket;
    if (!b || !b.round1 || b.round1.length === 0) {
      bracketRoot.innerHTML = `
        <div style="text-align:center; width:100%; color:#4a5568; padding:40px 0;">
          <div>❌ Chaves não geradas.</div>
          <div style="font-size:12px; margin-top:6px;">Aguardando o fechamento das inscrições e a geração do bracket pelo organizador.</div>
        </div>
      `;
      return;
    }

    const r1Col = createBracketRoundColumn("Quartas de Final", b.round1);
    bracketRoot.appendChild(r1Col);

    const r2Col = createBracketRoundColumn("Semifinais", b.round2);
    bracketRoot.appendChild(r2Col);

    const r3Col = createBracketRoundColumn("Grande Final", b.round3);
    bracketRoot.appendChild(r3Col);
  }

  function createBracketRoundColumn(title, matches) {
    const col = document.createElement('div');
    col.className = 'bracket-round';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'bracket-round-title';
    titleEl.textContent = title;
    col.appendChild(titleEl);

    matches.forEach(m => {
      const node = document.createElement('div');
      m.teamA = m.teamA || "Aguardando";
      m.teamB = m.teamB || "Aguardando";
      
      node.className = 'bracket-match-node';
      node.innerHTML = `
        <div class="match-node-header">
          <span>Partida #${m.id}</span>
          <span style="color: ${m.status === 'Finalizado' ? '#ff3333' : '#00ff88'};">${m.status}</span>
        </div>
        <div class="match-node-team ${m.winner === m.teamA ? 'winner' : ''}">
          <div class="match-team-left">
            <span class="match-team-logo">🔫</span>
            <span>${m.teamA}</span>
          </div>
          <span class="match-team-score">${m.scoreA}</span>
        </div>
        <div class="match-node-team ${m.winner === m.teamB ? 'winner' : ''}">
          <div class="match-team-left">
            <span class="match-team-logo">🔫</span>
            <span>${m.teamB}</span>
          </div>
          <span class="match-team-score">${m.scoreB}</span>
        </div>
      `;

      node.addEventListener('click', () => {
        openMatchDetailsModal(m);
      });

      col.appendChild(node);
    });

    return col;
  }

  /* ─── MATCH DETAILS MODAL ─── */
  function openMatchDetailsModal(match) {
    const modal = document.getElementById('modal-match-details');
    if (!modal) return;

    document.getElementById('md-title').textContent = `${match.teamA} vs ${match.teamB}`;
    document.getElementById('md-status').textContent = `Status: ${match.status} (${match.time})`;
    document.getElementById('md-mvp').textContent = match.mvp || "Aguardando resultado";
    document.getElementById('md-map-scores').textContent = match.mapScores || "0 - 0";
    document.getElementById('md-maps').textContent = match.maps.length > 0 ? match.maps.join(', ') : 'Não definidos';

    renderTeamModalRoster('md-team-a-name', 'md-team-a-players', match.teamA);
    renderTeamModalRoster('md-team-b-name', 'md-team-b-players', match.teamB);

    modal.classList.add('open');
  }

  function renderTeamModalRoster(titleId, containerId, teamName) {
    document.getElementById(titleId).textContent = teamName;
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const team = teams.find(t => t.name === teamName);
    if (!team) {
      for (let i = 1; i <= 5; i++) {
        const item = document.createElement('div');
        item.className = 'match-roster-player';
        item.innerHTML = `
          <span class="match-player-nick">BotPlayer #${i} ${i === 1 ? '<span class="cpt">CPT</span>' : ''}</span>
          <span style="font-size:11px; color:#4a5568;">Rifle</span>
        `;
        container.appendChild(item);
      }
      return;
    }

    team.members.forEach(m => {
      const isCpt = team.captain === m;
      const isSub = team.vice === m;
      const item = document.createElement('div');
      item.className = 'match-roster-player';
      item.innerHTML = `
        <span class="match-player-nick">${m} ${isCpt ? '<span class="cpt">CPT</span>' : isSub ? '<span class="cpt" style="color:#00d4ff; border-color:#00d4ff;">VICE</span>' : ''}</span>
        <span style="font-size:11px; color:#4a5568;">Pro</span>
      `;
      container.appendChild(item);
    });
  }

  /* ─── EQUIPES COMPONENT ─── */
  const teamsListGrid = document.getElementById('teams-list-grid');

  function renderTeams() {
    if (!teamsListGrid) return;
    teamsListGrid.innerHTML = '';

    teams.forEach(t => {
      const card = document.createElement('div');
      card.className = 'cs2-card';
      card.innerHTML = `
        <div class="cs2-card-banner" style="background-image: url('${t.banner}')"></div>
        <div class="cs2-card-body" style="text-align: center;">
          <div style="font-size:36px; margin-top:-40px; background:#07090e; width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-left:auto; margin-right:auto; border:2px solid var(--cs-border);">${t.logo}</div>
          <h3 style="margin-top:10px;">${t.name}</h3>
          <div class="cs2-card-meta-list" style="margin-top:12px;">
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Capitão</span>
              <span class="cs2-meta-val">${t.captain}</span>
            </div>
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Integrantes</span>
              <span class="cs2-meta-val">${t.members.length} Jogadores</span>
            </div>
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Ranking</span>
              <span class="cs2-meta-val">#${t.ranking}</span>
            </div>
            <div class="cs2-meta-item">
              <span class="cs2-meta-label">Pontos</span>
              <span class="cs2-meta-val" style="color:var(--cs-accent-cyan);">${t.points} pts</span>
            </div>
          </div>
          <div style="border-top:1px solid var(--cs-border); padding-top:12px; font-size:12px; color:#718096; text-align:left;">
            <strong>Roster Principal:</strong> ${t.members.join(', ')}
          </div>
          <button class="btn-card-action btn-view-team" type="button">👥 Ver equipe</button>
        </div>
      `;
      card.querySelector('.btn-view-team').addEventListener('click', () => {
        window.location.href = `my-teams.html?teamName=${encodeURIComponent(t.name)}`;
      });
      teamsListGrid.appendChild(card);
    });
  }

  /* ─── RANKINGS COMPONENT ─── */
  const leaderboardPlayersTbody = document.getElementById('leaderboard-players-tbody');
  const leaderboardTeamsTbody = document.getElementById('leaderboard-teams-tbody');

  function renderRankings() {
    if (leaderboardPlayersTbody) {
      leaderboardPlayersTbody.innerHTML = '';
      players.sort((a,b) => b.points - a.points).forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${idx+1}</strong></td>
          <td><span style="margin-right:8px;">${p.avatar}</span><strong>${p.nick}</strong></td>
          <td><span class="slot-badge">${p.role}</span></td>
          <td>${p.wins} W</td>
          <td style="color:#00ff88; font-weight:700;">${p.kd}</td>
          <td style="color:var(--cs-accent); font-weight:900;">${p.points}</td>
        `;
        leaderboardPlayersTbody.appendChild(tr);
      });
    }

    if (leaderboardTeamsTbody) {
      leaderboardTeamsTbody.innerHTML = '';
      teams.sort((a,b) => b.points - a.points).forEach((t, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${idx+1}</strong></td>
          <td><span style="margin-right:8px;">${t.logo}</span><strong>${t.name}</strong></td>
          <td>${t.captain}</td>
          <td>${t.stats}</td>
          <td>${t.history.map(h => `<span class="hist-result ${h}" style="padding:1px 4px; font-size:9px; margin-right:2px;">${h === 'win' ? 'W' : 'L'}</span>`).join('')}</td>
          <td style="color:var(--cs-accent-cyan); font-weight:900;">${t.points}</td>
        `;
        leaderboardTeamsTbody.appendChild(tr);
      });
    }
  }

  /* ─── STEAM FEED COMPONENT ─── */
  const steamFeedContainer = document.getElementById('steam-feed-container');

  function renderFeed() {
    if (!steamFeedContainer) return;
    steamFeedContainer.innerHTML = '';

    feedItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'feed-item';
      el.innerHTML = `
        <div class="feed-item-header">
          <div class="feed-item-avatar" style="display:flex; align-items:center; justify-content:center; font-size:16px;">📰</div>
          <div class="feed-item-meta">
            <span class="feed-item-user">${item.user}</span>
            <span class="feed-item-time">${item.time}</span>
          </div>
        </div>
        <div class="feed-item-content">
          Postou um marco competitivo em <strong>${item.target}</strong>: <span style="color:var(--cs-accent-cyan); font-weight:700;">${item.action}</span>
        </div>
        <div class="feed-item-actions">
          <button class="btn-feed-action ${item.likedByMe ? 'active' : ''}" onclick="likeFeedItem(${item.id})">👍 Curtir (${item.likes})</button>
          <button class="btn-feed-action" onclick="toggleFeedComments(${item.id})">💬 Comentar (${item.comments.length})</button>
          <button class="btn-feed-action" onclick="shareFeedItem('${item.target}')">📣 Compartilhar</button>
        </div>
        <div id="comments-box-${item.id}" style="display:none; margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.03);">
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <input class="form-input" style="height:32px; font-size:12px;" placeholder="Escreva um comentário..." id="new-comment-${item.id}"/>
            <button class="cs2-btn cs2-btn-primary" style="padding:4px 12px; font-size:11px;" onclick="addFeedComment(${item.id})">Enviar</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${item.comments.map(c => `
              <div style="font-size:12px; background:rgba(0,0,0,0.1); padding:6px 10px; border-radius:4px;">
                <strong>${c.user}:</strong> <span style="color:#a0aec0;">${c.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      steamFeedContainer.appendChild(el);
    });
  }

  window.likeFeedItem = (id) => {
    const item = feedItems.find(f => f.id === id);
    if (!item) return;
    if (item.likedByMe) {
      item.likes--;
      item.likedByMe = false;
    } else {
      item.likes++;
      item.likedByMe = true;
    }
    saveData(STORAGE_KEY_FEED, feedItems);
    renderFeed();
  };

  window.toggleFeedComments = (id) => {
    const el = document.getElementById(`comments-box-${id}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };

  window.addFeedComment = (id) => {
    const input = document.getElementById(`new-comment-${id}`);
    if (!input || !input.value.trim()) return;
    const item = feedItems.find(f => f.id === id);
    if (!item) return;

    item.comments.push({
      user: currentUser.nick,
      text: input.value.trim()
    });
    saveData(STORAGE_KEY_FEED, feedItems);
    renderFeed();
    input.value = '';
  };

  window.shareFeedItem = (title) => {
    showToast(`📢 Compartilhado em suas redes sociais: ${title}!`, '#00d4ff');
  };

  /* ─── INITIALIZATION CALL ─── */
  async function init() {
    await syncInitialData();
    updateHeroCounters();
    renderNotifications();
    renderTeams();

    setTimeout(() => {
      renderTournaments();
    }, 1200);

    // ── Real-time Firebase listeners ──
    // Whenever ANY user creates/edits a tournament, all screens update instantly
    if (window.CluchAPI?.onStoreChange) {
      CluchAPI.onStoreChange(STORAGE_KEY_CAMPS, (freshTournaments) => {
        if (!Array.isArray(freshTournaments)) return;
        tournaments = freshTournaments;
        renderTournaments();
        updateHeroCounters();
      });

      CluchAPI.onStoreChange(STORAGE_KEY_TEAMS, (freshTeams) => {
        if (!Array.isArray(freshTeams)) return;
        teams = freshTeams;
        renderTeams();
        updateHeroCounters();
      });

      CluchAPI.onStoreChange(STORAGE_KEY_FEED, (freshFeed) => {
        if (!Array.isArray(freshFeed)) return;
        feedItems = freshFeed;
        renderFeed();
      });

      CluchAPI.onStoreChange(STORAGE_KEY_NOTIFS, (freshNotifs) => {
        if (!Array.isArray(freshNotifs)) return;
        notifications = freshNotifs;
        renderNotifications();
      });
    }
  }

  init();
});
