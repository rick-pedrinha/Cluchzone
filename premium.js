/* ═══════════════════════════════════════════════════════════════
   CLUCHZONE — PREMIUM SYSTEM JS
   Assinatura Premium + Criar Campeonato (para subscribers)
   ═══════════════════════════════════════════════════════════════ */
(function() {

  /* ── PREMIUM STATE (localStorage) ── */
  let isPremium = localStorage.getItem('cluchzone_premium') === 'true';

  /* ── GAMES LIST ── */
  const GAMES = ['PUBG','CS2 / CS:GO','Brawl Stars','Valorant','Apex Legends','Rainbow Six Siege','Call of Duty: Warzone','League of Legends'];
  const FORMATS = ['Solo','Duo','Squad (4)','Squad (5)','1v1','3v3','5v5','Battle Royale'];
  const REGIONS = ['Brasil - SP','Brasil - RJ','Brasil - Sul','América do Sul','América do Norte','Europa'];
  const ENTRIES = ['Gratuito','R$ 5,00','R$ 10,00','R$ 15,00','R$ 20,00','R$ 30,00','R$ 50,00','R$ 100,00'];

  /* ── BUILD MODALS ── */
  function buildModals() {
    const html = `
    <!-- PREMIUM MODAL -->
    <div class="modal-overlay" id="modal-premium">
      <div class="modal-box">
        <button class="modal-close" data-close="modal-premium">✕</button>
        <div class="premium-header">
          <span class="premium-crown">👑</span>
          <div class="premium-title">CLUCHZONE PREMIUM</div>
          <div class="premium-sub">Eleve seu jogo. Organize seus campeonatos. Domine a plataforma.</div>
        </div>

        <div class="premium-plans">
          <div class="premium-plan" data-plan="monthly">
            <div class="plan-period">Mensal</div>
            <div class="plan-price">R$29<span>,90/mês</span></div>
            <div class="plan-saving">&nbsp;</div>
          </div>
          <div class="premium-plan recommended" data-plan="annual">
            <div class="plan-badge">⭐ MELHOR VALOR</div>
            <div class="plan-period">Anual</div>
            <div class="plan-price">R$19<span>,90/mês</span></div>
            <div class="plan-saving">Economia de R$ 120/ano</div>
          </div>
        </div>

        <div class="premium-features">
          <h4>✦ BENEFÍCIOS PREMIUM</h4>
          <div class="feature-item"><span class="feature-icon">🏆</span> Criar e gerenciar seus próprios campeonatos</div>
          <div class="feature-item"><span class="feature-icon">🛂</span> Passaporte Game com estatísticas avançadas</div>
          <div class="feature-item"><span class="feature-icon">📊</span> Dashboard de UX completo com gráficos</div>
          <div class="feature-item"><span class="feature-icon">⚡</span> Inscrição prioritária em campeonatos</div>
          <div class="feature-item"><span class="feature-icon">💬</span> Chat direto com organizadores verificados</div>
          <div class="feature-item"><span class="feature-icon">🎖️</span> Badge Premium exclusivo no perfil</div>
          <div class="feature-item"><span class="feature-icon">📣</span> Destaque do seu campeonato na home</div>
          <div class="feature-item"><span class="feature-icon">🔔</span> Notificações em tempo real</div>
        </div>

        <button class="btn-premium-subscribe" id="btn-do-subscribe">
          👑 ASSINAR PREMIUM AGORA
        </button>
        <p style="text-align:center;font-size:11px;color:#4a5568;margin-top:10px;">Cancele a qualquer momento · Sem fidelidade</p>
      </div>
    </div>

    <!-- CREATE TOURNAMENT MODAL -->
    <div class="modal-overlay" id="modal-create-tour">
      <div class="modal-box wide">
        <button class="modal-close" data-close="modal-create-tour">✕</button>
        <div class="create-tour-header">
          <div class="create-tour-icon">🏆</div>
          <div>
            <div class="create-tour-title">CRIAR CAMPEONATO</div>
            <div class="create-tour-sub">Configure e publique seu torneio para a comunidade CLUCHZONE</div>
          </div>
        </div>

        <form id="create-tour-form">
          <div class="form-grid">
            <div class="form-group full">
              <label class="form-label">Nome do Campeonato *</label>
              <input class="form-input" id="ct-name" type="text" placeholder="Ex: Copa Noturna de PUBG #5" required maxlength="60"/>
            </div>

            <div class="form-group">
              <label class="form-label">Jogo *</label>
              <select class="form-select" id="ct-game">
                ${GAMES.map(g => `<option value="${g}">${g}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Formato</label>
              <select class="form-select" id="ct-format">
                ${FORMATS.map(f => `<option value="${f}">${f}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Data do Campeonato *</label>
              <input class="form-input" id="ct-date" type="datetime-local" required/>
            </div>

            <div class="form-group">
              <label class="form-label">Região do Servidor</label>
              <select class="form-select" id="ct-region">
                ${REGIONS.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Vagas (máx. jogadores)</label>
              <input class="form-input" id="ct-slots" type="number" min="2" max="100" value="100" placeholder="100"/>
            </div>

            <div class="form-group">
              <label class="form-label">Taxa de Inscrição</label>
              <select class="form-select" id="ct-entry">
                ${ENTRIES.map(e => `<option value="${e}">${e}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Premiação Total (R$)</label>
              <input class="form-input" id="ct-prize" type="number" min="0" placeholder="Ex: 500" value="200"/>
            </div>

            <div class="form-group">
              <label class="form-label">1º Lugar (%)</label>
              <input class="form-input" id="ct-p1" type="number" min="1" max="100" value="60" placeholder="60"/>
            </div>

            <div class="form-group full" style="margin:0;"><div class="form-divider"></div></div>

            <div class="form-group full">
              <label class="form-label">Chaves / Formato de Eliminação</label>
              <div class="form-row-radio" id="ct-bracket-opts">
                <label class="radio-opt checked"><input type="radio" name="bracket" value="single" checked/>Eliminação Simples</label>
                <label class="radio-opt"><input type="radio" name="bracket" value="double"/>Eliminação Dupla</label>
                <label class="radio-opt"><input type="radio" name="bracket" value="groups"/>Fase de Grupos + KO</label>
                <label class="radio-opt"><input type="radio" name="bracket" value="br"/>Battle Royale (pontos)</label>
              </div>
            </div>

            <div class="form-group full">
              <label class="form-label">Regras do Campeonato</label>
              <textarea class="form-textarea" id="ct-rules" placeholder="Descreva as regras, como reportar resultados, conduta esperada, etc..."></textarea>
            </div>

            <div class="form-group full">
              <label class="form-label">Visibilidade</label>
              <div class="form-row-radio" id="ct-vis-opts">
                <label class="radio-opt checked"><input type="radio" name="visibility" value="public" checked/>🌐 Público</label>
                <label class="radio-opt"><input type="radio" name="visibility" value="invite"/>🔒 Somente convidados</label>
              </div>
            </div>
          </div>

          <button type="submit" class="btn-create-tour">🏆 PUBLICAR CAMPEONATO</button>
        </form>
      </div>
    </div>

    <!-- SUCCESS MODAL -->
    <div class="modal-overlay" id="modal-success">
      <div class="modal-box" style="text-align:center;">
        <div style="font-size:64px;margin-bottom:16px;">🎉</div>
        <div style="font-family:'Orbitron',sans-serif;font-size:20px;font-weight:900;color:#ffd700;margin-bottom:10px;">CAMPEONATO CRIADO!</div>
        <p style="color:#a0aec0;font-size:14px;margin-bottom:24px;" id="success-msg">Seu campeonato foi publicado e já está visível na plataforma.</p>
        <button class="btn-create-tour" style="max-width:300px;margin:0 auto;display:block;" onclick="document.getElementById('modal-success').classList.remove('open')">Fechar</button>
      </div>
    </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
  }

  /* ── HELPERS ── */
  function openModal(id) { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  /* ── UPDATE NAV ── */
  function updateNav() {
    // inject premium btn into nav-actions if not there yet
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    if (isPremium) {
      // replace any existing premium button with badge
      const existing = document.getElementById('btn-premium-nav');
      if (existing) existing.remove();
      const badge = document.createElement('button');
      badge.id = 'btn-create-tour-nav';
      badge.className = 'premium-badge-nav';
      badge.innerHTML = '👑 CRIAR CAMPEONATO';
      badge.addEventListener('click', () => openModal('modal-create-tour'));
      navActions.prepend(badge);
    } else {
      if (!document.getElementById('btn-premium-nav')) {
        const btn = document.createElement('button');
        btn.id = 'btn-premium-nav';
        btn.className = 'premium-badge-nav';
        btn.innerHTML = '👑 PREMIUM';
        btn.addEventListener('click', () => openModal('modal-premium'));
        navActions.prepend(btn);
      }
    }
  }

  /* ── INIT ── */
  function init() {
    buildModals();
    updateNav();

    /* close buttons */
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    /* click outside to close */
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    /* plan selection */
    document.querySelectorAll('.premium-plan').forEach(plan => {
      plan.addEventListener('click', () => {
        document.querySelectorAll('.premium-plan').forEach(p => p.classList.remove('recommended'));
        plan.classList.add('recommended');
      });
    });

    /* subscribe */
    const subscribeBtn = document.getElementById('btn-do-subscribe');
    if (subscribeBtn) {
      subscribeBtn.addEventListener('click', () => {
        subscribeBtn.textContent = '⏳ Processando...';
        setTimeout(() => {
          isPremium = true;
          localStorage.setItem('cluchzone_premium', 'true');
          closeModal('modal-premium');
          updateNav();
          showToast('👑 Bem-vindo ao CLUCHZONE PREMIUM! Aproveite todos os benefícios.', '#ffd700');
          subscribeBtn.textContent = '👑 ASSINAR PREMIUM AGORA';
        }, 1600);
      });
    }

    /* radio-opt style */
    document.querySelectorAll('.radio-opt input[type=radio]').forEach(radio => {
      radio.addEventListener('change', () => {
        const group = radio.closest('.form-row-radio');
        group.querySelectorAll('.radio-opt').forEach(o => o.classList.remove('checked'));
        radio.closest('.radio-opt').classList.add('checked');
      });
    });

    /* create tournament form */
    const form = document.getElementById('create-tour-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const name  = document.getElementById('ct-name')?.value  || 'Meu Campeonato';
        const game  = document.getElementById('ct-game')?.value  || 'PUBG';
        const prize = document.getElementById('ct-prize')?.value || '0';

        closeModal('modal-create-tour');
        const msgEl = document.getElementById('success-msg');
        if (msgEl) msgEl.textContent = `"${name}" de ${game} com R$${prize} em prêmios foi publicado e já está visível para a comunidade!`;
        openModal('modal-success');
      });
    }

    /* expose global open fns */
    window.openPremiumModal = () => openModal('modal-premium');
    window.openCreateTourModal = () => {
      if (!isPremium) { openModal('modal-premium'); return; }
      openModal('modal-create-tour');
    };
  }

  /* ── TOAST ── */
  function showToast(msg, color) {
    const tc = document.getElementById('toast-container') || (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;';
      document.body.appendChild(el);
      return el;
    })();
    const t = document.createElement('div');
    t.style.cssText = `padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;
      background:rgba(10,13,20,.97);border:1px solid ${color || '#00d4ff'};color:${color || '#00d4ff'};
      box-shadow:0 4px 24px rgba(0,0,0,.6);white-space:nowrap;`;
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
