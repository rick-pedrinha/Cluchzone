(function () {
  'use strict';
  if (window.ClutchGlobal) return;

  const fallbackCatalog = {
    locales: [
      { code: 'pt-BR', label: 'Português (Brasil)' }, { code: 'en-US', label: 'English (United States)' },
      { code: 'es-419', label: 'Español (Latinoamérica)' }, { code: 'fr-FR', label: 'Français' },
      { code: 'de-DE', label: 'Deutsch' }, { code: 'it-IT', label: 'Italiano' }, { code: 'pl-PL', label: 'Polski' },
      { code: 'tr-TR', label: 'Türkçe' }, { code: 'ru-RU', label: 'Русский' }, { code: 'ja-JP', label: '日本語' },
      { code: 'ko-KR', label: '한국어' }, { code: 'zh-CN', label: '简体中文' }, { code: 'zh-TW', label: '繁體中文' },
    ],
    currencies: ['BRL', 'USD', 'EUR', 'GBP', 'CAD', 'MXN', 'ARS', 'CLP', 'TRY', 'JPY', 'KRW', 'CNY', 'AUD'],
    communityRegions: [
      { code: 'south-america', label: 'South America' }, { code: 'north-america', label: 'North America' },
      { code: 'europe', label: 'Europe' }, { code: 'middle-east', label: 'Middle East' },
      { code: 'africa', label: 'Africa' }, { code: 'asia', label: 'Asia' }, { code: 'oceania', label: 'Oceania' },
    ],
    matchRegions: [],
  };
  const PREFERENCES_KEY = 'cluchzone_global_preferences_v1';
  const strings = {
    'pt-BR': { button: '🌐 Global', title: 'Preferências globais', subtitle: 'Idioma, região e formatos', language: 'Idioma e formato', region: 'Região competitiva', timezone: 'Fuso horário', currency: 'Moeda preferida', save: 'SALVAR PREFERÊNCIAS', saved: 'Preferências sincronizadas.', guest: 'Entre com a Steam para sincronizar estas preferências em todos os dispositivos.', local: 'Aplicado neste acesso. Entre com a Steam para sincronizar.' },
    'es-419': { button: '🌐 Global', title: 'Preferencias globales', subtitle: 'Idioma, región y formatos', language: 'Idioma y formato', region: 'Región competitiva', timezone: 'Zona horaria', currency: 'Moneda preferida', save: 'GUARDAR PREFERENCIAS', saved: 'Preferencias sincronizadas.', guest: 'Inicia sesión con Steam para sincronizar estas preferencias en todos tus dispositivos.', local: 'Aplicado en esta visita. Inicia sesión con Steam para sincronizar.' },
    'en-US': { button: '🌐 Global', title: 'Global preferences', subtitle: 'Language, region and formats', language: 'Language and format', region: 'Competitive region', timezone: 'Time zone', currency: 'Preferred currency', save: 'SAVE PREFERENCES', saved: 'Preferences synced.', guest: 'Sign in with Steam to sync these preferences across devices.', local: 'Applied for this visit. Sign in with Steam to sync.' },
  };

  const browserLocale = Intl.NumberFormat().resolvedOptions().locale || navigator.language || 'en-US';
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let catalog = fallbackCatalog;
  let preferences = { ...detectPreferences(), ...loadLocalPreferences() };
  let control = null;

  function loadLocalPreferences() {
    try {
      const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || 'null');
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
      return {
        ...(typeof stored.preferredLocale === 'string' ? { preferredLocale: stored.preferredLocale } : {}),
        ...(typeof stored.timeZone === 'string' ? { timeZone: stored.timeZone } : {}),
        ...(typeof stored.currencyCode === 'string' ? { currencyCode: stored.currencyCode } : {}),
        ...(typeof stored.regionCode === 'string' ? { regionCode: stored.regionCode } : {}),
      };
    } catch (_) {
      return {};
    }
  }

  function persistLocalPreferences() {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch (_) { /* storage unavailable */ }
  }

  function supportedLocale(value) {
    const exact = catalog.locales.find(item => item.code.toLowerCase() === String(value || '').toLowerCase());
    if (exact) return exact.code;
    const language = String(value || '').split('-')[0].toLowerCase();
    return catalog.locales.find(item => item.code.toLowerCase().startsWith(`${language}-`))?.code || 'en-US';
  }

  function detectRegion(timeZone) {
    if (/^(America\/Sao_Paulo|America\/Argentina|America\/Santiago|America\/Bogota|America\/Lima)/.test(timeZone)) return 'south-america';
    if (/^America\//.test(timeZone)) return 'north-america';
    if (/^(Europe\/)/.test(timeZone)) return 'europe';
    if (/^(Asia\/(Dubai|Riyadh|Jerusalem|Qatar|Kuwait|Bahrain))/.test(timeZone)) return 'middle-east';
    if (/^(Africa\/)/.test(timeZone)) return 'africa';
    if (/^(Australia\/|Pacific\/Auckland)/.test(timeZone)) return 'oceania';
    return 'asia';
  }

  function detectCurrency(locale) {
    const territory = String(locale).split('-').at(-1)?.toUpperCase();
    return ({ BR: 'BRL', US: 'USD', GB: 'GBP', CA: 'CAD', MX: 'MXN', AR: 'ARS', CL: 'CLP', TR: 'TRY', JP: 'JPY', KR: 'KRW', CN: 'CNY', AU: 'AUD' })[territory] || 'EUR';
  }

  function detectPreferences() {
    const locale = supportedLocale(browserLocale);
    return { preferredLocale: locale, timeZone: browserTimeZone, currencyCode: detectCurrency(browserLocale), regionCode: detectRegion(browserTimeZone) };
  }

  function activeStrings() {
    return strings[preferences.preferredLocale] || strings[preferences.preferredLocale.startsWith('es') ? 'es-419' : preferences.preferredLocale.startsWith('pt') ? 'pt-BR' : 'en-US'];
  }

  function apply(next, emit = true) {
    preferences = { ...preferences, ...next };
    persistLocalPreferences();
    document.documentElement.lang = preferences.preferredLocale;
    document.documentElement.dataset.region = preferences.regionCode;
    document.documentElement.dataset.timeZone = preferences.timeZone;
    if (control) renderControlText();
    if (emit) window.dispatchEvent(new CustomEvent('clutchzone-global-changed', { detail: { ...preferences } }));
  }

  function formatCurrency(amountMinor, currencyCode = preferences.currencyCode) {
    return new Intl.NumberFormat(preferences.preferredLocale, { style: 'currency', currency: currencyCode }).format(Number(amountMinor || 0) / 100);
  }

  function formatNumber(value, options) {
    return new Intl.NumberFormat(preferences.preferredLocale, options).format(Number(value || 0));
  }

  function formatDate(value, options = {}) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(preferences.preferredLocale, { timeZone: preferences.timeZone, dateStyle: 'medium', timeStyle: 'short', ...options }).format(date);
  }

  function option(value, label, selected) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    element.selected = value === selected;
    return element;
  }

  function fillSelect(select, values, selected) {
    select.replaceChildren(...values.map(item => option(item.code || item, item.label || item, selected)));
  }

  function fillRegionSelect(select, selected = '') {
    if (!select) return;
    const current = selected || select.value || preferences.regionCode;
    fillSelect(select, catalog.communityRegions, current);
  }

  function renderControlText() {
    if (!control) return;
    const text = activeStrings();
    control.querySelector('.cz-global-button').textContent = text.button;
    control.querySelector('[data-global-title]').textContent = text.title;
    control.querySelector('[data-global-subtitle]').textContent = text.subtitle;
    control.querySelector('[for="cz-global-locale"]').textContent = text.language;
    control.querySelector('[for="cz-global-region"]').textContent = text.region;
    control.querySelector('[for="cz-global-timezone"]').textContent = text.timezone;
    control.querySelector('[for="cz-global-currency"]').textContent = text.currency;
    control.querySelector('.cz-global-save').textContent = text.save;
    control.querySelector('.cz-global-note').textContent = window.ClutchAuth?.getUser?.() ? '' : text.guest;
  }

  function syncInputs() {
    if (!control) return;
    fillSelect(control.querySelector('#cz-global-locale'), catalog.locales, preferences.preferredLocale);
    fillSelect(control.querySelector('#cz-global-region'), catalog.communityRegions, preferences.regionCode);
    fillSelect(control.querySelector('#cz-global-currency'), catalog.currencies, preferences.currencyCode);
    control.querySelector('#cz-global-timezone').value = preferences.timeZone;
  }

  function createControl() {
    if (control || !document.body) return;
    control = document.createElement('div');
    control.className = 'cz-global-control';
    control.innerHTML = `<button class="cz-global-button" type="button" aria-expanded="false">🌐 Global</button>
      <section class="cz-global-panel" hidden aria-label="Global preferences">
        <div class="cz-global-head"><div><strong data-global-title></strong><span data-global-subtitle></span></div><button class="cz-global-close" type="button" aria-label="Close">×</button></div>
        <form class="cz-global-form">
          <div class="cz-global-field"><label for="cz-global-locale"></label><select id="cz-global-locale"></select></div>
          <div class="cz-global-field"><label for="cz-global-region"></label><select id="cz-global-region"></select></div>
          <div class="cz-global-field full"><label for="cz-global-timezone"></label><select id="cz-global-timezone"></select></div>
          <div class="cz-global-field full"><label for="cz-global-currency"></label><select id="cz-global-currency"></select></div>
          <p class="cz-global-note full"></p><div class="cz-global-status" role="status"></div><button class="cz-global-save" type="submit"></button>
        </form>
      </section>`;
    const zone = control.querySelector('#cz-global-timezone');
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [browserTimeZone, 'UTC'];
    fillSelect(zone, zones, preferences.timeZone);
    const panel = control.querySelector('.cz-global-panel');
    const button = control.querySelector('.cz-global-button');
    const close = () => { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); };
    button.addEventListener('click', () => { panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) syncInputs(); });
    control.querySelector('.cz-global-close').addEventListener('click', close);
    control.querySelector('.cz-global-form').addEventListener('submit', async event => {
      event.preventDefault();
      const save = control.querySelector('.cz-global-save');
      const status = control.querySelector('.cz-global-status');
      const next = { preferredLocale: control.querySelector('#cz-global-locale').value, regionCode: control.querySelector('#cz-global-region').value, timeZone: zone.value, currencyCode: control.querySelector('#cz-global-currency').value };
      apply(next);
      save.disabled = true;
      try {
        if (window.ClutchAuth?.getUser?.()) {
          const saved = await window.CluchAPI.saveGlobalPreferences(next);
          apply(saved);
          await window.ClutchAuth.refresh();
          status.textContent = activeStrings().saved;
        } else status.textContent = activeStrings().local;
      } catch (error) { status.textContent = error.message || 'Unable to save preferences.'; }
      finally { save.disabled = false; }
    });
    (document.querySelector('.nav-actions') || document.body).prepend(control);
    syncInputs();
    renderControlText();
  }

  async function loadCatalog() {
    try {
      const remote = await window.CluchAPI?.getGlobalCatalog?.();
      if (remote?.locales?.length) catalog = remote;
    } catch (error) { console.warn('[ClutchGlobal] catálogo remoto indisponível; usando catálogo público embutido.', error.message); }
    apply(preferences, false);
    syncInputs();
    document.querySelectorAll('[data-global-region-select], #tm-region, #tournament-region, #cs2-form-region').forEach(select => fillRegionSelect(select));
    return catalog;
  }

  const ready = loadCatalog();
  window.ClutchGlobal = { ready, getCatalog: () => catalog, getPreferences: () => ({ ...preferences }), formatCurrency, formatNumber, formatDate, fillRegionSelect };

  window.addEventListener('clutchzone-auth-changed', event => {
    const user = event.detail;
    if (user) apply({
      preferredLocale: user.preferredLocale || preferences.preferredLocale,
      timeZone: user.timeZone || preferences.timeZone,
      currencyCode: user.currencyCode || preferences.currencyCode,
      regionCode: user.regionCode || preferences.regionCode,
    });
    renderControlText();
  });
  document.addEventListener('click', event => { if (control && !control.contains(event.target)) { control.querySelector('.cz-global-panel').hidden = true; control.querySelector('.cz-global-button').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('DOMContentLoaded', createControl);
  if (document.readyState !== 'loading') createControl();
})();
