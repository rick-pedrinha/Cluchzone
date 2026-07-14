// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — My Teams Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { teamService } from '../features/teams/team.service.js';
import { tournamentService } from '../features/tournaments/tournament.service.js';
import { escapeHtml } from '../core/ui/sanitize.js';
import type { Team, PixStatus } from '../types/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  authService.init();
  await Promise.all([teamService.loadAll(), tournamentService.loadAll()]);

  const params = new URLSearchParams(window.location.search);
  const teamNameParam = params.get('teamName');
  const campIdParam = params.get('campId');

  // DOM Elements
  const cursorGlow = document.getElementById('cursor-glow');
  const teamTitle = document.getElementById('team-title');
  const teamRegion = document.getElementById('team-region');
  const teamLogo = document.getElementById('team-logo');
  const teamBanner = document.getElementById('team-banner');
  const rosterList = document.getElementById('roster-list');

  // Glow Follow Mouse
  document.addEventListener('mousemove', (e) => {
    if (cursorGlow) {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    }
  });

  async function loadTeamData() {
    const teams = await teamService.loadAll();
    const activeTeam = teams.find(t => t.name === teamNameParam) || teams[0];

    if (!activeTeam) {
      if (teamTitle) teamTitle.textContent = 'Nenhuma equipe encontrada';
      return;
    }

    renderTeam(activeTeam);
  }

  function renderTeam(team: Team) {
    if (teamTitle) teamTitle.textContent = team.name;
    if (teamRegion) teamRegion.textContent = `Região: ${team.region || 'Brasil'}`;
    if (teamLogo) teamLogo.textContent = team.logo || '🛡️';
    if (teamBanner && team.banner) teamBanner.style.backgroundImage = `url('${team.banner}')`;

    // Render roster and highlight payment status
    if (rosterList) {
      rosterList.innerHTML = '';

      const members = team.members || [];

      // Load active tournament to check player payments
      tournamentService.loadAll().then(tournaments => {
        const camp = tournaments.find(t => String(t.id) === String(campIdParam));
        const playerPix = camp?.playerPixStatus?.[team.name] || {};

        members.forEach(m => {
          const isCaptain = team.captain === m;
          const status: PixStatus = playerPix[m] || 'pendente';
          const isPaid = status === 'pago';
          const badgeColor = isPaid ? '#00ff88' : '#ff3333';

          const li = document.createElement('div');
          li.className = 'roster-player-item';
          li.style.cssText = `
            display:flex; justify-content:space-between; align-items:center;
            padding:10px; border-bottom:1px solid rgba(255,255,255,0.02);
          `;
          li.innerHTML = `
            <span style="color: ${isPaid ? '#00ff88' : '#fff'}; font-weight: ${isPaid ? '700' : 'normal'};">
              ${isCaptain ? '👑 ' : ''}${escapeHtml(m)}
            </span>
            <span style="font-size:10px; color:${badgeColor}; border:1px solid ${badgeColor}; padding:2px 6px; border-radius:4px; font-weight:700;">
              ${status.toUpperCase()}
            </span>
          `;
          rosterList.appendChild(li);
        });
      });
    }
  }

  teamService.subscribe(() => {
    loadTeamData();
  });

  await loadTeamData();
});
