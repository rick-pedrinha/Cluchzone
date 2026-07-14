(function () {
  'use strict';

  const kits = {
    cs2: {
      eyebrow: 'ARSENAL TÁTICO',
      title: 'LOADOUT DE DESTAQUE',
      note: 'Rifle, sidearm e utilitárias para entrar no round pronto.',
      action: 'ABRIR MEU INVENTÁRIO',
      slots: [
        { kind: 'rifle', code: 'AK-47', label: 'Rifle principal' },
        { kind: 'pistol', code: 'USP-S', label: 'Sidearm silenciosa' },
        { kind: 'he', code: 'HE', label: 'Granada explosiva' },
        { kind: 'smoke', code: 'SMK', label: 'Granada de fumaça' },
      ],
    },
    pubg: {
      eyebrow: 'SURVIVAL KIT',
      title: 'PRONTO PARA O DROP',
      note: 'Loot, proteção e cobertura para sobreviver até o círculo final.',
      action: 'ESCOLHER CAMPEONATO',
      slots: [
        { kind: 'crate', code: 'DROP', label: 'Airdrop' },
        { kind: 'helmet', code: 'LV.3', label: 'Capacete nível 3' },
        { kind: 'smoke', code: 'SMK', label: 'Granada de fumaça' },
        { kind: 'boost', code: '+40', label: 'Boost de energia' },
      ],
    },
    brawl: {
      eyebrow: 'BATTLE KIT',
      title: 'PODER PARA O 3V3',
      note: 'Gemas, Super e Power Cubes dão o ritmo de uma arena arcade.',
      action: 'ENTRAR NA ARENA',
      slots: [
        { kind: 'gem', code: 'GEM', label: 'Gem Grab' },
        { kind: 'super', code: 'SUPER', label: 'Super carregado' },
        { kind: 'cube', code: 'PWR', label: 'Power Cube' },
        { kind: 'team', code: '3V3', label: 'Equipe completa' },
      ],
    },
  };

  let mounted = null;
  let activeUserId = null;

  function currentGame() {
    if (document.body.classList.contains('csgo-theme')) return 'cs2';
    if (document.body.classList.contains('pubg-theme')) return 'pubg';
    if (document.body.classList.contains('brawl-theme')) return 'brawl';
    return null;
  }

  function hostFor(game) {
    if (game === 'cs2') return document.querySelector('.cs2-match-visual');
    if (game === 'pubg') return document.querySelector('.pubg-hero-content');
    if (game === 'brawl') return document.querySelector('.brawl-hero-content');
    return null;
  }

  function createFallbackSlot(item) {
    const slot = document.createElement('div');
    slot.className = 'game-signature-slot is-fallback';
    slot.dataset.kind = item.kind;
    slot.title = item.label;
    const visual = document.createElement('span');
    visual.className = 'game-signature-visual';
    visual.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'game-signature-slot-copy';
    const code = document.createElement('strong');
    code.textContent = item.code;
    const label = document.createElement('small');
    label.textContent = item.label;
    copy.append(code, label);
    slot.append(visual, copy);
    return slot;
  }

  function renderFallback(section, game) {
    const slots = section.querySelector('.game-signature-slots');
    slots.replaceChildren(...kits[game].slots.map(createFallbackSlot));
  }

  function safeSteamImage(value) {
    return typeof value === 'string' && /^https:\/\/community\.fastly\.steamstatic\.com\//.test(value) ? value : '';
  }

  function renderSteamHighlights(section, highlights) {
    const slots = section.querySelector('.game-signature-slots');
    slots.replaceChildren(...highlights.map(item => {
      const slot = document.createElement('div');
      slot.className = 'game-signature-slot has-steam-item';
      const rarity = /^#[a-f0-9]{6}$/i.test(String(item.rarityColor || '')) ? item.rarityColor : '#5b6b84';
      slot.style.setProperty('--signature-rarity', rarity);
      slot.title = item.name || 'Item Steam';
      const visual = document.createElement('span');
      visual.className = 'game-signature-visual';
      const source = safeSteamImage(item.imageUrl);
      if (source) {
        const image = document.createElement('img');
        image.src = source;
        image.alt = '';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        visual.appendChild(image);
      }
      const copy = document.createElement('span');
      copy.className = 'game-signature-slot-copy';
      const name = document.createElement('strong');
      name.textContent = item.name || 'Item Steam';
      const price = document.createElement('small');
      price.textContent = item.marketPrice?.formatted || item.rarity || 'Steam';
      copy.append(name, price);
      slot.append(visual, copy);
      return slot;
    }));
  }

  function createKit(game) {
    const config = kits[game];
    const section = document.createElement('section');
    section.className = `game-signature-kit is-${game}`;
    section.dataset.signatureGame = game;
    section.innerHTML = `
      <header class="game-signature-head">
        <span class="game-signature-heading"><small>${config.eyebrow}</small><strong>${config.title}</strong></span>
        <button class="game-signature-action" type="button">${config.action}</button>
      </header>
      <p class="game-signature-note" aria-live="polite">${config.note}</p>
      <div class="game-signature-slots"></div>`;
    renderFallback(section, game);
    return section;
  }

  function bindContextAction(section, game) {
    const action = section.querySelector('.game-signature-action');
    if (game === 'cs2') {
      action.hidden = true;
      action.addEventListener('click', () => {
        const user = window.ClutchAuth?.getUser?.();
        if (!user) return window.ClutchAuth?.open?.();
        window.ClutchInventory?.openProfile({ userId: user.uid || user.id, playerName: user.displayName || user.nick || 'Jogador', game: 'cs2' });
      });
      return;
    }
    const target = game === 'pubg' ? '.pubg-tournaments' : '.brawl-arena-lobby';
    action.addEventListener('click', () => document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function hydrateSteamKit(section, game) {
    if (!['cs2', 'pubg'].includes(game)) return;
    await window.ClutchAuth?.ready;
    const user = window.ClutchAuth?.getUser?.();
    const userId = user?.uid || user?.id;
    if (!userId || activeUserId === `${game}:${userId}` || !window.ClutchInventory?.preloadProfile) return;
    activeUserId = `${game}:${userId}`;
    const note = section.querySelector('.game-signature-note');
    const action = section.querySelector('.game-signature-action');
    note.textContent = 'Sincronizando destaques públicos da Steam…';
    section.classList.add('is-loading');
    try {
      const payload = await window.ClutchInventory.preloadProfile({ userId, game });
      const highlights = payload?.showcaseVisible !== false && payload?.showcaseAvailable === true && Array.isArray(payload.highlights)
        ? payload.highlights.slice(0, 4)
        : [];
      const canOpen = Boolean(payload?.player && payload?.inventory);
      if (canOpen) action.hidden = false;
      if (highlights.length === 4) {
        renderSteamHighlights(section, highlights);
        section.classList.add('has-steam-loadout');
        section.querySelector('.game-signature-heading small').textContent = 'SEU INVENTÁRIO PÚBLICO';
        section.querySelector('.game-signature-heading strong').textContent = 'SKINS EM DESTAQUE';
        note.textContent = 'Seus quatro itens públicos mais valiosos, verificados pelo Mercado Steam.';
      } else {
        note.textContent = kits[game].note;
      }
    } catch (_) {
      note.textContent = kits[game].note;
    } finally {
      section.classList.remove('is-loading');
    }
  }

  function mount() {
    const game = currentGame();
    const host = hostFor(game);
    if (!game || !host || host.querySelector('[data-signature-game]')) return;
    const section = createKit(game);
    if (game === 'cs2') host.querySelector('.cs2-visual-topline')?.insertAdjacentElement('afterend', section);
    else host.appendChild(section);
    bindContextAction(section, game);
    mounted = { section, game };
    void hydrateSteamKit(section, game);
  }

  window.addEventListener('clutchzone-auth-changed', () => {
    if (mounted) void hydrateSteamKit(mounted.section, mounted.game);
  });
  document.addEventListener('DOMContentLoaded', mount);
  if (document.readyState !== 'loading') mount();
})();
