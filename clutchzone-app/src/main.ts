// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Application Entry Point
// ═══════════════════════════════════════════════════════════

import { authService } from './core/auth/auth-service.js';
import { tournamentService } from './features/tournaments/tournament.service.js';
import { teamService } from './features/teams/team.service.js';
import { toast } from './core/ui/toast.js';

async function bootstrap(): Promise<void> {
  // Cache buster for mock data (July 2026 update)
  if (!localStorage.getItem('cluchzone_cleared_mocks_v2')) {
      localStorage.removeItem('cluchzone_cs2_teams');
      localStorage.removeItem('cluchzone_cs2_camps');
      localStorage.setItem('cluchzone_cleared_mocks_v2', 'true');
  }

  // 1. Initialize auth session
  const user = await authService.init();
  
  if (!user) {
    console.info('[CLUTCHZONE] No session found — guest mode');
  }

  // 2. Load initial data
  try {
    await Promise.all([
      tournamentService.loadAll(),
      teamService.loadAll(),
    ]);
  } catch (err) {
    console.error('[CLUTCHZONE] Failed to load initial data:', err);
    toast.error('Erro ao carregar dados. Tente recarregar a página.');
  }

  // 3. Subscribe to real-time changes
  tournamentService.subscribe();
  teamService.subscribe();

  // 4. Clean up on unload
  window.addEventListener('beforeunload', () => {
    import('./core/api/firebase-client.js').then(({ db }) => db.destroyAll());
  });
}

bootstrap();

// Export core modules for use in legacy JS files (backward compat)
export { authService } from './core/auth/auth-service.js';
export { tournamentService } from './features/tournaments/tournament.service.js';
export { teamService } from './features/teams/team.service.js';
export { toast } from './core/ui/toast.js';
export { modal } from './core/ui/modal.js';
export { can } from './core/auth/rbac.js';
export { escapeHtml, sanitize, setText } from './core/ui/sanitize.js';
export { STORAGE_KEYS } from './core/store/keys.js';
