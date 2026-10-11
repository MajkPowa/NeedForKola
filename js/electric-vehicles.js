/* Progressive enhancement: every EV model link is also available without JS. */
(function () {
  'use strict';
  const root = document.getElementById('evModels');
  if (!root) return;
  const brand = document.getElementById('evBrand');
  const search = document.getElementById('evSearch');
  const reset = document.getElementById('evReset');
  const count = document.getElementById('evResultCount');
  const empty = root.querySelector('.ev-empty');
  const cards = [...root.querySelectorAll('[data-ev-brand]')];
  const links = [...root.querySelectorAll('[data-ev-model]')];
  const normalise = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const params = new URLSearchParams(location.search);
  if ([...brand.options].some(option => option.value === params.get('brand'))) brand.value = params.get('brand');
  const entry = links.find(link => link.dataset.evModel === params.get('model') && (!brand.value || link.dataset.evBrandId === brand.value));
  search.value = params.get('search') || (entry ? entry.dataset.evModelName : '');

  function filter({ save = true } = {}) {
    const term = normalise(search.value);
    let total = 0;
    for (const card of cards) {
      let visible = 0;
      for (const link of card.querySelectorAll('[data-ev-model]')) {
        const match = (!brand.value || card.dataset.evBrand === brand.value) && (!term || normalise(link.dataset.evSearch).includes(term));
        link.closest('li').hidden = !match;
        if (match) visible++;
      }
      card.hidden = visible === 0;
      total += visible;
    }
    count.textContent = `Zobrazené modelové řady: ${total} z ${links.length}`;
    empty.hidden = total !== 0;
    reset.hidden = !brand.value && !search.value;
    if (save) {
      const url = new URL(location.href);
      url.searchParams.delete('model');
      for (const [key, value] of [['brand', brand.value], ['search', search.value.trim()]]) {
        if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
      }
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }

  root.querySelector('.ev-filters').hidden = false;
  brand.addEventListener('change', () => filter());
  search.addEventListener('input', () => filter());
  reset.addEventListener('click', () => { brand.value = ''; search.value = ''; filter(); search.focus(); });
  filter({ save: false });
})();
