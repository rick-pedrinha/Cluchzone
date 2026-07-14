/* ═══════════════════════════════════════════════
   FRAG ESPORTS — JAVASCRIPT
   Interactivity, animations & micro-interactions
   ═══════════════════════════════════════════════ */

'use strict';

// Disable unload warnings
if (typeof window !== 'undefined') {
  // Prevent CSP violations
  try {
    if (window.opener) {
      window.onbeforeunload = null;
    }
  } catch (e) {
    // Ignore errors
  }
}

// ══════════════════════════════════════
// CURSOR GLOW
// ══════════════════════════════════════
const cursorGlow = document.getElementById('cursor-glow');
document.addEventListener('mousemove', (e) => {
  cursorGlow.style.left = e.clientX + 'px';
  cursorGlow.style.top  = e.clientY + 'px';
});

// ══════════════════════════════════════
// PARTICLES CANVAS
// ══════════════════════════════════════
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.r = Math.random() * 1.5 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.5 ? '0,212,255' : '123,47,247';
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 120; i++) particles.push(new Particle());

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,212,255,${0.05 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
})();

// ══════════════════════════════════════
// NAVBAR SCROLL + MOBILE MENU
// ══════════════════════════════════════
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('nav-hamburger');
const mobileMenu = document.getElementById('mobile-menu');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
  updateActiveNav();
});

hamburger && hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

document.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// Active nav link on scroll
function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const scrollY = window.scrollY + 100;
  sections.forEach(sec => {
    const id = sec.getAttribute('id');
    const link = document.querySelector(`.nav-link[data-section="${id}"]`);
    if (link) {
      const inView = scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight;
      link.classList.toggle('active', inView);
    }
  });
}

// ══════════════════════════════════════
// ANIMATED COUNTERS (HERO STATS)
// ══════════════════════════════════════
function animateCounter(el, target, prefix = '', duration = 2000) {
  const start = Date.now();
  const suffix = target >= 1000000 ? 'M' : target >= 1000 ? 'k' : '';
  const displayTarget = target >= 1000000 ? target / 1000000 : target >= 1000 ? Math.floor(target / 1000) : target;

  function step() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
    const current = Math.floor(eased * displayTarget);
    el.textContent = prefix + (window.ClutchGlobal?.formatNumber(current) || current.toLocaleString(navigator.language)) + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = prefix + (window.ClutchGlobal?.formatNumber(displayTarget) || displayTarget.toLocaleString(navigator.language)) + suffix;
  }
  step();
}

// Intersection observer for counters
const statNums = document.querySelectorAll('.stat-num[data-target]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.dataset.target);
      const prefix = el.dataset.prefix || '';
      animateCounter(el, target, prefix);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });
statNums.forEach(el => counterObserver.observe(el));

// ══════════════════════════════════════
// PROGRESS BARS ANIMATION
// ══════════════════════════════════════
function animateBars(container) {
  const bars = container.querySelectorAll('[data-w]');
  bars.forEach(bar => {
    const w = bar.dataset.w;
    setTimeout(() => { bar.style.width = w + '%'; }, 200);
  });
}

const barObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateBars(entry.target);
      barObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.passport-bars, .rep-breakdown, .career-games').forEach(el => barObserver.observe(el));

// ══════════════════════════════════════
// 3D CARD TILT (PROFILE)
// ══════════════════════════════════════
const card3d = document.getElementById('profile-card-3d');
if (card3d) {
  card3d.addEventListener('mousemove', (e) => {
    const rect = card3d.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    card3d.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
  });
  card3d.addEventListener('mouseleave', () => {
    card3d.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
  });
}

// ══════════════════════════════════════
// TOURNAMENT FILTERS
// ══════════════════════════════════════
const filterBtns = document.querySelectorAll('.filter-btn');
const tourCards  = document.querySelectorAll('.tour-card[data-game]');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    tourCards.forEach(card => {
      const show = filter === 'all' || card.dataset.game === filter;
      card.style.display = show ? 'block' : 'none';
      if (show) {
        card.style.animation = 'none';
        requestAnimationFrame(() => {
          card.style.animation = 'fadeIn 0.3s ease';
        });
      }
    });
  });
});

