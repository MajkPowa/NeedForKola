/* Need For Wheels — searchable, exact-record vehicle catalogue. */
(function () {
  'use strict';
  const root = document.getElementById('vehicleCatalogue');
  const V = window.NFWVehicles;
  if (!root || !V) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalise = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const num = value => Number(value).toLocaleString('cs-CZ');
  const through = Math.min(Number(V.verifiedThrough || V.through || 2026), 2026);
  const pageSize = 12;
  const models = V.brands.flatMap(brand => brand.models.map(model => ({
    brand, model, key: brand.id + '/' + model.id,
    variants: (model.variants || model.generations || []).filter(g => Number.isInteger(g.from) && g.from <= through && Number.isInteger(g.to) && g.to >= g.from),
    search: normalise(brand.name + ' ' + model.name)
  })));
  const totalVariants = models.reduce((count, item) => count + item.variants.length, 0);
  const state = { brand: '', search: '', year: '', page: 1 };
  const query = new URLSearchParams(location.search);
  if (V.brands.some(b => b.id === query.get('catalogBrand'))) state.brand = query.get('catalogBrand');
  state.search = (query.get('catalogSearch') || query.get('catalogModel') || '').slice(0, 80);
  if (/^\d{4}$/.test(query.get('catalogYear') || '') && Number(query.get('catalogYear')) <= through) state.year = query.get('catalogYear');
  state.page = Math.max(1, Number.parseInt(query.get('catalogPage'), 10) || 1);

  root.innerHTML = `
    <div class="catalog-heading">
      <div><span class="catalog-eyebrow">KATALOG VOZŮ / DO ROKU ${through}</span><h3 id="catalogTitle">NAJDI SVOU GENERACI.</h3><p>Vyber model, prohlédni jeho karoserie a pokračuj s konkrétním vozem.</p></div>
      <div class="catalog-totals" aria-label="Rozsah katalogu"><span><b>${num(V.brands.length)}</b>značek</span><span><b>${num(models.length)}</b>modelů</span><span><b>${num(totalVariants)}</b>variant v katalogu</span></div>
    </div>
    <div class="catalog-filters" role="search" aria-label="Vyhledávání vozů">
      <label class="catalog-search"><span>Hledat vůz</span><input id="catalogSearch" type="search" maxlength="80" autocomplete="off" placeholder="Např. BMW X5, Octavia, Model Y…" value="${esc(state.search)}" aria-controls="catalogResults"></label>
      <label><span>Značka</span><select id="catalogBrand" aria-controls="catalogResults"><option value="">Všechny značky</option>${V.brands.map(b => `<option value="${esc(b.id)}" ${state.brand === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label><span>Rok výroby</span><select id="catalogYear" aria-controls="catalogResults"><option value="">Všechny roky</option></select></label>
    </div>
    <div class="catalog-result-bar"><p id="catalogResultCount" role="status" aria-live="polite" aria-atomic="true"></p><button id="catalogReset" type="button" hidden>Zrušit filtry <span aria-hidden="true">×</span></button></div>
    <div class="catalog-models" id="catalogResults"></div>
    <nav class="catalog-pagination" id="catalogPagination" aria-label="Stránky katalogu"></nav>
    <div class="catalog-source-note"><span class="catalog-source-marker" aria-hidden="true">i</span><div><p>Katalog rozlišuje dostupné generace, provedení a karoserie. Záznamy průběžně doplňujeme; přesný vůz i vhodné rozměry kol potvrdíme před výrobou.</p><details class="catalog-sources"><summary>Zdroje a rozsah katalogu</summary><div><p>Roky vycházejí z dostupných podkladů a mohou se při změně generace překrývat. U otevřených období není potvrzen konec výroby. Samostatně označujeme oznámené vozy a záznamy doložené výrobcem. Katalogový záznam sám o sobě nepotvrzuje facelift, kompatibilitu kol ani dostupnost přesného 3D modelu.</p><p>Upravená data: <a href="https://github.com/gor3a/vehicle-makes-models" target="_blank" rel="noopener">vehicle-makes-models</a> / <a href="https://www.autoevolution.com/" target="_blank" rel="noopener">autoevolution.com</a>. Doplnění rodin, karoserií a zdrojů výrobců: Need For Wheels. Databáze pod licencí <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a> · <a href="data/vehicle-variants.json" download>Stáhnout upravená data</a>.</p></div></details></div></div>`;

  const brandInput = root.querySelector('#catalogBrand');
  const searchInput = root.querySelector('#catalogSearch');
  const yearInput = root.querySelector('#catalogYear');
  const resultContainer = root.querySelector('#catalogResults');
  const termsMatch = item => !state.search.trim() || normalise(state.search).split(' ').every(term => item.search.includes(term) || item.search.replace(/ /g, '').includes(term));
  const prefiltered = () => models.filter(item => (!state.brand || item.brand.id === state.brand) && termsMatch(item));
  const inYear = g => !state.year || (Number(state.year) >= g.from && Number(state.year) <= Math.min(g.to, through));

  function updateYears(items) {
    const years = new Set();
    for (const item of items) for (const g of item.variants) {
      for (let year = g.from; year <= Math.min(g.to, through); year++) years.add(year);
    }
    if (state.year && !years.has(Number(state.year))) state.year = '';
    yearInput.innerHTML = '<option value="">Všechny roky</option>' + [...years].sort((a, b) => b - a).map(year => `<option value="${year}" ${String(year) === state.year ? 'selected' : ''}>${year}</option>`).join('');
    yearInput.disabled = years.size === 0;
  }

  function saveFilters() {
    const url = new URL(location.href);
    url.searchParams.delete('catalogModel');
    for (const [key, value] of [['catalogBrand', state.brand], ['catalogSearch', state.search], ['catalogYear', state.year], ['catalogPage', state.page > 1 ? String(state.page) : '']]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function linkFor(item, variant) {
    const params = new URLSearchParams({ brand: item.brand.id, model: item.model.id });
    if (variant) {
      const year = state.year && inYear(variant) ? Number(state.year) : Math.min(variant.to, through);
      params.set('year', year);
      params.set('generation', variant.id);
      if (variant.body) params.set('body', variant.body);
    }
    params.set('view', 'car');
    return 'konfigurator.html?' + params.toString();
  }

  function period(g) {
    const end = Math.min(g.to, through);
    return String(g.from === end ? g.from : `${g.from}–${end}`);
  }

  function variantRow(item, g) {
    const status = g.status === 'announced' ? '<span class="catalog-variant-status">Oznámeno</span>' : '';
    const facelift = g.facelift === true ? '<span>Facelift</span>' : '';
    const body = g.bodyName || 'Karoserie neuvedena';
    const exactSource = typeof g.source === 'string' && /^https:\/\//i.test(g.source) ? g.source : '';
    const source = exactSource ? `<a class="catalog-variant-source" href="${esc(exactSource)}" target="_blank" rel="noopener" aria-label="Zdroj pro ${esc(g.name)}">${g.confidence === 'verified' ? 'Zdroj výrobce' : 'Zdroj záznamu'} ↗</a>` : '';
    const endNote = g.endBasis === 'open' ? 'Konec výroby neuveden' : g.endBasis === 'inferred' ? 'Období mezi katalogovými změnami' : '';
    return `<li class="catalog-variant"><span class="catalog-variant-period">${period(g)}</span><div class="catalog-variant-content"><b>${esc(g.name)}</b><div class="catalog-variant-meta"><span>${esc(body)}</span>${facelift}${status}</div>${endNote ? `<small>${endNote}</small>` : ''}${source}</div><a class="catalog-variant-select" href="${esc(linkFor(item, g))}" aria-label="Vybrat ${esc(item.brand.name + ' ' + item.model.name + ', ' + g.name + ', ' + body)}"><span>Vybrat</span><i aria-hidden="true">↗</i></a></li>`;
  }

  function modelCard(item) {
    const variants = item.variants.filter(inYear).slice().sort((a, b) => b.from - a.from || b.to - a.to || a.name.localeCompare(b.name, 'cs'));
    const bodies = [...new Set(variants.filter(g => g.body && g.body !== 'unknown').map(g => g.bodyName || g.body))];
    const years = variants.length ? `${Math.min(...variants.map(g => g.from))}–${Math.min(through, Math.max(...variants.map(g => g.to)))}` : 'Varianty doplňujeme';
    const firstRows = variants.slice(0, 6).map(g => variantRow(item, g)).join('');
    return `<article class="catalog-card" data-catalog-key="${esc(item.key)}"><div class="catalog-card-top"><span>${esc(item.brand.name)}</span><small>${state.year || years}</small></div><h4>${esc(item.model.name)}</h4><p class="catalog-card-bodies">${bodies.length ? esc(bodies.slice(0, 3).join(' / ')) + (bodies.length > 3 ? ` <span>+${bodies.length - 3}</span>` : '') : 'Výběr konkrétního vozu'}</p>${variants.length ? `<details class="catalog-variants"><summary><span>Generace a karoserie <b>${num(variants.length)}</b></span><i aria-hidden="true">+</i></summary><ol class="catalog-variant-list">${firstRows}</ol>${variants.length > 6 ? `<button class="catalog-more-variants" type="button" data-more-variants="${esc(item.key)}">Zobrazit zbývající varianty (${num(variants.length - 6)}) <span aria-hidden="true">↓</span></button>` : ''}</details>` : `<div class="catalog-card-missing"><span>Detailní podklady ještě doplňujeme.</span><a href="${esc(linkFor(item))}">Vybrat model <span aria-hidden="true">↗</span></a></div>`}</article>`;
  }

  function render({ years = false, persist = true } = {}) {
    const baseItems = prefiltered();
    if (years) updateYears(baseItems);
    const items = baseItems.filter(item => !state.year || item.variants.some(inYear));
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * pageSize;
    resultContainer.innerHTML = items.length ? items.slice(start, start + pageSize).map(modelCard).join('') : `<div class="catalog-empty"><span aria-hidden="true">⌕</span><h4>Tenhle vůz jsme nenašli.</h4><p>Zkus jiný název nebo zruš filtr značky a roku.</p><button type="button" data-catalog-clear>Zobrazit celý katalog →</button></div>`;
    root.querySelector('#catalogResultCount').innerHTML = items.length ? (items.length === 1 ? '<b>1</b> model' : `<b>${num(start + 1)}–${num(Math.min(start + pageSize, items.length))}</b> z ${num(items.length)} modelů`) + (state.year ? ` <span>· rok ${state.year}</span>` : '') : 'Žádný odpovídající model';
    root.querySelector('#catalogReset').hidden = !state.brand && !state.search && !state.year;
    root.querySelector('#catalogPagination').innerHTML = pages > 1 ? `<button type="button" data-catalog-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="Předchozí stránka katalogu"><span aria-hidden="true">←</span> Předchozí</button><span>Strana <b>${state.page}</b> / ${pages}</span><button type="button" data-catalog-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="Další stránka katalogu">Další <span aria-hidden="true">→</span></button>` : '';
    if (persist) saveFilters();
  }

  function clear() {
    Object.assign(state, { brand: '', search: '', year: '', page: 1 });
    brandInput.value = ''; searchInput.value = '';
    render({ years: true });
    searchInput.focus({ preventScroll: true });
  }

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    state.search = searchInput.value; state.page = 1;
    searchTimer = setTimeout(() => render({ years: true }), 120);
  });
  brandInput.addEventListener('change', () => { state.brand = brandInput.value; state.page = 1; render({ years: true }); });
  yearInput.addEventListener('change', () => { state.year = yearInput.value; state.page = 1; render(); });
  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.id === 'catalogReset' || target.hasAttribute('data-catalog-clear')) { clear(); return; }
    if (target.hasAttribute('data-catalog-page')) {
      state.page = Number(target.dataset.catalogPage); render();
      root.querySelector('.catalog-result-bar').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      root.querySelector('#catalogResultCount').setAttribute('tabindex', '-1');
      root.querySelector('#catalogResultCount').focus({ preventScroll: true });
    }
    if (target.hasAttribute('data-more-variants')) {
      const item = models.find(item => item.key === target.dataset.moreVariants);
      if (!item) return;
      const remaining = item.variants.filter(inYear).slice().sort((a, b) => b.from - a.from || b.to - a.to || a.name.localeCompare(b.name, 'cs')).slice(6);
      const list = target.closest('.catalog-variants').querySelector('ol');
      const previousCount = list.children.length;
      list.insertAdjacentHTML('beforeend', remaining.map(g => variantRow(item, g)).join(''));
      target.remove();
      list.children[previousCount]?.querySelector('.catalog-variant-select')?.focus({ preventScroll: true });
    }
  });
  render({ years: true, persist: false });
})();
