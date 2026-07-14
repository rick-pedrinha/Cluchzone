// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — CS2 Tactical Arena Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { tournamentService } from '../features/tournaments/tournament.service.js';
import { teamService } from '../features/teams/team.service.js';
import { escapeHtml } from '../core/ui/sanitize.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user and load data
  const authenticatedUser = await authService.init();
  await Promise.all([tournamentService.loadAll(), teamService.loadAll()]);

  // DOM Elements
  const cursorGlow = document.getElementById('cursor-glow');
  const toursListContainer = document.getElementById('tours-list-container');
  const teamsListGrid = document.getElementById('teams-list-grid');
  const btnExploreTours = document.getElementById('btn-explore-tours');
  const tabButtons = document.querySelectorAll('.cs2-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const sessionCard = document.getElementById('cs2-session-card');
  const sessionName = document.getElementById('cs2-session-name');

  if (authenticatedUser) {
    sessionCard?.setAttribute('data-state', 'authenticated');
    if (sessionName) sessionName.textContent = `${authenticatedUser.nick} · conectado`;
  } else {
    const authState = (window as typeof window & { ClutchAuth?: { getState?: () => string } }).ClutchAuth?.getState?.();
    sessionCard?.setAttribute('data-state', authState === 'unavailable' ? 'loading' : 'anonymous');
    if (sessionName) {
      sessionName.textContent = authState === 'unavailable'
        ? 'Backend indisponível · sessão preservada'
        : 'Entre uma vez para sincronizar sua conta';
    }
  }

  // Stats Counters
  const statActiveCamps = document.getElementById('stat-active-camps');
  const statRegisteredTeams = document.getElementById('stat-registered-teams');
  const statPlayersOnline = document.getElementById('stat-players-online');
  const feeInput = document.getElementById('cs2-form-fee') as HTMLInputElement | null;
  const platformFeeInput = document.getElementById('cs2-form-platform-fee') as HTMLInputElement | null;
  const maxTeamsInput = document.getElementById('cs2-form-max-teams') as HTMLSelectElement | null;
  const prizeInput = document.getElementById('cs2-form-prize') as HTMLInputElement | null;
  const grossRevenueOutput = document.getElementById('cs2-gross-revenue');
  const platformFeeOutput = document.getElementById('cs2-platform-fee');
  const platformRateLabel = document.getElementById('cs2-platform-rate-label');
  const netPrizeOutput = document.getElementById('cs2-net-prize');
  const distributionInputs = ['p1', 'p2', 'p3'].map(place => ({
    input: document.getElementById(`cs2-form-${place}`) as HTMLInputElement | null,
    value: document.getElementById(`cs2-form-${place}-value`),
  }));
  const playersPerTeam = 5;

  function updatePrizeDistribution(): void {
    const prize = Math.max(Number(prizeInput?.value) || 0, 0);
    distributionInputs.forEach(({ input, value }) => {
      if (!input || !value) return;
      const amount = prize * Math.max(Number(input.value) || 0, 0) / 100;
      value.textContent = window.ClutchGlobal?.formatCurrency(amount * 100, 'BRL')
        || amount.toLocaleString(navigator.language, { style: 'currency', currency: 'BRL' });
    });
  }

  function updateAutomaticPrize(): void {
    if (!feeInput || !maxTeamsInput || !prizeInput) return;
    const fee = Math.max(Number(feeInput.value) || 0, 0);
    const maxTeams = Math.max(Number(maxTeamsInput.value) || 0, 0);
    const platformRate = Math.min(Math.max(Number(platformFeeInput?.value) || 0, 0), 100);
    const grossRevenue = fee * maxTeams * playersPerTeam;
    const platformFee = grossRevenue * platformRate / 100;
    const netPrize = grossRevenue - platformFee;
    prizeInput.value = netPrize.toFixed(2);
    const currency = (amount: number) => window.ClutchGlobal?.formatCurrency(amount * 100, 'BRL')
      || amount.toLocaleString(navigator.language, { style: 'currency', currency: 'BRL' });
    if (grossRevenueOutput) grossRevenueOutput.textContent = currency(grossRevenue);
    if (platformFeeOutput) platformFeeOutput.textContent = currency(platformFee);
    if (platformRateLabel) platformRateLabel.textContent = window.ClutchGlobal?.formatNumber(platformRate, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      || platformRate.toLocaleString(navigator.language, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (netPrizeOutput) netPrizeOutput.textContent = currency(netPrize);
    updatePrizeDistribution();
  }

  feeInput?.addEventListener('input', updateAutomaticPrize);
  platformFeeInput?.addEventListener('input', updateAutomaticPrize);
  maxTeamsInput?.addEventListener('change', updateAutomaticPrize);
  distributionInputs.forEach(({ input }) => input?.addEventListener('input', updatePrizeDistribution));
  updateAutomaticPrize();

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
      if (htmlBtn.dataset.pane === 'teams') void renderTeams();
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
      
      const currentUser = authService.getCurrentUser();

      list.forEach(camp => {
        const card = document.createElement('div');
        card.className = 'cs2-card';

        const isReg = camp.status === "Registros Abertos";
        const isLive = camp.status === "Em Andamento";
        const badgeClass = isLive ? 'badge-live' : (camp.status === 'Finalizado' ? 'badge-done' : 'badge-reg');
        const isAdmin = currentUser?.role === 'admin';

        card.innerHTML = `
          <div class="cs2-card-banner" style="background-image: url('${camp.banner || 'images/cs2_open_pro.jpg'}')">
            <span class="cs2-card-badge ${badgeClass}">${escapeHtml(camp.status)}</span>
          </div>
          <div class="cs2-card-body">
            <h3 class="cs2-card-title">${escapeHtml(camp.name)}</h3>
            <div class="cs2-meta-grid">
              <div class="cs2-meta-item">
                <span class="cs2-meta-label">Prêmio</span>
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
            <button class="btn-card-action ${isReg ? 'btn-participar' : 'btn-ver-chaves'}" data-camp-id="${camp.id}" style="margin-bottom: ${isAdmin ? '8px' : '0'};">
              ${isReg ? 'Participar / Detalhes' : 'Visualizar Chaves'}
            </button>
            ${isAdmin ? `
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

        card.querySelector('.btn-card-action')?.addEventListener('click', () => {
          window.location.href = `tournament-details.html?id=${encodeURIComponent(camp.id)}`;
        });
        
        if (isAdmin) {
          card.querySelector('.btn-manage-camp')?.addEventListener('click', () => {
            window.location.href = `organizer-panel.html?id=${encodeURIComponent(camp.id)}`;
          });
        }

        toursListContainer.appendChild(card);
      });
    });
  }

  async function renderTeams() {
    if (!teamsListGrid) return;

    const teams = await teamService.loadAll();
    teamsListGrid.innerHTML = '';

    teams.forEach(team => {
      const card = document.createElement('div');
      card.className = 'cs2-card';
      card.innerHTML = `
        <div class="cs2-card-banner" style="background-image: url('${team.banner || 'images/cs2_open_pro.jpg'}')"></div>
        <div class="cs2-card-body" style="text-align:center;">
          <div class="team-card-logo">${team.logo || '🛡️'}</div>
          <h3 style="margin-top:10px;">${escapeHtml(team.name)}</h3>
          <div class="cs2-card-meta-list" style="margin-top:12px;">
            <div class="cs2-meta-item"><span class="cs2-meta-label">Capitão</span><span class="cs2-meta-val">${escapeHtml(team.captain)}</span></div>
            <div class="cs2-meta-item"><span class="cs2-meta-label">Integrantes</span><span class="cs2-meta-val">${team.members.length} Jogadores</span></div>
            <div class="cs2-meta-item"><span class="cs2-meta-label">Ranking</span><span class="cs2-meta-val">#${team.ranking}</span></div>
            <div class="cs2-meta-item"><span class="cs2-meta-label">Pontos</span><span class="cs2-meta-val" style="color:var(--cs-accent-cyan);">${team.points} pts</span></div>
          </div>
          <div class="team-card-roster"><strong>Roster Principal:</strong> ${team.members.map(escapeHtml).join(', ')}</div>
          <button class="btn-card-action btn-view-team" type="button">👥 Ver equipe</button>
        </div>
      `;

      card.querySelector('.btn-view-team')?.addEventListener('click', () => {
        window.location.href = `my-teams.html?teamName=${encodeURIComponent(team.name)}`;
      });
      teamsListGrid.appendChild(card);
    });
  }

  // Initial stats loader
  teamService.loadAll().then(list => {
    if (statRegisteredTeams) statRegisteredTeams.textContent = String(list.length);
  });

  teamService.subscribe(teams => {
    if (statRegisteredTeams) statRegisteredTeams.textContent = String(teams.length);
    void renderTeams();
  });

  if (statPlayersOnline) {
    const playersOnline = 1200 + Math.floor(Math.random() * 80);
    statPlayersOnline.textContent = window.ClutchGlobal?.formatNumber(playersOnline) || playersOnline.toLocaleString(navigator.language);
  }

  // Active lobby / Real-time updates subscription
  tournamentService.subscribe(() => {
    renderTournaments();
  });

  // Render first batch
  renderTournaments();
});