// ══════════════════════════════════════
// MODALS (Legacy support, disabled in favor of auth.js platform modals)
// ══════════════════════════════════════
/*
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

// Open triggers
document.getElementById('btn-login')?.addEventListener('click', () => openModal('modal-login'));
document.getElementById('btn-register')?.addEventListener('click', () => openModal('modal-register'));
document.getElementById('btn-hero-register')?.addEventListener('click', () => openModal('modal-register'));
document.getElementById('btn-create-passport')?.addEventListener('click', () => openModal('modal-register'));
document.getElementById('btn-create-team')?.addEventListener('click', () => openModal('modal-register'));

// Close triggers
document.getElementById('close-login-modal')?.addEventListener('click', () => closeModal('modal-login'));
document.getElementById('close-register-modal')?.addEventListener('click', () => closeModal('modal-register'));

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  });
});

// Switch between modals
document.getElementById('switch-to-register')?.addEventListener('click', (e) => {
  e.preventDefault(); closeModal('modal-login'); openModal('modal-register');
});
document.getElementById('switch-to-login')?.addEventListener('click', (e) => {
  e.preventDefault(); closeModal('modal-register'); openModal('modal-login');
});

// ── FORM HANDLERS ──
document.getElementById('login-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  if (!email) { showToast('Por favor, preencha todos os campos.', 'error'); return; }
  showToast('🎮 Bem-vindo de volta, Campeão!', 'success');
  closeModal('modal-login');
});

document.getElementById('register-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const nick = document.getElementById('reg-nick').value;
  if (!nick) { showToast('Escolha um nickname incrível!', 'error'); return; }
  showToast(`✅ Passaporte criado! Bem-vindo, ${nick}!`, 'success');
  closeModal('modal-register');
});
*/

// Game selection in register form
document.querySelectorAll('.game-sel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.game-sel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ══════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'none';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ══════════════════════════════════════
// INTERACTIVE BUTTONS
// ══════════════════════════════════════
// Tournament join buttons
document.querySelectorAll('.btn-join:not(.outline)').forEach(btn => {
  btn.addEventListener('click', () => {
    const tourName = btn.closest('.tour-card')?.querySelector('.tour-name')?.textContent || 'campeonato';
    showToast(`🏆 Inscrição em "${tourName}" realizada!`, 'success');
  });
});
document.querySelector('.btn-join.outline')?.addEventListener('click', () => {
  showToast('🔔 Você será notificado quando as inscrições abrirem!', 'info');
});

// Watch live buttons
document.querySelectorAll('.btn-watch').forEach(btn => {
  btn.addEventListener('click', () => showToast('📺 Abrindo transmissão ao vivo...', 'info'));
});

// Follow buttons
document.querySelectorAll('.btn-follow').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.textContent === 'Seguindo') {
      btn.textContent = 'Seguir';
      btn.style.color = '';
      btn.style.background = '';
      btn.style.borderColor = '';
    } else {
      btn.textContent = 'Seguindo';
      btn.style.color = '#00ff88';
      btn.style.background = 'rgba(0,255,136,0.1)';
      btn.style.borderColor = 'rgba(0,255,136,0.4)';
      showToast('✅ Seguindo com sucesso!', 'success');
    }
  });
});

// Like buttons
document.querySelectorAll('.fp-action.like').forEach(btn => {
  btn.addEventListener('click', () => {
    const current = parseInt(btn.textContent.replace(/\D/g, ''));
    btn.textContent = `❤️ ${current + 1}`;
    btn.style.color = '#ff2d7a';
    btn.style.borderColor = 'rgba(255,45,122,0.4)';
  });
});

// Hero Watch Live
document.getElementById('btn-hero-explore')?.addEventListener('click', () => {
  document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth' });
});

// All tournaments button
document.getElementById('btn-all-tours')?.addEventListener('click', () => {
  showToast('📋 Carregando todos os campeonatos...', 'info');
});

// Notify marketplace
document.getElementById('btn-notify-marketplace')?.addEventListener('click', () => {
  showToast('🔔 Você será o primeiro a saber quando o Marketplace abrir!', 'success');
});

