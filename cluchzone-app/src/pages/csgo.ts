// ═══════════════════════════════════════════════════════════
// CLUCHZONE — CS2 Tactical Arena Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { tournamentService } from '../features/tournaments/tournament.service.js';
import { teamService } from '../features/teams/team.service.js';
import { escapeHtml } from '../core/ui/sanitize.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user and load data
  authService.init();
  await Promise.all([tournamentService.loadAll(), teamService.loadAll()]);

  // DOM Elements
  const cursorGlow = document.getElementById('cursor-glow');
  const toursListContainer = document.getElementById('tours-list-container');
  const btnExploreTours = document.getElementById('btn-explore-tours');
  const tabButtons = document.querySelectorAll('.cs2-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Stats Counters
  const statActiveCamps = document.getElementById('stat-active-camps');
  const statRegisteredTeams = document.getElementById('stat-registered-teams');
  const statPlayersOnline = document.getElementById('stat-players-online');

  // Glow Follow Mouse
  document.addEventListener('mousemove', (e) => {
    if (cursorGlow) {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    }
  });

  // Tab switching
  tabButtons.forEach(btn => {
    const htmlBtn = btn as HTMLButtonElement;
    htmlBtn.addEventListener('click', () => {
      if (htmlBtn.id === 'tab-active-lobby') return;
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      htmlBtn.classList.add('active');
      const paneId = `pane-${htmlBtn.dataset.pane}`;
      const targetPane = document.getElementById(paneId);
      if (targetPane) targetPane.classList.add('active');

      const lobbyTab = document.getElementById('tab-active-lobby');
      if (lobbyTab) lobbyTab.style.display = 'none';

      if (htmlBtn.dataset.pane === 'camps') renderTournaments();
    });
  });

  // Explore button scroll
  btnExploreTours?.addEventListener('click', () => {
    const campsTab = document.querySelector('[data-pane="camps"]') as HTMLButtonElement;
    campsTab?.click();
    toursListContainer?.scrollIntoView({ behavior: 'smooth' });
  });

  // Render Tournaments
  function renderTournaments() {
    if (!toursListContainer) return;
    toursListContainer.innerHTML = '';

    const tournaments = tournamentService.loadAll();
    tournaments.then(list => {
      if (statActiveCamps) {
        statActiveCamps.textContent = String(list.filter(t => t.status !== 'Finalizado').length);
      }

      list.forEach(camp => {
        const card = document.createElement('div');
        card.className = 'cs2-card';

        const isReg = camp.status === "Registros Abertos";
        const isLive = camp.status === "Em Andamento";
        const badgeClass = isLive ? 'badge-live' : (camp.status === 'Finalizado' ? 'badge-done' : 'badge-reg');

        card.innerHTML = `
          <div class="cs2-card-banner" style="background-image: url('${camp.banner || 'images/cs2_open_pro.jpg'}')">
            <span class="cs2-card-badge ${badgeClass}">${escapeHtml(camp.status)}</span>
          </div>
          <div class="cs2-card-body">
            <h3>${escapeHtml(camp.name)}</h3>
            <div class="cs2-card-meta-list">
              <div class="cs2-meta-item">
                <span class="cs2-meta-label">Premiação</span>
                <span class="cs2-meta-val gold">${escapeHtml(camp.prize)}</span>
              </div>
              <div class="cs2-meta-item">
                <span class="cs2-meta-label">Inscrições</span>
                <span class="cs2-meta-val">${camp.registeredTeams.length}/${camp.maxTeams} Equipes</span>
              </div>
              <div class="cs2-meta-item">
                <span class="cs2-meta-label">Formato</span>
                <span class="cs2-meta-val">${escapeHtml(camp.format)}</span>
              </div>
              <div class="cs2-meta-item">
                <span class="cs2-meta-label">Região</span>
                <span class="cs2-meta-val">${escapeHtml(camp.region)}</span>
              </div>
            </div>
            <button class="btn-card-action ${isReg ? 'btn-participar' : 'btn-ver-chaves'}" data-camp-id="${camp.id}">
              ${isReg ? 'Participar / Detalhes' : 'Visualizar Chaves'}
            </button>
          </div>
        `;

        card.querySelector('.btn-card-action')?.addEventListener('click', () => {
          window.location.href = `tournament-details.html?id=${encodeURIComponent(camp.id)}`;
        });

        toursListContainer.appendChild(card);
      });
    });
  }

  // Initial stats loader
  teamService.loadAll().then(list => {
    if (statRegisteredTeams) statRegisteredTeams.textContent = String(list.length);
  });

  if (statPlayersOnline) {
    statPlayersOnline.textContent = (1200 + Math.floor(Math.random() * 80)).toLocaleString('pt-BR');
  }

  // Active lobby / Real-time updates subscription
  tournamentService.subscribe(() => {
    renderTournaments();
  });

  // Render first batch
  renderTournaments();
});
