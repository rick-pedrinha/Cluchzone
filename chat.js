/* ═══════════════════════════════════════════════════════════════
   CLUCHZONE — CHAT WIDGET JS (shared)
   Simulates real-time room chat + organizer DM
   ═══════════════════════════════════════════════════════════════ */
(function() {
  /* ── CONFIG ── */
  const ROOM_NAME = document.querySelector('meta[name="room-name"]')?.content || 'Lobby';
  const GAME_ICON = document.querySelector('meta[name="room-icon"]')?.content || '🎮';
  const ORG_NAME  = document.querySelector('meta[name="org-name"]')?.content  || 'Organizador';

  /* ── MOCK MESSAGES ── */
  const ROOM_MSGS = [
    { nick:'xDROPx',    text:'Alguém sabe o servidor hoje?',    time: -8 },
    { nick:'BattlePro', text:'SA-SP aparentemente',             time: -7 },
    { nick:'SniperGod', text:'Que horas começa o check-in?',    time: -6 },
    { nick:ORG_NAME,    text:'Check-in abre 30min antes 🎯',    time: -5, isOrg: true },
    { nick:'GhostX',    text:'Participei semana passada, show!', time: -4 },
    { nick:'ErangelK',  text:'Qual o mapa prioritário?',        time: -3 },
    { nick:ORG_NAME,    text:'Erangel e Miramar nessa ordem ✅', time: -2, isOrg: true },
    { nick:'DesertFox', text:'Boa sorte a todos! 🔥',           time: -1 },
  ];
  const DM_MSGS = [
    { nick: ORG_NAME, text: `Olá! Sou o organizador do ${ROOM_NAME}. Como posso ajudar?`, time: -5, isOrg: true },
    { nick: ORG_NAME, text: 'Qualquer dúvida sobre regras ou premiação, é só perguntar 👍', time: -4, isOrg: true },
  ];

  function timeAgo(minutesAgo) {
    const d = new Date(Date.now() - minutesAgo * 60000);
    return d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  }
  function nowTime() { return new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); }

  /* ── BUILD HTML ── */
  function buildWidget() {
    const html = `
    <!-- CHAT TOGGLE -->
    <button id="chat-toggle-btn" aria-label="Abrir chat" title="Chat da Sala">
      💬
      <div class="chat-notif" id="chat-notif">3</div>
    </button>

    <!-- CHAT PANEL -->
    <div id="chat-panel" role="dialog" aria-label="Chat da sala">
      <div class="chat-header">
        <div class="chat-header-icon">${GAME_ICON}</div>
        <div class="chat-header-info">
          <div class="chat-header-title">${ROOM_NAME}</div>
          <div class="chat-header-sub">
            <span class="chat-online-dot"></span>
            <span id="chat-online-count">24 online</span>
          </div>
        </div>
        <button class="chat-close-btn" id="chat-close-btn">✕</button>
      </div>

      <div class="chat-tabs">
        <button class="chat-tab active" data-tab="room">🏠 Sala</button>
        <button class="chat-tab"        data-tab="dm">👑 Organizador</button>
      </div>

      <!-- ROOM TAB -->
      <div id="tab-room" class="chat-tab-content">
        <div class="organizer-alert" id="org-shortcut">
          <div class="organizer-alert-icon">📩</div>
          <div class="organizer-alert-text">
            <div class="organizer-alert-title">FALAR COM ORGANIZADOR</div>
            <div class="organizer-alert-sub">${ORG_NAME} · Online agora</div>
          </div>
          <div class="organizer-online"></div>
        </div>

        <div class="chat-messages" id="chat-messages-room"></div>

        <div class="chat-input-area">
          <input type="text" id="chat-input" placeholder="Mensagem..." maxlength="200" autocomplete="off"/>
          <button id="chat-send-btn" aria-label="Enviar">➤</button>
        </div>
      </div>

      <!-- DM TAB -->
      <div id="tab-dm" class="chat-tab-content" style="display:none; display:flex; flex-direction:column; height:100%; flex:1;">
        <div class="chat-dm-header">
          <div class="chat-dm-avatar">👑</div>
          <div class="chat-dm-name">${ORG_NAME}</div>
          <div class="chat-dm-role">Organizador Verificado</div>
          <div class="chat-dm-status">
            <span style="width:6px;height:6px;border-radius:50%;background:#00e676;display:inline-block;"></span>
            Online agora
          </div>
        </div>
        <div class="chat-messages" id="chat-messages-dm" style="flex:1;"></div>
        <div class="chat-input-area">
          <input type="text" id="chat-input-dm" placeholder="Mensagem para o organizador..." maxlength="200" autocomplete="off"/>
          <button id="chat-send-dm-btn" aria-label="Enviar">➤</button>
        </div>
      </div>
    </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
  }

  /* ── RENDER MESSAGES ── */
  function renderMsg(container, msg, isMe = false) {
    const el = document.createElement('div');
    el.className = `chat-msg${isMe ? ' mine' : ''}`;

    const initial = msg.nick.charAt(0).toUpperCase();
    const orgClass = msg.isOrg ? ' org' : '';
    const nickClass = msg.isOrg ? ' org-nick' : '';
    const textClass = msg.isOrg ? ' org-text' : '';
    const t = msg.time < 0 ? timeAgo(Math.abs(msg.time)) : nowTime();

    el.innerHTML = `
      <div class="chat-msg-avatar${orgClass}">${msg.isOrg ? '👑' : initial}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-header">
          <span class="chat-msg-nick${nickClass}">${msg.nick}</span>
          <span class="chat-msg-time">${t}</span>
        </div>
        <div class="chat-msg-text${textClass}">${msg.text}</div>
      </div>`;

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function renderSystem(container, text) {
    const el = document.createElement('div');
    el.className = 'chat-system-msg';
    el.textContent = text;
    container.appendChild(el);
  }

  /* ── INIT ── */
  function init() {
    buildWidget();

    const toggleBtn  = document.getElementById('chat-toggle-btn');
    const panel      = document.getElementById('chat-panel');
    const closeBtn   = document.getElementById('chat-close-btn');
    const notif      = document.getElementById('chat-notif');
    const tabs       = document.querySelectorAll('.chat-tab');
    const tabRoom    = document.getElementById('tab-room');
    const tabDm      = document.getElementById('tab-dm');
    const roomMsgs   = document.getElementById('chat-messages-room');
    const dmMsgs     = document.getElementById('chat-messages-dm');
    const roomInput  = document.getElementById('chat-input');
    const roomSend   = document.getElementById('chat-send-btn');
    const dmInput    = document.getElementById('chat-input-dm');
    const dmSend     = document.getElementById('chat-send-dm-btn');
    const orgShort   = document.getElementById('org-shortcut');

    let isOpen       = false;
    let activeTab    = 'room';
    let unread       = 3;

    /* load initial messages */
    renderSystem(roomMsgs, '─── Bem-vindo ao chat da sala ───');
    ROOM_MSGS.forEach(m => renderMsg(roomMsgs, m));
    DM_MSGS.forEach(m => renderMsg(dmMsgs, m));

    /* open / close */
    function openChat() {
      isOpen = true;
      panel.classList.add('open');
      toggleBtn.innerHTML = '✕';
      unread = 0;
      if (notif) notif.remove();
    }
    function closeChat() {
      isOpen = false;
      panel.classList.remove('open');
      toggleBtn.innerHTML = '💬';
    }

    toggleBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());
    closeBtn.addEventListener('click', closeChat);

    /* tabs */
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        tabRoom.style.display = activeTab === 'room' ? 'flex' : 'none';
        tabDm.style.display   = activeTab === 'dm'   ? 'flex' : 'none';
        if (activeTab === 'room') tabRoom.style.flexDirection = 'column';
        if (activeTab === 'dm')  tabDm.style.flexDirection   = 'column';
      });
    });
    // initial state
    tabRoom.style.display = 'flex'; tabRoom.style.flexDirection = 'column';
    tabDm.style.display   = 'none';

    /* organizer shortcut → switch to DM tab */
    if (orgShort) {
      orgShort.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="dm"]').classList.add('active');
        activeTab = 'dm';
        tabRoom.style.display = 'none';
        tabDm.style.display   = 'flex'; tabDm.style.flexDirection = 'column';
      });
    }

    /* send room message */
    function sendRoom() {
      const text = roomInput.value.trim();
      if (!text) return;
      renderMsg(roomMsgs, { nick: 'Você', text }, true);
      roomInput.value = '';

      // simulate reply after delay
      const replies = [
        'Boa sorte! 🔥', 'Vejo você na zona 👀', 'Vou te pegar no mapa 😏',
        'GG! Que venha o melhor', 'Estou pronto para o drop ✈️'
      ];
      setTimeout(() => {
        renderMsg(roomMsgs, {
          nick: ['xDROPx','SniperGod','GhostX'][Math.floor(Math.random()*3)],
          text: replies[Math.floor(Math.random() * replies.length)]
        });
      }, 1200 + Math.random() * 1400);
    }
    roomSend.addEventListener('click', sendRoom);
    roomInput.addEventListener('keydown', e => e.key === 'Enter' && sendRoom());

    /* send DM */
    function sendDM() {
      const text = dmInput.value.trim();
      if (!text) return;
      renderMsg(dmMsgs, { nick: 'Você', text }, true);
      dmInput.value = '';

      const orgReplies = [
        `Claro! ${text.length > 10 ? 'Deixa eu verificar isso para você.' : 'Pode deixar!'}`,
        'Entendido! Vou resolver isso agora mesmo 👍',
        'Boa pergunta! A regra é: primeiro a confirmar, garante a vaga ✅',
        'Sem problemas! Qualquer outra dúvida é só chamar 🎯',
      ];
      setTimeout(() => {
        renderMsg(dmMsgs, {
          nick: ORG_NAME, isOrg: true,
          text: orgReplies[Math.floor(Math.random() * orgReplies.length)]
        });
      }, 1500 + Math.random() * 1000);
    }
    dmSend.addEventListener('click', sendDM);
    dmInput.addEventListener('keydown', e => e.key === 'Enter' && sendDM());

    /* simulate incoming messages periodically */
    const autoMsgs = [
      { nick:'AutoPlayer1', text:'Alguém formando duo?' },
      { nick:'QuickScope',  text:'Pronto para o drop! 🪂' },
      { nick:'IronSight',   text:'Que horas abre o lobby?' },
      { nick:ORG_NAME, isOrg:true, text:'Lobby abre em 10 minutos pessoal! ✈️' },
    ];
    let autoIdx = 0;
    setInterval(() => {
      if (!isOpen || activeTab !== 'room') {
        // show notification badge
        const existing = document.getElementById('chat-notif');
        if (!existing) {
          const n = document.createElement('div');
          n.className = 'chat-notif'; n.id = 'chat-notif'; n.textContent = '!';
          toggleBtn.appendChild(n);
        }
      }
      if (isOpen && activeTab === 'room') {
        renderMsg(roomMsgs, autoMsgs[autoIdx % autoMsgs.length]);
      }
      autoIdx++;
    }, 18000);

    /* update online count randomly */
    const onlineEl = document.getElementById('chat-online-count');
    if (onlineEl) {
      setInterval(() => {
        const n = Math.floor(Math.random() * 15) + 18;
        onlineEl.textContent = `${n} online`;
      }, 8000);
    }
  }

  /* run after DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
