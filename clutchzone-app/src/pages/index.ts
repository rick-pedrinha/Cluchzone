// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Index Hub Page Controller
// ═══════════════════════════════════════════════════════════

import { authService } from '../core/auth/auth-service.js';
import { toast } from '../core/ui/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user session
  await authService.init();

  // "Em breve" cards
  const upcomingGames = ['card-val', 'card-apex', 'card-r6', 'card-cod', 'card-lol'];
  upcomingGames.forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      e.preventDefault();
      toast.info('🔵 Este jogo estará disponível em breve!');
    });
  });

  document.getElementById('btn-choose-game')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
  });

  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
      navbar.style.boxShadow = window.scrollY > 20 ? '0 4px 30px rgba(0,0,0,.5)' : '';
    }
  });
});
