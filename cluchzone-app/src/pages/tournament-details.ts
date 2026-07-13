// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Tournament Details Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { tournamentService } from '../features/tournaments/tournament.service.js';
import { teamService } from '../features/teams/team.service.js';
import { modal } from '../core/ui/modal.js';
import { toast } from '../core/ui/toast.js';
import { escapeHtml } from '../core/ui/sanitize.js';
import type { Tournament, PixStatus } from '../types/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = authService.init() || authService.getGuestUser();
  await Promise.all([tournamentService.loadAll(), teamService.loadAll()]);

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
  const adminPanelContainer = document.getElementById('admin-panel-container');
  const adminTeamsList = document.getElementById('admin-teams-list');
  const editCampForm = document.getElementById('edit-camp-form') as HTMLFormElement;

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

  }

  // Real-time listener
  tournamentService.subscribe(() => {
    loadTournamentData();
  });

  await loadTournamentData();
});
