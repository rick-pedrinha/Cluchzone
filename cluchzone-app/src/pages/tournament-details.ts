// ═══════════════════════════════════════════════════════════
// CLUCHZONE — Tournament Details Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { tournamentService } from '../features/tournaments/tournament.service.js';
import { teamService } from '../features/teams/team.service.js';
import { modal } from '../core/ui/modal.js';
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
    if (tdSlots) tdSlots.textContent = `${tournament.registeredTeams.length}/${tournament.maxTeams}`;

    if (tdDate && tournament.date) {
      const dateVal = new Date(tournament.date);
      tdDate.textContent = isNaN(dateVal.getTime()) ? tournament.date : dateVal.toLocaleString('pt-BR');
    }

    if (tdHeroBg) {
      tdHeroBg.style.backgroundImage = `url('${tournament.banner || 'images/cs2_open_pro.jpg'}')`;
    }

    // Admin authorization check
    const isOrganizer = authService.isOrganizer();
    if (isOrganizer && adminPanelContainer) {
      adminPanelContainer.style.display = 'block';
      renderAdminPanel();
    } else if (adminPanelContainer) {
      adminPanelContainer.style.display = 'none';
    }
  }

  function renderAdminPanel() {
    if (!tournament || !adminTeamsList) return;
    adminTeamsList.innerHTML = '';

    const allTeams = [...new Set([...tournament.registeredTeams, ...tournament.pendingApprovals])];

    if (allTeams.length === 0) {
      adminTeamsList.innerHTML = `<div style="text-align:center;color:#718096;padding:20px 0;">Nenhuma equipe inscrita ainda.</div>`;
      return;
    }

    allTeams.forEach(name => {
      const isApproved = tournament?.registeredTeams.includes(name);
      const isPending = tournament?.pendingApprovals.includes(name);

      const card = document.createElement('div');
      card.className = 'admin-team-card';
      card.style.cssText = `
        background: #0d111d; border: 1px solid rgba(255,255,255,0.03);
        border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;
      `;

      const pixStatus: PixStatus = tournament?.pixStatus[name] || 'pendente';
      const statusColor = pixStatus === 'pago' ? '#00ff88' : (pixStatus === 'enviado' ? '#ffd700' : '#ff3333');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="margin:0; font-family:'Orbitron',sans-serif; color:#fff;">${escapeHtml(name)}</h4>
          <span style="font-size:10px; padding:3px 8px; border-radius:4px; font-weight:700; background:rgba(0,0,0,0.3); color:${statusColor}; border:1px solid ${statusColor}">
            PIX: ${pixStatus.toUpperCase()}
          </span>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px;">
          ${isPending ? `
            <button class="cs2-btn cs2-btn-success btn-approve" style="font-size:9px; padding:6px 12px;">Aprovar Roster</button>
            <button class="cs2-btn cs2-btn-danger btn-reject" style="font-size:9px; padding:6px 12px;">Recusar</button>
          ` : ''}
          ${isApproved ? `<span style="font-size:10px; color:#00ff88; font-weight:700;">🟢 Confirmado</span>` : ''}
          
          <button class="cs2-btn btn-confirm-pix" style="font-size:9px; padding:6px 12px; background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.35); color:#00d4ff;">
            Autorizar Pix
          </button>
          <a href="my-teams.html?teamName=${encodeURIComponent(name)}&campId=${tournament?.id}" style="font-size:9px; padding:6px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; text-decoration:none; border-radius:4px; text-align:center;">
            🛡️ Ver Equipe
          </a>
        </div>
      `;

      // Event bindings
      card.querySelector('.btn-approve')?.addEventListener('click', async () => {
        const ok = await tournamentService.approveTeam(safeCampId, name, currentUser.role);
        if (ok) loadTournamentData();
      });

      card.querySelector('.btn-reject')?.addEventListener('click', async () => {
        const ok = await tournamentService.rejectTeam(safeCampId, name, currentUser.role);
        if (ok) loadTournamentData();
      });

      card.querySelector('.btn-confirm-pix')?.addEventListener('click', async () => {
        const ok = await tournamentService.confirmPix(safeCampId, name, currentUser.role);
        if (ok) loadTournamentData();
      });

      adminTeamsList.appendChild(card);
    });
  }

  // Edit live form submit handler
  editCampForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!tournament) return;

    const name = (document.getElementById('edit-c-name') as HTMLInputElement).value;
    const description = (document.getElementById('edit-c-desc') as HTMLTextAreaElement).value;
    const prize = (document.getElementById('edit-c-prize') as HTMLInputElement).value;
    const maxTeams = Number((document.getElementById('edit-c-maxTeams') as HTMLInputElement).value);
    const region = (document.getElementById('edit-c-region') as HTMLInputElement).value;
    const status = (document.getElementById('edit-c-status') as HTMLSelectElement).value as any;

    const updated = await tournamentService.update(safeCampId, {
      name, description, prize, maxTeams, region, status
    }, currentUser.role);

    if (updated) {
      modal.close('modal-edit-camp');
      loadTournamentData();
    }
  });

  // Global edit modal openers
  (window as any).openEditCampModal = () => {
    if (!tournament) return;
    modal.open('modal-edit-camp');
    (document.getElementById('edit-c-name') as HTMLInputElement).value = tournament.name || '';
    (document.getElementById('edit-c-desc') as HTMLTextAreaElement).value = tournament.description || '';
    (document.getElementById('edit-c-prize') as HTMLInputElement).value = tournament.prize || '';
    (document.getElementById('edit-c-maxTeams') as HTMLInputElement).value = String(tournament.maxTeams || 8);
    (document.getElementById('edit-c-region') as HTMLInputElement).value = tournament.region || '';
    (document.getElementById('edit-c-status') as HTMLSelectElement).value = tournament.status || 'Registros Abertos';
  };

  // Real-time listener
  tournamentService.subscribe(() => {
    loadTournamentData();
  });

  await loadTournamentData();
});
