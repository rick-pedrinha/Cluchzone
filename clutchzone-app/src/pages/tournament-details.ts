// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Tournament Details Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { tournamentService } from '../features/tournaments/tournament.service.js';
import { teamService } from '../features/teams/team.service.js';
import { toast } from '../core/ui/toast.js';
import type { Tournament } from '../types/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await authService.init();
  const currentNick = currentUser?.nick ?? null;
  await tournamentService.loadAll();
  const teams = await teamService.loadAll();

  const params = new URLSearchParams(window.location.search);
  const campId = params.get('id');

  if (!campId) {
    showError('Campeonato não especificado.');
    return;
  }

  const safeCampId = campId as string;
  let tournament: Tournament | null = null;

  // DOM Elements
  const tdTitle = document.getElementById('td-title');
  const tdDescription = document.getElementById('td-description');
  const tdHeroBg = document.getElementById('td-hero-bg');
  const tdPrize = document.getElementById('td-prize');
  const tdFormat = document.getElementById('td-format');
  const tdRegion = document.getElementById('td-region');
  const tdOrganizer = document.getElementById('td-organizer');
  const tdDate = document.getElementById('td-date');
  const tdSlots = document.getElementById('td-slots');
  const tdServer = document.getElementById('td-server');
  const steamLobbyAccess = document.getElementById('td-steam-lobby-access') as HTMLButtonElement | null;

  function showError(msg: string) {
    if (tdTitle) tdTitle.textContent = 'Erro';
    if (tdDescription) tdDescription.textContent = msg;
  }

  async function loadTournamentData() {
    const list = await tournamentService.loadAll();
    const found = list.find(t => String(t.id) === String(safeCampId));
    if (!found) {
      showError('Campeonato não encontrado.');
      return;
    }
    tournament = found;
    renderDetails();
  }

  function renderDetails() {
    if (!tournament) return;

    if (tdTitle) tdTitle.textContent = tournament.name;
    if (tdDescription) tdDescription.textContent = tournament.description || 'Sem descrição.';
    if (tdPrize) tdPrize.textContent = tournament.prize;
    if (tdFormat) tdFormat.textContent = `${tournament.format} - ${tournament.elimination || 'Eliminatória Simples'}`;
    if (tdRegion) tdRegion.textContent = tournament.region;
    if (tdOrganizer) {
      let displayName = '';
      try { displayName = JSON.parse(localStorage.getItem('cluchzone_profile') || '{}').displayName?.trim() || ''; } catch (_) { displayName = ''; }
      const isCurrentOrganizer = currentNick !== null && currentNick.trim().toLowerCase() === String(tournament.organizer || '').trim().toLowerCase();
      tdOrganizer.textContent = isCurrentOrganizer && displayName ? displayName : tournament.organizer;
    }
    if (tdSlots) tdSlots.textContent = `${tournament.registeredTeams.length}/${tournament.maxTeams}`;

    if (tdDate && tournament.date) {
      const dateVal = new Date(tournament.date);
      tdDate.textContent = isNaN(dateVal.getTime()) ? tournament.date : (window.ClutchGlobal?.formatDate(dateVal) || dateVal.toLocaleString(navigator.language));
    }

    if (tdHeroBg) {
      tdHeroBg.style.backgroundImage = `url('${tournament.banner || 'images/cs2_open_pro.jpg'}')`;
    }

    renderTournamentTeams();

    const lobby = tournament.steamLobby;
    const userHasApprovedTeam = teams.some(team =>
      tournament!.registeredTeams.includes(team.name) &&
      currentNick !== null && (team.captain === currentNick || team.vice === currentNick || team.members.includes(currentNick))
    );
    if (!lobby?.active || !lobby.invite) {
      if (tdServer) tdServer.textContent = 'Aguardando liberação do organizador.';
      if (steamLobbyAccess) steamLobbyAccess.style.display = 'none';
    } else if (!userHasApprovedTeam) {
      if (tdServer) tdServer.textContent = 'A sala será liberada para a sua equipe após a confirmação da inscrição.';
      if (steamLobbyAccess) steamLobbyAccess.style.display = 'none';
    } else {
      if (tdServer) tdServer.textContent = lobby.instructions || 'Sua equipe está confirmada. Entre na sala privada Steam antes da partida.';
      if (steamLobbyAccess) {
        steamLobbyAccess.style.display = 'inline-flex';
        steamLobbyAccess.textContent = /^https?:\/\//i.test(lobby.invite) ? 'ENTRAR NA SALA STEAM' : 'COPIAR CÓDIGO DA SALA';
        steamLobbyAccess.onclick = async () => {
          if (/^https?:\/\//i.test(lobby.invite)) {
            window.open(lobby.invite, '_blank', 'noopener');
            return;
          }
          try {
            await navigator.clipboard.writeText(lobby.invite);
            toast.success('Código da sala copiado. Cole-o no convite da Steam.');
          } catch (_) {
            toast.info(`Código da sala: ${lobby.invite}`);
          }
        };
      }
    }

  }

  function renderTournamentTeams() {
    if (!tournament) return;
    const list = document.getElementById('td-team-list');
    const count = document.getElementById('td-team-count');
    if (!list) return;
    const names = [...new Set([...tournament.registeredTeams, ...tournament.pendingApprovals])];
    if (count) count.textContent = `${names.length}/${tournament.maxTeams} equipes`;
    list.innerHTML = '';
    if (!names.length) {
      const empty = document.createElement('div');
      empty.className = 'td-empty';
      empty.textContent = 'Nenhuma equipe inscrita ainda.';
      list.appendChild(empty);
      return;
    }
    names.forEach(name => {
      const team = teams.find(item => item.name === name);
      const pending = tournament!.pendingApprovals.includes(name);
      const card = document.createElement('article');
      card.className = 'td-team-card';
      const logo = document.createElement('div');
      logo.className = 'td-team-logo';
      logo.textContent = team?.name.slice(0, 2).toUpperCase() || 'CS';
      const info = document.createElement('div');
      info.className = 'td-team-info';
      const title = document.createElement('strong');
      title.textContent = name;
      const captain = document.createElement('span');
      captain.textContent = `Capitão: ${team?.captain || 'Aguardando'}`;
      const size = document.createElement('small');
      size.textContent = `${team?.members.length || 0} jogadores no roster`;
      info.append(title, captain, size);
      if (team && !pending) {
        const details = document.createElement('details');
        details.className = 'cs2-roster-inventory';
        const summary = document.createElement('summary');
        summary.textContent = 'Ver elenco e inventários CS2';
        details.appendChild(summary);
        const roster = [...new Set([team.captain, ...team.members, ...team.reserves].filter(Boolean))];
        roster.forEach(playerName => {
          const playerRow = document.createElement('div');
          playerRow.className = 'cs2-roster-player';
          const playerLabel = document.createElement('span');
          playerLabel.textContent = playerName;
          const inventoryButton = document.createElement('button');
          inventoryButton.type = 'button';
          inventoryButton.className = 'cs2-inventory-trigger';
          inventoryButton.dataset.cs2TournamentId = encodeURIComponent(tournament!.id);
          inventoryButton.dataset.cs2InventoryPlayer = encodeURIComponent(playerName);
          inventoryButton.textContent = 'ARSENAL';
          playerRow.append(playerLabel, inventoryButton);
          details.appendChild(playerRow);
        });
        info.appendChild(details);
      }
      const status = document.createElement('div');
      status.className = `td-team-status ${pending ? 'pending' : 'approved'}`;
      status.textContent = pending ? 'Pendente' : 'Aprovada';
      card.append(logo, info, status);
      list.appendChild(card);
    });
  }

  // Real-time listener
  tournamentService.subscribe(() => {
    loadTournamentData();
  });

  await loadTournamentData();
});
