/* Public orders and enquiries. Personal details stay in the form and HTTPS API. */
(function () {
  'use strict';
  const clean = value => typeof value === 'string' ? value.trim() : '';
  const money = cents => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(cents / 100);
  const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = String(text); return el; };
  const cfg = () => window.NFW_SITE || {};
  const photoPath = value => typeof value === 'string' && /^assets\/(?:real-wheels|stock)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g|avif)$/i.test(value);
  const enabled = () => {
    try { if (typeof cfg().apiBase !== 'string') return false; const url = new URL(cfg().apiBase || '/', location.href); return url.protocol === 'https:' || (['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'); } catch { return false; }
  };
  function notice(container) {
    let status = container.querySelector('[data-commerce-status]');
    if (!status) { status = node('p', 'commerce-status'); status.dataset.commerceStatus = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.tabIndex = -1; container.append(status); }
    return status;
  }
  function unavailable() { return 'Online odeslání nyní není dostupné. Zavolej nám na ' + (cfg().phone || '+420 723 958 421') + '. Vyplněné údaje zůstávají ve formuláři.'; }
  async function request(path, payload) {
    if (!enabled()) throw new Error(unavailable());
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const base = clean(cfg().apiBase).replace(/\/$/, '');
      const response = await fetch(base + path, { method: payload ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: payload ? { 'Content-Type': 'application/json', 'X-NFW-Request': '1' } : { Accept: 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { const error = new Error(clean(data?.error?.message).slice(0, 350) || 'Požadavek se nepodařilo potvrdit. Zkus to znovu nebo nám zavolej.'); error.status = response.status; throw error; }
      if (!data || typeof data !== 'object') throw new Error('Server nevrátil platné potvrzení. Před opakováním nás prosím kontaktuj.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Spojení se serverem se nepodařilo dokončit. Přijetí není potvrzené; před opakováním nás kontaktuj. Údaje zůstaly vyplněné.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  const pending = new WeakSet();
  async function submitEnquiry(container, payload, buttons = []) {
    if (pending.has(container)) return false;
    pending.add(container); const status = notice(container); status.dataset.state = 'pending'; status.textContent = 'Odesíláme poptávku…';
    container.setAttribute('aria-busy', 'true'); buttons.forEach(button => { button.disabled = true; });
    try {
      const result = await request('/api/enquiries', { ...payload, website: payload.website || '' });
      if (!clean(result.reference) || result.status !== 'received') throw new Error('Server nevrátil potvrzení přijetí. Před opakováním nás prosím kontaktuj.');
      status.dataset.state = 'success'; status.textContent = 'Poptávka byla přijata. Tvoje reference: ' + result.reference + '. Ozveme se s ověřenou dostupností a nabídkou. Toto není objednávka ani rezervace.';
      if (result.emailStatus === 'blocked') status.textContent += ' E-mailové potvrzení nyní není odesíláno; referenci si prosím ulož.';
      container.dataset.enquiryReceived = result.reference; status.focus({ preventScroll: true }); status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return true;
    } catch (error) { status.dataset.state = 'error'; status.textContent = error.message; status.focus({ preventScroll: true }); return false; }
    finally { pending.delete(container); container.removeAttribute('aria-busy'); buttons.forEach(button => { button.disabled = Boolean(container.dataset.enquiryReceived); }); }
  }
  function bindEnquiry(form, buildPayload) {
    if (!form || form.dataset.commerceBound) return;
    form.dataset.commerceBound = 'true';
    form.querySelectorAll('[type="submit"]').forEach(button => { button.disabled = !enabled(); });
    if (!enabled()) { const status = notice(form); status.textContent = unavailable(); status.dataset.state = 'unavailable'; }
    form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) submitEnquiry(form, buildPayload(new FormData(form)), [...form.querySelectorAll('[type="submit"]')]); });
    form.addEventListener('input', () => { if (!pending.has(form) && form.dataset.enquiryReceived) { delete form.dataset.enquiryReceived; form.querySelectorAll('[type="submit"]').forEach(button => { button.disabled = false; }); notice(form).textContent = 'Údaje byly změněny. Odesláním vznikne nová poptávka.'; } });
  }
  let catalogPromise;
  function getCatalog(refresh = false) {
    if (refresh || !catalogPromise) catalogPromise = request('/api/catalog').then(data => {
      if (!Array.isArray(data.items) || typeof data.orderingEnabled !== 'boolean') throw new Error('Aktuální nabídku se nepodařilo ověřit.');
      return data;
    }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function validProduct(item) { return item && clean(item.id) && clean(item.title) && item.currency === 'CZK' && Number.isSafeInteger(item.priceCents) && item.priceCents > 0 && Number.isInteger(item.stockAvailable) && item.stockAvailable > 0 && Number.isSafeInteger(item.version) && item.version > 0 && Number.isInteger(item.wheelsPerSet) && item.wheelsPerSet >= 1 && item.wheelsPerSet <= 8; }
  function hydrate() {
    document.querySelectorAll('[data-phone]').forEach(el => { el.textContent = cfg().phone || '+420 723 958 421'; if (el.tagName === 'A') el.href = 'tel:' + el.textContent.replace(/\s/g, ''); });
    document.querySelectorAll('[data-phone-action]').forEach(el => { const phone = cfg().phone || '+420 723 958 421'; el.href = 'tel:' + phone.replace(/\s/g, ''); el.setAttribute('aria-label', 'Zavolat na ' + phone); });
    document.querySelectorAll('[data-email]').forEach(el => { el.textContent = (cfg().email || 'info@oarts.cz') + (cfg().emailEnabled === true ? '' : ' · připravujeme'); if (el.tagName === 'A') { if (cfg().emailEnabled === true) el.href = 'mailto:' + cfg().email; else { el.removeAttribute('href'); el.setAttribute('aria-disabled','true'); } } });
    document.querySelectorAll('[data-company-name]').forEach(el => { el.textContent = cfg().company?.name || 'Need For Wheels by Oarts s.r.o.'; });
    document.querySelectorAll('[data-company-ico]').forEach(el => { el.textContent = cfg().company?.ico || '30074088'; });
    document.querySelectorAll('[data-warehouse]').forEach(el => { el.textContent = cfg().company?.warehouse || 'Předvrší 846, Ostrava – Krásné Pole, 725 26'; });
    document.querySelectorAll('[data-social]').forEach(el => { const fallback = el.dataset.social === 'instagram' ? 'https://www.instagram.com/nfw.oarts/' : 'https://www.tiktok.com/@nfw.oarts'; el.href = cfg().socials?.[el.dataset.social] || fallback; });
  }
  function safeLegalMarkup(html) {
    const template = document.createElement('template'); template.innerHTML = clean(html);
    const allowed = new Set(['P','UL','OL','LI','STRONG','EM','BR','H2','H3','H4','A']);
    function copy(source) {
      if (source.nodeType === Node.TEXT_NODE) return document.createTextNode(source.textContent);
      if (source.nodeType !== Node.ELEMENT_NODE || ['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','SVG','FORM','INPUT','LINK','META'].includes(source.tagName)) return document.createDocumentFragment();
      const target = allowed.has(source.tagName) ? document.createElement(source.tagName.toLowerCase()) : document.createDocumentFragment();
      if (source.tagName === 'A') {
        try { const href = new URL(source.getAttribute('href') || '', location.href); if (href.protocol === 'https:' || href.protocol === 'tel:' || (href.origin === location.origin && href.protocol === 'http:')) { target.href = href.href; target.target = '_blank'; target.rel = 'noopener noreferrer'; } } catch { /* Unsafe links remain plain text. */ }
      }
      for (const child of source.childNodes) target.append(copy(child)); return target;
    }
    const content = document.createDocumentFragment(); for (const child of template.content.childNodes) content.append(copy(child)); return content;
  }
  function attachTermsSnapshot(form, snapshot, version) {
    const required = ['obchodni-podminky', 'reklamacni-rad', 'odstoupeni'];
    if (!snapshot || snapshot.version !== version || !Array.isArray(snapshot.pages) || !required.every(id => snapshot.pages.some(page => page.id === id && clean(page.title) && (clean(page.html) || page.sections?.some(section => clean(section.html)))))) return false;
    form.querySelector('[data-archived-terms]')?.remove();
    const details = node('details', 'commerce-archived-terms'); details.dataset.archivedTerms = ''; details.id = 'archivedOrderTerms';
    details.append(node('summary', '', 'Přesné podmínky této nabídky · verze ' + version));
    const content = node('div', 'commerce-archived-terms__content');
    content.append(node('p', 'commerce-small', 'Toto znění je uložené spolu s konkrétní nabídkou. Následná změna podmínek na webu ho nepřepisuje.'));
    for (const document of snapshot.pages.filter(page => required.includes(page.id))) {
      const article = node('article'); article.append(node('h3', '', document.title)); if (clean(document.lead)) article.append(node('p', '', document.lead));
      if (Array.isArray(document.sections) && document.sections.length) for (const section of document.sections) { article.append(node('h4', '', section.title || '')); article.append(safeLegalMarkup(section.html)); }
      else article.append(safeLegalMarkup(document.html));
      content.append(article);
    }
    const download = node('button', 'btn', 'Stáhnout toto znění podmínek'); download.type = 'button';
    download.addEventListener('click', () => {
      const text = ['Need For Wheels — archivované podmínky', 'Verze: ' + version, ...Array.from(content.querySelectorAll('h3,h4,p,li')).map(el => el.textContent)].join('\r\n\r\n');
      const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' })), link = node('a'); link.href = url; link.download = 'oarts-podminky-' + version.replace(/[^a-z0-9_-]/gi, '') + '.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    details.append(content, download); const consent = form.querySelector('.commerce-terms'); consent.before(details);
    const opener = node('button', 'commerce-terms-link', 'archivovanými obchodními podmínkami této nabídky'); opener.type = 'button'; opener.setAttribute('aria-controls', details.id); opener.setAttribute('aria-expanded', 'false');
    opener.addEventListener('click', event => { event.preventDefault(); details.open = true; details.querySelector('summary').focus(); details.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    details.addEventListener('toggle', () => opener.setAttribute('aria-expanded', String(details.open)));
    (consent.querySelector('.commerce-terms-link') || consent.querySelector('a')).replaceWith(opener);
    return true;
  }
  async function orderPage() {
    const root = document.getElementById('commercePage'); if (!root) return;
    const params = new URLSearchParams(location.search), reference = clean(params.get('reference'));
    let selected = window.NFWRealWheels?.collections?.find(item => item.reference === reference);
    const quote = document.getElementById('quoteForm'), context = document.getElementById('quoteContext');
    const source = ['gallery', 'stock', 'configurator', 'contact'].includes(params.get('source')) ? params.get('source') : 'stock';
    if (selected) {
      context.replaceChildren();
      if (photoPath(selected.cover?.src)) { const img = node('img'); img.src = selected.cover.src; img.alt = selected.title; context.append(img); }
      context.append(node('span', 'eyebrow', selected.reference), node('h2', '', selected.title), node('p', '', selected.finishLabel));
      document.getElementById('orderHeading').textContent = 'Poptat vybrané provedení';
    } else if (reference) context.append(node('p', 'commerce-status', 'Referenci se nepodařilo přiřadit k fotografii. Uveď ji prosím do zprávy; dostupnost ověříme.'));
    bindEnquiry(quote, f => ({ name: f.get('name'), email: f.get('email'), phone: f.get('phone'), vehicle: f.get('vehicle'), message: f.get('message'), reference: selected?.reference || reference.slice(0, 100), source, website: f.get('website') || '', ...(selected ? { configuration: { title: selected.title, finish: selected.finishLabel, galleryId: selected.id } } : {}) }));
    if (reference) {
      if (!selected && source === 'stock') {
        try {
          const stock = await getCatalog(), item = stock.items.find(item => item.sku === reference || item.id === reference);
          if (item && clean(item.title)) {
            selected = { id: item.id, reference: item.sku || item.id, title: item.title, finishLabel: item.description || '' }; context.replaceChildren();
            if (photoPath(item.image)) { const img = node('img'); img.src = item.image; img.alt = item.title; context.append(img); }
            context.append(node('span', 'eyebrow', selected.reference), node('h2', '', selected.title), node('p', '', 'Dostupnost a přesnou nabídku potvrdíme v odpovědi na poptávku.'));
          }
        } catch { /* The reference stays in the enquiry even if the catalogue is temporarily unavailable. */ }
      }
      return;
    }
    const catalogue = document.getElementById('orderCatalogue'), checkoutSection = document.getElementById('checkoutSection'), checkout = document.getElementById('checkoutForm');
    catalogue.textContent = 'Načítáme ověřenou nabídku…';
    let catalog;
    try { catalog = await getCatalog(); }
    catch { catalogue.textContent = 'Aktuální skladové sady ověříme osobně. Napiš nám níže nebo zavolej.'; return; }
    const items = catalog.items.filter(validProduct);
    if (!catalog.orderingEnabled || !items.length) { catalogue.textContent = 'Online objednávky otevřeme u sad s potvrzenou cenou a dostupností. Zatím nám pošli nezávaznou poptávku.'; return; }
    let shipping = (catalog.checkout?.shippingMethods || []).filter(item => clean(item.id) && clean(item.label) && Number.isSafeInteger(item.priceCents) && item.priceCents >= 0);
    let payments = (catalog.checkout?.paymentMethods || []).filter(item => clean(item.id) && clean(item.label));
    if (!shipping.length || !payments.length || !clean(catalog.checkout?.termsVersion) || !Number.isSafeInteger(catalog.checkout?.version) || !attachTermsSnapshot(checkout, catalog.checkout?.termsSnapshot, catalog.checkout?.termsVersion)) { catalogue.textContent = 'Objednávání právě připravujeme. Napiš nám nezávazně níže.'; return; }
    catalogue.replaceChildren(); const grid = node('div', 'commerce-products'); catalogue.append(grid);
    let chosen = null, idempotencyKey = null, submitting = false, successful = false, attempted = false, lastPayload = null;
    const methodSelect = (id, rows) => { const select = document.getElementById(id); rows.forEach(row => { const option = node('option', '', row.label + (Number.isSafeInteger(row.priceCents) ? ' · ' + money(row.priceCents) : '')); option.value = row.id; select.append(option); }); };
    methodSelect('shippingMethod', shipping); methodSelect('paymentMethod', payments);
    const status = notice(checkout), summary = document.getElementById('checkoutSummary'), quantity = checkout.elements.quantity, submit = document.getElementById('placeOrder');
    function recalculate() {
      if (!chosen) return;
      const ship = shipping.find(row => row.id === checkout.elements.shippingMethod.value), payment = payments.find(row => row.id === checkout.elements.paymentMethod.value);
      const count = Number(quantity.value), valid = Number.isInteger(count) && count >= 1 && count <= chosen.stockAvailable;
      summary.replaceChildren(node('h3', '', chosen.title), node('p', '', 'Sada: ' + (chosen.wheelsPerSet || 4) + ' kola · ' + money(chosen.priceCents) + ' / sada'));
      if (Array.isArray(chosen.specs)) { const specs = node('dl', 'commerce-specs'); chosen.specs.forEach(spec => { if (clean(spec.label) && clean(spec.value)) specs.append(node('dt', '', spec.label), node('dd', '', spec.value)); }); summary.append(specs); }
      if (photoPath(chosen.image)) { const img = node('img'); img.src = chosen.image; img.alt = chosen.title; summary.prepend(img); }
      if (ship) summary.append(node('p', '', ship.label + ': ' + money(ship.priceCents) + (ship.deliveryText ? ' · ' + ship.deliveryText : '')));
      if (payment?.instructions) summary.append(node('p', '', payment.instructions));
      summary.append(node('strong', 'commerce-total', valid && ship ? 'Celkem ' + money(chosen.priceCents * count + ship.priceCents) : 'Zkontroluj počet sad.'));
      summary.append(node('p', 'commerce-small', catalog.checkout.taxMode === 'vat_included' ? 'Cena včetně DPH a zvolené dopravy.' : 'Konečná cena včetně zvolené dopravy.'));
      submit.disabled = !valid || !ship || successful || submitting;
    }
    function choose(item, focus = true) {
      if (submitting || successful || attempted) return;
      chosen = item; idempotencyKey = crypto.randomUUID(); quantity.max = String(item.stockAvailable); quantity.value = '1'; checkoutSection.hidden = false;
      document.getElementById('quoteSection').hidden = true; recalculate();
      grid.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.productId === item.id)));
      if (focus) { document.getElementById('checkoutHeading').focus(); checkoutSection.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    }
    for (const item of items) {
      const card = node('article', 'commerce-product');
      if (photoPath(item.image)) { const img = node('img'); img.src = item.image; img.alt = item.title; img.loading = 'lazy'; card.append(img); }
      card.append(node('h3', '', item.title), node('p', '', item.description || ''), node('strong', '', money(item.priceCents) + ' / sada'), node('p', 'commerce-small', 'K dispozici: ' + item.stockAvailable + ' sad'));
      const select = node('button', 'btn btn--primary', 'Vybrat sadu →'); select.type = 'button'; select.dataset.productId = item.id; select.setAttribute('aria-pressed', 'false'); select.addEventListener('click', () => choose(item)); card.append(select); grid.append(card);
    }
    checkout.addEventListener('input', () => { if (!attempted && !submitting && !successful) idempotencyKey = crypto.randomUUID(); recalculate(); });
    checkout.addEventListener('change', recalculate);
    checkout.addEventListener('submit', async event => {
      event.preventDefault(); if (submitting || successful || !chosen || !checkout.reportValidity()) return;
      if (!attempted) {
        const f = new FormData(checkout), ship = shipping.find(row => row.id === f.get('shippingMethod')), method = payments.find(row => row.id === f.get('paymentMethod'));
        if (!ship || !method || f.get('terms') !== 'on') return;
        lastPayload = { idempotencyKey, catalogVersion: catalog.checkout.version, items: [{ productId: chosen.id, quantity: Number(f.get('quantity')), version: chosen.version }], customer: { name: f.get('name'), email: f.get('email'), phone: f.get('phone'), address: f.get('address'), city: f.get('city'), postalCode: f.get('postalCode'), country: 'CZ' }, shippingMethod: ship.id, paymentMethod: method.id, termsAccepted: true, termsVersion: catalog.checkout.termsVersion };
      }
      submitting = true; attempted = true; checkout.setAttribute('aria-busy', 'true'); checkout.querySelectorAll('input,select,button').forEach(el => { el.disabled = true; }); grid.querySelectorAll('button').forEach(el => { el.disabled = true; });
      status.dataset.state = 'pending'; status.textContent = 'Odesíláme objednávku…';
      try {
        const result = await request('/api/checkout', lastPayload);
        if (!clean(result.reference) || !Number.isSafeInteger(result.totalCents)) throw new Error('Server nevrátil úplné potvrzení. Před opakováním nás prosím kontaktuj.');
        successful = true; submit.textContent = 'Objednávka přijata'; status.dataset.state = 'success'; status.textContent = 'Objednávka přijata pod číslem ' + result.reference + '. Celkem ' + money(result.totalCents) + '. Platba zatím není potvrzená.';
        if (result.emailStatus === 'blocked') status.textContent += ' E-mailové potvrzení nyní není odesíláno; toto číslo si prosím ulož.';
        const printable = node('button', 'btn', 'Uložit potvrzení / tisk'); printable.type = 'button'; printable.addEventListener('click', () => window.print()); status.after(printable);
      } catch (error) {
        status.dataset.state = 'error'; status.textContent = error.message;
        if (error.status >= 400 && error.status < 500) {
          attempted = false; idempotencyKey = crypto.randomUUID(); lastPayload = null;
          checkout.querySelectorAll('input,select,button').forEach(el => { el.disabled = false; }); grid.querySelectorAll('button').forEach(el => { el.disabled = false; });
          status.textContent += ' Objednávka nebyla přijata. Údaje můžeš opravit; dostupnost ověříme při dalším odeslání.';
          submit.textContent = 'Objednávka zavazující k platbě';
          if (error.status === 409) {
            try {
              const refreshed = await getCatalog(true), freshItem = refreshed.items.find(item => item.id === chosen.id && validProduct(item));
              if (!refreshed.orderingEnabled || !freshItem || !Number.isSafeInteger(refreshed.checkout?.version)) throw new Error('Sada už není k objednání.');
              if (!attachTermsSnapshot(checkout, refreshed.checkout?.termsSnapshot, refreshed.checkout?.termsVersion)) throw new Error('Podmínky se aktualizují.');
              catalog = refreshed; chosen = freshItem; shipping = refreshed.checkout.shippingMethods; payments = refreshed.checkout.paymentMethods;
              for (const id of ['shippingMethod', 'paymentMethod']) document.getElementById(id).replaceChildren();
              methodSelect('shippingMethod', shipping); methodSelect('paymentMethod', payments); quantity.max = String(chosen.stockAvailable); formTermsReset();
              status.textContent = 'Nabídka se změnila. Načetli jsme aktuální cenu, dostupnost a dopravu. Před novým odesláním prosím znovu zkontroluj souhrn a potvrď podmínky. Kontaktní údaje zůstaly vyplněné.';
            } catch { status.textContent += ' Aktuální dostupnost nyní nelze potvrdit. Zavolej nám prosím.'; chosen = null; }
          }
        } else { status.textContent += ' Pokud přijetí není jisté, neměň údaje. Opakování odešle stejný požadavek se stejným identifikátorem.'; submit.textContent = 'Ověřit / zopakovat stejnou objednávku'; }
        submit.disabled = !chosen;
      } finally { submitting = false; checkout.removeAttribute('aria-busy'); status.focus({ preventScroll: true }); status.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
    function formTermsReset() { checkout.elements.terms.checked = false; recalculate(); }
    const preselected = items.find(item => item.id === params.get('product')); if (preselected) choose(preselected, false);
  }
  async function offerPage() {
    const root = document.getElementById('offerPage'); if (!root) return;
    const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
    const lead = document.getElementById('offerStatus'), section = document.getElementById('checkoutSection'), form = document.getElementById('checkoutForm'), summary = document.getElementById('checkoutSummary'), submit = document.getElementById('placeOrder');
    if (!/^[a-zA-Z0-9_-]{20,512}$/.test(token)) { lead.textContent = 'Odkaz na nabídku není úplný. Požádej nás o aktuální odkaz nebo zavolej na ' + (cfg().phone || '+420 723 958 421') + '.'; return; }
    lead.textContent = 'Ověřujeme konkrétní nabídku…';
    let offer;
    try { offer = await request('/api/offers/view', { token }); }
    catch (error) { lead.textContent = error.message; return; }
    if (offer.status === 'accepted') { lead.textContent = 'Tato nabídka už byla přijata. Pro informace k objednávce nás kontaktuj; další objednávku z ní nevytváříme.'; return; }
    if (offer.status !== 'open' || offer.currency !== 'CZK' || !Number.isSafeInteger(offer.totalCents) || offer.totalCents <= 0 || !clean(offer.termsVersion) || !clean(offer.title) || !['vat_included', 'non_vat_payer'].includes(offer.taxMode) || !attachTermsSnapshot(form, offer.termsSnapshot, offer.termsVersion)) { lead.textContent = 'Nabídku nelze nyní přijmout. Kontaktuj nás pro kontrolu specifikace a archivovaného znění podmínek.'; return; }
    lead.textContent = 'Zkontroluj celou specifikaci, cenu a termín. Objednávka vznikne až tvým výslovným potvrzením tlačítkem dole.';
    summary.replaceChildren(node('span', 'eyebrow', 'Konkrétní nabídka'), node('h3', '', offer.title));
    const specification = node('p', 'commerce-offer-spec', offer.specification || ''); summary.append(specification);
    summary.append(node('p', '', 'Kola: ' + money(offer.subtotalCents)), node('p', '', (offer.shipping?.label || 'Doprava') + ': ' + money(offer.shipping?.priceCents || 0)), node('p', '', 'Dodání: ' + (offer.deliveryText || offer.shipping?.deliveryText || 'Dle nabídky')), node('p', '', 'Platba: ' + (offer.payment?.label || 'Dle nabídky')));
    if (offer.payment?.instructions) summary.append(node('p', '', offer.payment.instructions));
    if (offer.payment?.bankAccount) summary.append(node('p', '', 'Bankovní účet: ' + offer.payment.bankAccount));
    summary.append(node('strong', 'commerce-total', 'Celkem ' + money(offer.totalCents)), node('p', 'commerce-small', offer.taxMode === 'vat_included' ? 'Konečná cena včetně DPH a dopravy.' : 'Konečná cena včetně dopravy. Prodávající není plátcem DPH.'));
    if (Number.isFinite(offer.expiresAt)) summary.append(node('p', 'commerce-small', 'Platnost nabídky do ' + new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Prague' }).format(new Date(offer.expiresAt * 1000))));
    for (const name of ['quantity', 'shippingMethod', 'paymentMethod']) { form.elements[name].required = false; form.elements[name].closest('label').hidden = true; }
    section.hidden = false;
    submit.disabled = false;
    let key = crypto.randomUUID(), pendingOffer = false, completed = false, lastPayload = null;
    const status = notice(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (pendingOffer || completed || !form.reportValidity()) return;
      if (!lastPayload) { const f = new FormData(form); if (f.get('terms') !== 'on') return; lastPayload = { token, idempotencyKey: key, customer: { name: f.get('name'), email: f.get('email'), phone: f.get('phone'), address: f.get('address'), city: f.get('city'), postalCode: f.get('postalCode'), country: 'CZ' }, termsAccepted: true, termsVersion: offer.termsVersion }; }
      pendingOffer = true; form.setAttribute('aria-busy', 'true'); form.querySelectorAll('input,select,button').forEach(el => { el.disabled = true; }); status.dataset.state = 'pending'; status.textContent = 'Odesíláme přijetí nabídky…';
      try {
        const result = await request('/api/offers/accept', lastPayload);
        if (!clean(result.reference) || !Number.isSafeInteger(result.totalCents)) throw new Error('Chybí úplné potvrzení přijetí. Kontaktuj nás před opakováním.');
        completed = true; submit.textContent = 'Objednávka přijata'; status.dataset.state = 'success'; status.textContent = 'Objednávka přijata pod číslem ' + result.reference + '. Celkem ' + money(result.totalCents) + '. Platba zatím není potvrzená.';
        if (result.emailStatus === 'blocked') status.textContent += ' E-mailové potvrzení nyní není odesíláno. Referenci si prosím ulož.';
        const print = node('button', 'btn', 'Uložit potvrzení / tisk'); print.type = 'button'; print.addEventListener('click', () => window.print()); status.after(print);
      } catch (error) {
        status.dataset.state = 'error'; status.textContent = error.message;
        if (error.status >= 400 && error.status < 500 && ![409,410].includes(error.status)) { lastPayload = null; key = crypto.randomUUID(); form.querySelectorAll('input,select,button').forEach(el => { el.disabled = false; }); status.textContent += ' Zkontroluj údaje; zůstaly vyplněné.'; }
        else if ([409,410].includes(error.status)) { status.textContent += ' Nabídku nyní nelze znovu přijmout. Kontaktuj nás pro ověření.'; }
        else { status.textContent += ' Přijetí není potvrzené. Opakování odešle stejnou objednávku se stejným identifikátorem.'; submit.disabled = false; submit.textContent = 'Ověřit / zopakovat stejnou objednávku'; }
      } finally { pendingOffer = false; form.removeAttribute('aria-busy'); status.focus({ preventScroll: true }); status.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
  }
  window.NFWCommerce = Object.freeze({ bindEnquiry, submitEnquiry, getCatalog, validProduct, photoPath, money, enabled, unavailable });
  hydrate(); orderPage(); offerPage();
})();
