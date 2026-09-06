/* Safe, static stock catalogue. All record values are rendered as plain text. */
(function () {
  'use strict';
  const EMAIL = 'info@oarts.cz';
  const text = value => typeof value === 'string' ? value.trim() : '';
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = text(value);
    return element;
  };
  const validID = value => typeof value === 'string' && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const validImage = value => typeof value === 'string' && /^assets\/stock\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|jpe?g|png|avif)$/i.test(value);
  const quantityLabel = quantity => quantity === 1 ? '1 sada' : quantity < 5 ? quantity + ' sady' : quantity + ' sad';
  const wheelCountLabel = count => Number.isInteger(count) && count >= 1 && count <= 8 ? count + (count === 1 ? ' kolo' : count < 5 ? ' kola' : ' kol') : '';
  const priceInfo = price => {
    if (!price || typeof price.amount !== 'number' || !Number.isFinite(price.amount) || price.amount <= 0 || price.amount > 100000000 || !['CZK', 'EUR'].includes(price.currency)) return null;
    return {
      amount: new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: price.currency, maximumFractionDigits: 2 }).format(price.amount),
      tax: price.vatIncluded === true ? 'včetně DPH' : price.vatIncluded === false ? 'bez DPH' : ''
    };
  };
  const dateLabel = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > new Date().toISOString().slice(0, 10)) return null;
    return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  };
  const mailto = (subject, lines) => 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\r\n'));
  function contactButton(href, label) {
    const link = node('a', 'btn btn--primary stock-cta'); link.href = href;
    const content = node('span', '', label), arrow = node('b', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); content.append(arrow); link.append(content); return link;
  }
  function emptyState() {
    const panel = node('div', 'stock-empty'); panel.dataset.stockState = 'unconfirmed';
    const visual = node('div', 'stock-empty__visual'), image = node('img');
    image.src = 'assets/renders/silver/apex10-feature.webp'; image.alt = 'Ilustrační 3D návrh stříbrného desetipaprskového disku'; image.loading = 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    visual.append(image, node('span', 'stock-empty__image-note', 'Ilustrační design · nejde o skladovou položku'));
    const copy = node('div', 'stock-empty__copy');
    copy.append(node('span', 'eyebrow', 'Zjistíme, co je právě k dispozici'), node('h3', '', 'Aktuální nabídku právě doplňujeme.'), node('p', '', 'Napiš nám, pro jaké auto kola hledáš. Potvrdíme dostupné sady, jejich rozměry, povrch i cenu.'));
    copy.append(contactButton(mailto('Dotaz na skladová kola — Need For Wheels', ['Dobrý den,', '', 'mám zájem o aktuální nabídku skladových sad kol.', '', 'Vůz, generace a rok:', 'Preferovaný rozměr:', 'Barva nebo povrch:', '', 'Prosím o potvrzení dostupnosti, specifikace a ceny.']), 'Zeptat se na dostupné sady'));
    copy.append(node('small', 'stock-email-hint', 'Otevře se e-mailová poptávka na ' + EMAIL + '.'));
    panel.append(visual, copy); return panel;
  }
  function setCard(item) {
    const card = node('article', 'stock-card'); card.dataset.stockId = item.id;
    const visual = node('div', 'stock-card__visual');
    const unavailable = () => { visual.querySelector('img')?.remove(); if (!visual.querySelector('.stock-card__image-missing')) visual.append(node('p', 'stock-card__image-missing', 'Fotografii sady doplníme k poptávce.')); };
    if (validImage(item.image?.src) && text(item.image?.alt)) {
      const image = node('img'); image.src = item.image.src; image.alt = item.image.alt; image.loading = 'lazy'; image.decoding = 'async'; image.addEventListener('error', unavailable, { once: true }); visual.append(image);
    } else unavailable();
    const quantity = node('span', 'stock-quantity', 'Skladem · ' + quantityLabel(item.quantity)); visual.append(quantity);
    const copy = node('div', 'stock-card__copy');
    if (text(item.design)) copy.append(node('span', 'eyebrow', item.design));
    copy.append(node('h3', '', item.title));
    const details = node('dl', 'stock-specs');
    const addDetail = (label, value) => { if (text(value)) details.append(node('dt', '', label), node('dd', '', value)); };
    addDetail('Přední náprava', text(item.frontSize) || 'Rozměr na dotaz');
    addDetail('Zadní náprava', text(item.rearSize) || 'Rozměr na dotaz');
    addDetail('Barva', text(item.color) || 'Na dotaz');
    addDetail('Povrch', text(item.finish) || 'Na dotaz');
    addDetail('Rozteč PCD', item.pcd); addDetail('Středový otvor CB', item.centerBore);
    addDetail('Obsah sady', wheelCountLabel(item.wheelsPerSet));
    copy.append(details);
    if (text(item.note)) copy.append(node('p', 'stock-card__note', item.note));
    const price = priceInfo(item.price), footer = node('div', 'stock-card__footer'), priceBlock = node('div', 'stock-price');
    priceBlock.append(node('strong', '', price ? price.amount : 'Cena na dotaz'), node('small', '', ['za celou sadu', price?.tax].filter(Boolean).join(' · ')));
    const lines = ['Dobrý den,', '', 'mám zájem o tuto skladovou sadu:', 'ID: ' + item.id, 'Sada: ' + item.title];
    for (const [label, value] of [['Design', item.design], ['Přední náprava', item.frontSize], ['Zadní náprava', item.rearSize], ['Barva', item.color], ['Povrch', item.finish], ['PCD', item.pcd], ['CB', item.centerBore], ['Obsah sady', wheelCountLabel(item.wheelsPerSet)]]) if (text(value)) lines.push(label + ': ' + value);
    lines.push('Uvedená cena: ' + (price ? [price.amount, 'za sadu', price.tax].filter(Boolean).join(' · ') : 'na dotaz'), '', 'Můj vůz, generace a rok:', 'Požadovaný počet sad:', '', 'Prosím o potvrzení dostupnosti, ceny a vhodnosti pro uvedený vůz.');
    footer.append(priceBlock, contactButton(mailto('Poptávka skladové sady ' + item.id + ' — ' + item.title, lines), 'Poptat sadu')); copy.append(footer);
    card.append(visual, copy); return card;
  }
  function render(container, data = window.NFWStock) {
    if (!container || typeof container.replaceChildren !== 'function') return;
    const seen = new Set();
    const items = (Array.isArray(data?.items) ? data.items : []).filter(item => {
      if (!item || !validID(item.id) || seen.has(item.id) || !text(item.title) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) return false;
      seen.add(item.id); return true;
    });
    container.replaceChildren();
    if (!items.length) { container.append(emptyState()); return; }
    const head = node('div', 'stock-list-meta'), date = dateLabel(data.updatedAt);
    head.append(node('p', '', 'Dostupnost a vhodnost pro tvůj vůz potvrdíme v odpovědi na poptávku.'));
    if (date) head.append(node('span', '', 'Aktualizováno ' + date));
    const grid = node('div', 'stock-grid'); grid.dataset.stockState = 'listed'; grid.append(...items.map(setCard));
    container.append(head, grid, node('p', 'stock-email-hint stock-list-note', 'Tlačítko připraví e-mailovou poptávku. Odeslání samo sadu nerezervuje.'));
  }
  window.NFWStockView = Object.freeze({ render });
  render(document.getElementById('stockInventory'));
})();
