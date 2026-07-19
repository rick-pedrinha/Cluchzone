(function () {
  'use strict';

  const ROOM_NAME = document.querySelector('meta[name="room-name"]')?.content || 'Lobby CLUTCHZONE';
  const GAME_ICON = document.querySelector('meta[name="room-icon"]')?.content || '🎮';
  const ORG_NAME = document.querySelector('meta[name="org-name"]')?.content || 'Organizador';
  const SOCIAL_KEY = 'cluchzone_social_network_v1';
  const AUTH_KEY = 'cluchzone_auth';
  const HIDDEN_TEAM_CHATS_KEY = 'cluchzone_hidden_team_chats';

  let social = { profiles: [], friendships: [], conversations: [], teamChats: [] };
  let currentUser = null;
  let activeConversationId = null;
  let activeTeamName = null;
  let userTeams = [];
  const teamMessagesById = new Map();
  let hiddenTeamChats = new Set();
  let activeTab = 'room';
  let isOpen = false;
  let steamFriends = [];
  let steamFriendsStatus = 'idle';
  let activeSteamFriend = null;
  let directMessages = [];
  let directMessagesStatus = 'idle';

  const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const userKey = nick => String(nick || '').trim().toLowerCase();
  const timeLabel = timestamp => new Intl.DateTimeFormat(
    window.ClutchGlobal?.getPreferences().preferredLocale || navigator.language,
    { hour: '2-digit', minute: '2-digit', timeZone: window.ClutchGlobal?.getPreferences().timeZone },
  ).format(new Date(timestamp));
  const relativeTime = timestamp => {
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
    return `${Math.floor(minutes / 1440)} d`;
  };

  function getAuth() {
    return window.ClutchAuth?.getUser() || null;
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
    const competitiveMode = document.body.classList.contains('csgo-theme');
    const toggleTitle = competitiveMode ? 'COMMS' : 'Bate-papo';
    const toggleSubtitle = competitiveMode ? 'Esquadrão online' : 'Comunidade ao vivo';
    const wrapper = document.createElement('div');
    wrapper.id = 'clutch-social-widget';
    wrapper.innerHTML = `
      <div id="team-chat-buttons" aria-label="Chats das minhas equipes"></div>
      <button id="chat-toggle-btn" aria-label="Abrir comunicações ClutchZone" title="Abrir comunicações">
        <span class="c4-wires" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="chat-toggle-icon" aria-hidden="true"><i class="c4-led"></i>●</span>
        <span class="c4-display"><span class="chat-toggle-copy"><strong>${toggleTitle}</strong><small>${toggleSubtitle}</small></span></span>
        <span class="c4-keypad" aria-hidden="true">${'<i></i>'.repeat(9)}</span>
        <span class="chat-notif" id="chat-notif">3</span>
      </button>
      <section id="chat-panel" role="dialog" aria-label="Bate-papo CLUTCHZONE">
        <header class="chat-header">
          <div class="chat-header-icon">${GAME_ICON}</div>
          <div class="chat-header-info"><strong class="chat-header-title">CLUTCH SOCIAL</strong><span class="chat-header-sub"><i class="chat-online-dot"></i><span id="chat-online-count">Conectando...</span></span></div>
          <button class="chat-close-btn" id="chat-close-btn" aria-label="Fechar">×</button>
        </header>
        <nav class="chat-tabs" aria-label="Seções do chat">
          <button class="chat-tab active" data-tab="room">🏠 Sala</button>
          <button class="chat-tab" data-tab="social">👥 Amigos <span class="social-request-badge" id="social-request-badge" hidden>0</span></button>
          <button class="chat-tab" id="team-chat-tab" data-tab="team">▥ Equipe</button>
          <button class="chat-tab" data-tab="dm">🏆 Org.</button>
        </nav>
        <div id="tab-room" class="chat-tab-content">
          <button class="organizer-alert" id="org-shortcut" type="button"><span class="organizer-alert-icon">📨</span><span class="organizer-alert-text"><b class="organizer-alert-title">FALAR COM ORGANIZADOR</b><small class="organizer-alert-sub">${escapeHtml(ORG_NAME)} · Online agora</small></span><i class="organizer-online"></i></button>
          <div class="chat-messages" id="chat-messages-room"></div>
          <div class="chat-input-area"><input id="chat-input" maxlength="300" placeholder="Mensagem para a sala..." autocomplete="off"><button id="chat-send-btn" type="button" aria-label="Enviar">➤</button></div>
        </div>
        <div id="tab-social" class="chat-tab-content" style="display:none">
          <div id="social-home" class="social-home">
            <div class="social-search"><input id="social-search-input" maxlength="64" placeholder="Buscar usuário ou amigo Steam"><button id="social-search-btn" type="button" aria-label="Buscar usuário ou amigo Steam">⌕</button></div>
            <div id="social-search-results" class="social-search-results"></div>
            <div id="social-login-note" class="social-login-note" hidden>Entre na sua conta para adicionar amigos e trocar mensagens.</div>
            <div id="social-requests" class="social-section"></div>
            <div class="social-section"><div class="social-section-title">MEUS AMIGOS <span id="social-friend-count">0</span></div><div id="social-friend-list" class="social-friend-list"></div></div>
          </div>
          <div id="social-conversation" class="social-conversation" style="display:none">
            <div class="social-conversation-head"><button id="social-back-btn" type="button" aria-label="Voltar">←</button><div class="social-user-avatar" id="social-conversation-avatar"></div><div><strong id="social-conversation-name"></strong><small id="social-conversation-status"><i></i> Online</small></div></div>
            <div id="social-messages" class="social-messages"></div>
            <div class="chat-input-area"><input id="social-message-input" maxlength="500" placeholder="Escreva uma mensagem..." autocomplete="off"><button id="social-send-btn" type="button" aria-label="Enviar">➤</button></div>
          </div>
        </div>
        <div id="tab-team" class="chat-tab-content" style="display:none"><div class="team-chat-picker" id="team-chat-picker" aria-label="Escolha uma equipe"></div><div class="team-chat-head"><button id="team-chat-change-btn" type="button" title="Próxima equipe">▦</button><div><strong id="team-chat-name">Canal da equipe</strong><small id="team-chat-members">Criptografado · somente roster</small></div></div><div class="chat-messages" id="team-chat-messages"></div><div class="chat-input-area"><input id="team-chat-input" maxlength="500" placeholder="Mensagem tática para a equipe..." autocomplete="off"><button id="team-chat-send-btn" type="button" aria-label="Enviar">➤</button></div></div>
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
      return (await window.CluchAPI?.getStore(SOCIAL_KEY, null)) || null;
    } catch (_) {
      return null;
    }
  }

  function saveSocial() {
    return window.CluchAPI?.setStore(SOCIAL_KEY, social);
  }

  async function loadSocial() {
    const stored = await readServerSocial();
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

  async function loadSteamFriends() {
    if (!currentUser?.steamId64 || !window.CluchAPI?.getSteamFriends) return;
    steamFriendsStatus = 'loading';
    renderSocial();
    try {
      steamFriends = await window.CluchAPI.getSteamFriends();
      steamFriendsStatus = 'ready';
    } catch (error) {
      steamFriends = [];
      steamFriendsStatus = error?.code === 'STEAM_FRIENDS_PRIVATE' ? 'private' : 'error';
    }
    renderSocial();
  }

  async function loadUserTeams() {
    if (!currentUser?.uid || !window.CluchAPI?.getMyTeams) {
      userTeams = [];
      renderTeamButtons();
      renderTeamChat();
      return;
    }
    try { userTeams = await window.CluchAPI.getMyTeams(); } catch (_) { userTeams = []; }
    renderTeamButtons();
    if (!activeTeamName && userTeams.length) activeTeamName = userTeams[0].name;
    if (!userTeams.some(team => team.name === activeTeamName)) activeTeamName = userTeams[0]?.name || null;
    renderTeamChat();
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
      button.innerHTML = `<span>▦</span><span><strong>${escapeHtml(team.name)}</strong><small>${team.members?.length || 0} no canal privado</small></span><button class="team-chat-dismiss" type="button" aria-label="Ocultar chat de ${escapeHtml(team.name)}" title="Ocultar atalho">×</button>`;
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
    const localAvatar = currentUser.avatar || getProfileAvatar();
    // Evita enviar imagens grandes em Base64 para o documento compartilhado do chat.
    const profile = { id, nick: currentUser.nick, avatar: localAvatar.length <= 12000 ? localAvatar : '', steamId64: currentUser.steamId64 || null, updatedAt: Date.now() };
    const index = social.profiles.findIndex(item => item.id === id);
    const changed = index < 0 || social.profiles[index].nick !== profile.nick || social.profiles[index].avatar !== profile.avatar || social.profiles[index].steamId64 !== profile.steamId64;
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
    const steamMatches = steamFriends.filter(friend => (
      friend.displayName.toLowerCase().includes(term) || friend.steamId64.includes(term)
    )).slice(0, 5);
    const matchedSteamIds = new Set(steamMatches.map(friend => friend.steamId64));
    const matchedMemberIds = new Set(steamMatches.map(friend => friend.clutchzoneUser?.id).filter(Boolean));
    const profileMatches = social.profiles.filter(profile => (
      profile.id !== userKey(currentUser.nick)
      && profile.nick.toLowerCase().includes(term)
      && !matchedSteamIds.has(profile.steamId64)
      && !matchedMemberIds.has(profile.id)
    )).slice(0, 5);
    if (!profileMatches.length && !steamMatches.length) {
      const syncHint = steamFriendsStatus === 'loading' ? ' A lista Steam ainda está sincronizando.' : '';
      container.innerHTML = `<p class="social-empty">Nenhum usuário ou amigo Steam encontrado.${syncHint}</p>`;
      return;
    }
    profileMatches.forEach(profile => {
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
    steamMatches.forEach(friend => {
      const registered = Boolean(friend.clutchzoneUser);
      const row = document.createElement('div');
      row.className = 'social-search-row steam-search-row';
      row.innerHTML = `<span class="social-user-avatar">${avatarMarkup({ nick: friend.displayName, avatar: friend.avatarUrl })}</span><span class="social-search-copy"><strong>${escapeHtml(friend.displayName)} <em class="steam-source-badge">STEAM</em></strong><small>${registered ? 'Disponível no chat CLUTCHZONE' : 'Precisa entrar no CLUTCHZONE'}</small></span><button type="button">${registered ? 'Abrir chat' : 'Como liberar'}</button>`;
      row.querySelector('button').addEventListener('click', () => openSteamConversation(friend));
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

  async function loadDirectMessages(silent = false) {
    const peerId = activeSteamFriend?.clutchzoneUser?.id;
    if (!peerId || !window.CluchAPI?.getDirectMessages) return;
    if (!silent) {
      directMessagesStatus = 'loading';
      renderConversation();
    }
    try {
      directMessages = await window.CluchAPI.getDirectMessages(peerId);
      directMessagesStatus = 'ready';
    } catch (_) {
      directMessages = [];
      directMessagesStatus = 'error';
    }
    if (activeSteamFriend?.clutchzoneUser?.id === peerId) renderConversation();
  }

  function openSteamConversation(friend) {
    activeConversationId = null;
    activeSteamFriend = friend;
    directMessages = [];
    directMessagesStatus = friend.clutchzoneUser ? 'loading' : 'unavailable';
    renderSocial();
    if (friend.clutchzoneUser) void loadDirectMessages();
  }

  function renderFriends() {
    const container = document.getElementById('social-friend-list');
    const count = document.getElementById('social-friend-count');
    if (!container || !count) return;
    const friends = friendProfiles();
    const localSteamIds = new Set(friends.map(profile => profile.steamId64).filter(Boolean));
    const visibleSteamFriends = steamFriends.filter(friend => {
      if (localSteamIds.has(friend.steamId64)) return false;
      const registeredName = friend.clutchzoneUser?.displayName;
      return !registeredName || !friends.some(profile => userKey(profile.nick) === userKey(registeredName));
    });
    count.textContent = friends.length + visibleSteamFriends.length;
    container.innerHTML = '';
    if (!currentUser?.nick) return;
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
    visibleSteamFriends
      .sort((a, b) => Number(b.personaState > 0) - Number(a.personaState > 0) || a.displayName.localeCompare(b.displayName))
      .forEach(friend => {
        const online = Number(friend.personaState) > 0;
        const row = document.createElement('button');
        row.className = 'social-friend-row steam-friend-row';
        row.type = 'button';
        const friendProfile = { nick: friend.displayName, avatar: friend.avatarUrl };
        const membership = friend.clutchzoneUser ? ' · Chat CLUTCHZONE' : ' · Convide para o CLUTCHZONE';
        row.innerHTML = `<span class="social-user-avatar">${avatarMarkup(friendProfile)}<i class="${online ? '' : 'offline'}"></i></span><span><strong>${escapeHtml(friend.displayName)} <em class="steam-source-badge">STEAM</em></strong><small>${online ? 'Online' : 'Offline'}${membership}</small></span><time aria-hidden="true">›</time>`;
        row.addEventListener('click', () => openSteamConversation(friend));
        container.appendChild(row);
      });
    if (!friends.length && !visibleSteamFriends.length && steamFriendsStatus === 'ready') {
      container.innerHTML = '<p class="social-empty">Nenhum amigo encontrado no Clutchzone ou na Steam.</p>';
    } else if (steamFriendsStatus === 'loading') {
      container.insertAdjacentHTML('beforeend', '<p class="social-empty steam-friends-note">Sincronizando amigos da Steam...</p>');
    } else if (steamFriendsStatus === 'private') {
      container.insertAdjacentHTML('beforeend', '<p class="social-empty steam-friends-note">Sua lista de amigos Steam está privada. Altere a privacidade do perfil para sincronizá-la.</p>');
    } else if (steamFriendsStatus === 'error') {
      container.insertAdjacentHTML('beforeend', '<p class="social-empty steam-friends-note">Não foi possível sincronizar a Steam agora.</p>');
    } else if (!friends.length && steamFriendsStatus === 'idle') {
      container.innerHTML = '<p class="social-empty">Busque um usuário acima para começar sua rede.</p>';
    }
  }

  function renderConversation() {
    const home = document.getElementById('social-home');
    const pane = document.getElementById('social-conversation');
    if (!home || !pane) return;
    const input = document.getElementById('social-message-input');
    const send = document.getElementById('social-send-btn');
    const status = document.getElementById('social-conversation-status');
    if (activeSteamFriend) {
      const registered = Boolean(activeSteamFriend.clutchzoneUser);
      home.style.display = 'none'; pane.style.display = 'flex';
      document.getElementById('social-conversation-name').textContent = activeSteamFriend.displayName;
      document.getElementById('social-conversation-avatar').innerHTML = avatarMarkup({ nick: activeSteamFriend.displayName, avatar: activeSteamFriend.avatarUrl });
      status.innerHTML = registered ? '<i></i> Chat interno CLUTCHZONE' : 'Ainda não entrou no CLUTCHZONE';
      input.disabled = !registered || directMessagesStatus === 'loading';
      send.disabled = input.disabled;
      input.placeholder = registered ? 'Escreva uma mensagem...' : 'Este amigo precisa entrar no CLUTCHZONE';
      const list = document.getElementById('social-messages');
      list.innerHTML = '';
      if (!registered) {
        list.innerHTML = '<p class="social-empty">Este amigo Steam precisa entrar no CLUTCHZONE com a conta dele antes de participar do chat interno.</p>';
      } else if (directMessagesStatus === 'loading') {
        list.innerHTML = '<p class="social-empty">Carregando conversa segura...</p>';
      } else if (directMessagesStatus === 'error') {
        list.innerHTML = '<p class="social-empty">Não foi possível carregar a conversa agora.</p>';
      } else if (!directMessages.length) {
        list.innerHTML = '<p class="social-empty">Conversa iniciada no CLUTCHZONE. Envie a primeira mensagem.</p>';
      } else {
        directMessages.forEach(message => list.appendChild(messageElement({
          nick: message.displayName,
          text: message.text,
          createdAt: new Date(message.createdAt).getTime(),
        }, message.senderId === currentUser?.uid)));
      }
      list.scrollTop = list.scrollHeight;
      return;
    }
    const conversation = social.conversations.find(item => item.id === activeConversationId);
    if (!conversation || !currentUser?.nick) { home.style.display = 'flex'; pane.style.display = 'none'; return; }
    const friendId = conversation.participants.find(id => id !== userKey(currentUser.nick));
    const profile = profileById(friendId);
    home.style.display = 'none'; pane.style.display = 'flex';
    input.disabled = false;
    send.disabled = false;
    input.placeholder = 'Escreva uma mensagem...';
    status.innerHTML = '<i></i> Online';
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

  async function sendPrivateMessage() {
    const input = document.getElementById('social-message-input');
    if (activeSteamFriend) {
      const peerId = activeSteamFriend.clutchzoneUser?.id;
      const text = input?.value.trim();
      if (!peerId || !text || !window.CluchAPI?.sendDirectMessage) return;
      input.disabled = true;
      document.getElementById('social-send-btn').disabled = true;
      try {
        const message = await window.CluchAPI.sendDirectMessage(peerId, text);
        if (message) directMessages.push(message);
        input.value = '';
        directMessagesStatus = 'ready';
      } catch (_) {
        directMessagesStatus = 'error';
      }
      renderConversation();
      if (directMessagesStatus === 'ready') input.focus();
      return;
    }
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

  function paintTeamMessages(team) {
    const list = document.getElementById('team-chat-messages');
    if (!list) return;
    list.innerHTML = '';
    if (!team) {
      const empty = document.createElement('div');
      empty.className = 'chat-system-msg team-chat-empty';
      empty.innerHTML = currentUser
        ? 'Você ainda não participa de uma equipe registrada no servidor.<br><a href="team-create.html">Criar equipe competitiva →</a>'
        : 'Entre com a Steam para acessar o canal privado da sua equipe.';
      list.appendChild(empty);
      return;
    }
    const messages = teamMessagesById.get(team.id) || [];
    if (!messages.length) {
      const welcome = document.createElement('div');
      welcome.className = 'chat-system-msg';
      welcome.textContent = `Canal privado de ${team.name}. Somente membros validados conseguem ler ou enviar mensagens.`;
      list.appendChild(welcome);
    }
    messages.forEach(message => list.appendChild(messageElement({
      nick: message.displayName,
      text: message.text,
      createdAt: new Date(message.createdAt).getTime(),
    }, message.userId === currentUser?.uid)));
    list.scrollTop = list.scrollHeight;
  }

  async function refreshTeamMessages() {
    const team = activeTeam();
    if (!team?.id || !window.CluchAPI?.getTeamMessages) return;
    try {
      teamMessagesById.set(team.id, await window.CluchAPI.getTeamMessages(team.id));
      if (activeTeam()?.id === team.id) paintTeamMessages(team);
    } catch (_) {
      teamMessagesById.set(team.id, []);
      paintTeamMessages(team);
    }
  }

  function renderTeamChat() {
    const tab = document.getElementById('team-chat-tab');
    const team = activeTeam();
    if (tab) tab.style.display = '';
    const picker = document.getElementById('team-chat-picker');
    if (picker) {
      picker.innerHTML = '';
      userTeams.forEach(userTeam => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = `team-chat-option${userTeam.name === team?.name ? ' active' : ''}`;
        option.innerHTML = `<span>▦</span><strong>${escapeHtml(userTeam.name)}</strong><small>${userTeam.members?.length || 0} jogadores</small>`;
        option.addEventListener('click', () => {
          activeTeamName = userTeam.name;
          renderTeamChat();
        });
        picker.appendChild(option);
      });
    }
    document.getElementById('team-chat-name').textContent = team?.name || 'Canal da equipe';
    document.getElementById('team-chat-members').textContent = team
      ? `${team.members?.length || 0} membros · acesso validado no servidor`
      : 'Privado · somente roster autenticado';
    const input = document.getElementById('team-chat-input');
    const send = document.getElementById('team-chat-send-btn');
    input.disabled = !team;
    send.disabled = !team;
    paintTeamMessages(team);
    if (team) void refreshTeamMessages();
  }

  async function sendTeamMessage() {
    const input = document.getElementById('team-chat-input');
    const team = activeTeam();
    const text = input?.value.trim();
    if (!text || !team?.id || !currentUser?.uid || !window.CluchAPI?.sendTeamMessage) return;
    input.disabled = true;
    try {
      const message = await window.CluchAPI.sendTeamMessage(team.id, text);
      if (message) teamMessagesById.set(team.id, [...(teamMessagesById.get(team.id) || []), message].slice(-100));
      input.value = '';
      paintTeamMessages(team);
    } catch (_) {
      const list = document.getElementById('team-chat-messages');
      const warning = document.createElement('div');
      warning.className = 'chat-system-msg error';
      warning.textContent = 'Não foi possível enviar. Confirme sua sessão e participação no roster.';
      list.appendChild(warning);
    } finally {
      input.disabled = false;
      input.focus();
    }
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
    loadSteamFriends();
    loadUserTeams();
    window.setInterval(() => {
      if (isOpen && activeTab === 'team') void refreshTeamMessages();
      if (isOpen && activeTab === 'social' && activeSteamFriend?.clutchzoneUser) void loadDirectMessages(true);
    }, 3000);
    window.setInterval(() => {
      if (!document.hidden) void loadUserTeams();
    }, 15000);

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
    document.getElementById('social-back-btn').addEventListener('click', () => { activeConversationId = null; activeSteamFriend = null; directMessages = []; renderSocial(); });
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

  const initAfterAuth = () => window.ClutchAuth?.ready.then(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAfterAuth); else initAfterAuth();
})();
