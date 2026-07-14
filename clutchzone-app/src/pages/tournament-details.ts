// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Tournament Details Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { tournamentService } from '../features/tournaments/tournament.service.js';
import { teamService } from '../features/teams/team.service.js';
import { toast } from '../core/ui/toast.js';
import type { Tournament } from '../types/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = await authService.init() || authService.getGuestUser();
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
      const isCurrentOrganizer = String(currentUser.nick || '').trim().toLowerCase() === String(tournament.organizer || '').trim().toLowerCase();
      tdOrganizer.textContent = isCurrentOrganizer && displayName ? displayName : tournament.organizer;
    }
    if (tdSlots) tdSlots.textContent = `${tournament.registeredTeams.length}/${tournament.maxTeams}`;

    if (tdDate && tournament.date) {
      const dateVal = new Date(tournament.date);
      tdDate.textContent = isNaN(dateVal.getTime()) ? tournament.date : dateVal.toLocaleString('pt-BR');
    }

    if (tdHeroBg) {
      tdHeroBg.style.backgroundImage = `url('${tournament.banner || 'images/cs2_open_pro.jpg'}')`;
    }

    const lobby = tournament.steamLobby;
    const userHasApprovedTeam = teams.some(team =>
      tournament!.registeredTeams.includes(team.name) &&
      (team.captain === currentUser.nick || team.vice === currentUser.nick || team.members.includes(currentUser.nick))
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

  // Real-time listener
  tournamentService.subscribe(() => {
    loadTournamentData();
  });

  await loadTournamentData();
});
