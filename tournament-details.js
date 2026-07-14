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

  function displayOrganizerName() {
    const organizer = camp.organizer || '-';
    try {
      const profile = JSON.parse(localStorage.getItem('cluchzone_profile') || '{}');
      const isCurrentUser = String(currentUser?.nick || '').trim().toLowerCase() === String(organizer).trim().toLowerCase();
      return isCurrentUser && profile.displayName?.trim() ? profile.displayName.trim() : organizer;
    } catch (_) {
      return organizer;
    }
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function renderSteamLobby() {
    const lobby = camp.steamLobby;
    const accessButton = document.getElementById('td-steam-lobby-access');
    const userHasApprovedTeam = teams.some(team =>
      (camp.registeredTeams || []).includes(team.name) &&
      (team.captain === currentUser.nick || team.vice === currentUser.nick || team.members?.includes(currentUser.nick))
    );

    if (!lobby?.active || !lobby.invite) {
      setText('td-server', 'Aguardando liberação do organizador.');
      if (accessButton) accessButton.style.display = 'none';
      return;
    }

    if (!userHasApprovedTeam) {
      setText('td-server', 'A sala será liberada para a sua equipe após a confirmação da inscrição.');
      if (accessButton) accessButton.style.display = 'none';
      return;
    }

    setText('td-server', lobby.instructions || 'Sua equipe está confirmada. Entre na sala privada Steam antes da partida.');
    if (!accessButton) return;
    accessButton.style.display = 'inline-flex';
    accessButton.textContent = /^https?:\/\//i.test(lobby.invite) ? 'ENTRAR NA SALA STEAM' : 'COPIAR CÓDIGO DA SALA';
    accessButton.onclick = async () => {
      if (/^https?:\/\//i.test(lobby.invite)) {
        window.open(lobby.invite, '_blank', 'noopener');
        return;
      }
      try {
        await navigator.clipboard.writeText(lobby.invite);
        showToast('✓ Código da sala copiado. Cole-o no convite da Steam.', '#00ff88');
      } catch (_) {
        showToast(`Código da sala: ${lobby.invite}`, '#00d4ff');
      }
    };
  }

  function renderHeader() {
    const normalizedName = String(camp.name || '').trim().toLowerCase();
    const banner = EVENT_BANNERS[normalizedName] || (String(camp.banner || '').startsWith('images/') ? camp.banner : 'images/cs2_open_pro.jpg');
    document.getElementById('td-hero-bg').style.backgroundImage = `url('${banner}')`;
    setText('td-status', camp.status || 'Registros Abertos');
    setText('td-title', camp.name || 'Campeonato CLUTCHZONE');
    setText('td-description', camp.description || camp.rules || 'Confira equipes, capitães, regras e chaveamento do campeonato.');
    setText('td-prize', camp.prize || 'R$ 0');
    setText('td-slots', `${(camp.registeredTeams || []).length}/${camp.maxTeams || 0}`);
    setText('td-format', `${camp.format || '-'}${camp.elimination ? ` - ${camp.elimination}` : ''}`);
    setText('td-region', camp.region || '-');
    setText('td-organizer', displayOrganizerName());
    setText('td-rules', camp.rules || 'Regras padrão CLUTCHZONE.');
    renderSteamLobby();
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
    const selectableTeams = teams.filter(team => team.captain === currentUser.nick || team.vice === currentUser.nick || team.members?.includes(currentUser.nick));
    const selector = document.getElementById('td-team-selector');
    const select = document.getElementById('td-team-select');
    if (!selector || !select) return;

    if (!selectableTeams.length) {
      const returnTo = encodeURIComponent(`tournament-details.html?id=${camp.id}`);
      selector.innerHTML = `
        <div style="display:grid; gap:9px; text-align:center; padding:4px 2px;">
          <span style="font-size:20px;">🛡️</span>
          <strong style="font:900 12px 'Orbitron',sans-serif; color:#fff;">VOCÊ AINDA NÃO TEM UMA EQUIPE</strong>
          <span style="font-size:13px; line-height:1.45; color:#aab6c8;">Crie sua equipe para poder concluir a inscrição neste campeonato.</span>
          <a class="cs2-btn cs2-btn-primary" href="team-create.html?returnTo=${returnTo}" style="display:flex; justify-content:center; align-items:center; min-height:40px; margin-top:3px; background:linear-gradient(135deg,#00d4ff,#6d4aff); border-color:#00d4ff; color:#fff; text-decoration:none;">＋ Criar nova equipe</a>
        </div>`;
      selector.style.display = 'block';
      return;
    }

    select.innerHTML = '<option value="">Selecione a equipe</option>';
    selectableTeams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.name;
      option.textContent = `${team.name}${team.tag ? ` [${team.tag}]` : ''}`;
      select.appendChild(option);
    });
    selector.style.display = 'block';
  }

  async function confirmTeamRegistration() {
    const select = document.getElementById('td-team-select');
    const teamName = select?.value;
    if (!teamName) {
      showToast('Selecione a equipe correta para continuar.', '#ffd700');
      return;
    }

    if ((camp.registeredTeams || []).includes(teamName) || (camp.pendingApprovals || []).includes(teamName)) {
      showToast('Sua equipe já está neste campeonato.', '#ffd700');
      return;
    }

    camp.pendingApprovals = camp.pendingApprovals || [];
    camp.pendingApprovals.push(teamName);

    await window.CluchAPI?.setStore(CAMP_KEY, tournaments);
    localStorage.setItem(CAMP_KEY, JSON.stringify(tournaments));

    allCampTeamNames.push(teamName);
    showToast('Inscrição enviada para aprovação do organizador.', '#00ff88');
    addNotification(`Inscrição da equipe ${teamName} enviada para aprovação.`);
    renderHeader();
    renderTeams();
    renderBracket();
    document.getElementById('td-team-selector').style.display = 'none';
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
    // Admin panel moved
    checkAndRenderPixPayment();
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

    const pixStatus = camp.pixStatus?.[name] || 'pendente';
    let pixBadge = '';
    if (pixStatus === 'pago') {
      pixBadge = `<span style="font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;background:rgba(0,255,136,0.1);color:#00ff88;border:1px solid rgba(0,255,136,0.25);padding:2px 6px;border-radius:4px;white-space:nowrap;margin-left:6px;">🟢 Pix Confirmado</span>`;
    } else if (pixStatus === 'enviado') {
      pixBadge = `<span style="font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;background:rgba(255,215,0,0.1);color:#ffd700;border:1px solid rgba(255,215,0,0.25);padding:2px 6px;border-radius:4px;white-space:nowrap;margin-left:6px;">🟡 Pix sob análise</span>`;
    } else {
      pixBadge = `<span style="font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;background:rgba(255,51,51,0.1);color:#ff3333;border:1px solid rgba(255,51,51,0.25);padding:2px 6px;border-radius:4px;white-space:nowrap;margin-left:6px;">🔴 Pix Pendente</span>`;
    }

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

    let receiptInspectorHtml = '';
    if (pixStatus === 'enviado') {
      receiptInspectorHtml = `
        <div style="padding:10px 12px;background:rgba(255,215,0,0.02);border-top:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="font-family:'Orbitron',sans-serif;font-size:9px;font-weight:900;color:#ffd700;letter-spacing:0.5px;margin-bottom:6px;">📄 COMPROVANTE ENVIADO PELO CAPITÃO</div>
          
          <div style="display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.25);padding:8px;border-radius:6px;border:1px solid rgba(255,215,0,0.15);margin-bottom:8px;">
            <div style="font-size:20px;">🧾</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">comprovante_pix_${safeId}.png</div>
              <div style="font-size:9px;color:#718096;">Simulado - Transferência de R$ 50,00 autorizada</div>
            </div>
            <button onclick="window.adminViewSimulatedReceipt('${name}')" style="background:rgba(255,215,0,0.1);color:#ffd700;border:1px solid rgba(255,215,0,0.3);border-radius:4px;padding:3px 8px;font-size:9px;font-weight:700;cursor:pointer;">Ver</button>
          </div>

          <div style="display:flex;gap:6px;">
            <button onclick="window.adminConfirmPix('${name}')" style="flex:1;background:rgba(0,255,136,0.12);color:#00ff88;border:1px solid rgba(0,255,136,0.25);border-radius:4px;padding:5px;font-size:10px;font-family:'Rajdhani',sans-serif;font-weight:700;cursor:pointer;">✓ Autorizar Pix</button>
            <button onclick="window.adminRejectPix('${name}')" style="flex:1;background:rgba(255,51,51,0.08);color:#ff3333;border:1px solid rgba(255,51,51,0.2);border-radius:4px;padding:5px;font-size:10px;font-family:'Rajdhani',sans-serif;font-weight:700;cursor:pointer;">✕ Recusar</button>
          </div>
        </div>
      `;
    } else if (pixStatus === 'pendente' && statusLabel === 'PENDENTE') {
      receiptInspectorHtml = `
        <div style="padding:10px 12px;background:rgba(255,255,255,0.01);border-top:1px solid rgba(255,255,255,0.05);font-size:10px;color:#718096;">
          ⏳ Aguardando envio do comprovante Pix pelo capitão da equipe.
        </div>
      `;
    }

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
          <div style="font-size:10px;color:#718096;margin-top:1px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
            👑 <span style="color:${accentColor};font-weight:700;">${team?.captain || '—'}</span>
            · ${members.length}j · ${team?.region || 'SA'}
            ${pixBadge}
            <a href="my-teams.html?teamName=${encodeURIComponent(name)}&campId=${camp.id}" style="
              display:inline-flex; align-items:center; gap:3px;
              font-family:'Orbitron',sans-serif; font-size:8px; font-weight:900;
              color:#00d4ff; border:1px solid rgba(0,212,255,0.25); background:rgba(0,212,255,0.05);
              padding:2px 6px; border-radius:4px; text-decoration:none; transition: all 0.2s;
            " onmouseover="this.style.background='rgba(0,212,255,0.15)'" onmouseout="this.style.background='rgba(0,212,255,0.05)'">
              💲 FINANCEIRO
            </a>
            <a href="my-teams.html?teamName=${encodeURIComponent(name)}" style="
              display:inline-flex; align-items:center; gap:3px;
              font-family:'Orbitron',sans-serif; font-size:8px; font-weight:900;
              color:#a0aec0; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.03);
              padding:2px 6px; border-radius:4px; text-decoration:none; transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.color='#a0aec0';">
              🛡️ VER EQUIPE
            </a>
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

      <!-- Receipt Inspector View -->
      ${receiptInspectorHtml}

      <!-- Action Buttons -->
      ${actions}
    `;
    return card;
  }

  // ── Pix Helper Functions ──
  window.copyPixKey = () => {
    const key = document.getElementById('pix-key-val')?.textContent || "45.922.015/0001-90";
    navigator.clipboard.writeText(key).then(() => {
      showToast('📋 Chave Pix copiada com sucesso!', '#ffd700');
    }).catch(() => {
      showToast('Erro ao copiar chave Pix.', '#ff3333');
    });
  };

  window.uploadSimulatedPix = (teamName, fileInput) => {
    if (!fileInput.files || !fileInput.files[0]) return;
    showToast('🧾 Enviando comprovante Pix...', '#ffd700');
    
    setTimeout(() => {
      camp.pixStatus = camp.pixStatus || {};
      camp.pixStatus[teamName] = 'enviado';
      
      saveAndRefreshAll();
      showToast('✓ Comprovante Pix enviado para análise!', '#00ff88');
      addNotification(`Comprovante de pagamento da equipe ${teamName} enviado para análise.`);
    }, 1500);
  };


  function checkAndRenderPixPayment() {
    const paymentContainer = document.getElementById('td-payment-container');
    if (!paymentContainer) return;

    if (!currentUser || !currentUser.nick) {
      paymentContainer.style.display = 'none';
      return;
    }

    const allPending = camp.pendingApprovals || [];
    const allApproved = camp.registeredTeams || [];
    
    const userTeam = teams.find(t => 
      (t.captain === currentUser.nick) && 
      (allPending.includes(t.name) || allApproved.includes(t.name))
    );

    if (!userTeam) {
      paymentContainer.style.display = 'none';
      return;
    }

    const teamName = userTeam.name;
    camp.pixStatus = camp.pixStatus || {};
    const status = camp.pixStatus[teamName] || 'pendente';

    paymentContainer.style.display = 'block';
    
    let content = '';
    if (status === 'pendente') {
      content = `
        <div style="
          background: linear-gradient(135deg, rgba(7,9,14,0.98), rgba(20,15,10,0.98));
          border: 1px solid rgba(222,155,53,0.3);
          border-radius: 12px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          margin-bottom: 24px;
        ">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span style="font-size:24px;">💸</span>
              <div>
                <h3 style="font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;color:#ffd700;letter-spacing:1px;margin:0;">PAGAMENTO DA INSCRIÇÃO VIA PIX</h3>
                <p style="font-size:11px;color:#718096;margin:2px 0 0;">Taxa de inscrição obrigatória para homologação da equipe</p>
              </div>
            </div>
            
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:14px;margin-bottom:16px;">
              <div style="font-size:12px;color:#a0aec0;line-height:1.5;">
                Sua equipe <strong style="color:#ffd700;">${teamName}</strong> está inscrita, mas o status está <span style="color:#ffd700;font-weight:700;font-family:'Orbitron',sans-serif;">PENDENTE DE APROVAÇÃO</span>.
                Para confirmar a vaga no campeonato, realize a transferência Pix correspondente à taxa de inscrição e envie o comprovante.
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:16px;">
              <div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:12px;">
                <span style="font-size:10px;color:#718096;text-transform:uppercase;font-family:'Orbitron',sans-serif;letter-spacing:0.5px;display:block;">Valor da Taxa</span>
                <strong style="font-size:20px;color:#fff;font-family:'Orbitron',sans-serif;margin-top:2px;display:block;">R$ 50,00</strong>
              </div>
              <div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:12px;">
                <span style="font-size:10px;color:#718096;text-transform:uppercase;font-family:'Orbitron',sans-serif;letter-spacing:0.5px;display:block;">Chave Pix (CNPJ)</span>
                <div style="display:flex;align-items:center;justify-content:between;gap:8px;margin-top:2px;">
                  <strong id="pix-key-val" style="font-size:13px;color:#ffd700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">45.922.015/0001-90</strong>
                  <button onclick="window.copyPixKey()" style="background:rgba(255,215,0,0.1);color:#ffd700;border:1px solid rgba(255,215,0,0.3);border-radius:4px;padding:3px 8px;font-size:9px;font-weight:700;cursor:pointer;">Copiar</button>
                </div>
              </div>
            </div>

            <div>
              <label style="font-size:10px;color:#718096;font-family:'Orbitron',sans-serif;letter-spacing:0.5px;margin-bottom:6px;display:block;">ENVIAR COMPROVANTE DE PAGAMENTO *</label>
              <div onclick="document.getElementById('pix-file-input').click()" style="
                border: 2px dashed rgba(255,215,0,0.25);
                border-radius: 8px;
                padding: 24px;
                text-align: center;
                background: rgba(255,215,0,0.01);
                cursor: pointer;
                transition: all 0.2s;
              " onmouseover="this.style.borderColor='#ffd700';this.style.background='rgba(255,215,0,0.03)';" onmouseout="this.style.borderColor='rgba(255,215,0,0.25)';this.style.background='rgba(255,215,0,0.01)';">
                <span style="font-size:28px;display:block;margin-bottom:6px;">🧾</span>
                <span style="font-size:12px;font-weight:700;color:#e2e8f0;display:block;">Arraste o comprovante ou clique para selecionar</span>
                <span style="font-size:10px;color:#718096;display:block;margin-top:2px;">Formatos aceitos: PNG, JPG, PDF (Max 5MB)</span>
                <input type="file" id="pix-file-input" style="display:none;" onchange="window.uploadSimulatedPix('${teamName}', this)" />
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (status === 'enviado') {
      content = `
        <div style="
          background: linear-gradient(135deg, rgba(7,9,14,0.98), rgba(15,15,20,0.98));
          border: 1px solid rgba(255,215,0,0.25);
          border-radius: 12px;
          padding: 24px;
          display:flex;
          align-items:center;
          gap:20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          margin-bottom: 24px;
        ">
          <div style="font-size:36px;">⏳</div>
          <div style="flex:1;">
            <h3 style="font-family:'Orbitron',sans-serif;font-size:13px;font-weight:900;color:#ffd700;letter-spacing:1px;margin:0;">COMPROVANTE ENVIADO (SOB ANÁLISE)</h3>
            <p style="font-size:12px;color:#a0aec0;margin:6px 0 0;line-height:1.5;">
              O comprovante Pix da equipe <strong style="color:#ffd700;">${teamName}</strong> foi enviado com sucesso e está sendo analisado pela organização. A inscrição será confirmada automaticamente assim que o pagamento for verificado.
            </p>
          </div>
        </div>
      `;
    } else if (status === 'pago') {
      content = `
        <div style="
          background: linear-gradient(135deg, rgba(7,9,14,0.98), rgba(10,25,15,0.98));
          border: 1px solid rgba(0,255,136,0.3);
          border-radius: 12px;
          padding: 24px;
          display:flex;
          align-items:center;
          gap:20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          margin-bottom: 24px;
        ">
          <div style="font-size:36px;">✅</div>
          <div style="flex:1;">
            <h3 style="font-family:'Orbitron',sans-serif;font-size:13px;font-weight:900;color:#00ff88;letter-spacing:1px;margin:0;">PAGAMENTO CONFIRMADO</h3>
            <p style="font-size:12px;color:#a0aec0;margin:6px 0 0;line-height:1.5;">
              Tudo certo! O pagamento Pix da equipe <strong style="color:#00ff88;">${teamName}</strong> foi autorizado pela organização. Sua vaga está garantida e o roster foi confirmado na chave oficial.
            </p>
          </div>
        </div>
      `;
    }

  }

  // ── Edit Tournament Modal logic ──
  window.openEditCampModal = () => {
    const modal = document.getElementById('modal-edit-camp');
    if (!modal) return;

    document.getElementById('edit-c-name').value = camp.name || '';
    document.getElementById('edit-c-rules').value = camp.rules || '';
    document.getElementById('edit-c-prize').value = camp.prize || '';
    document.getElementById('edit-c-slots').value = camp.maxTeams || 8;
    document.getElementById('edit-c-region').value = camp.region || 'América do Sul';
    document.getElementById('edit-c-status').value = camp.status || 'Registros Abertos';

    modal.classList.add('open');
  };

  const editCampForm = document.getElementById('edit-camp-form');
  if (editCampForm) {
    editCampForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const newName = document.getElementById('edit-c-name').value;
      const newRules = document.getElementById('edit-c-rules').value;
      const newPrize = document.getElementById('edit-c-prize').value;
      const newMaxTeams = Number(document.getElementById('edit-c-slots').value);
      const newRegion = document.getElementById('edit-c-region').value;
      const newStatus = document.getElementById('edit-c-status').value;

      camp.name = newName;
      camp.rules = newRules;
      camp.prize = newPrize;
      camp.maxTeams = newMaxTeams;
      camp.region = newRegion;
      camp.status = newStatus;

      saveAndRefreshAll();
      renderHeader();

      document.getElementById('modal-edit-camp').classList.remove('open');
      showToast('✓ Campeonato editado com sucesso!', '#00ff88');
      addNotification(`O campeonato ${newName} foi reconfigurado pelo organizador.`);
    });
  }

  window.confirmDeleteCamp = async () => {
    if (!camp) return;
    const confirm = window.confirm(`Você tem certeza que deseja excluir o campeonato "${camp.name}"? Esta ação não pode ser desfeita.`);
    if (!confirm) return;

    // Filter out this tournament
    const filtered = tournaments.filter(t => String(t.id) !== String(campId));
    
    // Save state back to Firestore
    localStorage.setItem(CAMP_KEY, JSON.stringify(filtered));
    if (window.CluchAPI?.setStore) {
      await CluchAPI.setStore(CAMP_KEY, filtered);
    }
    
    showToast('❌ Campeonato excluído com sucesso!', '#ff3333');
    setTimeout(() => {
      window.location.href = 'csgo.html';
    }, 1000);
  };

  const btnJoinTeam = document.getElementById('td-join-team-btn');
  const btnJoinSolo = document.getElementById('td-join-solo-btn');

  if (btnJoinTeam) btnJoinTeam.addEventListener('click', joinTournament);
  document.addEventListener('click', event => {
    if (event.target?.id === 'td-confirm-team-btn') confirmTeamRegistration();
  });
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
  // Admin panel moved
  checkAndRenderPixPayment();

  // ── Real-time Firebase listeners ──
  // Qualquer alteração feita por outro usuário atualiza esta página instantaneamente
  if (window.CluchAPI?.onStoreChange) {
    CluchAPI.onStoreChange(CAMP_KEY, (freshTournaments) => {
      if (!Array.isArray(freshTournaments)) return;
      const fresh = freshTournaments.find(t => String(t.id) === String(campId));
      if (!fresh) return;

      // Sync camp data in place
      Object.assign(camp, fresh);

      // Sync allCampTeamNames
      allCampTeamNames.length = 0;
      [...new Set([...(camp.registeredTeams || []), ...(camp.pendingApprovals || [])])].forEach(n => allCampTeamNames.push(n));

      renderHeader();
      renderTeams();
      renderBracket();
      renderSoloQueue();
      // Admin panel moved
      checkAndRenderPixPayment();
    });

    CluchAPI.onStoreChange(TEAM_KEY, (freshTeams) => {
      if (!Array.isArray(freshTeams)) return;
      teams = freshTeams;
      renderTeams();
      // Admin panel moved
      checkAndRenderPixPayment();
    });
  }
});

