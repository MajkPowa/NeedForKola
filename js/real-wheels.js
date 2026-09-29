/* Real supplier photographs stay separate from confirmed stock and client projects. */
(function () {
  'use strict';
  const clean = value => typeof value === 'string' ? value.trim() : '';
  const element = (tag, className, value) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = clean(value);
    return el;
  };
  const path = (value, video = false) => typeof value === 'string' && (video
    ? /^assets\/real-wheels\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:mp4|webm)$/i
    : /^assets\/real-wheels\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|jpe?g|png|avif)$/i).test(value);
  const validID = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value);
  const labels = { all: 'Vše', silver: 'Stříbrná / šedá', black: 'Černá', bronze: 'Bronz / zlatá', other: 'Ostatní' };
  const categoryLabels = { wheel: 'Skutečná kola', detail: 'Detail provedení', vehicle: 'Kola na voze' };
  let activeDialog = null;
  function button(className, label, action) {
    const el = element('button', className, label);
    el.type = 'button';
    if (action) el.addEventListener('click', action);
    return el;
  }
  function image(src, alt, lazy = true) {
    const img = element('img');
    img.src = src; img.alt = clean(alt); img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    return img;
  }
  function normalize(data) {
    const ids = new Set();
    return (Array.isArray(data?.collections) ? data.collections : []).flatMap(item => {
      if (!item || !validID(item.id) || ids.has(item.id) || !clean(item.title)) return [];
      const media = (Array.isArray(item.media) ? item.media : []).filter(entry => entry && ['image', 'video'].includes(entry.type) && path(entry.src, entry.type === 'video')).map(entry => ({ ...entry, alt: clean(entry.alt) || clean(item.title) }));
      if (!media.length) return [];
      ids.add(item.id);
      return [{ ...item, media, title: clean(item.title), reference: clean(item.reference) || item.id, tone: Object.hasOwn(labels, item.tone) && item.tone !== 'all' ? item.tone : 'other' }];
    });
  }
  function mailLink(item) {
    const configured = clean(window.NFW?.EMAIL);
    const email = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(configured) ? configured : 'info@oarts.cz';
    const lines = ['Dobrý den,', '', 'zaujalo mě provedení kol z galerie:', 'Reference: ' + item.reference, 'Provedení: ' + item.title];
    if (clean(item.finishLabel)) lines.push('Povrch na fotografii: ' + clean(item.finishLabel));
    lines.push('', 'Můj vůz, generace a rok:', 'Požadovaný rozměr:', 'Telefon pro konzultaci:', '', 'Prosím o ověření dostupnosti, specifikace, ceny a vhodnosti pro můj vůz.');
    return 'mailto:' + email + '?subject=' + encodeURIComponent('Poptávka kol ' + item.reference + ' — ' + item.title) + '&body=' + encodeURIComponent(lines.join('\r\n'));
  }
  function openDetail(item, opener) {
    if (activeDialog) activeDialog.close();
    const dialog = element('dialog', 'real-wheel-dialog');
    dialog.setAttribute('aria-labelledby', 'realWheelDialogTitle');
    dialog.setAttribute('aria-describedby', 'realWheelDialogNote');
    const shell = element('div', 'real-wheel-dialog__shell');
    const head = element('header', 'real-wheel-dialog__head');
    const heading = element('div', 'real-wheel-dialog__heading');
    heading.append(element('span', 'real-wheel-dialog__reference', item.reference));
    const title = element('h3', '', item.title); title.id = 'realWheelDialogTitle';
    heading.append(title);
    const close = button('real-wheel-close', '×', () => dialog.close());
    close.setAttribute('aria-label', 'Zavřít detail kol'); close.autofocus = true;
    head.append(heading, close);
    const content = element('div', 'real-wheel-dialog__content');
    const gallery = element('div', 'real-wheel-viewer');
    const frame = element('div', 'real-wheel-viewer__frame');
    const mediaHost = element('div', 'real-wheel-viewer__media');
    const controls = element('div', 'real-wheel-viewer__controls');
    const previous = button('real-wheel-arrow', '←', () => show(index - 1)); previous.setAttribute('aria-label', 'Předchozí fotografie nebo video');
    const next = button('real-wheel-arrow', '→', () => show(index + 1)); next.setAttribute('aria-label', 'Další fotografie nebo video');
    const counter = element('span', 'real-wheel-viewer__counter'); counter.setAttribute('aria-live', 'polite'); counter.setAttribute('aria-atomic', 'true');
    controls.append(previous, counter, next);
    frame.append(mediaHost);
    const caption = element('p', 'real-wheel-viewer__caption');
    const thumbs = element('div', 'real-wheel-thumbs'); thumbs.setAttribute('role', 'group'); thumbs.setAttribute('aria-label', 'Fotografie a videa tohoto provedení');
    const thumbButtons = item.media.map((entry, position) => {
      const thumb = button('real-wheel-thumb', '', () => show(position));
      thumb.setAttribute('aria-label', (entry.type === 'video' ? 'Video ' : 'Fotografie ') + (position + 1) + ': ' + entry.alt);
      if (path(entry.thumb)) thumb.append(image(entry.thumb, ''));
      else thumb.append(element('span', '', String(position + 1)));
      if (entry.type === 'video') { const play = element('span', 'real-wheel-thumb__play', '▶'); play.setAttribute('aria-hidden', 'true'); thumb.append(play); }
      thumbs.append(thumb); return thumb;
    });
    gallery.append(frame, controls, caption, thumbs);
    const info = element('div', 'real-wheel-dialog__info');
    info.append(element('span', 'real-wheel-tag', categoryLabels[item.category] || categoryLabels.wheel));
    if (clean(item.finishLabel)) info.append(element('h4', 'real-wheel-dialog__finish', item.finishLabel));
    if (clean(item.description)) info.append(element('p', 'real-wheel-dialog__description', item.description));
    const specs = element('dl', 'real-wheel-specs');
    for (const spec of Array.isArray(item.specs) ? item.specs : []) if (clean(spec?.label) && clean(spec?.value)) specs.append(element('dt', '', spec.label), element('dd', '', spec.value));
    if (specs.childElementCount) info.append(specs);
    const note = element('p', 'real-wheel-dialog__note', 'Fotografie zachycují konkrétní provedení kol. Dostupnost, rozměry, cenu a vhodnost pro tvůj vůz potvrdíme v odpovědi na poptávku.'); note.id = 'realWheelDialogNote';
    const cta = element('a', 'real-wheel-enquiry', 'Poptat tento design ↗'); cta.href = mailLink(item);
    info.append(note, cta, element('small', 'real-wheel-mail-note', 'Otevře se e-mailová poptávka. Nejde o objednávku ani rezervaci.'));
    content.append(gallery, info); shell.append(head, content); dialog.append(shell);
    let index = 0;
    function pauseMedia() {
      for (const video of mediaHost.querySelectorAll('video')) { video.pause(); video.removeAttribute('src'); video.load(); }
    }
    function show(requested) {
      index = (requested + item.media.length) % item.media.length;
      const entry = item.media[index];
      pauseMedia(); mediaHost.replaceChildren();
      const media = entry.type === 'video' ? element('video') : image(entry.src, entry.alt, false);
      if (entry.type === 'video') {
        media.controls = true; media.preload = 'none'; media.playsInline = true;
        media.setAttribute('aria-label', entry.alt);
        if (path(entry.poster) || path(entry.thumb)) media.poster = path(entry.poster) ? entry.poster : entry.thumb;
        media.src = entry.src;
        media.append(element('p', '', 'Váš prohlížeč nepodporuje přehrávání videa.'));
      }
      media.addEventListener('error', () => {
        if (!media.isConnected) return;
        mediaHost.replaceChildren(element('p', 'real-wheel-media-error', 'Tento podklad se nepodařilo načíst. Zkus další fotografii nebo nám napiš referenci ' + item.reference + '.'));
      }, { once: true });
      mediaHost.append(media);
      counter.textContent = (entry.type === 'video' ? 'Video' : 'Fotografie') + ' ' + (index + 1) + ' / ' + item.media.length;
      caption.textContent = entry.alt;
      previous.disabled = next.disabled = item.media.length <= 1;
      thumbButtons.forEach((thumb, position) => { thumb.setAttribute('aria-current', position === index ? 'true' : 'false'); });
      const current = thumbButtons[index];
      if (current) thumbs.scrollLeft = Math.max(0, current.offsetLeft - thumbs.offsetLeft - (thumbs.clientWidth - current.clientWidth) / 2);
    }
    const oldStyles = { bodyOverflow: document.body.style.overflow, htmlOverflow: document.documentElement.style.overflow, paddingRight: document.body.style.paddingRight };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.append(dialog); activeDialog = dialog;
    dialog.addEventListener('close', () => {
      pauseMedia(); dialog.remove();
      document.body.style.overflow = oldStyles.bodyOverflow; document.documentElement.style.overflow = oldStyles.htmlOverflow; document.body.style.paddingRight = oldStyles.paddingRight;
      if (activeDialog === dialog) activeDialog = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }, { once: true });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); dialog.close(); return; }
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], video[controls], [tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.target.tagName !== 'VIDEO' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault(); show(index + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    if (scrollbarWidth > 0) document.body.style.paddingRight = (parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth) + 'px';
    document.body.style.overflow = document.documentElement.style.overflow = 'hidden';
    dialog.showModal(); show(0); close.focus();
  }
  function card(item) {
    const card = element('article', 'real-wheel-card'); card.dataset.realWheelId = item.id;
    const open = button('real-wheel-card__open', '', () => openDetail(item, open));
    open.setAttribute('aria-label', 'Prohlédnout ' + item.title + ', reference ' + item.reference);
    open.setAttribute('aria-haspopup', 'dialog');
    const visual = element('span', 'real-wheel-card__visual');
    const cover = item.cover || {};
    const thumb = path(cover.thumb) ? cover.thumb : item.media.find(entry => path(entry.thumb))?.thumb;
    if (thumb) {
      const img = image(thumb, clean(cover.alt) || item.title);
      if (Number.isInteger(cover.width) && cover.width > 0) img.width = cover.width;
      if (Number.isInteger(cover.height) && cover.height > 0) img.height = cover.height;
      img.addEventListener('error', () => { img.remove(); visual.append(element('span', 'real-wheel-card__missing', 'Otevřít fotografie')); }, { once: true });
      visual.append(img);
    } else visual.append(element('span', 'real-wheel-card__missing', 'Otevřít fotografie'));
    const counts = [item.media.filter(entry => entry.type === 'image').length, item.media.filter(entry => entry.type === 'video').length];
    const countLabel = [counts[0] ? counts[0] + ' foto' : '', counts[1] ? counts[1] + ' video' : ''].filter(Boolean).join(' · ');
    visual.append(element('span', 'real-wheel-card__count', countLabel), element('span', 'real-wheel-card__expand', '↗'));
    const copy = element('span', 'real-wheel-card__copy');
    copy.append(element('span', 'real-wheel-card__reference', item.reference), element('span', 'real-wheel-card__title', item.title));
    if (clean(item.finishLabel)) copy.append(element('span', 'real-wheel-card__finish', item.finishLabel));
    const footer = element('span', 'real-wheel-card__footer'); footer.append(element('span', '', 'Dostupnost na dotaz'), element('span', 'real-wheel-card__link', 'Prohlédnout →'));
    copy.append(footer); open.append(visual, copy); card.append(open); return card;
  }
  function render(container, data = window.NFWRealWheels) {
    if (!container || typeof container.replaceChildren !== 'function') return;
    const collections = normalize(data);
    container.replaceChildren();
    const intro = element('p', 'real-wheels-note', 'Prohlédni si skutečná kola z více úhlů. Rozměry, cenu a aktuální dostupnost potvrdíme k vybranému provedení.');
    container.append(intro);
    if (!collections.length) { container.append(element('p', 'real-wheels-empty', 'Fotografie jednotlivých provedení právě připravujeme.')); return; }
    const toolbar = element('div', 'real-wheels-toolbar');
    const filters = element('div', 'real-wheels-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Filtrovat kola podle barvy');
    const status = element('p', 'real-wheels-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-atomic', 'true');
    const grid = element('div', 'real-wheels-grid');
    const moreRow = element('div', 'real-wheels-more');
    const more = button('real-wheels-more__button', 'Zobrazit další', () => {
      const start = visibleCount;
      visibleCount = Math.min(visibleCount + batchSize, filtered.length);
      const newCards = filtered.slice(start, visibleCount).map(card);
      grid.append(...newCards); updateCount();
      const nextCard = newCards[0]?.querySelector('button');
      if (nextCard) { nextCard.focus({ preventScroll: true }); nextCard.scrollIntoView({ block: 'nearest', behavior: 'auto' }); }
    });
    moreRow.append(more);
    const chips = [];
    const batchSize = window.matchMedia('(max-width: 650px)').matches ? 6 : 9;
    let filtered = [], visibleCount = 0;
    function updateCount() {
      status.textContent = 'Zobrazeno ' + visibleCount + ' z ' + filtered.length + ' provedení';
      moreRow.hidden = visibleCount >= filtered.length;
      const remaining = Math.min(batchSize, filtered.length - visibleCount);
      more.textContent = remaining === 1 ? 'Zobrazit další provedení ↓' : 'Zobrazit dalších ' + remaining + ' provedení ↓';
    }
    function select(tone) {
      filtered = collections.filter(item => tone === 'all' || item.tone === tone);
      visibleCount = Math.min(batchSize, filtered.length);
      chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.tone === tone)));
      grid.replaceChildren(...filtered.slice(0, visibleCount).map(card)); updateCount();
    }
    for (const [tone, label] of Object.entries(labels)) {
      if (tone !== 'all' && !collections.some(item => item.tone === tone)) continue;
      const count = tone === 'all' ? collections.length : collections.filter(item => item.tone === tone).length;
      const chip = button('real-wheels-filter', label + ' · ' + count, () => select(tone));
      chip.dataset.tone = tone; chip.setAttribute('aria-pressed', String(tone === 'all')); chips.push(chip); filters.append(chip);
    }
    toolbar.append(filters, status); container.append(toolbar, grid, moreRow); select('all');
  }
  window.NFWRealWheelsView = Object.freeze({ render });
  render(document.getElementById('realWheelsGallery'));
})();
