/* Need For Wheels — logo-led brand selection, with the native select as fallback. */
(function () {
  'use strict';
  const instances = new WeakMap();
  let activePicker = null;
  let nextId = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalise = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function logo(brandId, className = '') {
    const asset = window.NFWBrandLogos?.[brandId];
    if (!asset?.src) return '';
    return `<img class="nfw-brand-logo ${esc(className)}" src="${esc(asset.src)}" alt="" width="72" height="48" loading="lazy" decoding="async">`;
  }

  function enhance(select, options = {}) {
    if (!(select instanceof HTMLSelectElement) || !window.HTMLDialogElement?.prototype.showModal) return null;
    if (instances.has(select)) return instances.get(select);
    const controllerAbort = new AbortController();
    const eventOptions = { signal: controllerAbort.signal };
    const id = `${select.id || 'brand'}-picker-${++nextId}`;
    const label = options.label || 'Značka';
    const previous = { tabIndex: select.getAttribute('tabindex'), ariaHidden: select.getAttribute('aria-hidden') };
    const associatedLabel = select.labels?.[0];
    const previousFor = associatedLabel?.getAttribute('for');
    const wrapper = document.createElement('div');
    wrapper.className = 'nfw-brand-picker';
    select.before(wrapper);
    wrapper.append(select);
    select.classList.add('nfw-brand-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = id + '-trigger';
    trigger.className = 'nfw-brand-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id);
    wrapper.append(trigger);
    if (associatedLabel) associatedLabel.htmlFor = trigger.id;

    const dialog = document.createElement('dialog');
    dialog.id = id;
    dialog.className = 'nfw-brand-dialog';
    dialog.setAttribute('aria-labelledby', id + '-title');
    dialog.setAttribute('aria-describedby', id + '-intro');
    dialog.innerHTML = `<div class="nfw-brand-dialog-inner">
      <div class="nfw-brand-dialog-head"><div><span class="nfw-brand-eyebrow">TVŮJ VŮZ. TVŮJ STYL.</span><h2 id="${id}-title">Začni svou značkou.</h2><p id="${id}-intro">Poznáš ji na první pohled. Nebo ji najdi podle názvu.</p></div><button type="button" class="nfw-brand-close" aria-label="Zavřít výběr značky"><span aria-hidden="true">×</span></button></div>
      <label class="nfw-brand-search-label" for="${id}-search">Vyhledat značku</label><div class="nfw-brand-search-wrap"><span aria-hidden="true">⌕</span><input id="${id}-search" class="nfw-brand-search" type="search" placeholder="Např. BMW, Škoda, Mercedes…" autocomplete="off" maxlength="60" aria-controls="${id}-grid"></div>
      <div class="nfw-brand-meta"><p class="nfw-brand-count" role="status" aria-live="polite" aria-atomic="true"></p><span>Vyber a pokračuj ke svému modelu</span></div>
      <div class="nfw-brand-grid" id="${id}-grid"></div>
    </div>`;
    document.body.append(dialog);
    const search = dialog.querySelector('input');
    const grid = dialog.querySelector('.nfw-brand-grid');
    const count = dialog.querySelector('.nfw-brand-count');
    let restoreFocus = true;
    let destroyed = false;

    function sync() {
      if (destroyed) return;
      const selected = select.selectedOptions[0];
      const name = selected?.textContent || 'Vyber značku';
      trigger.innerHTML = `${logo(select.value, 'nfw-brand-trigger-logo')}<span class="nfw-brand-trigger-name">${esc(name)}</span><span class="nfw-brand-trigger-chevron" aria-hidden="true">⌄</span>`;
      trigger.setAttribute('aria-label', `${label}: ${name}. Vybrat značku`);
      trigger.disabled = select.disabled;
      if (dialog.open) renderChoices();
    }

    function renderChoices() {
      const terms = normalise(search.value).split(' ').filter(Boolean);
      const all = [...select.options].filter(option => !option.disabled);
      const available = all.filter(option => terms.every(term => normalise(option.textContent).includes(term)));
      grid.innerHTML = available.length ? available.map(option => `<button type="button" class="nfw-brand-choice${option.value ? '' : ' nfw-brand-choice-all'}" data-brand="${esc(option.value)}" aria-pressed="${select.value === option.value}"><span class="nfw-brand-choice-art">${option.value ? logo(option.value) : '<span class="nfw-brand-all-mark" aria-hidden="true">✦</span>'}</span><span class="nfw-brand-choice-name">${esc(option.textContent)}</span><span class="nfw-brand-choice-check" aria-hidden="true">✓</span></button>`).join('') : '<div class="nfw-brand-empty"><b>Značku jsme nenašli.</b><p>Zkus kratší název nebo vymaž hledání.</p><button type="button" class="nfw-brand-clear">Zobrazit všechny značky</button></div>';
      const brandCount = available.filter(option => option.value).length;
      count.textContent = `${brandCount} ${brandCount === 1 ? 'značka' : brandCount >= 2 && brandCount <= 4 ? 'značky' : 'značek'}`;
    }

    function close(focus = true) {
      restoreFocus = focus;
      if (dialog.open) dialog.close();
      trigger.setAttribute('aria-expanded', 'false');
      if (activePicker === controller) { activePicker = null; document.documentElement.classList.remove('nfw-brand-picker-open'); }
      if (focus && trigger.isConnected && !destroyed) trigger.focus({ preventScroll: true });
    }

    function open() {
      if (destroyed || select.disabled) return;
      if (activePicker && activePicker !== controller) activePicker.close(false);
      search.value = '';
      renderChoices();
      restoreFocus = true;
      dialog.showModal();
      activePicker = controller;
      document.documentElement.classList.add('nfw-brand-picker-open');
      trigger.setAttribute('aria-expanded', 'true');
      search.focus({ preventScroll: true });
    }

    const controller = {
      trigger, sync, open, close,
      destroy() {
        if (destroyed) return;
        close(false);
        destroyed = true;
        controllerAbort.abort();
        observer.disconnect();
        dialog.remove();
        select.classList.remove('nfw-brand-native');
        for (const [attribute, value] of [['tabindex', previous.tabIndex], ['aria-hidden', previous.ariaHidden]]) {
          if (value === null) select.removeAttribute(attribute); else select.setAttribute(attribute, value);
        }
        if (associatedLabel) {
          if (previousFor === null) associatedLabel.removeAttribute('for'); else associatedLabel.setAttribute('for', previousFor);
        }
        if (wrapper.parentNode) wrapper.replaceWith(select);
        instances.delete(select);
      }
    };
    trigger.addEventListener('click', open, eventOptions);
    select.addEventListener('change', sync, eventOptions);
    dialog.querySelector('.nfw-brand-close').addEventListener('click', () => close(), eventOptions);
    search.addEventListener('input', renderChoices, eventOptions);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }, eventOptions);
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      trigger.setAttribute('aria-expanded', 'false');
      if (activePicker === controller) { activePicker = null; document.documentElement.classList.remove('nfw-brand-picker-open'); }
      if (restoreFocus && trigger.isConnected && !destroyed) trigger.focus({ preventScroll: true });
    }, eventOptions);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }
      if (event.target.closest('.nfw-brand-clear')) { search.value = ''; renderChoices(); search.focus(); }
      const option = event.target.closest('[data-brand]');
      if (!option) return;
      select.value = option.dataset.brand;
      close();
      sync();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, eventOptions);
    dialog.addEventListener('keydown', event => {
      // Keep configurator step shortcuts outside the brand dialog.
      event.stopPropagation();
      if (event.key === 'ArrowDown' && event.target === search) {
        const first = grid.querySelector('button');
        if (first) { event.preventDefault(); first.focus(); }
      } else if (event.target.closest('[data-brand]') && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const choices = [...grid.querySelectorAll('[data-brand]')];
        const index = choices.indexOf(event.target.closest('[data-brand]'));
        const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const offset = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : Math.min(choices.length - 1, Math.max(0, index + offset));
        event.preventDefault(); choices[target]?.focus();
      }
    }, eventOptions);
    const observer = new MutationObserver(sync);
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected', 'disabled'] });
    instances.set(select, controller);
    sync();
    return controller;
  }

  window.NFWBrandPicker = Object.freeze({ enhance, logo, get: select => instances.get(select) || null });
})();
