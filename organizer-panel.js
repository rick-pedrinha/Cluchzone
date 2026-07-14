'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  await window.ClutchAuth?.ready;
  const CAMP_KEY = 'cluchzone_cs2_camps';
  const TEAM_KEY = 'cluchzone_cs2_teams';
  const AUTH_KEY = 'cluchzone_auth';

  const params = new URLSearchParams(window.location.search);
  const campId = params.get('id');

  const getJson = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  };

  let tournaments = await window.CluchAPI?.getStore(CAMP_KEY, null);
  let teams = await window.CluchAPI?.getStore(TEAM_KEY, null);
  let currentUser = window.ClutchAuth?.getUser() || null;

  tournaments = Array.isArray(tournaments) ? tournaments : (getJson(CAMP_KEY) || []);
  teams = Array.isArray(teams) ? teams : (getJson(TEAM_KEY) || []);
  currentUser = currentUser || { nick: 'Jogador_Convidado', provider: 'steam', role: 'guest' };

  const camp = tournaments.find(item => String(item.id) === String(campId));
  
  if (!camp) {
    alert('Campeonato não encontrado.');
    window.location.href = 'csgo.html';
    return;
  }

  // Security Access Control
  const isOrganizer = currentUser && (currentUser.role === 'admin' || currentUser.role === 'organizer');

  if (!isOrganizer) {
    alert('Acesso negado: Você não é o organizador ou administrador deste torneio.');
    window.location.href = `tournament-details.html?id=${campId}`;
    return;
  }

  // Setup Back Link
  document.getElementById('btn-back-to-camp').href = `tournament-details.html?id=${campId}`;

  const teamByName = name => teams.find(team => team.name === name);
  const teamLogo = name => teamByName(name)?.logo || 'CS';
  const teamCaptain = name => teamByName(name)?.captain || 'Aguardando capitão';

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function renderHeader() {
    setText('op-camp-name', `Painel do Organizador - ${camp.name}`);
    setText('op-camp-meta', `Região: ${camp.region || 'América do Sul'} | slots: ${(camp.registeredTeams || []).length}/${camp.maxTeams || 8} | Formato: ${camp.format || 'MD1'}`);
    
    const badge = document.getElementById('op-status-badge');
    if (badge) {
      badge.textContent = camp.status || 'Registros Abertos';
      if (camp.status === 'Em Andamento') {
        badge.style.background = 'rgba(0, 212, 255, 0.1)';
        badge.style.color = '#00d4ff';
        badge.style.borderColor = 'rgba(0, 212, 255, 0.3)';
      } else if (camp.status === 'Finalizado') {
        badge.style.background = 'rgba(0, 255, 136, 0.08)';
        badge.style.color = '#00ff88';
        badge.style.borderColor = 'rgba(0, 255, 136, 0.25)';
      } else {
        badge.style.background = 'rgba(255, 215, 0, 0.1)';
        badge.style.color = '#ffd700';
        badge.style.borderColor = 'rgba(255, 215, 0, 0.3)';
      }
    }
  }

  function renderSteamLobbyConfig() {
    const lobby = camp.steamLobby || {};
    const invite = document.getElementById('admin-steam-invite');
    const instructions = document.getElementById('admin-steam-instructions');
    const active = document.getElementById('admin-steam-active');
    if (invite) invite.value = lobby.invite || '';
    if (instructions) instructions.value = lobby.instructions || '';
    if (active) active.checked = Boolean(lobby.active);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function getCampTeamNames() {
    return [...new Set([
      ...(camp.pendingApprovals || []),
      ...(camp.registeredTeams || []),
      ...(camp.rejectedTeams || [])
    ])];
  }

  function getPaymentRoster(team) {
    const members = [...(team?.members || [])];
    if (team?.captain && !members.includes(team.captain)) members.unshift(team.captain);
    if (team?.vice && !members.includes(team.vice)) members.push(team.vice);
    const reserves = (team?.reserves || []).filter(player => !members.includes(player));
    return [...members, ...reserves].map((player, index) => ({
      player,
      role: player === team?.captain ? 'Capitão' : player === team?.vice ? 'Vice-capitão' : members.includes(player) ? `Titular ${index + 1}` : 'Reserva'
    }));
  }

  function getPlayerPaymentStatus(teamName, player) {
    const playerPayments = camp.playerPixStatus?.[teamName] || {};
    if (Object.prototype.hasOwnProperty.call(playerPayments, player)) return playerPayments[player];
    return camp.pixStatus?.[teamName] || 'pendente';
  }

  function paymentMeta(status) {
    if (status === 'pago') return { label: 'Pago', color: '#00ff88', background: 'rgba(0,255,136,.08)', border: 'rgba(0,255,136,.25)' };
    if (status === 'enviado') return { label: 'Em análise', color: '#ffd700', background: 'rgba(255,215,0,.08)', border: 'rgba(255,215,0,.25)' };
    return { label: 'Pendente', color: '#ff6b6b', background: 'rgba(255,51,51,.08)', border: 'rgba(255,51,51,.25)' };
  }

  function registrationLabel(teamName) {
    if ((camp.registeredTeams || []).includes(teamName)) return 'Confirmada';
    if ((camp.rejectedTeams || []).includes(teamName)) return 'Recusada';
    return 'Aguardando aprovação';
  }

  function renderPayments() {
    const list = document.getElementById('admin-payments-list');
    if (!list) return;

    const summary = { pago: 0, enviado: 0, pendente: 0 };
    const reports = getCampTeamNames().map(name => {
      const team = teams.find(item => item.name === name);
      const players = getPaymentRoster(team).map(entry => ({ ...entry, status: getPlayerPaymentStatus(name, entry.player) }));
      players.forEach(entry => { summary[entry.status] = (summary[entry.status] || 0) + 1; });
      return { name, team, players };
    });

    setText('payment-count-paid', summary.pago);
    setText('payment-count-sent', summary.enviado);
    setText('payment-count-pending', summary.pendente);

    if (!reports.length) {
      list.innerHTML = `<div style="text-align:center;padding:42px 12px;border:1px dashed rgba(255,255,255,.1);border-radius:10px;color:#718096;">Nenhuma equipe inscrita neste campeonato ainda.</div>`;
      return;
    }

    list.innerHTML = reports.map(({ name, team, players }) => {
      const paid = players.filter(entry => entry.status === 'pago').length;
      const rows = players.length ? players.map(({ player, role, status }) => {
        const meta = paymentMeta(status);
        return `<tr>
          <td style="padding:10px 12px;color:#f1f5f9;font-weight:700;">${escapeHtml(player)}</td>
          <td style="padding:10px 12px;color:#718096;">${escapeHtml(role)}</td>
          <td style="padding:8px 12px;"><span style="display:inline-flex;padding:3px 7px;border-radius:999px;background:${meta.background};color:${meta.color};border:1px solid ${meta.border};font-size:10px;font-family:'Orbitron',sans-serif;font-weight:900;">${meta.label}</span></td>
          <td style="padding:7px 12px;"><select class="admin-player-payment" data-team="${encodeURIComponent(name)}" data-player="${encodeURIComponent(player)}" style="width:100%;min-width:120px;background:#0b1220;color:#e2e8f0;border:1px solid rgba(255,255,255,.12);border-radius:5px;padding:6px;font-size:11px;"><option value="pendente" ${status === 'pendente' ? 'selected' : ''}>Pendente</option><option value="enviado" ${status === 'enviado' ? 'selected' : ''}>Em análise</option><option value="pago" ${status === 'pago' ? 'selected' : ''}>Pago</option></select></td>
        </tr>`;
      }).join('') : `<tr><td colspan="4" style="padding:14px;color:#718096;">A equipe ainda não possui jogadores cadastrados.</td></tr>`;

      return `<article style="border:1px solid rgba(0,212,255,.16);border-radius:10px;overflow:hidden;background:linear-gradient(135deg,rgba(8,13,24,.96),rgba(10,18,30,.92));">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06);">
          <div><strong style="font-family:'Orbitron',sans-serif;font-size:13px;color:#fff;">${escapeHtml(name)}</strong><div style="font-size:10px;color:#718096;margin-top:3px;">Inscrição: ${registrationLabel(name)}</div></div>
          <span style="font-family:'Orbitron',sans-serif;font-size:10px;color:#00ff88;">${paid}/${players.length} JOGADORES PAGOS</span>
        </div>
        <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:560px;font-size:12px;"><thead><tr style="text-align:left;background:rgba(255,255,255,.02);color:#4f627d;font-family:'Orbitron',sans-serif;font-size:9px;"><th style="padding:9px 12px;">JOGADOR</th><th style="padding:9px 12px;">FUNÇÃO</th><th style="padding:9px 12px;">STATUS</th><th style="padding:9px 12px;">ATUALIZAR</th></tr></thead><tbody>${rows}</tbody></table></div>
      </article>`;
    }).join('');

    list.querySelectorAll('.admin-player-payment').forEach(select => {
      select.addEventListener('change', event => {
        const target = event.currentTarget;
        window.adminSetPlayerPixStatus(decodeURIComponent(target.dataset.team), decodeURIComponent(target.dataset.player), target.value);
      });
    });
  }

  function paymentReportLines() {
    const lines = [`Campeonato: ${camp.name}`, `Gerado em: ${new Date().toLocaleString('pt-BR')}`, ''];
    getCampTeamNames().forEach(name => {
      const team = teams.find(item => item.name === name);
      const roster = getPaymentRoster(team);
      lines.push(`EQUIPE: ${name} | Inscrição: ${registrationLabel(name)}`);
      if (!roster.length) lines.push('  Sem jogadores cadastrados.');
      roster.forEach(({ player, role }) => {
        lines.push(`  ${player} | ${role} | Pagamento: ${paymentMeta(getPlayerPaymentStatus(name, player)).label}`);
      });
      lines.push('');
    });
    return lines;
  }

  function pdfSafeText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?').replace(/[\\()]/g, '\\$&');
  }

  function createPaymentsPdf(lines) {
    const pageSize = 42;
    const chunks = [];
    for (let index = 0; index < lines.length; index += pageSize) chunks.push(lines.slice(index, index + pageSize));
    if (!chunks.length) chunks.push([]);

    const objects = {};
    const pageEntries = chunks.map(() => ({ pageId: 0, contentId: 0 }));
    let nextId = 4;
    pageEntries.forEach(entry => { entry.pageId = nextId++; entry.contentId = nextId++; });
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageEntries.map(entry => `${entry.pageId} 0 R`).join(' ')}] /Count ${pageEntries.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    pageEntries.forEach((entry, index) => {
      const contentLines = ['BT', '/F1 16 Tf', '48 800 Td', '(CLUTCHZONE - RELATORIO DE PAGAMENTOS) Tj', '/F1 9 Tf', '0 -22 Td', `(Pagina ${index + 1} de ${pageEntries.length}) Tj`, '0 -18 Td'];
      chunks[index].forEach(line => contentLines.push(`(${pdfSafeText(line)}) Tj`, '0 -14 Td'));
      contentLines.push('ET');
      const content = contentLines.join('\n');
      objects[entry.contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
      objects[entry.pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${entry.contentId} 0 R >>`;
    });

    let pdf = '%PDF-1.4\n% CLUTCHZONE\n';
    const offsets = [0];
    for (let id = 1; id < nextId; id += 1) {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${nextId}\n0000000000 65535 f \n`;
    for (let id = 1; id < nextId; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  window.adminSetPlayerPixStatus = (teamName, player, status) => {
    if (!['pendente', 'enviado', 'pago'].includes(status)) return;
    camp.playerPixStatus = camp.playerPixStatus || {};
    camp.playerPixStatus[teamName] = camp.playerPixStatus[teamName] || {};
    camp.playerPixStatus[teamName][player] = status;

    const team = teams.find(item => item.name === teamName);
    const roster = getPaymentRoster(team);
    const allPaid = roster.length > 0 && roster.every(entry => getPlayerPaymentStatus(teamName, entry.player) === 'pago');
    const hasPaymentInProgress = roster.some(entry => ['enviado', 'pago'].includes(getPlayerPaymentStatus(teamName, entry.player)));
    camp.pixStatus = camp.pixStatus || {};
    camp.pixStatus[teamName] = allPaid ? 'pago' : hasPaymentInProgress ? 'enviado' : 'pendente';
    saveAndRefreshAll();
    showToast(`Pagamento de ${player} atualizado para ${paymentMeta(status).label}.`, paymentMeta(status).color);
  };

  window.adminDownloadPaymentsPdf = () => {
    const report = createPaymentsPdf(paymentReportLines());
    const link = document.createElement('a');
    link.href = URL.createObjectURL(report);
    const slug = pdfSafeText(camp.name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'campeonato';
    link.download = `clutchzone-pagamentos-${slug}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast('✓ Relatório PDF baixado com os dados das equipes.', '#00ff88');
  };

  window.switchPanel = (panel) => {
    const panels = ['teams', 'matches', 'solo', 'payments', 'config'];
    panels.forEach(p => {
      const el = document.getElementById(`panel-${p}`);
      const btn = document.getElementById(`tab-btn-${p}`);
      if (el) el.style.display = p === panel ? 'block' : 'none';
      if (btn) {
        if (p === panel) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  };

  function saveAndRefreshAll() {
    localStorage.setItem(CAMP_KEY, JSON.stringify(tournaments));
    window.CluchAPI?.setStore(CAMP_KEY, tournaments);
    renderTeams();
    renderMatches();
    renderSolo();
    renderPayments();
    renderHeader();
    renderSteamLobbyConfig();
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

    const receiptInspectorHtml = pixStatus === 'enviado' ? `
      <div style="padding:10px 12px; background:rgba(255,215,0,0.02); border:1px solid rgba(255,215,0,0.15); border-radius:6px; margin:8px 12px; display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:10px; color:#ffd700; font-family:'Orbitron',sans-serif; font-weight:900;">INSPEÇÃO DE COMPROVANTE</div>
        <div style="display:flex; gap:6px;">
          <button onclick="adminConfirmPix('${name}')" style="flex:1; padding:5px; font-size:9px; font-family:'Orbitron',sans-serif; font-weight:700; background:#00ff88; border:none; color:#000; border-radius:4px; cursor:pointer;">✓ CONFIRMAR</button>
          <button onclick="adminRejectPix('${name}')" style="flex:1; padding:5px; font-size:9px; font-family:'Orbitron',sans-serif; font-weight:700; background:#ff3333; border:none; color:#fff; border-radius:4px; cursor:pointer;">✕ RECUSAR</button>
          <button onclick="adminViewSimulatedReceipt('${name}')" style="padding:5px; font-size:9px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:4px; cursor:pointer;">🔍 VER</button>
        </div>
      </div>
    ` : '';

    const card = document.createElement('article');
    card.className = 'td-team-card';
    card.style.cssText = `
      border: 1px solid ${borderColor};
      background: linear-gradient(135deg, rgba(8,12,22,0.92), rgba(13,18,30,0.92));
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(255,255,255,0.01);border-bottom:1px solid rgba(255,255,255,0.03);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="td-team-logo" style="width:34px;height:34px;font-size:12px;background:#0b111e;border-color:rgba(255,255,255,0.06);flex-shrink:0;">${logoEl}</div>
          <div>
            <div style="font-size:13px;font-weight:900;color:#fff;font-family:'Orbitron',sans-serif;">${name}</div>
            <div style="font-size:10px;color:#718096;margin-top:2px;">Capitão: ${teamCaptain(name)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${pixBadge}
          <span class="op-badge" style="background:${statusColor};color:${accentColor};border:1px solid ${borderColor};">${statusLabel}</span>
        </div>
      </div>

      <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.03);">
        <button onclick="adminToggleMembers('${safeId}')" id="btn-toggle-${safeId}" style="
          width:100%;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);
          border-radius:6px;padding:6px 10px;display:flex;justify-content:space-between;align-items:center;
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

      ${receiptInspectorHtml}
      ${actions}
    `;
    return card;
  }

  function renderTeams() {
    const pending  = camp.pendingApprovals || [];
    const approved = camp.registeredTeams  || [];
    const rejected = camp.rejectedTeams    || [];

    setText('count-pending', pending.length);
    setText('count-approved', approved.length);

    // Badges update
    const pBadge = document.getElementById('admin-pending-badge');
    const aBadge = document.getElementById('admin-approved-badge');
    if (pBadge) pBadge.textContent = pending.length;
    if (aBadge) aBadge.textContent = approved.length;

    // Pending list
    const pendList = document.getElementById('admin-pending-list');
    if (pendList) {
      pendList.innerHTML = '';
      if (!pending.length) {
        pendList.innerHTML = `<div style="text-align:center;padding:40px 10px;color:#4a5568;border: 1px dashed rgba(255,255,255,0.05);border-radius:8px;">
          <div style="font-size:32px;margin-bottom:12px;">✅</div>
          <div style="font-family:'Orbitron',sans-serif;font-size:11px;font-weight:700;">Nenhuma inscrição pendente</div>
        </div>`;
      } else {
        pending.forEach(name => {
          const isPixPaid = (camp.pixStatus?.[name] || 'pendente') === 'pago';
          const actionHtml = `
            <div style="display:flex;flex-direction:row;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,0.04);background:rgba(0,0,0,0.15);">
              <button onclick="adminApprove('${name}')" ${isPixPaid ? '' : 'disabled style="opacity:0.4; cursor:not-allowed;"'} style="
                flex:1;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:900;
                padding:8px;border-radius:6px;cursor:pointer;border:1px solid #00ff88;
                background:rgba(0,255,136,0.08);color:#00ff88;transition:background 0.2s;
              " onmouseover="if(!this.disabled) this.style.background='rgba(0,255,136,0.2)'" onmouseout="if(!this.disabled) this.style.background='rgba(0,255,136,0.08)'">✓ APROVAR INSCRIÇÃO</button>
              <button onclick="adminReject('${name}')" style="
                flex:1;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:900;
                padding:8px;border-radius:6px;cursor:pointer;border:1px solid #ff3333;
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

    // Approved list
    const apprList = document.getElementById('admin-approved-list');
    if (apprList) {
      apprList.innerHTML = '';
      if (!approved.length) {
        apprList.innerHTML = `<div style="text-align:center;padding:40px 10px;color:#4a5568;border: 1px dashed rgba(255,255,255,0.05);border-radius:8px;font-size:12px;">Nenhuma equipe aprovada até o momento.</div>`;
      } else {
        approved.forEach(name => {
          apprList.appendChild(buildAdminCard({
            name,
            accentColor: '#00ff88',
            borderColor: 'rgba(0,255,136,0.18)',
            statusLabel: 'APROVADA',
            statusColor: 'rgba(0,255,136,0.08)',
            actions: ''
          }));
        });
      }
    }

    // Rejected list
    const rejList = document.getElementById('admin-rejected-list');
    if (rejList) {
      rejList.innerHTML = '';
      if (!rejected.length) {
        rejList.innerHTML = `<div style="text-align:center;padding:40px 10px;color:#4a5568;border: 1px dashed rgba(255,255,255,0.05);border-radius:8px;font-size:12px;">Nenhuma equipe rejeitada.</div>`;
      } else {
        rejected.forEach(name => {
          const actionHtml = `
            <div style="padding:12px;border-top:1px solid rgba(255,255,255,0.04);background:rgba(0,0,0,0.15);">
              <button onclick="adminRestore('${name}')" style="
                width:100%;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:900;
                padding:8px;border-radius:6px;cursor:pointer;border:1px solid #718096;
                background:rgba(255,255,255,0.03);color:#a0aec0;transition:background 0.2s;
              " onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">↩ RESTAURAR PARA PENDENTES</button>
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

  function renderMatches() {
    const approved = camp.registeredTeams || [];
    const hasBracket = camp.bracket && camp.bracket.round1 && camp.bracket.round1.length > 0;
    const matchesList = document.getElementById('admin-matches-control-list');
    
    if (!matchesList) return;

    if (!hasBracket) {
      matchesList.innerHTML = `
        <div style="background:rgba(255,255,255,0.01); border:1px dashed rgba(255,255,255,0.08); padding:30px; border-radius:12px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:16px;">
          <div style="font-size:40px;">🎲</div>
          <p style="font-size:13px; color:#a0aec0; max-width:400px; margin:0; line-height:1.6;">O chaveamento oficial ainda não foi gerado. É recomendável aguardar o preenchimento total das vagas antes de sortear as chaves.</p>
          <button onclick="adminGenerateBracket()" style="
            font-family:'Orbitron',sans-serif; font-size:11px; font-weight:900; background:#ffd700; border:none; color:#000; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;
          ">🎲 SORTEAR CONFRONTOS & GERAR CHAVES</button>
        </div>
      `;
    } else {
      let html = '';
      const roundsList = [
        { title: 'Quartas de Final', key: 'round1' },
        { title: 'Semifinais', key: 'round2' },
        { title: 'Grande Final', key: 'round3' }
      ];

      const allPlayers = [];
      approved.forEach(tName => {
        const t = teams.find(x => x.name === tName);
        if (t) {
          (t.members || []).forEach(m => {
            if (!allPlayers.includes(m)) allPlayers.push(m);
          });
        }
      });

      roundsList.forEach(rInfo => {
        const rMatches = camp.bracket[rInfo.key] || [];
        if (!rMatches.length) return;
        html += `<h3 style="font-family:'Orbitron',sans-serif; font-size:12px; color:#00d4ff; margin:20px 0 10px; letter-spacing:1px; text-transform:uppercase; border-left:3px solid #00d4ff; padding-left:8px;">${rInfo.title}</h3>`;
        rMatches.forEach(m => {
          const isWaiting = m.teamA === 'Aguardando' || m.teamB === 'Aguardando' || m.teamA === 'Aguardando equipe' || m.teamB === 'Aguardando equipe';
          const isFinished = m.status === 'Finalizado';
          
          html += `
            <div class="admin-match-action-card" style="padding:16px;">
              <div class="match-title" style="display:flex; justify-content:space-between;">
                <span>PARTIDA #${m.id}</span>
                <span style="color:${isFinished ? '#00ff88' : isWaiting ? '#718096' : '#ffd700'}; font-size:10px;">${m.status || 'Aguardando'}</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:20px; font-size:14px; margin:10px 0;">
                <div style="text-align:right; font-weight:${m.winner === m.teamA ? '900' : 'normal'}; color:${m.winner === m.teamA ? '#00ff88' : '#fff'};">${m.teamA}</div>
                <div style="font-family:'Orbitron',sans-serif; font-size:10px; color:#718096; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px;">VS</div>
                <div style="text-align:left; font-weight:${m.winner === m.teamB ? '900' : 'normal'}; color:${m.winner === m.teamB ? '#00ff88' : '#fff'};">${m.teamB}</div>
              </div>
          `;
          
          if (!isFinished && !isWaiting) {
            html += `
              <div style="display:flex; gap:10px; align-items:center; margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.04);">
                <input type="number" id="adm-score-a-${m.id}" value="${m.scoreA || 0}" style="width:60px; text-align:center; font-size:12px; padding:6px; background:#0c101b; border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:4px; font-weight:bold;" />
                <span style="font-size:11px; color:#718096;">x</span>
                <input type="number" id="adm-score-b-${m.id}" value="${m.scoreB || 0}" style="width:60px; text-align:center; font-size:12px; padding:6px; background:#0c101b; border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:4px; font-weight:bold;" />
                
                <select id="adm-mvp-${m.id}" style="flex:1; font-size:12px; padding:6px; background:#0c101b; border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:4px;">
                  <option value="">Definir MVP da Partida...</option>
                  ${allPlayers.map(pName => `<option value="${pName}" ${m.mvp === pName ? 'selected' : ''}>${pName}</option>`).join('')}
                </select>
                
                <button onclick="adminPostScore(${m.id})" style="
                  font-family:'Orbitron',sans-serif; font-size:10px; font-weight:900; background:#ffd700; border:none; color:#000; padding:7px 16px; border-radius:4px; cursor:pointer;
                ">SALVAR PLACAR</button>
              </div>
            `;
          } else if (isWaiting) {
            html += `<div style="font-size:11px; color:#4a5568; font-style:italic; margin-top:8px; text-align:center;">Aguardando a definição das fases anteriores.</div>`;
          } else {
            html += `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#00ff88; font-weight:bold; margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.04);">
                <span>Placar Final: ${m.scoreA} x ${m.scoreB}</span>
                ${m.mvp ? `<span style="color:#ffd700; font-size:11px;">⭐ MVP: ${m.mvp}</span>` : ''}
                <span>Vencedor: ${m.winner}</span>
              </div>
            `;
          }
          html += `</div>`;
        });
      });
      
      html += `
        <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.06); padding-top:20px;">
          <button onclick="adminResetBracket()" style="
            width:100%; font-family:'Orbitron',sans-serif; font-size:10px; font-weight:900;
            color:#ff3333; border:1px solid rgba(255,51,51,0.25); background:rgba(255,51,51,0.04);
            padding:10px; border-radius:6px; cursor:pointer; transition: background 0.2s;
          " onmouseover="this.style.background='rgba(255,51,51,0.1)'" onmouseout="this.style.background='rgba(255,51,51,0.04)'">⚠️ RESETAR TODO O CHAVEAMENTO (DESTRUTIVO)</button>
        </div>
      `;
      matchesList.innerHTML = html;
    }
  }

  function renderSolo() {
    const soloPlayers = camp.soloPlayers || [];
    const soloControlList = document.getElementById('admin-solo-control-list');
    if (!soloControlList) return;

    let html = '';
    
    if (soloPlayers.length >= 5) {
      html += `
        <div style="background:rgba(168,85,247,0.06); border:1px solid rgba(168,85,247,0.2); padding:16px; border-radius:8px; display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">⚡</span>
            <strong style="color:#c084fc; font-family:'Orbitron',sans-serif; font-size:13px;">EQUIPE AUTOMÁTICA DISPONÍVEL</strong>
          </div>
          <p style="font-size:12px; color:#a0aec0; margin:0; line-height:1.5;">Temos ${soloPlayers.length} jogadores na Fila Solo. Você pode agrupar os 5 primeiros em uma nova equipe mista oficial com um clique.</p>
          <button onclick="adminMergeSoloQueue()" style="
            align-self:flex-start; font-family:'Orbitron',sans-serif; font-size:10px; font-weight:900; background:#a855f7; border:none; color:#fff; padding:8px 16px; border-radius:4px; cursor:pointer; transition:opacity 0.2s;
          " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">⚡ MESCLAR 5 JOGADORES EM NOVA EQUIPE</button>
        </div>
      `;
    }

    const approvedTeams = camp.registeredTeams || [];
    const teamsWithSlots = approvedTeams.filter(tName => {
      const t = teams.find(x => x.name === tName);
      return t && (t.members || []).length < 5;
    });

    if (!soloPlayers.length) {
      html += `<div style="font-size:12px; color:#4a5568; padding:30px; text-align:center; border: 1px dashed rgba(255,255,255,0.05); border-radius:8px;">Nenhum jogador na Fila Solo no momento.</div>`;
    } else {
      html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
      soloPlayers.forEach(player => {
        const options = teamsWithSlots.map(tName => `<option value="${tName}">${tName}</option>`).join('');
        const safePlayerId = player.replace(/[^a-z0-9]/gi, '_');
        html += `
          <div style="background:rgba(255,255,255,0.01); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.03); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-size:13px; font-weight:bold; color:#fff;">${player}</div>
              <div style="font-size:11px; color:#718096; margin-top:2px;">Aguardando vaga</div>
            </div>
            ${teamsWithSlots.length === 0 ? `
              <span style="font-size:11px; color:#4a5568; font-style:italic;">Nenhuma equipe aberta</span>
            ` : `
              <div style="display:flex; gap:8px; align-items:center;">
                <select id="adm-alloc-team-${safePlayerId}" style="font-size:12px; padding:6px; background:#0c101b; border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:4px; min-width:160px;">
                  ${options}
                </select>
                <button onclick="adminAllocateSolo('${player}')" style="
                  font-family:'Orbitron',sans-serif; font-size:10px; font-weight:900; background:#00d4ff; border:none; color:#000; padding:7px 14px; border-radius:4px; cursor:pointer;
                ">ALOCAR NA EQUIPE</button>
              </div>
            `}
          </div>
        `;
      });
      html += `</div>`;
    }
    
    soloControlList.innerHTML = html;
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
    showToast(`✓ ${name} aprovada!`, '#00ff88');
    addNotification(`Sua equipe ${name} foi confirmada no campeonato ${camp.name}!`);
    saveAndRefreshAll();
  };

  window.adminReject = (name) => {
    camp.pendingApprovals = (camp.pendingApprovals || []).filter(t => t !== name);
    camp.rejectedTeams = camp.rejectedTeams || [];
    if (!camp.rejectedTeams.includes(name)) camp.rejectedTeams.push(name);
    showToast(`✕ ${name} rejeitada.`, '#ff3333');
    addNotification(`Inscrição da equipe ${name} recusada pelo organizador.`);
    saveAndRefreshAll();
  };

  window.adminRestore = (name) => {
    camp.rejectedTeams = (camp.rejectedTeams || []).filter(t => t !== name);
    camp.pendingApprovals = camp.pendingApprovals || [];
    if (!camp.pendingApprovals.includes(name)) camp.pendingApprovals.push(name);
    showToast(`↩ ${name} restaurada.`, '#ffd700');
    saveAndRefreshAll();
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

  window.adminConfirmPix = (teamName) => {
    camp.pixStatus = camp.pixStatus || {};
    camp.pixStatus[teamName] = 'pago';
    saveAndRefreshAll();
    showToast(`✓ Pagamento Pix de ${teamName} confirmado!`, '#00ff88');
    addNotification(`O pagamento Pix da sua equipe ${teamName} foi confirmado pela organização.`);
  };

  window.adminRejectPix = (teamName) => {
    camp.pixStatus = camp.pixStatus || {};
    camp.pixStatus[teamName] = 'pendente';
    saveAndRefreshAll();
    showToast(`✕ Pagamento Pix de ${teamName} recusado.`, '#ff3333');
    addNotification(`O comprovante Pix da equipe ${teamName} foi recusado. Envie novamente.`);
  };

  window.adminViewSimulatedReceipt = (teamName) => {
    const safeId = teamName.replace(/[^a-z0-9]/gi, '_');
    showToast(`Inspecionando comprovante...`, '#00d4ff');
    alert(`[CLUTCHZONE PIX ENGINE]\nComprovante do Time: ${teamName}\nArquivo: comprovante_pix_${safeId}.png\nValor: R$ 50,00\nAutenticação: MOCK-PIX-VAL-84920492-OK`);
  };

  window.adminGenerateBracket = () => {
    const approved = camp.registeredTeams || [];
    if (approved.length < 2) {
      showToast('⚠️ Mínimo de 2 equipes aprovadas para gerar chaves!', '#ffd700');
      return;
    }

    const list = [...approved];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    const maxTeams = Number(camp.maxTeams || 8);
    while (list.length < maxTeams) {
      list.push('Aguardando equipe');
    }

    if (maxTeams <= 4) {
      camp.bracket = {
        round1: [
          { id: 1, teamA: list[0], teamB: list[1], scoreA: 0, scoreB: 0, winner: null, status: 'Aguardando', time: '19:00', maps: ['Mirage'] },
          { id: 2, teamA: list[2], teamB: list[3], scoreA: 0, scoreB: 0, winner: null, status: 'Aguardando', time: '19:45', maps: ['Inferno'] }
        ],
        round2: [
          { id: 3, teamA: 'Aguardando', teamB: 'Aguardando', scoreA: 0, scoreB: 0, winner: null, status: 'Pendente', time: '20:30', maps: [] }
        ],
        round3: []
      };
    } else {
      camp.bracket = {
        round1: [
          { id: 1, teamA: list[0], teamB: list[7], scoreA: 0, scoreB: 0, winner: null, status: 'Aguardando', time: '19:00', maps: ['Mirage'] },
          { id: 2, teamA: list[1], teamB: list[6], scoreA: 0, scoreB: 0, winner: null, status: 'Aguardando', time: '19:30', maps: ['Anubis'] },
          { id: 3, teamA: list[2], teamB: list[5], scoreA: 0, scoreB: 0, winner: null, status: 'Aguardando', time: '20:00', maps: ['Dust II'] },
          { id: 4, teamA: list[3], teamB: list[4], scoreA: 0, scoreB: 0, winner: null, status: 'Aguardando', time: '20:30', maps: ['Ancient'] }
        ],
        round2: [
          { id: 5, teamA: 'Aguardando', teamB: 'Aguardando', scoreA: 0, scoreB: 0, winner: null, status: 'Pendente', time: '21:00', maps: [] },
          { id: 6, teamA: 'Aguardando', teamB: 'Aguardando', scoreA: 0, scoreB: 0, winner: null, status: 'Pendente', time: '21:30', maps: [] }
        ],
        round3: [
          { id: 7, teamA: 'Aguardando', teamB: 'Aguardando', scoreA: 0, scoreB: 0, winner: null, status: 'Pendente', time: '22:00', maps: [] }
        ]
      };
    }

    camp.status = 'Em Andamento';
    saveAndRefreshAll();
    showToast('✓ Chaveamento oficial gerado com sucesso!', '#00ff88');
    addNotification(`O chaveamento oficial do campeonato ${camp.name} foi gerado!`);
  };

  window.adminResetBracket = () => {
    if (!confirm('Deseja REALMENTE resetar o chaveamento? Todos os placares serão apagados.')) return;
    camp.bracket = {
      round1: [],
      round2: [],
      round3: []
    };
    camp.status = 'Registros Abertos';
    saveAndRefreshAll();
    showToast('✓ Chaveamento resetado!', '#ff3333');
    addNotification(`O chaveamento do campeonato ${camp.name} foi resetado pelo organizador.`);
  };

  window.adminPostScore = (matchId) => {
    const sAInput = document.getElementById(`adm-score-a-${matchId}`);
    const sBInput = document.getElementById(`adm-score-b-${matchId}`);
    const mvpSelect = document.getElementById(`adm-mvp-${matchId}`);
    if (!sAInput || !sBInput) return;

    const scoreA = Number(sAInput.value);
    const scoreB = Number(sBInput.value);
    const mvpVal = mvpSelect ? mvpSelect.value : '';

    const r1 = camp.bracket.round1 || [];
    const r2 = camp.bracket.round2 || [];
    const r3 = camp.bracket.round3 || [];
    const match = [...r1, ...r2, ...r3].find(m => m.id === matchId);
    if (!match) return;

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.status = 'Finalizado';
    match.mvp = mvpVal;

    if (scoreA > scoreB) {
      match.winner = match.teamA;
    } else if (scoreB > scoreA) {
      match.winner = match.teamB;
    } else {
      showToast('⚠️ Empates não são permitidos em chaves eliminatórias!', '#ffd700');
      return;
    }

    const maxTeams = Number(camp.maxTeams || 8);
    if (maxTeams <= 4) {
      if (matchId === 1 || matchId === 2) {
        const finalMatch = r2.find(m => m.id === 3);
        if (finalMatch) {
          if (matchId === 1) {
            finalMatch.teamA = match.winner;
          } else {
            finalMatch.teamB = match.winner;
          }
          finalMatch.status = (finalMatch.teamA !== 'Aguardando' && finalMatch.teamB !== 'Aguardando') ? 'Aguardando' : 'Pendente';
        }
      }
    } else {
      if (matchId >= 1 && matchId <= 4) {
        const nextId = matchId <= 2 ? 5 : 6;
        const nextMatch = r2.find(m => m.id === nextId);
        if (nextMatch) {
          if (matchId % 2 === 1) {
            nextMatch.teamA = match.winner;
          } else {
            nextMatch.teamB = match.winner;
          }
          nextMatch.status = (nextMatch.teamA !== 'Aguardando' && nextMatch.teamB !== 'Aguardando') ? 'Aguardando' : 'Pendente';
        }
      } else if (matchId === 5 || matchId === 6) {
        const finalMatch = r3.find(m => m.id === 7);
        if (finalMatch) {
          if (matchId === 5) {
            finalMatch.teamA = match.winner;
          } else {
            finalMatch.teamB = match.winner;
          }
          finalMatch.status = (finalMatch.teamA !== 'Aguardando' && finalMatch.teamB !== 'Aguardando') ? 'Aguardando' : 'Pendente';
        }
      }
    }

    saveAndRefreshAll();
    showToast(`✓ Partida #${matchId} atualizada!`, '#00ff88');
    addNotification(`Placar da partida #${matchId} atualizado: ${match.teamA} ${scoreA} x ${scoreB} ${match.teamB}.`);
  };

  window.adminAllocateSolo = (player) => {
    const safePlayerId = player.replace(/[^a-z0-9]/gi, '_');
    const select = document.getElementById(`adm-alloc-team-${safePlayerId}`);
    if (!select) return;
    const teamName = select.value;
    if (!teamName) return;

    const team = teams.find(t => t.name === teamName);
    if (!team) return;

    team.members = team.members || [];
    team.members.push(player);

    camp.soloPlayers = (camp.soloPlayers || []).filter(p => p !== player);

    localStorage.setItem(TEAM_KEY, JSON.stringify(teams));
    window.CluchAPI?.setStore(TEAM_KEY, teams);
    saveAndRefreshAll();
    showToast(`✓ ${player} alocado na equipe ${teamName}!`, '#00ff88');
    addNotification(`O jogador ${player} foi alocado no roster da equipe ${teamName}.`);
  };

  window.adminMergeSoloQueue = () => {
    const solo = camp.soloPlayers || [];
    if (solo.length < 5) {
      showToast('⚠️ Mínimo de 5 jogadores necessários na fila!', '#ffd700');
      return;
    }

    const members = solo.slice(0, 5);
    const teamName = `SoloForce Team ${Math.floor(100 + Math.random() * 900)}`;
    const captain = members[0];

    const newTeam = {
      logo: '🛡️',
      banner: 'images/cs2_bg.jpg',
      name: teamName,
      captain: captain,
      vice: members[1] || '',
      members: members,
      reserves: [],
      stats: '0-0',
      history: [],
      ranking: teams.length + 1,
      points: 0
    };

    teams.push(newTeam);
    camp.registeredTeams = camp.registeredTeams || [];
    camp.registeredTeams.push(teamName);
    camp.soloPlayers = solo.slice(5);

    localStorage.setItem(TEAM_KEY, JSON.stringify(teams));
    window.CluchAPI?.setStore(TEAM_KEY, teams);
    saveAndRefreshAll();
    showToast(`✓ Equipe ${teamName} formada!`, '#00ff88');
    addNotification(`Nova equipe [${teamName}] formada com jogadores da Fila Solo.`);
  };

  window.adminSaveSteamLobby = () => {
    const invite = document.getElementById('admin-steam-invite').value.trim();
    const instructions = document.getElementById('admin-steam-instructions').value.trim();
    const active = document.getElementById('admin-steam-active').checked;

    if (!invite) {
      showToast('⚠️ Cole o link ou código de convite da Steam!', '#ffd700');
      return;
    }

    camp.steamLobby = { invite, instructions, active };

    saveAndRefreshAll();
    showToast('✓ Sala privada Steam atualizada!', '#00ff88');
    if (active) {
      addNotification(`A sala privada Steam do campeonato ${camp.name} foi liberada para as equipes confirmadas.`);
    }
  };

  window.adminCloseTournament = () => {
    if (!confirm('Deseja realmente finalizar o campeonato?')) return;
    camp.status = 'Finalizado';
    saveAndRefreshAll();
    showToast('🏆 Campeonato finalizado!', '#00ff88');
    addNotification(`O campeonato ${camp.name} foi finalizado.`);
  };

  window.adminDeleteTournament = () => {
    if (!confirm('⚠️ Deseja REALMENTE excluir este campeonato permanentemente? Todos os dados associados serão perdidos e esta ação NÃO pode ser desfeita.')) return;

    // Remove from tournaments array
    tournaments = tournaments.filter(t => String(t.id) !== String(campId));

    // Save to stores
    localStorage.setItem(CAMP_KEY, JSON.stringify(tournaments));
    window.CluchAPI?.setStore(CAMP_KEY, tournaments);

    addNotification(`O campeonato ${camp.name} foi excluído da plataforma.`);
    
    alert('Campeonato excluído com sucesso.');
    window.location.href = 'csgo.html';
  };

  // Modal helpers
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

      document.getElementById('modal-edit-camp').classList.remove('open');
      showToast('✓ Torneio atualizado!', '#00ff88');
      addNotification(`O campeonato ${newName} foi reconfigurado pelo organizador.`);
    });
  }

  document.addEventListener('mousemove', event => {
    const glow = document.getElementById('cursor-glow');
    if (!glow) return;
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });

  // Initial render calls
  renderHeader();
  renderTeams();
  renderMatches();
  renderSolo();
  renderPayments();
  renderSteamLobbyConfig();

  // Switch to teams tab by default
  switchPanel('teams');

  // Real-time synchronization
  if (window.CluchAPI?.onStoreChange) {
    CluchAPI.onStoreChange(CAMP_KEY, (freshTournaments) => {
      if (!Array.isArray(freshTournaments)) return;
      const fresh = freshTournaments.find(t => String(t.id) === String(campId));
      if (!fresh) return;
      Object.assign(camp, fresh);
      renderHeader();
      renderTeams();
      renderMatches();
      renderSolo();
      renderPayments();
      renderSteamLobbyConfig();
    });

    CluchAPI.onStoreChange(TEAM_KEY, (freshTeams) => {
      if (!Array.isArray(freshTeams)) return;
      teams = freshTeams;
      renderTeams();
      renderMatches();
      renderSolo();
      renderPayments();
    });
  }
});
