(function () {
  'use strict';

  const byId = id => document.getElementById(id);
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
  const kindLabels = { SPONSORSHIP: 'Patrocínio', STREAMER_SERVICE: 'Streamer', PRODUCT: 'Produto' };
  const statusLabels = { DRAFT: 'Rascunho', PUBLISHED: 'Publicado', PAUSED: 'Pausado', ARCHIVED: 'Arquivado', PENDING: 'Pendente', ACCEPTED: 'Aceito', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' };

  function setError(message) {
    const error = byId('erp-error');
    error.hidden = !message;
    error.textContent = message || '';
  }

  function statusBadge(status) {
    const badge = document.createElement('span');
    badge.className = `erp-status ${status}`;
    badge.textContent = statusLabels[status] || status;
    return badge;
  }

  function actionButton(label, handler, variant = 'secondary') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `market-button ${variant}`;
    button.textContent = label;
    button.addEventListener('click', async () => {
      button.disabled = true;
      setError('');
      try { await handler(); } catch (error) { setError(error.message); } finally { button.disabled = false; }
    });
    return button;
  }

  function emptyRow(columns, message) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns;
    cell.textContent = message;
    cell.style.color = 'var(--market-muted)';
    cell.style.textAlign = 'center';
    cell.style.padding = '28px';
    row.appendChild(cell);
    return row;
  }

  function renderListings(listings) {
    const body = byId('listing-table-body');
    body.innerHTML = '';
    if (!listings.length) {
      body.appendChild(emptyRow(6, 'Nenhum anúncio criado. Seu primeiro anúncio começará como rascunho.'));
      return;
    }
    listings.forEach(listing => {
      const row = document.createElement('tr');
      const title = document.createElement('td'); title.textContent = listing.title;
      const kind = document.createElement('td'); kind.textContent = kindLabels[listing.kind] || listing.kind;
      const price = document.createElement('td'); price.textContent = listing.priceCents ? money(listing.priceCents) : 'Sob proposta';
      const stock = document.createElement('td'); stock.textContent = String(listing.stockQuantity);
      const status = document.createElement('td'); status.appendChild(statusBadge(listing.status));
      const actions = document.createElement('td'); actions.className = 'erp-actions';
      if (listing.status === 'DRAFT' || listing.status === 'PAUSED') actions.appendChild(actionButton('PUBLICAR', async () => { await window.CluchAPI.updateSellerListingStatus(listing.id, 'PUBLISHED'); await loadDashboard(); }));
      if (listing.status === 'PUBLISHED') actions.appendChild(actionButton('PAUSAR', async () => { await window.CluchAPI.updateSellerListingStatus(listing.id, 'PAUSED'); await loadDashboard(); }, 'warning'));
      if (listing.status !== 'ARCHIVED') actions.appendChild(actionButton('ARQUIVAR', async () => { await window.CluchAPI.updateSellerListingStatus(listing.id, 'ARCHIVED'); await loadDashboard(); }, 'danger'));
      row.append(title, kind, price, stock, status, actions);
      body.appendChild(row);
    });
  }

  function renderOrders(orders) {
    const body = byId('order-table-body');
    body.innerHTML = '';
    if (!orders.length) {
      body.appendChild(emptyRow(6, 'Nenhum pedido recebido até agora.'));
      return;
    }
    orders.forEach(order => {
      const row = document.createElement('tr');
      const buyer = document.createElement('td'); buyer.textContent = order.buyerDisplayName;
      const listing = document.createElement('td'); listing.textContent = `${order.listingTitle} × ${order.quantity}`;
      const total = document.createElement('td'); total.textContent = money(order.totalCents);
      const brief = document.createElement('td'); brief.textContent = order.brief; brief.title = order.brief;
      const status = document.createElement('td'); status.appendChild(statusBadge(order.status));
      const actions = document.createElement('td'); actions.className = 'erp-actions';
      if (order.status === 'PENDING') actions.appendChild(actionButton('ACEITAR', async () => { await window.CluchAPI.updateSellerOrderStatus(order.id, 'ACCEPTED'); await loadDashboard(); }));
      if (order.status === 'ACCEPTED') actions.appendChild(actionButton('CONCLUIR', async () => { await window.CluchAPI.updateSellerOrderStatus(order.id, 'COMPLETED'); await loadDashboard(); }));
      if (order.status === 'PENDING' || order.status === 'ACCEPTED') actions.appendChild(actionButton('CANCELAR', async () => { await window.CluchAPI.updateSellerOrderStatus(order.id, 'CANCELLED'); await loadDashboard(); }, 'danger'));
      row.append(buyer, listing, total, brief, status, actions);
      body.appendChild(row);
    });
  }

  function fillProfile(seller) {
    if (!seller) return;
    byId('seller-name').value = seller.storeName || '';
    byId('seller-category').value = seller.category || 'MERCHANT';
    byId('seller-description').value = seller.description || '';
    byId('seller-website').value = seller.websiteUrl || '';
  }

  function renderDashboard(dashboard) {
    const seller = dashboard.seller;
    byId('erp-title').textContent = seller ? `${seller.storeName} · Seller Ops` : 'Configure sua operação comercial';
    byId('metric-listings').textContent = dashboard.metrics.totalListings;
    byId('metric-published').textContent = dashboard.metrics.publishedListings;
    byId('metric-pending').textContent = dashboard.metrics.pendingOrders;
    byId('metric-revenue').textContent = money(dashboard.metrics.completedRevenueCents);
    fillProfile(seller);
    ['erp-new-listing', 'erp-listings', 'erp-orders'].forEach(id => { byId(id).hidden = !seller; });
    renderListings(dashboard.listings || []);
    renderOrders(dashboard.orders || []);
  }

  async function loadDashboard() {
    setError('');
    const dashboard = await window.CluchAPI.getSellerDashboard();
    renderDashboard(dashboard);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await window.CluchAPI.saveSellerProfile({
        storeName: byId('seller-name').value.trim(),
        category: byId('seller-category').value,
        description: byId('seller-description').value.trim(),
        websiteUrl: byId('seller-website').value.trim() || null,
      });
      await loadDashboard();
    } catch (error) {
      setError(error.message);
    } finally {
      submit.disabled = false;
    }
  }

  async function createListing(event) {
    event.preventDefault();
    setError('');
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const priceCents = Math.round(Number(byId('listing-price').value) * 100);
      await window.CluchAPI.createSellerListing({
        kind: byId('listing-kind').value,
        title: byId('listing-title').value.trim(),
        description: byId('listing-description').value.trim(),
        game: byId('listing-game').value.trim(),
        audience: byId('listing-audience').value.trim() || null,
        priceCents,
        stockQuantity: Number(byId('listing-stock').value),
        imageUrl: byId('listing-image').value.trim() || null,
      });
      event.currentTarget.reset();
      byId('listing-price').value = '0';
      byId('listing-stock').value = '1';
      await loadDashboard();
    } catch (error) {
      setError(error.message);
    } finally {
      submit.disabled = false;
    }
  }

  async function init() {
    await window.ClutchAuth?.ready;
    const authenticated = Boolean(window.ClutchAuth?.getUser());
    byId('erp-auth-gate').hidden = authenticated;
    byId('erp-shell').hidden = !authenticated;
    if (!authenticated) return;
    try { await loadDashboard(); } catch (error) { setError(error.message); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    byId('erp-login').addEventListener('click', () => window.ClutchAuth?.open());
    byId('seller-profile-form').addEventListener('submit', saveProfile);
    byId('listing-form').addEventListener('submit', createListing);
    void init();
  });
})();
