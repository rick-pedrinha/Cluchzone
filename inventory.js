'use strict';

(function () {
  const CATEGORY_META = {
    all: ['Tudo', '✦'],
    weapon: ['Armas', '⌖'],
    knife: ['Facas', '◆'],
    glove: ['Luvas', '◈'],
    agent: ['Agentes', '◎'],
    sticker: ['Adesivos', '✣'],
    graffiti: ['Grafites', '✎'],
    container: ['Caixas', '▣'],
    other: ['Outros', '•••'],
  };
  const GAME_META = {
    cs2: { key: 'cs2', name: 'Counter-Strike 2', shortName: 'CS2', appId: 730, kicker: 'ARSENAL DO JOGADOR', search: 'Buscar skin, arma ou coleção' },
    pubg: { key: 'pubg', name: 'PUBG: Battlegrounds', shortName: 'PUBG', appId: 578080, kicker: 'COLEÇÃO DO SOBREVIVENTE', search: 'Buscar arma, traje ou item' },
  };
  let modal = null;
  let previousFocus = null;
  let activeRequest = null;
  const profileCache = new Map();
  const profilePending = new Map();
  const PROFILE_CACHE_TTL_MS = 20 * 1000;
  let current = { player: null, inventory: null, game: GAME_META.cs2, category: 'all', search: '' };

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const safeColor = value => /^#[a-f0-9]{6}$/i.test(String(value || '')) ? value : '#5b6b84';
  const safeDecode = value => { try { return decodeURIComponent(value); } catch (_) { return ''; } };
  const apiBase = () => String(window.ClutchAuth?.backendUrl || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3001' : '')).replace(/\/$/, '');

  async function requestInventoryPayload(endpoint, signal, options = {}) {
    const base = apiBase();
    if (!base) throw Object.assign(new Error('Backend unavailable'), { code: 'BACKEND_UNAVAILABLE' });
    const response = await fetch(`${base}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: { accept: 'application/json', ...(options.headers || {}) },
      ...(signal ? { signal } : {}),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw Object.assign(new Error(payload?.error?.message || `HTTP ${response.status}`), {
        code: payload?.error?.code || 'REQUEST_FAILED',
      });
    }
    return payload;
  }

  function profileInventoryRequest(userId, game) {
    const clutchzoneUserId = String(userId || '').trim();
    const gameKey = String(game || '').trim().toLowerCase();
    if (!clutchzoneUserId || !GAME_META[gameKey]) return null;
    return {
      key: `${clutchzoneUserId}:${gameKey}`,
      endpoint: `/api/players/${encodeURIComponent(clutchzoneUserId)}/showcases/${encodeURIComponent(gameKey)}/inventory`,
      gameKey,
    };
  }

  function preloadProfile({ userId, game = 'cs2', refresh = false }) {
    const request = profileInventoryRequest(userId, game);
    if (!request) return Promise.reject(Object.assign(new Error('Invalid showcase'), { code: 'INVALID_INPUT' }));
    const cached = profileCache.get(request.key);
    if (!refresh && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.payload);
    if (profilePending.has(request.key)) return profilePending.get(request.key);
    const pending = requestInventoryPayload(request.endpoint)
      .then(payload => {
        profileCache.set(request.key, { payload, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
        return payload;
      })
      .finally(() => profilePending.delete(request.key));
    profilePending.set(request.key, pending);
    return pending;
  }

  function getShowcaseVisibility() {
    return requestInventoryPayload('/api/players/me/showcase-visibility');
  }

  async function setShowcaseVisibility(visible) {
    const payload = await requestInventoryPayload('/api/players/me/showcase-visibility', null, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visible: Boolean(visible) }),
    });
    profileCache.clear();
    profilePending.clear();
    return payload;
  }

  function ensureModal() {
    if (modal) return modal;
    const root = document.createElement('div');
    root.className = 'cs2-inventory-overlay';
    root.id = 'cs2-inventory-overlay';
    root.hidden = true;
    root.innerHTML = `
      <section class="cs2-inventory-modal" role="dialog" aria-modal="true" aria-labelledby="cs2-inventory-title">
        <header class="cs2-inventory-topbar">
          <div class="cs2-inventory-brand"><span id="steam-vault-game-badge">CS2</span><div><strong>GAME VAULT</strong><small id="steam-vault-game-subtitle">Inventário público verificado pela Steam</small></div></div>
          <button class="cs2-inventory-close" type="button" aria-label="Fechar inventário">×</button>
        </header>
        <div class="cs2-inventory-hero" id="steam-vault-hero" data-app-id="730">
          <div class="cs2-inventory-player-avatar" id="cs2-inventory-avatar"><span>?</span></div>
          <div class="cs2-inventory-player-copy">
            <span class="cs2-inventory-kicker" id="steam-vault-kicker">ARSENAL DO JOGADOR</span>
            <h2 id="cs2-inventory-title">Carregando jogador</h2>
            <div class="cs2-inventory-player-meta" id="cs2-inventory-player-meta"></div>
          </div>
          <a class="cs2-inventory-steam-link" id="cs2-inventory-steam-link" target="_blank" rel="noopener noreferrer" hidden>Perfil Steam ↗</a>
        </div>
        <div class="cs2-inventory-content">
          <div class="cs2-inventory-stats" id="cs2-inventory-stats" aria-label="Resumo do inventário"></div>
          <div class="cs2-inventory-toolbar" id="cs2-inventory-toolbar" hidden>
            <div class="cs2-inventory-filters" id="cs2-inventory-filters" role="group" aria-label="Filtrar inventário"></div>
            <label class="cs2-inventory-search"><span aria-hidden="true">⌕</span><input id="cs2-inventory-search" type="search" maxlength="100" placeholder="Buscar skin, arma ou coleção" autocomplete="off"></label>
          </div>
          <div class="cs2-inventory-results-head" id="cs2-inventory-results-head" hidden><strong>COLEÇÃO</strong><span id="cs2-inventory-result-count"></span></div>
          <div class="cs2-inventory-grid" id="cs2-inventory-grid"></div>
        </div>
      </section>`;
    document.body.appendChild(root);
    modal = root;
    root.querySelector('.cs2-inventory-close').addEventListener('click', close);
    root.addEventListener('click', event => { if (event.target === root) close(); });
    root.querySelector('#cs2-inventory-search').addEventListener('input', event => {
      current.search = event.target.value.trim().toLocaleLowerCase('pt-BR');
      renderItems();
    });
    root.querySelector('#cs2-inventory-filters').addEventListener('click', event => {
      const button = event.target.closest('[data-inventory-category]');
      if (!button) return;
      current.category = button.dataset.inventoryCategory;
      renderFilters();
      renderItems();
    });
    return root;
  }

  function applyGameMeta(gameValue) {
    const gameKey = typeof gameValue === 'string' ? gameValue : gameValue?.key;
    const fallback = GAME_META[gameKey] || GAME_META.cs2;
    current.game = typeof gameValue === 'object' ? { ...fallback, ...gameValue } : fallback;
    const root = ensureModal();
    root.querySelector('#steam-vault-game-badge').textContent = current.game.shortName;
    root.querySelector('#steam-vault-game-subtitle').textContent = `${current.game.name} · inventário público verificado pela Steam`;
    root.querySelector('#steam-vault-kicker').textContent = current.game.kicker || fallback.kicker;
    root.querySelector('#steam-vault-hero').dataset.appId = String(current.game.appId || fallback.appId);
    root.querySelector('#cs2-inventory-search').placeholder = current.game.search || fallback.search;
  }

  function openShell(playerName, gameKey = 'cs2') {
    const root = ensureModal();
    applyGameMeta(gameKey);
    previousFocus = document.activeElement;
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('open'));
    document.body.classList.add('cs2-inventory-open');
    root.querySelector('#cs2-inventory-title').textContent = playerName;
    root.querySelector('#cs2-inventory-avatar').innerHTML = `<span>${escapeHtml(playerName.slice(0, 2).toUpperCase())}</span>`;
    root.querySelector('#cs2-inventory-player-meta').innerHTML = '<span class="cs2-inventory-live"><i></i> Conectando à Steam</span>';
    root.querySelector('#cs2-inventory-steam-link').hidden = true;
    root.querySelector('#cs2-inventory-toolbar').hidden = true;
    root.querySelector('#cs2-inventory-results-head').hidden = true;
    root.querySelector('#cs2-inventory-stats').innerHTML = '';
    renderSkeleton();
    root.querySelector('.cs2-inventory-close').focus();
  }

  function close() {
    if (!modal || modal.hidden) return;
    activeRequest?.abort();
    modal.classList.remove('open');
    document.body.classList.remove('cs2-inventory-open');
    window.setTimeout(() => { if (modal) modal.hidden = true; }, 180);
    previousFocus?.focus?.();
  }

  function renderSkeleton() {
    const grid = ensureModal().querySelector('#cs2-inventory-grid');
    grid.innerHTML = Array.from({ length: 10 }, () => '<div class="cs2-inventory-skeleton"><i></i><span></span><small></small></div>').join('');
  }

  function renderError(code) {
    const messages = {
      STEAM_INVENTORY_PRIVATE: ['INVENTÁRIO PRIVADO', 'Este jogador escolheu manter o inventário Steam privado. O restante do perfil competitivo continua disponível.', 'lock'],
      PLAYER_STEAM_ACCOUNT_NOT_FOUND: ['CONTA NÃO VINCULADA', 'Este integrante ainda não entrou no Clutchzone com a conta Steam usada no campeonato.', 'user'],
      PLAYER_IDENTITY_AMBIGUOUS: ['IDENTIDADE AMBÍGUA', 'Mais de uma conta Clutchzone usa este nick. O jogador precisa atualizar o cadastro para vincular sua identidade ao elenco.', 'user'],
      TOURNAMENT_PLAYER_NOT_FOUND: ['JOGADOR NÃO CONFIRMADO', 'O jogador não faz parte do elenco aprovado deste campeonato.', 'roster'],
      RATE_LIMITED: ['MUITAS CONSULTAS', 'Aguarde um instante antes de abrir outro inventário.', 'clock'],
      STEAM_INVENTORY_RATE_LIMITED: ['STEAM OCUPADA', 'A Steam limitou consultas temporariamente. Tente novamente em alguns minutos.', 'clock'],
      PLAYER_NOT_FOUND: ['PERFIL INDISPONÍVEL', 'Este perfil de jogador não está disponível no Clutchzone.', 'user'],
    };
    const [title, message, icon] = messages[code] || ['INVENTÁRIO INDISPONÍVEL', 'Não foi possível carregar este inventário agora. Tente novamente mais tarde.', 'alert'];
    ensureModal().querySelector('#cs2-inventory-grid').innerHTML = `<div class="cs2-inventory-empty"><div class="cs2-inventory-empty-icon ${icon}">◇</div><span>STEAM COMMUNITY</span><h3>${title}</h3><p>${message}</p></div>`;
  }

  function renderPlayer() {
    const { player, inventory } = current;
    const root = ensureModal();
    applyGameMeta(current.game);
    root.querySelector('#cs2-inventory-title').textContent = player.displayName;
    const avatar = root.querySelector('#cs2-inventory-avatar');
    avatar.innerHTML = player.avatarUrl
      ? `<img src="${escapeHtml(player.avatarUrl)}" alt="Avatar de ${escapeHtml(player.displayName)}">`
      : `<span>${escapeHtml(player.displayName.slice(0, 2).toUpperCase())}</span>`;
    const online = Number(player.personaState) > 0;
    root.querySelector('#cs2-inventory-player-meta').innerHTML = `
      <span class="cs2-inventory-live ${online ? '' : 'offline'}"><i></i>${online ? 'Online na Steam' : 'Offline na Steam'}</span>
      ${player.steamLevel != null ? `<span>Nível Steam ${Number(player.steamLevel)}</span>` : ''}
      <span>Sincronizado agora</span>`;
    const steamLink = root.querySelector('#cs2-inventory-steam-link');
    steamLink.href = player.profileUrl;
    steamLink.hidden = false;
    const rare = inventory.items.filter(item => item.rarity).length;
    const marketable = inventory.items.filter(item => item.marketable).length;
    root.querySelector('#cs2-inventory-stats').innerHTML = `
      <div><span>ITENS PÚBLICOS</span><strong>${inventory.total.toLocaleString('pt-BR')}</strong></div>
      <div><span>COM RARIDADE</span><strong>${rare}</strong></div>
      <div><span>NEGOCIÁVEIS</span><strong>${marketable}</strong></div>
      <div><span>CARREGADOS</span><strong>${inventory.loaded.toLocaleString('pt-BR')}</strong></div>`;
    root.querySelector('#cs2-inventory-toolbar').hidden = false;
    root.querySelector('#cs2-inventory-results-head').hidden = false;
    renderFilters();
    renderItems();
  }

  function renderFilters() {
    const items = current.inventory?.items || [];
    const counts = items.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + 1 }), {});
    ensureModal().querySelector('#cs2-inventory-filters').innerHTML = Object.entries(CATEGORY_META).map(([category, [label, icon]]) => {
      const count = category === 'all' ? items.length : counts[category] || 0;
      if (category !== 'all' && !count) return '';
      return `<button type="button" data-inventory-category="${category}" class="${current.category === category ? 'active' : ''}"><i>${icon}</i>${label}<small>${count}</small></button>`;
    }).join('');
  }

  function renderItems() {
    const root = ensureModal();
    const inventory = current.inventory;
    if (!inventory) return;
    const items = inventory.items.filter(item => {
      const categoryMatches = current.category === 'all' || item.category === current.category;
      const searchable = `${item.name} ${item.type || ''} ${item.rarity || ''} ${item.exterior || ''}`.toLocaleLowerCase('pt-BR');
      return categoryMatches && (!current.search || searchable.includes(current.search));
    });
    root.querySelector('#cs2-inventory-result-count').textContent = `${items.length} item${items.length === 1 ? '' : 's'} exibido${items.length === 1 ? '' : 's'}`;
    const grid = root.querySelector('#cs2-inventory-grid');
    if (!items.length) {
      grid.innerHTML = '<div class="cs2-inventory-empty compact"><div class="cs2-inventory-empty-icon">⌕</div><h3>NADA POR AQUI</h3><p>Ajuste os filtros ou tente outro termo de busca.</p></div>';
      return;
    }
    grid.innerHTML = items.map(item => {
      const color = safeColor(item.rarityColor);
      return `<article class="cs2-item-card" style="--item-rarity:${color}">
        <div class="cs2-item-glow"></div>
        <div class="cs2-item-flags">${item.tradable ? '<span>TR</span>' : ''}${item.marketable ? '<span>MK</span>' : ''}</div>
        <div class="cs2-item-image">${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">` : `<span>${escapeHtml(current.game.shortName)}</span>`}</div>
        <div class="cs2-item-copy"><small>${escapeHtml(item.type || CATEGORY_META[item.category]?.[0] || `Item ${current.game.shortName}`)}</small><strong>${escapeHtml(item.name)}</strong><div>${item.rarity ? `<span style="color:${color}">${escapeHtml(item.rarity)}</span>` : `<span>Item ${escapeHtml(current.game.shortName)}</span>`}${item.exterior ? `<em>${escapeHtml(item.exterior)}</em>` : ''}</div></div>
      </article>`;
    }).join('');
  }

  async function loadInventory({ endpoint, playerName, game = 'cs2', payloadPromise = null }) {
    const player = String(playerName || '').trim();
    if (!endpoint || !player) return;
    activeRequest?.abort();
    const requestController = new AbortController();
    activeRequest = requestController;
    current = { player: null, inventory: null, game: GAME_META[game] || GAME_META.cs2, category: 'all', search: '' };
    openShell(player, game);
    const search = ensureModal().querySelector('#cs2-inventory-search');
    search.value = '';
    try {
      const payload = payloadPromise || requestInventoryPayload(endpoint, requestController.signal);
      const resolvedPayload = await payload;
      if (requestController.signal.aborted || activeRequest !== requestController) return;
      current.player = resolvedPayload.player;
      current.inventory = resolvedPayload.inventory;
      if (resolvedPayload.game) current.game = { ...(GAME_META[resolvedPayload.game.key] || GAME_META.cs2), ...resolvedPayload.game };
      renderPlayer();
    } catch (error) {
      if (error?.name !== 'AbortError') renderError(error?.code);
    }
  }

  function open({ tournamentId, playerName }) {
    const tournament = String(tournamentId || '').trim();
    const player = String(playerName || '').trim();
    if (!tournament || !player) return;
    return loadInventory({
      endpoint: `/api/tournaments/${encodeURIComponent(tournament)}/players/${encodeURIComponent(player)}/cs2-inventory`,
      playerName: player,
      game: 'cs2',
    });
  }

  function openProfile({ userId, playerName, game = 'cs2' }) {
    const clutchzoneUserId = String(userId || '').trim();
    const player = String(playerName || '').trim();
    const gameKey = String(game || '').trim().toLowerCase();
    const request = profileInventoryRequest(clutchzoneUserId, gameKey);
    if (!request || !player) return;
    return loadInventory({
      endpoint: request.endpoint,
      playerName: player,
      game: gameKey,
      payloadPromise: preloadProfile({ userId: clutchzoneUserId, game: gameKey }),
    });
  }

  document.addEventListener('click', event => {
    const profileTrigger = event.target.closest('[data-steam-showcase-user][data-steam-showcase-game]');
    if (profileTrigger) {
      event.preventDefault();
      openProfile({
        userId: safeDecode(profileTrigger.dataset.steamShowcaseUser),
        playerName: safeDecode(profileTrigger.dataset.steamShowcasePlayer),
        game: safeDecode(profileTrigger.dataset.steamShowcaseGame),
      });
      return;
    }
    const trigger = event.target.closest('[data-cs2-inventory-player][data-cs2-tournament-id]');
    if (!trigger) return;
    event.preventDefault();
    open({
      tournamentId: safeDecode(trigger.dataset.cs2TournamentId),
      playerName: safeDecode(trigger.dataset.cs2InventoryPlayer),
    });
  });
  document.addEventListener('keydown', event => {
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(element => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  window.ClutchInventory = { open, openProfile, preloadProfile, getShowcaseVisibility, setShowcaseVisibility, close };
})();
