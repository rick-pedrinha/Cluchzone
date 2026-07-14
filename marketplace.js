(function () {
  'use strict';

  const labels = {
    SPONSORSHIP: 'PATROCÍNIO',
    STREAMER_SERVICE: 'STREAMER',
    PRODUCT: 'PRODUTO',
  };
  const glyphs = { SPONSORSHIP: 'SPN', STREAMER_SERVICE: 'LIVE', PRODUCT: 'GEAR' };
  let selectedListing = null;

  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
  const byId = id => document.getElementById(id);

  function setError(target, message) {
    const element = byId(target);
    if (!element) return;
    element.hidden = !message;
    element.textContent = message || '';
  }

  function safeImage(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function buildListingCard(listing) {
    const card = document.createElement('article');
    card.className = 'listing-card';

    const cover = document.createElement('div');
    cover.className = 'listing-cover';
    const imageUrl = safeImage(listing.imageUrl);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      cover.appendChild(image);
    } else {
      const glyph = document.createElement('span');
      glyph.className = 'listing-glyph';
      glyph.textContent = glyphs[listing.kind] || 'CZ';
      cover.appendChild(glyph);
    }
    const kind = document.createElement('span');
    kind.className = 'listing-kind';
    kind.textContent = labels[listing.kind] || listing.kind;
    cover.appendChild(kind);

    const body = document.createElement('div');
    body.className = 'listing-body';
    const seller = document.createElement('div');
    seller.className = 'listing-seller';
    const dot = document.createElement('i');
    const sellerName = document.createElement('span');
    sellerName.textContent = `${listing.seller.storeName}${listing.seller.verified ? ' · verificado' : ''}`;
    seller.append(dot, sellerName);
    const title = document.createElement('h3');
    title.textContent = listing.title;
    const description = document.createElement('p');
    description.className = 'listing-description';
    description.textContent = listing.description;
    const meta = document.createElement('div');
    meta.className = 'listing-meta';
    [listing.game, listing.audience].filter(Boolean).forEach(value => {
      const badge = document.createElement('span');
      badge.textContent = value;
      meta.appendChild(badge);
    });
    if (listing.kind === 'PRODUCT') {
      const stock = document.createElement('span');
      stock.textContent = `${listing.stockQuantity} em estoque`;
      meta.appendChild(stock);
    }
    const bottom = document.createElement('div');
    bottom.className = 'listing-bottom';
    const price = document.createElement('div');
    price.className = 'listing-price';
    const priceValue = document.createElement('strong');
    priceValue.textContent = listing.priceCents ? money(listing.priceCents) : 'Sob proposta';
    const priceNote = document.createElement('small');
    priceNote.textContent = listing.kind === 'PRODUCT' ? 'por unidade' : 'valor base';
    price.append(priceValue, priceNote);
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'market-button';
    action.textContent = listing.kind === 'PRODUCT' ? 'COMPRAR' : 'NEGOCIAR';
    action.disabled = listing.kind === 'PRODUCT' && listing.stockQuantity < 1;
    action.addEventListener('click', () => openOrder(listing));
    bottom.append(price, action);
    body.append(seller, title, description, meta, bottom);
    card.append(cover, body);
    return card;
  }

  async function loadListings() {
    const container = byId('market-listings');
    setError('market-error', '');
    container.innerHTML = '<div class="market-loading">Sincronizando oportunidades...</div>';
    try {
      const listings = await window.CluchAPI.getMarketplaceListings({
        kind: byId('market-kind').value,
        game: byId('market-game').value.trim(),
        q: byId('market-search').value.trim(),
      });
      container.innerHTML = '';
      byId('market-count').textContent = `${listings.length} ${listings.length === 1 ? 'ANÚNCIO' : 'ANÚNCIOS'}`;
      if (!listings.length) {
        container.innerHTML = '<div class="market-empty">Nenhum anúncio publicado corresponde a este radar. Ajuste os filtros ou volte em breve.</div>';
        return;
      }
      listings.forEach(listing => container.appendChild(buildListingCard(listing)));
    } catch (error) {
      container.innerHTML = '<div class="market-empty">A vitrine não pôde ser sincronizada agora.</div>';
      byId('market-count').textContent = 'INDISPONÍVEL';
      setError('market-error', error.message);
    }
  }

  function refreshOrderTotal() {
    if (!selectedListing) return;
    const quantity = Math.max(1, Number(byId('order-quantity').value || 1));
    byId('order-total').value = selectedListing.priceCents ? money(selectedListing.priceCents * quantity) : 'A definir com o vendedor';
  }

  async function openOrder(listing) {
    await window.ClutchAuth?.ready;
    if (!window.ClutchAuth?.getUser()) {
      window.ClutchAuth?.open();
      return;
    }
    selectedListing = listing;
    byId('order-listing-name').textContent = `${listing.title} · ${listing.seller.storeName}`;
    byId('order-quantity').value = '1';
    byId('order-quantity').max = listing.kind === 'PRODUCT' ? String(Math.min(100, listing.stockQuantity)) : '1';
    byId('order-brief').value = '';
    setError('order-error', '');
    refreshOrderTotal();
    byId('order-modal').classList.add('open');
    byId('order-brief').focus();
  }

  function closeOrder() {
    byId('order-modal').classList.remove('open');
    selectedListing = null;
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!selectedListing) return;
    setError('order-error', '');
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await window.CluchAPI.createMarketplaceOrder(selectedListing.id, {
        quantity: Number(byId('order-quantity').value),
        brief: byId('order-brief').value.trim(),
      });
      closeOrder();
      window.alert('Pedido enviado. O vendedor já pode acompanhar a solicitação no ERP ClutchZone.');
    } catch (error) {
      if (error.status === 401) window.ClutchAuth?.open();
      else setError('order-error', error.message);
    } finally {
      submit.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    byId('market-filters').addEventListener('submit', event => { event.preventDefault(); void loadListings(); });
    byId('order-form').addEventListener('submit', submitOrder);
    byId('order-quantity').addEventListener('input', refreshOrderTotal);
    byId('order-close').addEventListener('click', closeOrder);
    byId('order-cancel').addEventListener('click', closeOrder);
    byId('order-modal').addEventListener('click', event => { if (event.target === byId('order-modal')) closeOrder(); });
    void loadListings();
  });
})();
