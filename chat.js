(function () {
  'use strict';

  const ROOM_NAME = document.querySelector('meta[name="room-name"]')?.content || 'Lobby CLUTCHZONE';
  const GAME_ICON = document.querySelector('meta[name="room-icon"]')?.content || '🎮';
  const ORG_NAME = document.querySelector('meta[name="org-name"]')?.content || 'Organizador';
  const SOCIAL_KEY = 'cluchzone_social_network_v1';
  const AUTH_KEY = 'cluchzone_auth';
  const TEAM_KEY = 'cluchzone_cs2_teams';
  const HIDDEN_TEAM_CHATS_KEY = 'cluchzone_hidden_team_chats';

  let social = { profiles: [], friendships: [], conversations: [], teamChats: [] };
  let currentUser = null;
  let activeConversationId = null;
  let activeTeamName = null;
  let userTeams = [];
  let hiddenTeamChats = new Set();
  let activeTab = 'room';
  let isOpen = false;
  let serverSocialAvailable = null;

  const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const userKey = nick => String(nick || '').trim().toLowerCase();
  const timeLabel = timestamp => new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const relativeTime = timestamp => {
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
    return `${Math.floor(minutes / 1440)} d`;
  };

  function getAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (_) { return null; }
  }

  function loadHiddenTeamChats() {
    try { hiddenTeamChats = new Set(JSON.parse(localStorage.getItem(HIDDEN_TEAM_CHATS_KEY) || '[]')); } catch (_) { hiddenTeamChats = new Set(); }
  }

  function hideTeamChatShortcut(teamName) {
    hiddenTeamChats.add(userKey(teamName));
    localStorage.setItem(HIDDEN_TEAM_CHATS_KEY, JSON.stringify([...hiddenTeamChats]));
    renderTeamButtons();
  }

  function getProfileAvatar() {
    try { return JSON.parse(localStorage.getItem('cluchzone_profile') || '{}').avatar || ''; } catch (_) { return ''; }
  }

  function buildWidget() {
    const wrapper = document.createElement('div');
    wrapper.id = 'clutch-social-widget';
    wrapper.innerHTML = `
      <div id="team-chat-buttons" aria-label="Chats das minhas equipes"></div>
      <button id="chat-toggle-btn" aria-label="Abrir bate-papo com a comunidade" title="Bate-papo com a comunidade"><span class="chat-toggle-icon">💬</span><span class="chat-toggle-copy"><strong>Bate-papo</strong><small>Comunidade ao vivo</small></span><span class="chat-notif" id="chat-notif">3</span></button>
      <section id="chat-panel" role="dialog" aria-label="Bate-papo CLUTCHZONE">
        <header class="chat-header">
          <div class="chat-header-icon">${GAME_ICON}</div>
          <div class="chat-header-info"><strong class="chat-header-title">CLUTCH SOCIAL</strong><span class="chat-header-sub"><i class="chat-online-dot"></i><span id="chat-online-count">Conectando...</span></span></div>
          <button class="chat-close-btn" id="chat-close-btn" aria-label="Fechar">×</button>
        </header>
        <nav class="chat-tabs" aria-label="Seções do chat">
          <button class="chat-tab active" data-tab="room">🏠 Sala</button>
          <button class="chat-tab" data-tab="social">👥 Amigos <span class="social-request-badge" id="social-request-badge" hidden>0</span></button>
          <button class="chat-tab" id="team-chat-tab" data-tab="team" style="display:none">🛡 Equipes</button>
          <button class="chat-tab" data-tab="dm">🏆 Org.</button>
        </nav>
        <div id="tab-room" class="chat-tab-content">
          <button class="organizer-alert" id="org-shortcut" type="button"><span class="organizer-alert-icon">📨</span><span class="organizer-alert-text"><b class="organizer-alert-title">FALAR COM ORGANIZADOR</b><small class="organizer-alert-sub">${escapeHtml(ORG_NAME)} · Online agora</small></span><i class="organizer-online"></i></button>
          <div class="chat-messages" id="chat-messages-room"></div>
          <div class="chat-input-area"><input id="chat-input" maxlength="300" placeholder="Mensagem para a sala..." autocomplete="off"><button id="chat-send-btn" type="button" aria-label="Enviar">➤</button></div>
        </div>
        <div id="tab-social" class="chat-tab-content" style="display:none">
          <div id="social-home" class="social-home">
            <div class="social-search"><input id="social-search-input" maxlength="32" placeholder="Adicionar amigo pelo usuário"><button id="social-search-btn" type="button" aria-label="Buscar jogador">⌕</button></div>
            <div id="social-search-results" class="social-search-results"></div>
            <div id="social-login-note" class="social-login-note" hidden>Entre na sua conta para adicionar amigos e trocar mensagens.</div>
            <div id="social-requests" class="social-section"></div>
            <div class="social-section"><div class="social-section-title">MEUS AMIGOS <span id="social-friend-count">0</span></div><div id="social-friend-list" class="social-friend-list"></div></div>
          </div>
          <div id="social-conversation" class="social-conversation" style="display:none">
            <div class="social-conversation-head"><button id="social-back-btn" type="button" aria-label="Voltar">←</button><div class="social-user-avatar" id="social-conversation-avatar"></div><div><strong id="social-conversation-name"></strong><small><i></i> Online</small></div></div>
            <div id="social-messages" class="social-messages"></div>
            <div class="chat-input-area"><input id="social-message-input" maxlength="500" placeholder="Escreva uma mensagem..." autocomplete="off"><button id="social-send-btn" type="button" aria-label="Enviar">➤</button></div>
          </div>
        </div>
        <div id="tab-team" class="chat-tab-content" style="display:none"><div class="team-chat-picker" id="team-chat-picker" aria-label="Escolha uma equipe"></div><div class="team-chat-head"><button id="team-chat-change-btn" type="button" title="Próxima equipe">🛡</button><div><strong id="team-chat-name">Chat da equipe</strong><small id="team-chat-members">Equipe privada</small></div></div><div class="chat-messages" id="team-chat-messages"></div><div class="chat-input-area"><input id="team-chat-input" maxlength="500" placeholder="Mensagem para a equipe..." autocomplete="off"><button id="team-chat-send-btn" type="button" aria-label="Enviar">➤</button></div></div>
        <div id="tab-dm" class="chat-tab-content" style="display:none"><div class="chat-dm-header"><div class="chat-dm-avatar">🏆</div><strong class="chat-dm-name">${escapeHtml(ORG_NAME)}</strong><small class="chat-dm-role">Organizador verificado</small></div><div class="chat-messages" id="chat-messages-dm"></div><div class="chat-input-area"><input id="chat-input-dm" maxlength="300" placeholder="Mensagem para o organizador..." autocomplete="off"><button id="chat-send-dm-btn" type="button" aria-label="Enviar">➤</button></div></div>
      </section>`;
    document.body.appendChild(wrapper);
  }

  function messageElement(message, mine) {
    const el = document.createElement('article');
    el.className = `chat-msg${mine ? ' mine' : ''}`;
    const initial = String(message.nick || '?').charAt(0).toUpperCase();
    el.innerHTML = `<div class="chat-msg-avatar">${escapeHtml(initial)}</div><div class="chat-msg-body"><div class="chat-msg-header"><b class="chat-msg-nick">${escapeHtml(message.nick)}</b><time class="chat-msg-time">${timeLabel(message.createdAt || Date.now())}</time></div><p class="chat-msg-text">${escapeHtml(message.text)}</p></div>`;
    return el;
  }

  function appendRoomMessage(message, mine) {
    const list = document.getElementById('chat-messages-room');
    if (!list) return;
    list.appendChild(messageElement(message, mine));
    list.scrollTop = list.scrollHeight;
  }

  async function readServerSocial() {
    try {
      const response = await fetch(`/api/store/${encodeURIComponent(SOCIAL_KEY)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Social API indisponível');
      const body = await response.json();
      serverSocialAvailable = true;
      return body.value || null;
    } catch (_) {
      serverSocialAvailable = false;
      return null;
    }
  }

  function saveSocial() {
    localStorage.setItem(SOCIAL_KEY, JSON.stringify(social));
    if (serverSocialAvailable !== false) {
      fetch(`/api/store/${encodeURIComponent(SOCIAL_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: social })
      }).then(response => { if (response.ok) serverSocialAvailable = true; }).catch(() => { serverSocialAvailable = false; });
    }
    return window.CluchAPI?.setStore(SOCIAL_KEY, social);
  }

  async function loadSocial() {
    let stored = await readServerSocial();
    if (!stored) {
      try { stored = await window.CluchAPI?.getStore(SOCIAL_KEY, null); } catch (_) { stored = null; }
    }
    if (!stored) {
      try { stored = JSON.parse(localStorage.getItem(SOCIAL_KEY) || 'null'); } catch (_) { stored = null; }
    }
    social = { profiles: [], friendships: [], conversations: [], teamChats: [], ...(stored || {}) };
    social.profiles = Array.isArray(social.profiles) ? social.profiles : [];
    social.friendships = Array.isArray(social.friendships) ? social.friendships : [];
    social.conversations = Array.isArray(social.conversations) ? social.conversations : [];
    social.teamChats = Array.isArray(social.teamChats) ? social.teamChats : [];
    publishCurrentProfile();
    renderSocial();
    window.CluchAPI?.onStoreChange?.(SOCIAL_KEY, data => {
      social = { profiles: [], friendships: [], conversations: [], teamChats: [], ...(data || {}) };
      renderSocial();
    });
    // Quando o servidor local está em uso, mantém os outros jogadores atualizados sem recarregar a página.
    setInterval(async () => {
      const remote = await readServerSocial();
      if (!remote) return;
      const next = { profiles: [], friendships: [], conversations: [], teamChats: [], ...remote };
      if (JSON.stringify(next) !== JSON.stringify(social)) {
        social = next;
        renderSocial();
      }
    }, 3000);
  }

  async function loadUserTeams() {
    if (!currentUser?.nick) return;
    let teams = null;
    try { teams = await window.CluchAPI?.getStore(TEAM_KEY, null); } catch (_) { teams = null; }
    if (!Array.isArray(teams)) {
      try { teams = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]'); } catch (_) { teams = []; }
    }
    const me = userKey(currentUser.nick);
    userTeams = teams.filter(team => userKey(team.captain) === me || userKey(team.vice) === me || team.members?.some(member => userKey(member) === me));
    renderTeamButtons();
    if (!activeTeamName && userTeams.length) activeTeamName = userTeams[0].name;
    renderTeamChat();
    window.CluchAPI?.onStoreChange?.(TEAM_KEY, freshTeams => {
      if (!Array.isArray(freshTeams)) return;
      userTeams = freshTeams.filter(team => userKey(team.captain) === me || userKey(team.vice) === me || team.members?.some(member => userKey(member) === me));
      if (!userTeams.some(team => team.name === activeTeamName)) activeTeamName = userTeams[0]?.name || null;
      renderTeamButtons();
      renderTeamChat();
    });
  }

  function renderTeamButtons() {
    const container = document.getElementById('team-chat-buttons');
    if (!container) return;
    container.innerHTML = '';
    userTeams.filter(team => !hiddenTeamChats.has(userKey(team.name))).forEach(team => {
      const button = document.createElement('div');
      button.className = 'team-chat-float-btn';
      button.setAttribute('role', 'button');
      button.tabIndex = 0;
      button.innerHTML = `<span>🛡</span><span><strong>${escapeHtml(team.name)}</strong><small>Chat do time</small></span><button class="team-chat-dismiss" type="button" aria-label="Ocultar chat de ${escapeHtml(team.name)}" title="Ocultar atalho">×</button>`;
      button.addEventListener('click', () => {
        activeTeamName = team.name;
        isOpen = true;
        document.getElementById('chat-panel').classList.add('open');
        document.getElementById('chat-toggle-btn').classList.add('chat-toggle-open');
        switchTab('team');
      });
      button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') button.click(); });
      button.querySelector('.team-chat-dismiss').addEventListener('click', event => {
        event.stopPropagation();
        hideTeamChatShortcut(team.name);
      });
      container.appendChild(button);
    });
  }

  function publishCurrentProfile() {
    if (!currentUser?.nick) return;
    const id = userKey(currentUser.nick);
    const localAvatar = getProfileAvatar();
    // Evita enviar imagens grandes em Base64 para o documento compartilhado do chat.
    const profile = { id, nick: currentUser.nick, avatar: localAvatar.length <= 12000 ? localAvatar : '', updatedAt: Date.now() };
    const index = social.profiles.findIndex(item => item.id === id);
    const changed = index < 0 || social.profiles[index].nick !== profile.nick || social.profiles[index].avatar !== profile.avatar;
    if (changed) {
      if (index < 0) social.profiles.push(profile); else social.profiles[index] = { ...social.profiles[index], ...profile };
      saveSocial();
    }
  }

  function profileById(id) { return social.profiles.find(profile => profile.id === id); }
  function friendshipWith(id) {
    if (!currentUser?.nick) return null;
    const me = userKey(currentUser.nick);
    return social.friendships.find(friendship => (friendship.from === me && friendship.to === id) || (friendship.from === id && friendship.to === me));
  }

  function avatarMarkup(profile) {
    return profile?.avatar ? `<img src="${profile.avatar}" alt="">` : escapeHtml(profile?.nick?.charAt(0)?.toUpperCase() || '?');
  }

  function renderSocial() {
    const loginNote = document.getElementById('social-login-note');
    const search = document.getElementById('social-search-input');
    if (!loginNote || !search) return;
    const signedIn = Boolean(currentUser?.nick);
    loginNote.hidden = signedIn;
    search.disabled = !signedIn;
    document.getElementById('social-search-btn').disabled = !signedIn;
    renderSearchResults(search.value);
    renderRequests();
    renderFriends();
    renderConversation();
  }

  function renderSearchResults(query) {
    const container = document.getElementById('social-search-results');
    if (!container) return;
    const term = String(query || '').trim().toLowerCase();
    container.innerHTML = '';
    if (!term || !currentUser?.nick) return;
    const matches = social.profiles.filter(profile => profile.id !== userKey(currentUser.nick) && profile.nick.toLowerCase().includes(term)).slice(0, 5);
    if (!matches.length) {
      container.innerHTML = '<p class="social-empty">Nenhum jogador encontrado. O usuário precisa entrar na CLUTCHZONE ao menos uma vez.</p>';
      return;
    }
    matches.forEach(profile => {
      const relation = friendshipWith(profile.id);
      const row = document.createElement('div');
      row.className = 'social-search-row';
      let action = 'Adicionar';
      let disabled = false;
      if (relation?.status === 'accepted') { action = 'Amigos'; disabled = true; }
      if (relation?.status === 'pending' && relation.from === userKey(currentUser.nick)) { action = 'Enviado'; disabled = true; }
      if (relation?.status === 'pending' && relation.to === userKey(currentUser.nick)) { action = 'Responder'; }
      row.innerHTML = `<span class="social-user-avatar">${avatarMarkup(profile)}</span><strong>${escapeHtml(profile.nick)}</strong><button type="button" ${disabled ? 'disabled' : ''}>${action}</button>`;
      row.querySelector('button').addEventListener('click', () => relation?.status === 'pending' && relation.to === userKey(currentUser.nick) ? acceptFriendship(relation.id) : requestFriendship(profile.id));
      container.appendChild(row);
    });
  }

  function renderRequests() {
    const container = document.getElementById('social-requests');
    const badge = document.getElementById('social-request-badge');
    if (!container || !badge) return;
    const me = userKey(currentUser?.nick);
    const requests = social.friendships.filter(friendship => friendship.status === 'pending' && friendship.to === me);
    badge.hidden = !requests.length;
    badge.textContent = requests.length;
    container.innerHTML = '';
    if (!requests.length) return;
    container.innerHTML = '<div class="social-section-title">PEDIDOS RECEBIDOS</div>';
    requests.forEach(request => {
      const profile = profileById(request.from);
      const row = document.createElement('div');
      row.className = 'social-request-row';
      row.innerHTML = `<span class="social-user-avatar">${avatarMarkup(profile)}</span><span><strong>${escapeHtml(profile?.nick || request.from)}</strong><small>quer ser seu amigo</small></span><div><button class="social-accept" type="button">Aceitar</button><button class="social-reject" type="button">×</button></div>`;
      row.querySelector('.social-accept').addEventListener('click', () => acceptFriendship(request.id));
      row.querySelector('.social-reject').addEventListener('click', () => rejectFriendship(request.id));
      container.appendChild(row);
    });
  }

  function friendProfiles() {
    if (!currentUser?.nick) return [];
    const me = userKey(currentUser.nick);
    return social.friendships.filter(friendship => friendship.status === 'accepted' && (friendship.from === me || friendship.to === me)).map(friendship => profileById(friendship.from === me ? friendship.to : friendship.from)).filter(Boolean);
  }

  function conversationFor(friendId, create) {
    const me = userKey(currentUser?.nick);
    const id = [me, friendId].sort().join('__');
    let conversation = social.conversations.find(item => item.id === id);
    if (!conversation && create) {
      conversation = { id, participants: [me, friendId], messages: [], updatedAt: Date.now() };
      social.conversations.push(conversation);
    }
    return conversation;
  }

  function renderFriends() {
    const container = document.getElementById('social-friend-list');
    const count = document.getElementById('social-friend-count');
    if (!container || !count) return;
    const friends = friendProfiles();
    count.textContent = friends.length;
    container.innerHTML = '';
    if (!currentUser?.nick) return;
    if (!friends.length) { container.innerHTML = '<p class="social-empty">Busque um usuário acima para começar sua rede.</p>'; return; }
    friends.sort((a, b) => (conversationFor(b.id)?.updatedAt || 0) - (conversationFor(a.id)?.updatedAt || 0)).forEach(profile => {
      const conversation = conversationFor(profile.id);
      const last = conversation?.messages?.at(-1);
      const row = document.createElement('button');
      row.className = 'social-friend-row';
      row.type = 'button';
      row.innerHTML = `<span class="social-user-avatar">${avatarMarkup(profile)}<i></i></span><span><strong>${escapeHtml(profile.nick)}</strong><small>${escapeHtml(last ? last.text : 'Agora vocês são amigos!')}</small></span><time>${last ? relativeTime(last.createdAt) : ''}</time>`;
      row.addEventListener('click', () => { activeConversationId = conversationFor(profile.id, true).id; renderSocial(); });
      container.appendChild(row);
    });
  }

  function renderConversation() {
    const home = document.getElementById('social-home');
    const pane = document.getElementById('social-conversation');
    if (!home || !pane) return;
    const conversation = social.conversations.find(item => item.id === activeConversationId);
    if (!conversation || !currentUser?.nick) { home.style.display = 'flex'; pane.style.display = 'none'; return; }
    const friendId = conversation.participants.find(id => id !== userKey(currentUser.nick));
    const profile = profileById(friendId);
    home.style.display = 'none'; pane.style.display = 'flex';
    document.getElementById('social-conversation-name').textContent = profile?.nick || friendId;
    document.getElementById('social-conversation-avatar').innerHTML = avatarMarkup(profile);
    const list = document.getElementById('social-messages');
    list.innerHTML = '';
    conversation.messages.forEach(message => list.appendChild(messageElement(message, message.from === userKey(currentUser.nick))));
    list.scrollTop = list.scrollHeight;
  }

  function requestFriendship(targetId) {
    if (!currentUser?.nick || !targetId) return;
    const me = userKey(currentUser.nick);
    const existing = friendshipWith(targetId);
    if (existing?.status === 'pending' && existing.to === me) return acceptFriendship(existing.id);
    if (existing) return;
    social.friendships.push({ id: `${me}_${targetId}_${Date.now()}`, from: me, to: targetId, status: 'pending', createdAt: Date.now() });
    saveSocial(); renderSocial();
  }

  function acceptFriendship(id) { const request = social.friendships.find(item => item.id === id); if (request) { request.status = 'accepted'; request.updatedAt = Date.now(); saveSocial(); renderSocial(); } }
  function rejectFriendship(id) { social.friendships = social.friendships.filter(item => item.id !== id); saveSocial(); renderSocial(); }

  function sendPrivateMessage() {
    const input = document.getElementById('social-message-input');
    const conversation = social.conversations.find(item => item.id === activeConversationId);
    const text = input?.value.trim();
    if (!text || !conversation || !currentUser?.nick) return;
    conversation.messages.push({ id: `${Date.now()}_${Math.random()}`, from: userKey(currentUser.nick), nick: currentUser.nick, text, createdAt: Date.now() });
    conversation.messages = conversation.messages.slice(-200);
    conversation.updatedAt = Date.now();
    input.value = '';
    saveSocial(); renderConversation();
  }

  function activeTeam() { return userTeams.find(team => team.name === activeTeamName) || null; }

  function teamChatFor(team, create) {
    if (!team) return null;
    const id = `team_${userKey(team.name)}`;
    let chat = social.teamChats.find(item => item.id === id);
    if (!chat && create) {
      chat = { id, teamName: team.name, messages: [], updatedAt: Date.now() };
      social.teamChats.push(chat);
    }
    return chat;
  }

  function renderTeamChat() {
    const tab = document.getElementById('team-chat-tab');
    const team = activeTeam();
    if (tab) tab.style.display = userTeams.length ? '' : 'none';
    if (!team) return;
    const picker = document.getElementById('team-chat-picker');
    if (picker) {
      picker.innerHTML = '';
      userTeams.forEach(userTeam => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = `team-chat-option${userTeam.name === team.name ? ' active' : ''}`;
        option.innerHTML = `<span>🛡</span><strong>${escapeHtml(userTeam.name)}</strong><small>${userTeam.members?.length || 0} jogadores</small>`;
        option.addEventListener('click', () => {
          activeTeamName = userTeam.name;
          renderTeamChat();
        });
        picker.appendChild(option);
      });
    }
    const chat = teamChatFor(team, true);
    document.getElementById('team-chat-name').textContent = team.name;
    document.getElementById('team-chat-members').textContent = `${team.members?.length || 0} jogadores no roster`;
    const list = document.getElementById('team-chat-messages');
    list.innerHTML = '';
    if (!chat.messages.length) {
      const welcome = document.createElement('div');
      welcome.className = 'chat-system-msg';
      welcome.textContent = `Canal privado de ${team.name}. Organize seu time aqui.`;
      list.appendChild(welcome);
    }
    chat.messages.forEach(message => list.appendChild(messageElement(message, message.from === userKey(currentUser?.nick))));
    list.scrollTop = list.scrollHeight;
  }

  function sendTeamMessage() {
    const input = document.getElementById('team-chat-input');
    const team = activeTeam();
    const chat = teamChatFor(team, true);
    const text = input?.value.trim();
    if (!text || !chat || !currentUser?.nick) return;
    chat.messages.push({ id: `${Date.now()}_${Math.random()}`, from: userKey(currentUser.nick), nick: currentUser.nick, text, createdAt: Date.now() });
    chat.messages = chat.messages.slice(-300);
    chat.updatedAt = Date.now();
    input.value = '';
    saveSocial();
    renderTeamChat();
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.chat-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
    ['room', 'social', 'team', 'dm'].forEach(name => { const pane = document.getElementById(`tab-${name}`); pane.style.display = name === tab ? 'flex' : 'none'; });
    if (tab === 'social') renderSocial();
    if (tab === 'team') renderTeamChat();
  }

  function init() {
    buildWidget();
    currentUser = getAuth();
    loadHiddenTeamChats();
    const roomMessages = [
      { nick: 'Sistema', text: `Bem-vindo à sala ${ROOM_NAME}!`, createdAt: Date.now() - 180000 },
      { nick: 'BattlePro', text: 'Alguém formando equipe para hoje?', createdAt: Date.now() - 90000 },
      { nick: ORG_NAME, text: 'Boa sorte a todos! O check-in abre em breve.', createdAt: Date.now() - 30000 }
    ];
    roomMessages.forEach(message => appendRoomMessage(message));
    const dmList = document.getElementById('chat-messages-dm');
    dmList.appendChild(messageElement({ nick: ORG_NAME, text: 'Olá! Como posso ajudar?', createdAt: Date.now() - 60000 }));
    loadSocial();
    loadUserTeams();

    const panel = document.getElementById('chat-panel');
    const toggle = document.getElementById('chat-toggle-btn');
    const close = () => { isOpen = false; panel.classList.remove('open'); toggle.classList.remove('chat-toggle-open'); };
    const open = () => { isOpen = true; panel.classList.add('open'); toggle.classList.add('chat-toggle-open'); document.getElementById('chat-notif')?.remove(); };
    toggle.addEventListener('click', () => isOpen ? close() : open());
    document.getElementById('chat-close-btn').addEventListener('click', close);
    document.querySelectorAll('.chat-tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    document.getElementById('org-shortcut').addEventListener('click', () => switchTab('dm'));

    const sendRoom = () => { const input = document.getElementById('chat-input'); const text = input.value.trim(); if (!text) return; appendRoomMessage({ nick: currentUser?.nick || 'Visitante', text, createdAt: Date.now() }, true); input.value = ''; };
    document.getElementById('chat-send-btn').addEventListener('click', sendRoom);
    document.getElementById('chat-input').addEventListener('keydown', event => { if (event.key === 'Enter') sendRoom(); });
    const sendOrg = () => { const input = document.getElementById('chat-input-dm'); const text = input.value.trim(); if (!text) return; dmList.appendChild(messageElement({ nick: currentUser?.nick || 'Você', text, createdAt: Date.now() }, true)); input.value = ''; dmList.scrollTop = dmList.scrollHeight; };
    document.getElementById('chat-send-dm-btn').addEventListener('click', sendOrg);
    document.getElementById('chat-input-dm').addEventListener('keydown', event => { if (event.key === 'Enter') sendOrg(); });

    const search = document.getElementById('social-search-input');
    document.getElementById('social-search-btn').addEventListener('click', () => renderSearchResults(search.value));
    search.addEventListener('input', () => renderSearchResults(search.value));
    document.getElementById('social-back-btn').addEventListener('click', () => { activeConversationId = null; renderSocial(); });
    document.getElementById('social-send-btn').addEventListener('click', sendPrivateMessage);
    document.getElementById('social-message-input').addEventListener('keydown', event => { if (event.key === 'Enter') sendPrivateMessage(); });
    document.getElementById('team-chat-send-btn').addEventListener('click', sendTeamMessage);
    document.getElementById('team-chat-input').addEventListener('keydown', event => { if (event.key === 'Enter') sendTeamMessage(); });
    document.getElementById('team-chat-change-btn').addEventListener('click', () => {
      const currentIndex = userTeams.findIndex(team => team.name === activeTeamName);
      activeTeamName = userTeams[(currentIndex + 1) % userTeams.length]?.name || null;
      renderTeamChat();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