// ══════════════════════════════════════
// CAREER CHART (CANVAS)
// ══════════════════════════════════════
(function drawCareerChart() {
  const canvas = document.getElementById('rankChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 400;
  const H = 200;
  canvas.width = W;
  canvas.height = H;

  // Data points: ranking position (lower = better, so we invert for display)
  const data = [4800, 4200, 3800, 3500, 2900, 2500, 2100, 1800, 1400, 1204];
  const labels = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  const pad = { t: 20, r: 20, b: 30, l: 50 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;

  function getY(val) {
    return pad.t + ((val - minVal) / range) * chartH;
  }
  function getX(i) {
    return pad.l + (i / (data.length - 1)) * chartW;
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
    ctx.stroke();
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
  grad.addColorStop(0, 'rgba(0,212,255,0.25)');
  grad.addColorStop(1, 'rgba(0,212,255,0)');

  ctx.beginPath();
  data.forEach((val, i) => {
    const x = getX(i);
    const y = getY(val);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(getX(data.length - 1), pad.t + chartH);
  ctx.lineTo(getX(0), pad.t + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,212,255,0.8)';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  data.forEach((val, i) => {
    const x = getX(i);
    const y = getY(val);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  data.forEach((val, i) => {
    const x = getX(i);
    const y = getY(val);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === data.length - 1 ? '#00d4ff' : 'rgba(0,212,255,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(5,8,17,1)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Labels
  ctx.fillStyle = 'rgba(136,146,170,0.8)';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    ctx.fillText(label, getX(i), H - 8);
  });

  // Y-axis labels
  ctx.textAlign = 'right';
  [4800, 3200, 1600].forEach(v => {
    const y = getY(v);
    ctx.fillText('#' + v.toLocaleString(), pad.l - 6, y + 4);
  });
})();

// ══════════════════════════════════════
// FADE-IN ANIMATION ON SCROLL
// ══════════════════════════════════════
const fadeStyle = document.createElement('style');
fadeStyle.textContent = `
  .fade-in { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
  .fade-in.visible { opacity: 1; transform: translateY(0); }
  .fade-in-delay-1 { transition-delay: 0.1s; }
  .fade-in-delay-2 { transition-delay: 0.2s; }
  .fade-in-delay-3 { transition-delay: 0.3s; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
`;
document.head.appendChild(fadeStyle);

// Add fade-in to various elements
const fadeTargets = [
  ...document.querySelectorAll('.tour-card'),
  ...document.querySelectorAll('.live-card'),
  ...document.querySelectorAll('.team-feat-card'),
  ...document.querySelectorAll('.feed-post'),
  ...document.querySelectorAll('.sidebar-widget'),
  ...document.querySelectorAll('.feat-item'),
  ...document.querySelectorAll('.milestone'),
  ...document.querySelectorAll('.cs-card'),
];
fadeTargets.forEach((el, i) => {
  el.classList.add('fade-in');
  if (i % 3 === 1) el.classList.add('fade-in-delay-1');
  if (i % 3 === 2) el.classList.add('fade-in-delay-2');
});

const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
fadeTargets.forEach(el => fadeObserver.observe(el));

// ══════════════════════════════════════
// AVATAR PLACEHOLDER (inline SVG)
// ══════════════════════════════════════
const passportImg = document.getElementById('passport-avatar-img');
if (passportImg) {
  // Replace with a styled text fallback
  passportImg.onerror = () => {
    passportImg.style.display = 'none';
    passportImg.parentElement.style.fontSize = '28px';
    passportImg.parentElement.textContent = '🎯';
  };
  // Trigger fallback if src is placeholder
  if (passportImg.src.includes('avatar_placeholder')) {
    passportImg.style.display = 'none';
    const parent = passportImg.parentElement;
    parent.textContent = '🎯';
  }
}

// ══════════════════════════════════════
// SCROLLING NUMBER TICKER FOR LIVE
// ══════════════════════════════════════
const liveViewers = document.querySelector('.live-viewers');
if (liveViewers) {
  setInterval(() => {
    const base = 12400;
    const delta = Math.floor(Math.random() * 200) - 100;
    const newVal = base + delta;
    liveViewers.textContent = `👁 ${(newVal / 1000).toFixed(1)}k assistindo`;
  }, 3000);
}

// ══════════════════════════════════════
// LIVE SCORE TICKER
// ══════════════════════════════════════
let scoreT1 = 14, scoreT2 = 11;
const scoreDom = document.querySelector('.score-main');
if (scoreDom) {
  setInterval(() => {
    // Random small update to make it feel live
    const team = Math.random() > 0.5 ? 1 : 2;
    if (team === 1) scoreT1 = Math.min(scoreT1, 16);
    else scoreT2 = Math.min(scoreT2 + 1, 16);
    scoreDom.innerHTML = `${scoreT1} <span class="score-sep">:</span> ${scoreT2}`;
  }, 12000);
}

// ══════════════════════════════════════
// KEYBOARD ACCESSIBILITY
// ══════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open'); document.body.style.overflow = '';
    });
    if (mobileMenu) mobileMenu.classList.remove('open');
  }
});

// ══════════════════════════════════════
// SMOOTH ANCHOR SCROLLING
// ══════════════════════════════════════
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ══════════════════════════════════════
// INITIAL WELCOME TOAST
// ══════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    showToast('🎮 Bem-vindo ao FRAG Esports! Explore a plataforma.', 'info', 4000);
  }, 1000);
});
