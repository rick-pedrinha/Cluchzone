/* ═══════════════════════════════════════════════════════════════
   CLUTCHZONE — TEAMS ENGINE JS
   Handles team creation, rosters editing, FACEIT-style view,
   invitation send/receive system, and integration with tournaments.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// Mantém os dados reais já cadastrados no navegador.
// Não remova equipes ou campeonatos automaticamente ao abrir a página.
function initTeams() {

  const STORAGE_KEY_TEAMS = 'cluchzone_cs2_teams';
  const STORAGE_KEY_INVITES = 'cluchzone_team_invites';
  const STORAGE_KEY_NOTIFS = 'cluchzone_cs2_notifs';
  const requestedReturn = new URLSearchParams(window.location.search).get('returnTo') || '';
  const safeReturnUrl = /^tournament-details\.html\?id=[^#]+$/.test(requestedReturn)
    ? requestedReturn
    : 'my-teams.html';

  // 1. Get logged-in user
  let currentUser = window.ClutchAuth?.getUser() || null;
  if (!currentUser) {
    currentUser = { nick: "Jogador_Convidado", provider: "email", games: ["CS2"] };
  }

  // 2. Load data from localStorage
  let teams = JSON.parse(localStorage.getItem(STORAGE_KEY_TEAMS)) || [];
  let invites = JSON.parse(localStorage.getItem(STORAGE_KEY_INVITES)) || [
    // Pre-filled sample invite for guest user
    { id: 1, teamName: "MIBR Classic", captain: "Apex_Lead", invitee: currentUser.nick, status: "pending" }
  ];
  let notifications = JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFS)) || [];

  // Sync data to localStorage and Firebase Firestore
  function syncStorage(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    window.CluchAPI?.setStore(key, val);
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
    setTimeout(() => { t.style.transform = 'translateY(0)'; t.style.opacity = '1'; }, 50);
    setTimeout(() => {
      t.style.transform = 'translateY(-20px)'; t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  function addNotification(text) {
    notifications.unshift({ id: Date.now(), text, time: "Agora", read: false });
    syncStorage(STORAGE_KEY_NOTIFS, notifications);
    renderNotificationsNav();
  }

  function renderNotificationsNav() {
    const list = document.getElementById('notif-list');
    const count = document.getElementById('notif-count');
    if (!list) return;
    list.innerHTML = '';
    let unread = 0;
    notifications.forEach(n => {
      if (!n.read) unread++;
      const el = document.createElement('div');
      el.className = 'dropdown-item';
      el.innerHTML = `<div>${n.text}</div><div style="font-size:9px; color:#4a5568;">${n.time}</div>`;
      list.appendChild(el);
    });
    if (count) {
      count.textContent = unread;
      count.style.display = unread > 0 ? 'flex' : 'none';
    }
  }

  /* ─── TEAM CREATION FORM (team-create.html) ─── */
  const teamCreateForm = document.getElementById('cluchzone-team-create-form');
  let logoBase64 = "";
  let bannerBase64 = "";

  // Helper function to bind drag and drop event listeners
  function setupDragAndDrop(boxId, inputId, previewId, callback) {
    const box = document.getElementById(boxId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!box || !input) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      box.addEventListener(eventName, (e) => {
        e.preventDefault();
        box.style.borderColor = 'var(--tm-cyan)';
        box.style.background = 'rgba(0, 212, 255, 0.04)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      box.addEventListener(eventName, (e) => {
        e.preventDefault();
        box.style.borderColor = 'var(--tm-border)';
        box.style.background = 'rgba(255,255,255,0.02)';
      }, false);
    });

    box.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        input.files = files;
        handleFileSelect(files[0], preview, callback);
      }
    }, false);

    input.addEventListener('change', () => {
      if (input.files.length > 0) {
        handleFileSelect(input.files[0], preview, callback);
      }
    });
  }

  function handleFileSelect(file, previewEl, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      if (previewEl) {
        previewEl.src = base64;
        previewEl.style.display = 'block';
      }
      callback(base64);
    };
    reader.readAsDataURL(file);
  }

  // Setup Drag & Drops for team-create
  setupDragAndDrop('tm-logo-upload-box', 'tm-logo-file', 'logo-preview-img', (b64) => { logoBase64 = b64; });
  setupDragAndDrop('tm-banner-upload-box', 'tm-banner-file', 'banner-preview-img', (b64) => { bannerBase64 = b64; });

  if (teamCreateForm) {
    const captainNameInput = document.getElementById('tm-captain-name');
    if (captainNameInput) captainNameInput.value = currentUser.nick;

    teamCreateForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('tm-name').value;
      const tag = document.getElementById('tm-tag').value.toUpperCase();
      const desc = document.getElementById('tm-desc').value;
      const region = document.getElementById('tm-region').value;

      const discord = document.getElementById('tm-link-discord').value || "#";
      const steam = document.getElementById('tm-link-steam').value || "#";
      const insta = document.getElementById('tm-link-insta').value || "#";
      const site = document.getElementById('tm-link-site').value || "#";

      const viceCap = document.getElementById('tm-vice-name').value;
      const titMembers = document.getElementById('tm-players-list').value.split(',').map(m => m.trim()).filter(m => m !== "");
      const resMembers = document.getElementById('tm-reserves-list').value.split(',').map(m => m.trim()).filter(m => m !== "");

      if (titMembers.length < 3) {
        showToast("⚠️ O time precisa ter no mínimo 5 titulares (Capitão, Vice + 3 membros)!", "#ffd700");
        return;
      }

      if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showToast("⚠️ Este nome de equipe já está cadastrado!", "#ffd700");
        return;
      }

      const newTeam = {
        logo: logoBase64 ? `<img src="${logoBase64}"/>` : "🛡️",
        banner: bannerBase64 || 'https://images.alphacoders.com/605/605592.jpg',
        name: name,
        tag: tag,
        description: desc,
        region: region,
        captain: currentUser.nick,
        vice: viceCap,
        members: [currentUser.nick, viceCap, ...titMembers],
        reserves: resMembers,
        socials: { discord, steam, insta, site },
        stats: "0-0",
        winrate: "0%",
        matches: 0,
        ranking: teams.length + 1,
        points: 1000,
        history: [],
        medals: ["🛡️ Recém Cadastrado"]
      };

      teams.push(newTeam);
      syncStorage(STORAGE_KEY_TEAMS, teams);

      addNotification(`A equipe ${name} [${tag}] foi criada oficialmente!`);
      showToast("🛡️ Equipe criada com sucesso!", "#00e676");

      setTimeout(() => {
        window.location.href = safeReturnUrl;
      }, 1500);
    });
  }

  /* ─── MY TEAMS & FACEIT DISPLAY (my-teams.html) ─── */
  const activeTeamSelector = document.getElementById('active-team-selector');
  let selectedTeamName = "";
  
  const params = new URLSearchParams(window.location.search);
  const paramCampId = params.get('campId');
  const paramTeamName = params.get('teamName');
  let activeCamp = null;
  let allTournaments = [];

  async function loadActiveCamp() {
    if (window.CluchAPI && paramCampId) {
      allTournaments = await CluchAPI.getStore('cluchzone_cs2_camps', []);
      activeCamp = allTournaments.find(c => String(c.id) === String(paramCampId));
    }
  }

  window.payPlayerPix = (teamName, nickname) => {
    if (!activeCamp) return;
    showToast(`💸 Abrindo Pix para pagar taxa de ${nickname}...`, '#ffd700');
    
    setTimeout(() => {
      activeCamp.playerPayments = activeCamp.playerPayments || {};
      activeCamp.playerPayments[teamName] = activeCamp.playerPayments[teamName] || {};
      activeCamp.playerPayments[teamName][nickname] = true;
      
      const targetTeam = teams.find(t => t.name === teamName);
      if (targetTeam) {
        const allPaid = targetTeam.members.every(m => {
          return activeCamp.playerPayments[teamName][m] === true;
        });
        if (allPaid) {
          activeCamp.pixStatus = activeCamp.pixStatus || {};
          activeCamp.pixStatus[teamName] = 'pago';
          showToast(`🟢 Todo o roster da equipe ${teamName} pagou! Inscrição confirmada.`, '#00ff88');
        }
      }

      if (window.CluchAPI) {
        CluchAPI.setStore('cluchzone_cs2_camps', allTournaments);
      }
      localStorage.setItem('cluchzone_cs2_camps', JSON.stringify(allTournaments));

      renderTeamDetails(targetTeam);
      showToast(`✓ Pix de ${nickname} confirmado com sucesso!`, '#00ff88');
    }, 1200);
  };

  function loadTeamsDashboard() {
    if (!activeTeamSelector) return;
    activeTeamSelector.innerHTML = '';

    // Filter user associated teams
    let myUserTeams = teams.filter(t => 
      t.captain === currentUser.nick || 
      t.vice === currentUser.nick || 
      t.members.includes(currentUser.nick) ||
      (t.reserves && t.reserves.includes(currentUser.nick))
    );

    // If requested a team name from query string, include it even if user is admin/not in roster
    if (paramTeamName) {
      const extTeam = teams.find(t => t.name === paramTeamName);
      if (extTeam && !myUserTeams.some(t => t.name === extTeam.name)) {
        myUserTeams.unshift(extTeam);
      }
    }

    if (myUserTeams.length === 0) {
      activeTeamSelector.innerHTML = `<option value="">Nenhuma equipe associada</option>`;
      activeTeamSelector.disabled = true;
      document.getElementById('active-team-name').textContent = "Nenhuma Equipe";
      document.getElementById('active-team-tag').textContent = "—";
      document.getElementById('active-team-meta').textContent = "Crie uma equipe clicando no botão ao lado.";
      document.getElementById('active-roster-list').innerHTML = `
        <div style="text-align:center; color:#4a5568; padding:30px 0;">Você ainda não faz parte de nenhuma equipe tática de eSports.</div>
      `;
      return;
    }

    myUserTeams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = `${t.logo && !t.logo.includes('<img') ? t.logo : '🛡️'} ${t.name} [${t.tag || 'IMP'}]`;
      activeTeamSelector.appendChild(opt);
    });

    // Select requested or default
    const preSelect = paramTeamName && myUserTeams.some(t => t.name === paramTeamName) ? paramTeamName : myUserTeams[0].name;
    activeTeamSelector.value = preSelect;
    selectedTeamName = preSelect;
    
    const initialTeam = myUserTeams.find(t => t.name === preSelect);
    if (initialTeam) renderTeamDetails(initialTeam);

    activeTeamSelector.addEventListener('change', () => {
      selectedTeamName = activeTeamSelector.value;
      const targetTeam = teams.find(t => t.name === selectedTeamName);
      if (targetTeam) renderTeamDetails(targetTeam);
    });
  }

  function renderTeamDetails(team) {
    document.getElementById('active-team-banner').style.backgroundImage = `url('${team.banner}')`;
    document.getElementById('active-team-logo').innerHTML = team.logo || "🛡️";
    document.getElementById('active-team-name').textContent = team.name;
    document.getElementById('active-team-tag').textContent = team.tag || "IMP";
    document.getElementById('active-team-meta').innerHTML = `Região: ${team.region || 'SA'} &nbsp;·&nbsp; Capitão: <strong style="color:var(--tm-gold);">${team.captain}</strong> &nbsp;·&nbsp; Pontuação: ${team.points || 1000} pts`;

    const soc = team.socials || { discord: "#", steam: "#", insta: "#", site: "#" };
    document.getElementById('soc-discord').href = soc.discord;
    document.getElementById('soc-steam').href = soc.steam;
    document.getElementById('soc-insta').href = soc.insta;
    document.getElementById('soc-site').href = soc.site;

    document.getElementById('stat-winrate').textContent = team.winrate || "50%";
    document.getElementById('stat-matches').textContent = team.matches || 0;
    document.getElementById('stat-rank').textContent = `#${team.ranking || 1}`;
    document.getElementById('stat-points').textContent = team.points || 1000;

    renderActiveRoster(team);
    renderTournamentHistory(team);
    renderTeamMedals(team);

    const settingsCard = document.getElementById('team-settings-card');
    const disbandBtn = document.getElementById('btn-disband-team');
    const sentInvitesCard = document.getElementById('sent-invites-card');

    const isCaptain = team.captain === currentUser.nick;
    const isVice = team.vice === currentUser.nick;

    if (settingsCard) {
      settingsCard.style.display = (isCaptain || isVice) ? 'block' : 'none';
      if (disbandBtn) disbandBtn.style.display = isCaptain ? 'block' : 'none';
    }

    if (sentInvitesCard) {
      settingsCard.style.display = (isCaptain || isVice) ? 'block' : 'none';
      renderSentInvites(team);
    }
  }

  function renderActiveRoster(team) {
    const list = document.getElementById('active-roster-list');
    if (!list) return;
    list.innerHTML = '';

    if (activeCamp) {
      const banner = document.createElement('div');
      banner.style.cssText = `
        background: rgba(0, 212, 255, 0.05);
        border: 1px solid rgba(0, 212, 255, 0.25);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-family: 'Rajdhani', sans-serif;
      `;
      banner.innerHTML = `
        <div style="font-family:'Orbitron',sans-serif; font-size:11px; font-weight:900; color:#00d4ff; letter-spacing:1px; margin-bottom:4px;">
          📍 FINANCEIRO DA EQUIPE — TORNEIO: ${activeCamp.name.toUpperCase()}
        </div>
        <div style="font-size:12px; color:#a0aec0;">
          Taxa por jogador: <strong style="color:#fff;">R$ 10,00</strong>. Integrantes verdes confirmaram o Pix individualmente. 
          O capitão pode pagar a taxa de qualquer membro pendente clicando no botão ao lado.
        </div>
      `;
      list.appendChild(banner);
    }

    const isCaptainOrVice = team.captain === currentUser.nick || team.vice === currentUser.nick;

    list.appendChild(createMemberRow(team.captain, 'Capitão', 'badge-cpt', false, team.name));
    list.appendChild(createMemberRow(team.vice, 'Vice-Capitão', 'badge-vice', isCaptainOrVice && team.captain !== team.vice, team.name));

    team.members.forEach(member => {
      if (member === team.captain || member === team.vice) return;
      list.appendChild(createMemberRow(member, 'Titular', 'badge-player', isCaptainOrVice, team.name));
    });

    if (team.reserves) {
      team.reserves.forEach(reserve => {
        list.appendChild(createMemberRow(reserve, 'Reserva', 'badge-reserve', isCaptainOrVice, team.name));
      });
    }
  }

  function createMemberRow(nickname, roleLabel, badgeClass, canManage, teamName) {
    const el = document.createElement('div');
    el.className = 'roster-member-item';
    
    let actionButtons = '';
    if (canManage && nickname !== currentUser.nick) {
      actionButtons = `
        <div class="roster-member-actions">
          <button class="btn-roster-action btn-roster-edit" onclick="promoteMember('${nickname}', '${teamName}')">Promover</button>
          <button class="btn-roster-action btn-roster-remove" onclick="removeMember('${nickname}', '${teamName}')">Remover</button>
        </div>
      `;
    }

    let nameStyle = 'color: #fff; font-weight: 700;';
    let pixBadge = '';
    
    if (activeCamp) {
      activeCamp.playerPayments = activeCamp.playerPayments || {};
      activeCamp.playerPayments[teamName] = activeCamp.playerPayments[teamName] || {};
      
      const isPaid = activeCamp.playerPayments[teamName][nickname] || (nickname === teamName.split(' ')[0] && activeCamp.pixStatus?.[teamName] === 'pago');
      
      if (isPaid) {
        nameStyle = 'color: #00ff88; font-weight: 700; text-shadow: 0 0 10px rgba(0,255,136,0.15);';
        pixBadge = `<span style="font-family:'Orbitron',sans-serif;font-size:8px;font-weight:900;background:rgba(0,255,136,0.12);color:#00ff88;border:1px solid rgba(0,255,136,0.25);padding:2px 6px;border-radius:4px;margin-left:8px;text-transform:uppercase;">🟢 Pix Pago</span>`;
      } else {
        nameStyle = 'color: #ff3333; font-weight: 700; text-shadow: 0 0 10px rgba(255,51,51,0.15);';
        pixBadge = `<span style="font-family:'Orbitron',sans-serif;font-size:8px;font-weight:900;background:rgba(255,51,51,0.12);color:#ff3333;border:1px solid rgba(255,51,51,0.25);padding:2px 6px;border-radius:4px;margin-left:8px;text-transform:uppercase;">🔴 Pix Pendente</span>`;
        
        const isUserCaptain = teams.find(t => t.name === teamName)?.captain === currentUser.nick;
        if (isUserCaptain) {
          actionButtons = `
            <div class="roster-member-actions">
              <button class="btn-roster-action" onclick="window.payPlayerPix('${teamName}', '${nickname}')" style="background:rgba(255,215,0,0.1);color:#ffd700;border:1px solid rgba(255,215,0,0.35);border-radius:4px;padding:4px 8px;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;cursor:pointer;">💸 Pagar Pix</button>
            </div>
          `;
        } else {
          actionButtons = '';
        }
      }
    }

    el.innerHTML = `
      <div class="roster-member-left">
        <div class="roster-member-avatar">👤</div>
        <div>
          <span class="roster-member-nick" style="${nameStyle}">${nickname}</span>
          <span class="roster-member-badge ${badgeClass}">${roleLabel}</span>
        </div>
      </div>
      ${actionButtons}
    `;

    return el;
  }

  window.promoteMember = (nick, teamName) => {
    const team = teams.find(t => t.name === teamName);
    if (!team) return;
    if (confirm(`Deseja promover ${nick} a Vice-Capitão da equipe?`)) {
      team.vice = nick;
      syncStorage(STORAGE_KEY_TEAMS, teams);
      showToast(`✓ ${nick} promovido a Vice-Capitão!`, "#00ff88");
      renderTeamDetails(team);
    }
  };

  window.removeMember = (nick, teamName) => {
    const team = teams.find(t => t.name === teamName);
    if (!team) return;
    if (confirm(`Deseja remover ${nick} da equipe ${teamName}?`)) {
      team.members = team.members.filter(m => m !== nick);
      if (team.reserves) team.reserves = team.reserves.filter(r => r !== nick);
      if (team.vice === nick) team.vice = team.captain; // Reset vice to captain
      syncStorage(STORAGE_KEY_TEAMS, teams);
      showToast(`❌ ${nick} foi removido da equipe.`, "#ff3333");
      renderTeamDetails(team);
    }
  };

  function renderTournamentHistory(team) {
    const tbody = document.getElementById('team-camp-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const history = team.history && team.history.length > 0 ? team.history : [
      { name: "Copa Deagle Master", region: "Brasil - SP", format: "MD3", place: "Top 8", result: "win" }
    ];

    history.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${h.name}</strong></td>
        <td>${h.region}</td>
        <td>${h.format}</td>
        <td>${h.place}</td>
        <td><span class="hist-result ${h.result === 'win' ? 'win' : 'loss'}" style="font-size:10px; padding:2px 8px;">${h.result === 'win' ? 'Classificado' : 'Eliminado'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderTeamMedals(team) {
    const grid = document.getElementById('team-medals-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const medals = team.medals || ["🛡️ Recém Cadastrado", "🔥 Em Ascensão"];
    medals.forEach(m => {
      const item = document.createElement('div');
      item.className = 'medal-item';
      item.innerHTML = `
        <div style="font-size:24px; margin-bottom:4px;">🏅</div>
        <div style="font-size:11px; font-weight:700; color:#fff;">${m}</div>
      `;
      grid.appendChild(item);
    });
  }

  /* ─── INVITES SYSTEM (SEND / RECEIVE) ─── */
  const btnSendInvite = document.getElementById('btn-send-invite');
  const inviteInput = document.getElementById('invite-player-name');

  if (btnSendInvite && inviteInput) {
    btnSendInvite.addEventListener('click', () => {
      const nick = inviteInput.value.trim();
      if (!nick) return;

      const team = teams.find(t => t.name === selectedTeamName);
      if (!team) return;

      // Check if player is already in roster
      if (team.members.includes(nick) || (team.reserves && team.reserves.includes(nick))) {
        showToast("⚠️ O jogador já faz parte desta equipe!", "#ffd700");
        return;
      }

      // Add to invites array
      invites.push({
        id: Date.now(),
        teamName: team.name,
        captain: currentUser.nick,
        invitee: nick,
        status: "pending"
      });
      syncStorage(STORAGE_KEY_INVITES, invites);

      showToast(`✉️ Convite enviado para ${nick}!`, "#00d4ff");
      inviteInput.value = '';
      renderSentInvites(team);
    });
  }

  function renderSentInvites(team) {
    const list = document.getElementById('sent-invites-list');
    if (!list) return;
    list.innerHTML = '';

    const sent = invites.filter(i => i.teamName === team.name && i.status === 'pending');
    if (sent.length === 0) {
      list.innerHTML = `<div style="font-size:11px; color:#4a5568;">Nenhum convite pendente enviado.</div>`;
      return;
    }

    sent.forEach(invite => {
      const el = document.createElement('div');
      el.style.cssText = `
        background: rgba(255,255,255,0.02); border: 1px solid var(--tm-border);
        padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;
      `;
      el.innerHTML = `
        <span style="font-size:12px;">Convidado: <strong>${invite.invitee}</strong></span>
        <button class="btn-roster-action btn-roster-remove" onclick="cancelInvite(${invite.id})">Cancelar</button>
      `;
      list.appendChild(el);
    });
  }

  window.cancelInvite = (inviteId) => {
    invites = invites.filter(i => i.id !== inviteId);
    syncStorage(STORAGE_KEY_INVITES, invites);
    showToast("❌ Convite cancelado pelo capitão.", "#ff3333");
    const activeTeam = teams.find(t => t.name === selectedTeamName);
    if (activeTeam) renderSentInvites(activeTeam);
  };

  // Receive / Accept invites list
  function renderPendingIncomingInvites() {
    const invitesCard = document.getElementById('pending-invites-card');
    const invitesList = document.getElementById('pending-invites-list');
    if (!invitesCard || !invitesList) return;

    const myIncoming = invites.filter(i => i.invitee === currentUser.nick && i.status === 'pending');

    if (myIncoming.length === 0) {
      invitesCard.style.display = 'none';
      return;
    }

    invitesCard.style.display = 'block';
    invitesList.innerHTML = '';

    myIncoming.forEach(invite => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--tm-border);
      `;
      row.innerHTML = `
        <div>
          <span style="font-size: 14px; color:#fff;">Convite para entrar na equipe <strong>${invite.teamName}</strong></span>
          <div style="font-size: 11px; color:#718096; margin-top:2px;">Convidado por Capitão: ${invite.captain}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="cs2-btn cs2-btn-primary" style="padding: 6px 12px; font-size:11px;" onclick="acceptInvite(${invite.id})">Aceitar</button>
          <button class="cs2-btn cs2-btn-secondary" style="padding: 6px 12px; font-size:11px;" onclick="declineInvite(${invite.id})">Recusar</button>
        </div>
      `;
      invitesList.appendChild(row);
    });
  }

  window.acceptInvite = (inviteId) => {
    const invite = invites.find(i => i.id === inviteId);
    if (!invite) return;

    const team = teams.find(t => t.name === invite.teamName);
    if (team) {
      // Add member
      team.members.push(currentUser.nick);
      syncStorage(STORAGE_KEY_TEAMS, teams);
      
      // Remove invite
      invites = invites.filter(i => i.id !== inviteId);
      syncStorage(STORAGE_KEY_INVITES, invites);

      showToast(`✓ Você entrou na equipe ${team.name}!`, "#00ff88");
      addNotification(`Você aceitou o convite e agora faz parte de ${team.name}!`);

      // Refresh
      loadTeamsDashboard();
      renderPendingIncomingInvites();
    }
  };

  window.declineInvite = (inviteId) => {
    invites = invites.filter(i => i.id !== inviteId);
    syncStorage(STORAGE_KEY_INVITES, invites);
    showToast("❌ Convite recusado.", "#ff3333");
    renderPendingIncomingInvites();
  };

  // Disband team
  const disbandBtn = document.getElementById('btn-disband-team');
  if (disbandBtn) {
    disbandBtn.addEventListener('click', () => {
      const team = teams.find(t => t.name === selectedTeamName);
      if (!team) return;

      if (confirm(`⚠️ Tem certeza de que deseja DESFAZER permanentemente a equipe ${team.name}? Esta ação não pode ser desfeita.`)) {
        teams = teams.filter(t => t.name !== team.name);
        syncStorage(STORAGE_KEY_TEAMS, teams);

        // Remove associated invites
        invites = invites.filter(i => i.teamName !== team.name);
        syncStorage(STORAGE_KEY_INVITES, invites);

        showToast("💥 Equipe desfeita com sucesso.", "#ff3333");
        addNotification(`A equipe ${team.name} foi desfeita permanentemente.`);
        
        loadTeamsDashboard();
      }
    });
  }

  /* ─── DIRECT ADD MEMBER (DIRECT NO INVITE) ─── */
  const btnDirectAdd = document.getElementById('btn-direct-add');
  const directInput = document.getElementById('direct-player-name');
  if (btnDirectAdd && directInput) {
    btnDirectAdd.addEventListener('click', () => {
      const nick = directInput.value.trim();
      if (!nick) return;

      const team = teams.find(t => t.name === selectedTeamName);
      if (!team) return;

      // Avoid duplicates
      if (team.members.includes(nick) || (team.reserves && team.reserves.includes(nick))) {
        showToast("⚠️ Este jogador já faz parte do elenco da equipe!", "#ffd700");
        return;
      }

      // Add directly as titular player
      team.members.push(nick);
      syncStorage(STORAGE_KEY_TEAMS, teams);

      showToast(`➕ ${nick} foi adicionado diretamente ao time!`, "#00ff88");
      addNotification(`${nick} entrou para a equipe ${team.name} via contratação direta.`);
      
      directInput.value = '';
      renderTeamDetails(team);
    });
  }

  /* ─── TEAM EDIT LOGIC ─── */
  const btnToggleEdit = document.getElementById('btn-toggle-edit-fields');
  const editContainer = document.getElementById('edit-team-fields-container');
  if (btnToggleEdit && editContainer) {
    btnToggleEdit.addEventListener('click', () => {
      const isHidden = editContainer.style.display === 'none';
      editContainer.style.display = isHidden ? 'flex' : 'none';
      
      if (isHidden) {
        const team = teams.find(t => t.name === selectedTeamName);
        if (team) {
          // Pre-populate fields
          document.getElementById('edit-team-name').value = team.name;
          document.getElementById('edit-team-tag').value = team.tag || '';
          document.getElementById('edit-team-desc').value = team.description || '';
          document.getElementById('edit-team-region').value = team.region || 'América do Sul';
          
          // Reset previews
          document.getElementById('edit-logo-preview').style.display = 'none';
          document.getElementById('edit-banner-preview').style.display = 'none';
          editLogoBase64 = "";
          editBannerBase64 = "";
        }
      }
    });
  }

  let editLogoBase64 = "";
  let editBannerBase64 = "";

  // Bind drag & drop for editing logo/banner
  setupDragAndDrop('edit-logo-upload-box', 'edit-logo-file', 'edit-logo-preview', (b64) => { editLogoBase64 = b64; });
  setupDragAndDrop('edit-banner-upload-box', 'edit-banner-file', 'edit-banner-preview', (b64) => { editBannerBase64 = b64; });

  const btnSaveTeamChanges = document.getElementById('btn-save-team-changes');
  if (btnSaveTeamChanges) {
    btnSaveTeamChanges.addEventListener('click', () => {
      const team = teams.find(t => t.name === selectedTeamName);
      if (!team) return;

      const newName = document.getElementById('edit-team-name').value.trim();
      const newTag = document.getElementById('edit-team-tag').value.toUpperCase().trim();
      const newDesc = document.getElementById('edit-team-desc').value;
      const newRegion = document.getElementById('edit-team-region').value;

      if (!newName || !newTag) {
        showToast("⚠️ Preencha o nome e a TAG da equipe!", "#ffd700");
        return;
      }

      // Check if new name conflicts with other teams
      if (newName.toLowerCase() !== team.name.toLowerCase() && teams.some(t => t.name.toLowerCase() === newName.toLowerCase())) {
        showToast("⚠️ Este nome de equipe já está cadastrado por outro clã!", "#ffd700");
        return;
      }

      // Update fields
      team.name = newName;
      team.tag = newTag;
      team.description = newDesc;
      team.region = newRegion;

      if (editLogoBase64) {
        team.logo = `<img src="${editLogoBase64}"/>`;
      }
      if (editBannerBase64) {
        team.banner = editBannerBase64;
      }

      syncStorage(STORAGE_KEY_TEAMS, teams);
      showToast("💾 Alterações salvas com sucesso!", "#00ff88");
      
      // Update selectedTeamName tracking if it was renamed
      selectedTeamName = newName;
      localStorage.setItem('cluchzone_active_team', newName);

      // Hide container & refresh details
      editContainer.style.display = 'none';
      loadTeamsDashboard();
    });
  }

  // Hook notification bell dropdown toggle
  const btnBell = document.getElementById('btn-notif-bell');
  const drawer = document.getElementById('notif-drawer');
  if (btnBell && drawer) {
    btnBell.addEventListener('click', (e) => {
      e.stopPropagation();
      drawer.classList.toggle('open');
    });
    document.addEventListener('click', () => drawer.classList.remove('open'));
  }

  /* ─── INITIALIZATION ─── */
  async function syncInitialData() {
    if (window.CluchAPI) {
      teams = await CluchAPI.getStore(STORAGE_KEY_TEAMS, teams);
      notifications = await CluchAPI.getStore(STORAGE_KEY_NOTIFS, notifications);
    }
  }

  async function startup() {
    await syncInitialData();
    await loadActiveCamp();
    loadTeamsDashboard();
    renderPendingIncomingInvites();
    renderNotificationsNav();

    // ── Real-time Firebase listeners ──
    if (window.CluchAPI?.onStoreChange) {
      CluchAPI.onStoreChange(STORAGE_KEY_TEAMS, (freshTeams) => {
        if (!Array.isArray(freshTeams)) return;
        teams = freshTeams;
        loadTeamsDashboard();
      });

      if (paramCampId) {
        CluchAPI.onStoreChange('cluchzone_cs2_camps', (freshTournaments) => {
          if (!Array.isArray(freshTournaments)) return;
          allTournaments = freshTournaments;
          activeCamp = freshTournaments.find(c => String(c.id) === String(paramCampId));
          const targetTeam = teams.find(t => t.name === selectedTeamName);
          if (targetTeam) renderTeamDetails(targetTeam);
        });
      }
    }
  }

  startup();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.ClutchAuth?.ready.then(initTeams));
} else {
  initTeams();
}
