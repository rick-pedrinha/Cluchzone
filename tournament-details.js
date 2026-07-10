'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const CAMP_KEY = 'cluchzone_cs2_camps';
  const TEAM_KEY = 'cluchzone_cs2_teams';
  const AUTH_KEY = 'cluchzone_auth';
  const EVENT_BANNERS = {
    'copa deagle master': 'images/cs2_copa_deagle_master.jpg',
    'dust ii shootout tournament': 'images/cs2_dust2_shootout.jpg',
    'cs2 open pro': 'images/cs2_open_pro.jpg'
  };

  const params = new URLSearchParams(window.location.search);
  const campId = params.get('id');

  const getJson = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  };

  let tournaments = await window.CluchAPI?.getStore(CAMP_KEY, null);
  let teams = await window.CluchAPI?.getStore(TEAM_KEY, null);
  let currentUser = await window.CluchAPI?.getStore(AUTH_KEY, null);

  tournaments = Array.isArray(tournaments) ? tournaments : (getJson(CAMP_KEY) || []);
  teams = Array.isArray(teams) ? teams : (getJson(TEAM_KEY) || []);
  currentUser = currentUser || getJson(AUTH_KEY) || { nick: 'Jogador_Convidado', provider: 'email' };

  const camp = tournaments.find(item => String(item.id) === String(campId));
  if (!camp) {
    document.getElementById('td-title').textContent = 'Campeonato não encontrado';
    document.getElementById('td-description').textContent = 'Volte para a lista e escolha um campeonato disponível.';
    const joinBtn = document.getElementById('td-join-team-btn');
    if (joinBtn) joinBtn.disabled = true;
    return;
  }

  const allCampTeamNames = [...new Set([...(camp.registeredTeams || []), ...(camp.pendingApprovals || [])])];
  const teamByName = name => teams.find(team => team.name === name);
  const teamLogo = name => teamByName(name)?.logo || 'CS';
  const teamCaptain = name => teamByName(name)?.captain || 'Aguardando capitão';

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function renderHeader() {
    const normalizedName = String(camp.name || '').trim().toLowerCase();
    const banner = EVENT_BANNERS[normalizedName] || (String(camp.banner || '').startsWith('images/') ? camp.banner : 'images/cs2_open_pro.jpg');
    document.getElementById('td-hero-bg').style.backgroundImage = `url('${banner}')`;
    setText('td-status', camp.status || 'Registros Abertos');
    setText('td-title', camp.name || 'Campeonato CLUCHZONE');
    setText('td-description', camp.description || camp.rules || 'Confira equipes, capitães, regras e chaveamento do campeonato.');
    setText('td-prize', camp.prize || 'R$ 0');
    setText('td-slots', `${(camp.registeredTeams || []).length}/${camp.maxTeams || 0}`);
    setText('td-format', `${camp.format || '-'}${camp.elimination ? ` - ${camp.elimination}` : ''}`);
    setText('td-region', camp.region || '-');
    setText('td-organizer', camp.organizer || '-');
    setText('td-rules', camp.rules || 'Regras padrão CLUCHZONE.');
    setText('td-server', camp.server?.active ? `connect ${camp.server.ip}:${camp.server.port}; password ${camp.server.password}` : 'Aguardando liberação do organizador.');
  }

  function renderTeams() {
    const list = document.getElementById('td-team-list');
    list.innerHTML = '';
    setText('td-team-count', `${allCampTeamNames.length}/${camp.maxTeams || 0} equipes`);

    if (!allCampTeamNames.length) {
      list.innerHTML = '<div class="td-empty">Nenhuma equipe inscrita ainda. Seja o primeiro capitão no campeonato.</div>';
      return;
    }

    allCampTeamNames.forEach(name => {
      const team = teamByName(name);
      const pending = (camp.pendingApprovals || []).includes(name);
      const card = document.createElement('article');
      card.className = 'td-team-card';
      card.innerHTML = `
        <div class="td-team-logo">${team?.logo || 'CS'}</div>
        <div class="td-team-info">
          <strong>${name}</strong>
          <span>Capitão: ${team?.captain || 'Aguardando'}</span>
          <small>${team?.members?.length || 0} jogadores no roster</small>
        </div>
        <div class="td-team-status ${pending ? 'pending' : 'approved'}">${pending ? 'Pendente' : 'Aprovada'}</div>
      `;
      list.appendChild(card);
    });
  }

  function getBracketRounds() {
    const bracket = camp.bracket || {};
    const rounds = [
      { title: 'Primeira fase', matches: bracket.round1 || [] },
      { title: 'Semifinais', matches: bracket.round2 || [] },
      { title: 'Final', matches: bracket.round3 || [] }
    ].filter(round => round.matches.length);

    if (rounds.length) return rounds;

    const maxTeams = Number(camp.maxTeams || 8);
    const names = [...(camp.registeredTeams || [])];
    while (names.length < maxTeams) names.push('Aguardando equipe');

    return [{
      title: maxTeams <= 4 ? 'Semifinais' : 'Primeira fase',
      matches: Array.from({ length: Math.ceil(maxTeams / 2) }, (_, index) => ({
        id: index + 1,
        teamA: names[index * 2],
        teamB: names[index * 2 + 1],
        scoreA: 0,
        scoreB: 0,
        status: 'Aguardando',
        winner: null
      }))
    }];
  }

  function renderBracket() {
    const bracket = document.getElementById('td-bracket');
    bracket.innerHTML = '';

    getBracketRounds().forEach(round => {
      const col = document.createElement('div');
      col.className = 'td-bracket-round';
      col.innerHTML = `<h3>${round.title}</h3>`;

      round.matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'td-match';
        item.innerHTML = `
          ${renderMatchTeam(match.teamA, match.scoreA, match.winner === match.teamA)}
          <div class="td-versus">${match.status || 'Aguardando'}</div>
          ${renderMatchTeam(match.teamB, match.scoreB, match.winner === match.teamB)}
        `;
        col.appendChild(item);
      });

      bracket.appendChild(col);
    });
  }

  function renderMatchTeam(name, score, winner) {
    const label = name || 'Aguardando equipe';
    return `
      <div class="td-match-team ${winner ? 'winner' : ''}">
        <span class="td-match-logo">${teamLogo(label)}</span>
        <span>
          <strong>${label}</strong>
          <small>${label === 'Aguardando equipe' ? 'Slot aberto' : `Capitão: ${teamCaptain(label)}`}</small>
        </span>
        <b>${Number.isFinite(Number(score)) ? score : 0}</b>
      </div>
    `;
  }

  function showToast(message, color = '#00d4ff') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.style.cssText = `padding:12px 18px;border-radius:8px;margin-bottom:8px;background:rgba(0,0,0,.72);border:1px solid ${color};color:${color};font-weight:800;`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function addNotification(text) {
    const NOTIF_KEY = 'cluchzone_cs2_notifs';
    let notifs = [];
    try {
      notifs = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
    } catch (_) {
      notifs = [];
    }
    notifs.unshift({ id: Date.now(), text, time: "Agora", read: false });
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
    window.CluchAPI?.setStore(NOTIF_KEY, notifs);
  }

  async function joinTournament() {
    const userTeam = teams.find(team => team.captain === currentUser.nick || team.members?.includes(currentUser.nick));
    const teamName = userTeam?.name || `${currentUser.nick || 'Jogador'} Team`;

    if (!userTeam) {
      teams.push({
        logo: 'CS',
        banner: 'images/cs2_bg.jpg',
        name: teamName,
        captain: currentUser.nick || 'Jogador_Convidado',
        vice: '',
        members: [currentUser.nick || 'Jogador_Convidado'],
        reserves: [],
        stats: '0-0',
        history: [],
        ranking: teams.length + 1,
        points: 0
      });
    }

    if ((camp.registeredTeams || []).includes(teamName) || (camp.pendingApprovals || []).includes(teamName)) {
      showToast('Sua equipe já está neste campeonato.', '#ffd700');
      return;
    }

    camp.pendingApprovals = camp.pendingApprovals || [];
    camp.pendingApprovals.push(teamName);

    await window.CluchAPI?.setStore(TEAM_KEY, teams);
    await window.CluchAPI?.setStore(CAMP_KEY, tournaments);
    localStorage.setItem(TEAM_KEY, JSON.stringify(teams));
    localStorage.setItem(CAMP_KEY, JSON.stringify(tournaments));

    allCampTeamNames.push(teamName);
    showToast('Inscrição enviada para aprovação do organizador.', '#00ff88');
    addNotification(`Inscrição da equipe ${teamName} enviada para aprovação.`);
    renderHeader();
    renderTeams();
    renderBracket();
  }

  function renderSoloQueue() {
    const list = document.getElementById('td-solo-list');
    const countEl = document.getElementById('td-solo-count');
    if (!list) return;

    const soloPlayers = camp.soloPlayers || [];
    if (countEl) countEl.textContent = `${soloPlayers.length} jogador${soloPlayers.length !== 1 ? 'es' : ''}`;

    if (!soloPlayers.length) {
      list.innerHTML = '<div class="td-empty" style="font-size:12px; color:#4a5568; padding: 16px 0; text-align:center;">Nenhum jogador na fila ainda.<br>Seja o primeiro!</div>';
      return;
    }

    list.innerHTML = '';
    soloPlayers.forEach((nick, index) => {
      const avatarLetters = nick.substring(0, 2).toUpperCase();
      const isMe = nick === currentUser.nick;
      const card = document.createElement('article');
      card.className = 'td-team-card';
      card.style.cssText = `
        border-color: ${isMe ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.05)'};
        background: ${isMe ? 'rgba(0,212,255,0.04)' : 'rgba(255,255,255,0.02)'};
      `;
      card.innerHTML = `
        <div class="td-team-logo" style="font-size:13px; font-family:'Orbitron',sans-serif; font-weight:900; background: linear-gradient(135deg,#0d1a2a,#0a2a3a); color:#00d4ff; border: 1px solid rgba(0,212,255,0.25);">${avatarLetters}</div>
        <div class="td-team-info">
          <strong style="color:${isMe ? '#00d4ff' : '#fff'}">${nick}${isMe ? ' (você)' : ''}</strong>
          <span style="font-size:11px; color:#718096;">Aguardando alocação em equipe</span>
        </div>
        <div style="font-family:'Orbitron',sans-serif; font-size:9px; font-weight:900; background:rgba(0,212,255,0.1); color:#00d4ff; border:1px solid rgba(0,212,255,0.25); padding:2px 8px; border-radius:4px; white-space:nowrap;">#${index + 1} na fila</div>
      `;
      list.appendChild(card);
    });
  }

  async function joinSoloQueue() {
    camp.soloPlayers = camp.soloPlayers || [];
    
    if (camp.soloPlayers.includes(currentUser.nick)) {
      showToast('Você já está na fila de jogadores solo deste campeonato.', '#ffd700');
      return;
    }

    camp.soloPlayers.push(currentUser.nick);

    await window.CluchAPI?.setStore(CAMP_KEY, tournaments);
    localStorage.setItem(CAMP_KEY, JSON.stringify(tournaments));

    showToast('✓ Você entrou na Fila Solo! Buscando equipe...', '#00ff88');
    addNotification(`Você entrou na Fila Solo do campeonato ${camp.name}!`);
    renderSoloQueue();
  }

  /* ─── ADMIN PANEL ─── */
  function saveAndRefreshAll() {
    localStorage.setItem(CAMP_KEY, JSON.stringify(tournaments));
    window.CluchAPI?.setStore(CAMP_KEY, tournaments);
    renderTeams();
    renderBracket();
    renderAdminPanel();
  }

  function buildAdminCard({ name, accentColor, borderColor, actions, statusLabel, statusColor }) {
    const team = teams.find(t => t.name === name);
    const logoRaw = team?.logo || 'CS';
    const logoEl = logoRaw.startsWith('<img')
      ? logoRaw
      : `<span style="font-family:'Orbitron',sans-serif;font-size:11px;font-weight:900;color:#fff;">${logoRaw}</span>`;

    const members = team?.members || [];
    const reserves = team?.reserves || [];
    const safeId = name.replace(/[^a-z0-9]/gi, '_');

    const memberRows = members.map((m, i) => {
      const isCap = m === team?.captain;
      const isVice = m === team?.vice;
      const role = isCap ? '👑 Capitão' : isVice ? '⭐ Vice' : `Titular ${i + 1}`;
      const roleColor = isCap ? '#ffd700' : isVice ? '#00d4ff' : '#718096';
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <div style="width:26px;height:26px;border-radius:50%;background:#0d1a2a;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#a0aec0;flex-shrink:0;">
            ${m.substring(0,2).toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m}</div>
            <div style="font-size:10px;color:${roleColor};">${role}</div>
          </div>
        </div>`;
    }).join('');

    const reserveRows = reserves.length ? `
      <div style="font-size:9px;font-family:'Orbitron',sans-serif;font-weight:900;color:#4a5568;letter-spacing:1px;margin:8px 0 4px;">RESERVAS</div>
      ${reserves.map(r => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
          <div style="width:22px;height:22px;border-radius:50%;background:#0a1018;border:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:9px;color:#4a5568;flex-shrink:0;">
            ${r.substring(0,2).toUpperCase()}
          </div>
          <div style="font-size:11px;color:#4a5568;">${r}</div>
        </div>`).join('')}` : '';

    const card = document.createElement('div');
    card.style.cssText = `
      border: 1px solid ${borderColor};
      border-radius: 10px;
      background: rgba(8,13,22,0.9);
      overflow: hidden;
      transition: border-color 0.2s;
    `;

    card.innerHTML = `
      <!-- Card Header Row -->
      <div style="display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:10px;padding:12px;">
        <div style="width:38px;height:38px;border-radius:8px;background:#0d1520;border:1px solid ${borderColor};display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden;flex-shrink:0;">
          ${logoEl}
        </div>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
          <div style="font-size:10px;color:#718096;margin-top:1px;">
            👑 <span style="color:${accentColor};font-weight:700;">${team?.captain || '—'}</span>
            · ${members.length}j · ${team?.region || 'SA'}
          </div>
        </div>
        <div style="font-family:'Orbitron',sans-serif;font-size:8px;font-weight:900;padding:3px 7px;border-radius:4px;background:${statusColor};color:${borderColor};white-space:nowrap;">
          ${statusLabel}
        </div>
      </div>

      <!-- Expandable Members -->
      <div style="padding:0 12px;">
        <button onclick="adminToggleMembers('${safeId}')" style="
          width:100%;display:flex;align-items:center;justify-content:space-between;
          padding:6px 0;background:none;border:none;border-top:1px solid rgba(255,255,255,0.05);
          color:#718096;cursor:pointer;font-size:10px;font-family:'Rajdhani',sans-serif;font-weight:600;
        ">
          <span>👥 Ver ${members.length} integrante${members.length !== 1 ? 's' : ''}</span>
          <span id="arrow-${safeId}" style="transition:transform 0.2s;">▼</span>
        </button>
        <div id="members-${safeId}" style="display:none;padding-bottom:10px;">
          ${members.length ? memberRows : '<div style="font-size:11px;color:#4a5568;padding:8px 0;">Nenhum membro cadastrado</div>'}
          ${reserveRows}
        </div>
      </div>

      <!-- Action Buttons -->
      ${actions}
    `;
    return card;
  }

  function renderAdminPanel() {
    const panel = document.getElementById('td-admin-panel');
    const publicBlock = document.getElementById('td-public-teams-block');
    if (!panel) return;

    // Admin sees panel, not the public block
    panel.style.display = 'block';
    if (publicBlock) publicBlock.style.display = 'none';

    const pending  = camp.pendingApprovals || [];
    const approved = camp.registeredTeams  || [];
    const rejected = camp.rejectedTeams    || [];

    const pendBadge = document.getElementById('admin-pending-badge');
    const apprBadge = document.getElementById('admin-approved-badge');
    if (pendBadge) pendBadge.textContent = pending.length;
    if (apprBadge) apprBadge.textContent = approved.length;

    // ── PENDING ──
    const pendList = document.getElementById('admin-pending-list');
    if (pendList) {
      pendList.innerHTML = '';
      if (!pending.length) {
        pendList.innerHTML = `<div style="text-align:center;padding:28px 10px;color:#4a5568;">
          <div style="font-size:28px;margin-bottom:8px;">✅</div>
          <div style="font-family:'Orbitron',sans-serif;font-size:10px;font-weight:700;">Nenhuma pendente</div>
        </div>`;
      } else {
        pending.forEach(name => {
          const actionHtml = `
            <div style="display:flex;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.05);">
              <button onclick="adminApprove('${name}')" style="
                flex:1;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;
                padding:7px 6px;border-radius:6px;cursor:pointer;border:1px solid #00ff88;
                background:rgba(0,255,136,0.08);color:#00ff88;transition:background 0.2s;
              " onmouseover="this.style.background='rgba(0,255,136,0.2)'" onmouseout="this.style.background='rgba(0,255,136,0.08)'">✓ APROVAR</button>
              <button onclick="adminReject('${name}')" style="
                flex:1;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;
                padding:7px 6px;border-radius:6px;cursor:pointer;border:1px solid #ff3333;
                background:rgba(255,51,51,0.06);color:#ff3333;transition:background 0.2s;
              " onmouseover="this.style.background='rgba(255,51,51,0.18)'" onmouseout="this.style.background='rgba(255,51,51,0.06)'">✕ REJEITAR</button>
            </div>`;
          pendList.appendChild(buildAdminCard({
            name,
            accentColor: '#ffd700',
            borderColor: 'rgba(255,215,0,0.2)',
            statusLabel: 'PENDENTE',
            statusColor: 'rgba(255,215,0,0.12)',
            actions: actionHtml
          }));
        });
      }
    }

    // ── APPROVED ──
    const apprList = document.getElementById('admin-approved-list');
    if (apprList) {
      apprList.innerHTML = '';
      if (!approved.length) {
        apprList.innerHTML = `<div style="text-align:center;padding:28px 10px;color:#4a5568;font-size:11px;">Nenhuma equipe aprovada ainda.</div>`;
      } else {
        approved.forEach(name => {
          apprList.appendChild(buildAdminCard({
            name,
            accentColor: '#00ff88',
            borderColor: 'rgba(0,255,136,0.18)',
            statusLabel: 'CONFIRMADA',
            statusColor: 'rgba(0,255,136,0.1)',
            actions: ''
          }));
        });
      }
    }

    // ── REJECTED ──
    const rejList = document.getElementById('admin-rejected-list');
    if (rejList) {
      rejList.innerHTML = '';
      if (!rejected.length) {
        rejList.innerHTML = `<div style="text-align:center;padding:28px 10px;color:#4a5568;font-size:11px;">Nenhuma equipe rejeitada.</div>`;
      } else {
        rejected.forEach(name => {
          const actionHtml = `
            <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,0.05);">
              <button onclick="adminRestore('${name}')" style="
                width:100%;font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;
                padding:7px;border-radius:6px;cursor:pointer;border:1px solid #718096;
                background:rgba(255,255,255,0.03);color:#a0aec0;transition:background 0.2s;
              " onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">↩ RESTAURAR</button>
            </div>`;
          rejList.appendChild(buildAdminCard({
            name,
            accentColor: '#718096',
            borderColor: 'rgba(255,51,51,0.12)',
            statusLabel: 'REJEITADA',
            statusColor: 'rgba(255,51,51,0.08)',
            actions: actionHtml
          }));
        });
      }
    }
  }

  window.adminToggleMembers = (safeId) => {
    const el = document.getElementById(`members-${safeId}`);
    const arrow = document.getElementById(`arrow-${safeId}`);
    if (!el) return;
    const open = el.style.display === 'none';
    el.style.display = open ? 'block' : 'none';
    if (arrow) arrow.style.transform = open ? 'rotate(180deg)' : '';
  };

  window.adminApprove = (name) => {
    camp.pendingApprovals = (camp.pendingApprovals || []).filter(t => t !== name);
    camp.registeredTeams = camp.registeredTeams || [];
    if (!camp.registeredTeams.includes(name)) camp.registeredTeams.push(name);
    showToast(`✓ ${name} aprovada no campeonato!`, '#00ff88');
    addNotification(`Equipe ${name} foi aprovada e confirmada no campeonato ${camp.name}!`);
    saveAndRefreshAll();
    allCampTeamNames.length = 0;
    [...new Set([...(camp.registeredTeams || []), ...(camp.pendingApprovals || [])])].forEach(n => allCampTeamNames.push(n));
  };

  window.adminReject = (name) => {
    camp.pendingApprovals = (camp.pendingApprovals || []).filter(t => t !== name);
    camp.rejectedTeams = camp.rejectedTeams || [];
    if (!camp.rejectedTeams.includes(name)) camp.rejectedTeams.push(name);
    showToast(`✕ ${name} foi rejeitada.`, '#ff3333');
    addNotification(`Inscrição da equipe ${name} foi recusada pelo organizador.`);
    saveAndRefreshAll();
    allCampTeamNames.length = 0;
    [...new Set([...(camp.registeredTeams || []), ...(camp.pendingApprovals || [])])].forEach(n => allCampTeamNames.push(n));
  };

  window.adminRestore = (name) => {
    camp.rejectedTeams = (camp.rejectedTeams || []).filter(t => t !== name);
    camp.pendingApprovals = camp.pendingApprovals || [];
    if (!camp.pendingApprovals.includes(name)) camp.pendingApprovals.push(name);
    showToast(`↩ ${name} movida de volta para Pendentes.`, '#ffd700');
    saveAndRefreshAll();
    allCampTeamNames.length = 0;
    [...new Set([...(camp.registeredTeams || []), ...(camp.pendingApprovals || [])])].forEach(n => allCampTeamNames.push(n));
  };

  window.adminSwitchTab = (tab) => {
    ['pending','approved','rejected'].forEach(t => {
      const content = document.getElementById(`admin-content-${t}`);
      const tabBtn = document.getElementById(`admin-tab-${t}`);
      if (content) content.style.display = t === tab ? 'block' : 'none';
      if (tabBtn) {
        const colors = { pending: '#ffd700', approved: '#00ff88', rejected: '#ff3333' };
        tabBtn.style.color = t === tab ? colors[t] : '#718096';
        tabBtn.style.borderBottom = t === tab ? `2px solid ${colors[t]}` : '2px solid transparent';
      }
    });
  };

  const btnJoinTeam = document.getElementById('td-join-team-btn');
  const btnJoinSolo = document.getElementById('td-join-solo-btn');

  if (btnJoinTeam) btnJoinTeam.addEventListener('click', joinTournament);
  if (btnJoinSolo) btnJoinSolo.addEventListener('click', joinSoloQueue);

  document.addEventListener('mousemove', event => {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });

  renderHeader();
  renderTeams();
  renderBracket();
  renderSoloQueue();
  renderAdminPanel();
});
