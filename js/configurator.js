/* ============================================================
   Need For Wheels — konfigurátor kol
   Kroky: 1 Auto · 2 Design · 3 Rozměry · 4 Vzhled · 5 Souhrn
   Stav se zrcadlí do URL (#hash), takže jde konfiguraci sdílet.
   Vše, co přijde z URL, se validuje proti katalogu a limitům.
   ============================================================ */
(function () {
  'use strict';
  const O = window.NFW;
  const P = window.NFWPricing;
  const V = window.NFWVehicles;
  const visuals = window.NFWVehicleVisuals;
  const models3D = window.NFWVehicleModels;
  const $ = s => document.querySelector(s);
  const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';
  const nf = n => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const HEX = /^#[0-9a-f]{6}$/i;

  const EXTRAS = [
    { id: 'hidden',   name: 'Skryté šrouby',            desc: 'Spojovací šrouby límce schované za čelem (u třídílných kol)' },
    { id: 'titanium', name: 'Titanové šrouby / matice', desc: 'Sada 20 ks, lehčí než ocelové' },
    { id: 'engrave',  name: 'Gravírování',              desc: 'Vlastní text nebo logo na paprsku' },
    { id: 'tpms',     name: 'TPMS senzory',             desc: 'Namontované v kole, párování s vozem provede servis' },
    { id: 'ceramic',  name: 'Keramická ochrana',        desc: 'Ochranná vrstva proti solím a prachu' },
  ];
  const STEPS = ['Auto', 'Design', 'Rozměry', 'Vzhled', 'Souhrn'];
  const MOBILE = matchMedia('(max-width: 900px)');
  let previewExpanded = false;
  function syncPreviewState() {
    $('.cfg').dataset.previewExpanded = String(previewExpanded);
    document.querySelectorAll('[data-flow-preview]').forEach(button => button.setAttribute('aria-expanded', String(previewExpanded)));
  }
  const FLOW = [
    ['Vyber svoje auto.', 'Zvol značku, model a rok. Potom pokračuj k designu.'],
    ['Najdi svůj design.', 'Klepni na kolo. Vybraný návrh uvidíš v náhledu.'],
    ['Jak velká kola?', 'Vyber průměr. Další rozměry můžeme doladit společně.'],
    ['Dolaď barvu a povrch.', 'Porovnej odstíny. Límec, krytku a doplňky najdeš níže.'],
    ['Tvůj návrh je připravený.', 'Zkontroluj výběr a pokračuj ke kontaktu.']
  ];
  const detailState = new Map();
  let guidingFrame = 0;
  const announce = message => { $('#flowAnnouncement').textContent = message; };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const detailsHTML = (id, title, content) => `<details class="flow-details" data-flow-detail="${id}" ${detailState.get(id) === true ? 'open' : ''}><summary>${title}<span aria-hidden="true">＋</span></summary><div class="flow-details__body">${content}</div></details>`;
  function revealFlow(target, { focus = true, block = 'start' } = {}) {
    if (!MOBILE.matches || !target) return;
    cancelAnimationFrame(guidingFrame);
    guidingFrame = requestAnimationFrame(() => {
      if (!target.isConnected) return;
      if (focus) target.focus({ preventScroll: true });
      const nav = $('.nav').getBoundingClientRect().height;
      const rect = (target.id === 'mobileFlowIntro' ? $('.cfg') : target).getBoundingClientRect();
      const footer = $('#panelFoot').getBoundingClientRect().height;
      const visibleBottom = (window.visualViewport?.height || innerHeight) - (document.body.classList.contains('flow-keyboard-open') ? 0 : footer) - 16;
      if (block === 'nearest' && rect.top >= nav + 16 && rect.bottom <= visibleBottom) return;
      // Step changes should place the next control immediately. A long smooth
      // scroll can move targets under the sticky header while someone taps again.
      window.scrollTo({ top: Math.max(0, scrollY + rect.top - nav - 16), behavior: 'instant' });
    });
  }
  function renderFlowIntro() {
    $('.cfg').dataset.currentStep = S.step;
    const [title, instruction] = flowCopy(S.step);
    $('#mobileFlowIntro').innerHTML = `<small class="mobile-flow-step">Krok ${S.step} z ${STEPS.length} · ${STEPS[S.step - 1]}</small><strong class="mobile-flow-title">${title}</strong><p class="mobile-flow-copy">${instruction}</p>`;
    $('#mobileFlowIntro').setAttribute('aria-label', `Krok ${S.step} z 5. ${title} ${instruction}`);
  }
  const DIAMS = P?.customFamily('forged-monoblock')?.diameters || [17, 18, 19, 20, 21, 22, 23, 24];
  const LIMITS = { d: [17, 24], wf: [7, 13.5], wr: [7, 13.5], etf: [-15, 75], etr: [-15, 75], cb: [50, 120] };

  /* ---------- stav ---------- */
  const S = {
    step: 1, view: 'wheel', spin: false, side: 'R',
    brand: '', model: '', year: 0, generation: '', body: '', vehicleFilter: 'all',
    car: 'suv', bodyColor: 'white', carDetail: '',
    design: O.E6_DESIGNS?.[0]?.id || 'motivo-mb-b', color: 'silver', colorHex: '#b9bcc2', finish: 'gloss', lip: 'same', cap: 'black',
    d: Math.min(...DIAMS), stag: true, wf: 9, wr: 11.5, etf: 50, etr: 62, pcd: '5x130', cb: 71.6,
    extras: [], note: '', name: '', email: '', phone: '', isElectricVehicle: false, loadKg: null, higherLoadConsultation: false,
  };
  const INITIAL = { ...S };
  const car = () => O.find(O.CARS, S.car);
  const selectedBrand = () => V.getBrand(S.brand);
  const selectedModel = () => V.getModel(S.brand, S.model);
  const isKnownElectricModel = () => V.isElectricModel?.(S.brand, S.model) === true;
  const visibleVehicleBrands = () => S.vehicleFilter === 'electric' ? V.brands.filter(brand => brand.models.some(model => V.isElectricModel?.(brand.id, model.id))) : V.brands;
  const visibleVehicleModels = () => (selectedBrand()?.models || []).filter(model => S.vehicleFilter !== 'electric' || V.isElectricModel?.(S.brand, model.id));
  const candidates = () => V.getCandidates(S.brand, S.model, S.year, S.body);
  const generation = () => S.body ? candidates().find(g => g.id === S.generation) || null : null;
  const vehicleName = () => !selectedModel() ? (selectedBrand() ? selectedBrand().name + ' · vyber model' : 'Vůz zatím nevybraný') : `${selectedBrand()?.name || ''} ${selectedModel()?.name || ''} · ${S.year || 'rok neurčen'}${generation() ? ' · ' + generation().name + ' · ' + generation().bodyName : S.body ? ' · ' + (V.getBodies(S.brand,S.model,S.year).find(b=>b.id===S.body)?.name || '') + ' · provedení neurčeno' : ' · provedení neurčeno'}`;
  function syncGeneration(autoSelect = true) {
    const all = V.getCandidates(S.brand, S.model, S.year);
    const bodies = V.getBodies(S.brand, S.model, S.year);
    if (!bodies.some(b => b.id === S.body)) S.body = '';
    const requested = all.find(g => g.id === S.generation);
    if (!S.body && requested) S.body = requested.body;
    if (autoSelect && !S.body && bodies.length === 1) S.body = bodies[0].id;
    const list = candidates();
    if (!S.body || !list.some(g => g.id === S.generation)) S.generation = autoSelect && S.body && list.length === 1 ? list[0].id : '';
  }
  const design = () => O.find(O.DESIGNS, S.design);
  const designPriceFamily = id => P?.customFamily(P.configuratorDesigns.find(item => item.id === id)?.family);
  const designDiameters = () => designPriceFamily(S.design)?.diameters || DIAMS;
  const isSourceE6 = () => design().sourceBrand === 'E6';
  const sourcePhotoOnly = () => isSourceE6() && !window.NFWPhotoWheelModels?.[S.design];
  const flowCopy = step => {
    const [title,instruction] = FLOW[step - 1];
    return [title, sourcePhotoOnly() && step === 2 ? 'Vyber konkrétní model E6. V náhledu uvidíš jeho produktovou fotografii.' : sourcePhotoOnly() && step === 4 ? 'Zvol požadovaný odstín pro poptávku. Produktová fotografie zůstává v původním provedení.' : instruction];
  };
  const constructionLabel = d => d.pieces === 2 ? 'Dvoudílné' : d.pieces === 3 ? 'Třídílné' : d.pieces === 1 ? 'Jednodílné' : d.construction === 'multipiece' ? 'Vícedílné · počet dílů k potvrzení' : 'Konstrukce k potvrzení';
  const constructionKey = d => Number.isInteger(d.pieces) ? String(d.pieces) : d.construction === 'multipiece' ? 'multipiece' : 'unconfirmed';
  const constructionFilterLabel = key => constructionLabel({pieces: Number(key), construction: key}).split(' · ')[0];
  let designConstructionFilter = 'all';
  let designSearch = '';
  const bodyHex = () => O.find(O.BODY_COLORS, S.bodyColor).hex;
  const colorHex = () => S.color === 'custom' ? S.colorHex : O.find(O.COLORS, S.color).hex;
  const colorName = () => S.color === 'custom' ? 'Vlastní ' + S.colorHex.toUpperCase() : O.find(O.COLORS, S.color).name;
  const directional = () => ['twist', 'turbine'].includes(design().style);
  const wheelOpts = () => ({ design: S.design, colorHex: colorHex(), finish: S.finish, lip: S.lip, cap: S.cap, bolts: parseInt(S.pcd, 10) || 5, mirror: directional() && S.side === 'L' });
  const sizeF = () => `${S.d} × ${nf(S.wf)}" ET${S.etf}`;
  const sizeR = () => `${S.d} × ${nf(S.wr)}" ET${S.etr}`;
  const clamp = (k, v) => Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v));
  const validLoad = value => Number.isInteger(value) && value >= 690 && value <= 1100;
  const requiredLoadKg = () => S.higherLoadConsultation ? null : S.isElectricVehicle ? Math.max(850, S.loadKg || 0) : S.loadKg;
  const loadLabel = () => S.higherLoadConsultation ? 'Vyšší nosnost než 1100 kg / kolo – nutná konzultace' : requiredLoadKg() ? `${requiredLoadKg()} kg / kolo` : 'Nastavíme při konzultaci (690–1100 kg / kolo)';
  const electricVehicleHint = () => S.higherLoadConsultation
    ? 'Požaduješ nosnost vyšší než 1100 kg na jedno kolo. Konkrétní hodnotu a vhodné provedení je nutné potvrdit při konzultaci podle vozu.'
    : S.isElectricVehicle
      ? `Požadovaná nosnost: ${requiredLoadKg()} kg na jedno kolo. Pro elektroauto automaticky zadáváme 850 kg; individuálně lze zvolit až 1100 kg. Vyšší nosnost vyžaduje konzultaci.`
      : 'Požadovanou nosnost lze zvolit od 690 do 1100 kg na jedno kolo. Vyšší nosnost vyžaduje konzultaci. Vhodnost konkrétního provedení potvrdíme podle vozu.';
  const loadOptions = () => `<option value="">${S.isElectricVehicle ? 'Automaticky · 850 kg / kolo' : 'Nastavíme při konzultaci'}</option>` + [...new Set([690, 725, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975, 1000, 1025, 1050, 1100, S.loadKg].filter(validLoad))].sort((a, b) => a - b).map(value => `<option value="${value}" ${S.loadKg === value ? 'selected' : ''} ${S.isElectricVehicle && value < 850 ? 'disabled' : ''}>${value} kg / kolo</option>`).join('') + `<option value="higher-consultation" ${S.higherLoadConsultation ? 'selected' : ''}>Vyšší nosnost než 1100 kg / kolo – nutná konzultace</option>`;
  const electricVehicleField = () => `<div class="cfg-electric-vehicle"><label class="check" for="electricVehicle"><input id="electricVehicle" type="checkbox" ${S.isElectricVehicle ? 'checked' : ''} ${isKnownElectricModel() ? 'disabled' : ''} aria-describedby="electricVehicleHint"><span><b>${isKnownElectricModel() ? 'Elektromobil' : 'Máte elektroauto?'}</b><span>${isKnownElectricModel() ? 'Rozpoznáno podle vybraného modelu' : 'Vyšší požadovaná nosnost kol'}</span></span></label><label class="cfg-load-label" for="wheelLoad">Požadovaná nosnost na jedno kolo</label><select id="wheelLoad" aria-describedby="electricVehicleHint">${loadOptions()}</select><p id="electricVehicleHint" role="status">${electricVehicleHint()}</p></div>`;

  function applyCarDefaults(c) {
    const f = c.fit;
    Object.assign(S, { wf: f.wf, wr: f.wr, etf: f.etf, etr: f.etr, pcd: f.pcd, cb: f.cb, bodyColor: f.bodyColor, stag: f.wf !== f.wr });
  }

  /* ---------- cena ---------- */
  const quotedOptions = () => [
    O.find(O.FINISHES, S.finish).quoteOnly ? O.find(O.FINISHES, S.finish).name : '',
    O.find(O.LIPS, S.lip).quoteOnly ? O.find(O.LIPS, S.lip).name : '',
    O.find(O.CAPS, S.cap).quoteOnly ? O.find(O.CAPS, S.cap).name : '',
    ...S.extras.map(id => EXTRAS.find(extra => extra.id === id)?.name || '')
  ].filter(Boolean);
  function price() {
    const rule = P?.configuratorDesigns.find(item => item.id === S.design);
    const packagePrice = packageKind => {
      const amount = rule?.family ? P.customPrice(rule.family, S.d, packageKind, 1) : null;
      return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
    };
    return { singleCents: packagePrice('single'), setCents: packagePrice('set4'), options: quotedOptions() };
  }
  const priceLabel = cents => cents === null ? 'Cena na potvrzení' : 'od ' + kc(cents / 100);
  function orderNo() {
    const now = new Date();
    let h = 0; for (const ch of `${S.car}${S.design}${S.d}${S.wf}${S.wr}${S.color}`) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
    return `OA-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}-${String(h % 900 + 100)}`;
  }

  /* ---------- URL ---------- */
  const has = (list, id) => list.some(x => x.id === id);
  function readURL() {
    Object.assign(S, INITIAL, { extras: [] });
    applyCarDefaults(car());
    const p = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    /* hash = kompletní sdílený stav (má přednost); query z homepage jen předvolí auto/design */
    const src = h.has('car') || h.has('brand') ? h : p;
    if (V.getBrand(src.get('brand'))) S.brand = V.getBrand(src.get('brand')).id;
    if (V.getModel(S.brand, src.get('model'))) S.model = V.getModel(S.brand, src.get('model')).id;
    else if (!V.getModel(S.brand, S.model)) S.model = '';
    const years = V.getYears(S.brand, S.model);
    const year = Number(src.get('year'));
    if (src.has('year')) S.year = Number.isInteger(year) && year >= 1886 && year <= V.through ? year : 0;
    else if (!years.includes(S.year)) S.year = years[0] || 0;
    S.generation = src.get('generation') || '';
    S.body = src.get('body') || '';
    // Conflicting explicit body/variant links must not resolve to an image.
    const linked = V.getCandidates(S.brand, S.model, S.year).find(g=>g.id===S.generation);
    const conflict = (S.generation && !linked) || (S.body && linked && S.body !== linked.body) || (S.body && !V.getBodies(S.brand,S.model,S.year).some(b=>b.id===S.body));
    if (conflict) S.generation = '';
    syncGeneration(!conflict && !(src.has('generation') && !src.get('generation')));
    if (['car','photo','model-photo','wheel','wheel-photo','own-car','showroom'].includes(src.get('view'))) S.view = src.get('view');
    else if (MOBILE.matches) S.view = 'wheel';
    // Old showroom links must never substitute a different car for the selection.
    if (S.view === 'showroom') S.view = 'car';
    // Entry links still select the exact car; the mobile journey starts with
    // the wheel. Explicit shared hash states retain their chosen photo view.
    if (MOBILE.matches && src === p && !['wheel-photo', 'own-car', 'model-photo'].includes(src.get('view'))) S.view = 'wheel';
    if (src === p && src.has('model') && S.year === 0 && src.get('view') === 'car') S.view = 'model-photo';
    if (has(O.CARS, src.get('car'))) { S.car = src.get('car'); applyCarDefaults(car()); }
    // A direct vehicle/photo-tool entry still needs a supported 3D wheel.
    // An explicitly selected E6 model always keeps its exact source photograph.
    if (!has(O.DESIGNS, src.get('design')) && ['car','showroom','photo','model-photo','own-car','wheel'].includes(src.get('view'))) S.design = 'motivo-mb-b';
    if (has(O.DESIGNS, src.get('design'))) { S.design = src.get('design'); if (src === p) S.step = 2; }
    if (has(O.COLORS, src.get('color'))) S.color = src.get('color');
    if (has(O.FINISHES, src.get('finish'))) S.finish = src.get('finish');
    S.vehicleFilter = src.get('vehicleFilter') === 'electric' && (!S.model || isKnownElectricModel()) ? 'electric' : 'all';
    if (S.vehicleFilter === 'electric' && !visibleVehicleBrands().some(brand => brand.id === S.brand)) S.brand = '';
    S.isElectricVehicle = isKnownElectricModel() || src.get('ev') === '1';
    S.higherLoadConsultation = src.get('higherLoadConsultation') === '1';
    const linkedLoad = Number(src.get('loadKg'));
    S.loadKg = !S.higherLoadConsultation && validLoad(linkedLoad) ? linkedLoad : null;
    if (S.isElectricVehicle && S.loadKg < 850) S.loadKg = null;
    const linkedDiameter = Number(src.get('d'));
    if (DIAMS.includes(linkedDiameter)) S.d = linkedDiameter;
    if (src !== h) return;
    if (has(O.BODY_COLORS, h.get('bodyColor'))) S.bodyColor = h.get('bodyColor');
    if (has(O.LIPS, h.get('lip'))) S.lip = h.get('lip');
    if (has(O.CAPS, h.get('cap'))) S.cap = h.get('cap');
    if (O.PCDS.includes(h.get('pcd'))) S.pcd = h.get('pcd');
    if (HEX.test(h.get('colorHex') || '')) S.colorHex = h.get('colorHex').toLowerCase();
    if (h.get('color') === 'custom') S.color = 'custom';
    Object.keys(LIMITS).forEach(k => {
      if (!h.has(k)) return;
      const v = Number(h.get(k));
      if (Number.isFinite(v)) S[k] = clamp(k, v);
    });
    S.d = Math.round(S.d);
    if (!DIAMS.includes(S.d)) S.d = Math.min(...DIAMS);
    S.stag = h.get('stag') !== '0';
    if (!S.stag) { S.wr = S.wf; S.etr = S.etf; }
    const st = parseInt(h.get('step'), 10);
    if (st >= 1 && st <= 5) S.step = st;
    if (h.get('side') === 'L') S.side = 'L';
    if (h.get('x')) S.extras = [...new Set(h.get('x').split(',').filter(id => EXTRAS.some(e => e.id === id)))];
    S.carDetail = (h.get('carDetail') || '').slice(0, 80);
    S.note = (h.get('note') || '').slice(0, 300);
  }
  const KEYS = ['brand', 'model', 'year', 'generation', 'body', 'vehicleFilter', 'view', 'car', 'bodyColor', 'design', 'color', 'colorHex', 'finish', 'lip', 'cap', 'd', 'wf', 'wr', 'etf', 'etr', 'pcd', 'cb', 'side', 'step'];
  function writeURL() {
    const diameters = designDiameters();
    if (!diameters.includes(S.d)) S.d = diameters.reduce((closest, value) => Math.abs(value - S.d) < Math.abs(closest - S.d) ? value : closest);
    // Source photographs are the only verified E6 visual asset. Shared links
    // must not reopen a generic 3D design or place a different wheel on a car.
    if (sourcePhotoOnly()) S.view = 'wheel-photo';
    const h = new URLSearchParams();
    KEYS.forEach(k => h.set(k, String(S[k])));
    h.set('stag', S.stag ? '1' : '0');
    h.set('ev', S.isElectricVehicle ? '1' : '0');
    if (S.higherLoadConsultation) h.set('higherLoadConsultation', '1');
    if (S.loadKg !== null) h.set('loadKg', S.loadKg);
    if (S.extras.length) h.set('x', S.extras.join(','));
    // Free text stays in this page and the explicitly submitted enquiry.
    // Keep old shared links readable, but remove their private fields on normalisation.
    const url = new URL(location.href);
    // Share one canonical vehicle state; obsolete entry-link values must not
    // keep advertising BMW in the query after selecting another vehicle.
    [...KEYS, 'weight', 'stag', 'ev', 'loadKg', 'higherLoadConsultation', 'x', 'carDetail', 'note', 'name', 'email', 'phone'].forEach(key => url.searchParams.delete(key));
    url.hash = h.toString();
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  /* z file:// by se sdílel lokální soubor – použijeme veřejnou adresu webu */
  const shareURL = () => location.protocol === 'file:' ? O.SITE_URL + 'konfigurator.html' + location.hash : location.href;

  /* ---------- render: kroky ---------- */
  function renderSteps() {
    renderFlowIntro();
    $('#stepsRail').innerHTML = `<div class="cfg-flow-header"><span>Tvoje konfigurace</span><small>Krok ${S.step} z ${STEPS.length}</small><button type="button" class="cfg-preview-trigger" data-flow-preview aria-controls="stageView">Náhled ↗</button></div><div class="cfg-step-list">` + STEPS.map((t, i) => {
      const n = i + 1;
      const cls = n === S.step ? 'active' : '';
      return `<button class="cfg-step ${cls}" type="button" data-step="${n}" aria-label="Krok ${n} z 5: ${t}" aria-current="${n === S.step ? 'step' : 'false'}"><b><span>${n}</span></b><span class="t">${t}</span></button>`;
    }).join('') + '</div>';
    syncPreviewState();
  }

  /* ---------- render: scéna ---------- */
  const selected3D = () => models3D?.resolve(S) || null;
  const stageAsset = () => S.view === 'car' ? selected3D() : null;
  const isPhotoView = () => S.view === 'photo' || S.view === 'model-photo' || (S.view === 'car' && !selected3D());
  const isWheelProductView = () => S.view === 'wheel-photo';
  const isOwnCarView = () => S.view === 'own-car';
  const product = () => O.WHEEL_PRODUCTS?.[S.design] || null;
  const productPhotoIndexes = new Map();
  function stageTitle() {
    return `<small>${isOwnCarView() ? 'Na tvém autě' : isWheelProductView() ? 'Produktová fotografie' : isPhotoView() ? 'Náhled na voze' : 'Tvůj návrh kol'}</small>${esc(design().name)}`;
  }
  let showroomModule, wheelPhotoModule, viewer, photoViewer, pendingViewerAbort, viewerKey = '', renderToken = 0;
  let ownCarModule, ownCarSession, ownCarViewer;
  const loadOwnCar = () => ownCarModule || (ownCarModule = import('./own-car-studio.js?v=20261011-wheel-fidelity-v1').catch(error => { ownCarModule = null; throw error; }));
  const failedVisuals = new Set();
  const loadShowroom = () => showroomModule || (showroomModule = import('./showroom.js?v=20261011-wheel-fidelity-v1').catch(e => { showroomModule = null; throw e; }));
  const loadWheelPhoto = () => wheelPhotoModule || (wheelPhotoModule = import('./wheel-fit-preview.js?v=20261011-wheel-fidelity-v1').catch(e => { wheelPhotoModule = null; throw e; }));
  const previewOptions = mode => ({ mode, vehicleAsset: stageAsset()?.id, design: S.design, color: colorHex(), colorHex: colorHex(), finish: S.finish, lip: S.lip, cap: S.cap, diameter: S.d, width: S.wf, autoRotate: S.spin, bodyColor: bodyHex(), mirror: S.side === 'L', bolts: parseInt(S.pcd,10) || 5 });
  const photoOptions = () => ({ ...previewOptions('wheel'), referencePreview: S.view === 'model-photo', label: `${design().name} · ${colorName()}` });
  const photoIndexes = new Map();
  async function renderWheelFallback(container, token, module) {
    const selected = { name: design().name, colourName: colorName(), colour: colorHex(), options: previewOptions('wheel') };
    const matchingColour = ['#b9bcc2', '#9a6d3a'].includes(selected.colour.toLowerCase());
    const message = window.NFWPhotoWheelModels?.[S.design]
      ? '3D náhled se nepodařilo načíst. Zobrazuje se původní fotografie; vybraný odstín zůstává uložený v konfiguraci.'
      : matchingColour
      ? '3D náhled se nepodařilo načíst. Zobrazuje se uložený render vybraného designu a barvy.'
      : '3D náhled se nepodařilo načíst. Náhled designu je ve stříbrné; vybraný odstín zůstává uložený v konfiguraci.';
    container.innerHTML = `<div class="viewer-fallback" data-wheel-design="${esc(S.design)}" data-wheel-colour="${esc(selected.colour)}">${O.renderWheel(wheelOpts())}<p><b>${esc(selected.name)} · ${esc(selected.colourName)}</b><br><span data-fallback-message>${message}</span></p><button class="btn btn--ghost" type="button" data-retry-3d>Zkusit znovu</button></div>`;
    // A missing car asset can still have a working GPU. Render the selected wheel
    // independently; a total WebGL failure keeps the explicitly labelled stored image.
    if (!module?.renderThumbnail) return;
    try {
      const src = await module.renderThumbnail({ ...selected.options, size: 600, transparent: true, shadows: true, quality: .95 });
      if (token !== renderToken || !container.isConnected) return;
      const image = container.querySelector('.viewer-fallback img');
      if (!image) return;
      image.src = src; image.alt = `${selected.name} — render vybraného kola, ${selected.colourName}`;
      image.width = image.height = 600;
      container.querySelector('[data-fallback-message]').textContent = 'Interaktivní náhled se nepodařilo načíst. Zobrazuje se render tvého vybraného kola.';
    } catch { /* Keep the usable, accurately labelled stored design preview. */ }
  }
  function renderStage() {
    if (sourcePhotoOnly()) S.view = 'wheel-photo';
    const tabs = sourcePhotoOnly() ? [['wheel-photo', 'Fotografie E6']] : [['wheel', '3D kolo'], ['wheel-photo', 'Foto kola'], ['own-car', 'Moje auto']];
    const vehicleViews = [['car', 'Můj vůz'], ['model-photo', 'Modelová řada'], ...(selected3D() ? [['photo', 'Fotografie vozu']] : [])];
    const vehicleView = vehicleViews.some(([id]) => id === S.view);
    $('#stageHead').innerHTML = `<div class="cfg-preview-heading"><div><h1>${stageTitle()}</h1><p class="cfg-preview-vehicle">${esc(selectedModel() ? vehicleName() : 'Vyber auto a navrhni kola podle sebe.')}</p></div><button class="cfg-close-preview" type="button" data-close-preview>Zavřít náhled ×</button>${document.fullscreenEnabled ? '<button class="cfg-expand" type="button" data-studio-fullscreen aria-label="Zvětšit náhled na celou obrazovku">Zvětšit ↗</button>' : ''}</div><div class="stage-controls"><div class="seg" role="group" aria-label="Typ náhledu">${tabs.map(([id,label])=>`<button type="button" class="${S.view===id?'active':''}" data-view="${id}" aria-pressed="${S.view===id}"><span>${label}</span></button>`).join('')}</div>${!sourcePhotoOnly() && (selectedModel() || vehicleView) ? `<label class="cfg-view-select"><span class="visually-hidden">Další náhled vozu</span><select id="previewView" aria-label="Další náhled vozu"><option value="">Náhled vozu</option>${vehicleViews.map(([id,label]) => `<option value="${id}" ${S.view === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}${!isPhotoView() && !isWheelProductView() && !isOwnCarView()?`<label class="toggle"><input type="checkbox" id="spinToggle" ${S.spin?'checked':''}> Rotace</label>`:''}</div>`;
    syncPreviewState();
    renderStageView(); renderStageFoot();
  }
  async function renderStageView() {
    if (sourcePhotoOnly()) S.view = 'wheel-photo';
    const v = $('#stageView');
    const token = ++renderToken;
    if (MOBILE.matches && !previewExpanded) {
      pendingViewerAbort?.abort(); pendingViewerAbort = null;
      viewer?.dispose(); viewer = null;
      photoViewer?.dispose(); photoViewer = null;
      ownCarViewer?.dispose(); ownCarViewer = null;
      viewerKey = ''; v.replaceChildren();
      return;
    }
    const asset = stageAsset();
    v.classList.toggle('has-own-car', isOwnCarView());
    v.closest('.cfg-stage')?.classList.toggle('has-own-car', isOwnCarView());
    if (isOwnCarView()) {
      pendingViewerAbort?.abort(); pendingViewerAbort = null;
      viewer?.dispose(); viewer = null;
      photoViewer?.dispose(); photoViewer = null;
      v.classList.remove('has-vehicle-photo', 'has-vehicle-3d', 'has-wheel-product', 'is-wheel-reference', 'is-visual-loading');
      v.closest('.cfg-stage')?.classList.remove('has-vehicle-3d', 'has-vehicle-visual', 'has-wheel-reference');
      viewerKey = 'own-car';
      if (ownCarViewer) { ownCarViewer.update(photoOptions()); return; }
      v.innerHTML = '<div class="viewer-loading" role="status">Připravuji tvoje foto studio…</div>';
      try {
        const module = await loadOwnCar();
        if (token !== renderToken || !isOwnCarView()) return;
        v.replaceChildren();
        ownCarSession ||= module.createOwnCarSession();
        ownCarViewer = module.mountOwnCarStudio(v, ownCarSession, photoOptions(), {
          continueLabel: 'Upřesnit auto a vybrat kola →',
          onContinue: () => {
            goStep(1);
            announce('Fotografie nerozpoznává model auta. Zkontroluj značku, model a rok pro poptávku, potom pokračuj k designu.');
            revealFlow($('#flowHeading'));
          },
        });
      } catch {
        if (token !== renderToken) return;
        v.innerHTML = '<div class="viewer-fallback"><p>Foto studio se nepodařilo načíst. Vybraná konfigurace zůstává zachovaná.</p><button type="button" class="btn btn--ghost" data-retry-own-car>Zkusit znovu</button></div>';
      }
      return;
    }
    ownCarViewer?.dispose(); ownCarViewer = null;
    v.classList.toggle('has-wheel-product', isWheelProductView());
    if (isWheelProductView()) {
      pendingViewerAbort?.abort(); pendingViewerAbort = null;
      viewer?.dispose(); viewer = null;
      photoViewer?.dispose(); photoViewer = null;
      viewerKey = 'product:' + S.design;
      v.classList.remove('has-vehicle-photo', 'has-vehicle-3d', 'is-wheel-reference', 'is-visual-loading');
      v.closest('.cfg-stage')?.classList.remove('has-vehicle-3d', 'has-vehicle-visual', 'has-wheel-reference');
      renderProductPhotoView(v);
      return;
    }
    if (isPhotoView() && visuals && !visuals.isReady) {
      pendingViewerAbort?.abort(); pendingViewerAbort = null;
      if (viewer) { viewer.dispose(); viewer = null; }
      if (photoViewer) { photoViewer.dispose(); photoViewer = null; }
      viewerKey = 'visual-pending';
      v.classList.add('has-vehicle-photo', 'is-visual-loading');
      v.closest('.cfg-stage')?.classList.add('has-vehicle-visual');
      v.innerHTML = '<figure class="stage-vehicle-frame"><div class="viewer-loading" role="status">Načítám fotografii vozu…</div></figure><div class="preview-caption"><b>Tvůj vůz je vybraný</b><span>Připravuji dostupný vizuální podklad.</span></div>';
      return;
    }
    const photoSelection = S.view === 'model-photo' ? { brand: S.brand, model: S.model } : S;
    const galleryPhotos = isPhotoView() ? visuals?.getGallery(photoSelection, { allowModelFallback: S.view === 'model-photo', includeVariantReferences: S.view === 'model-photo' }) || [] : [];
    if (galleryPhotos.length && window.NFWVehiclePhotoGallery) {
      const key = 'gallery:' + S.view + ':' + galleryPhotos.map(photo => photo.id).join('|');
      v.classList.add('has-vehicle-photo'); v.classList.remove('has-vehicle-3d', 'is-wheel-reference', 'is-visual-loading');
      v.closest('.cfg-stage')?.classList.add('has-vehicle-visual');
      v.closest('.cfg-stage')?.classList.remove('has-vehicle-3d', 'has-wheel-reference');
      if (photoViewer && viewerKey === key) { photoViewer.update(photoOptions()); return; }
      pendingViewerAbort?.abort(); pendingViewerAbort = null;
      viewer?.dispose(); viewer = null; photoViewer?.dispose(); photoViewer = null;
      viewerKey = key; v.replaceChildren();
      photoViewer = window.NFWVehiclePhotoGallery.mount(v, {
        photos: galleryPhotos, index: photoIndexes.get(key) || 0, wheelOptions: photoOptions(), renderWheels: true,
        onChange: ({ index }) => { photoIndexes.set(key, index); },
      });
      return;
    }
    let visual = isPhotoView() ? visuals?.resolve(S, { allowModelFallback: false }) || null : null;
    if (visual && failedVisuals.has(visual.src)) visual = null;
    const mode = asset ? 'car' : 'wheel';
    const key = visual ? 'image:' + visual.id : asset ? '3d:' + asset.id : mode;
    v.classList.toggle('is-wheel-reference', !asset && !visual && isPhotoView());
    v.closest('.cfg-stage')?.classList.toggle('has-wheel-reference', !asset && !visual && isPhotoView());
    v.classList.toggle('has-vehicle-3d', Boolean(asset));
    v.closest('.cfg-stage')?.classList.toggle('has-vehicle-3d', Boolean(asset));
    v.classList.toggle('has-vehicle-photo', Boolean(visual));
    v.closest('.cfg-stage')?.classList.toggle('has-vehicle-visual', Boolean(visual));
    v.classList.remove('is-visual-loading');
    if (photoViewer && viewerKey === key) {
      photoViewer.update(photoOptions());
      updatePreviewCaption(v, visual); return;
    }
    if (viewer && viewerKey === key) {
      viewer.update(previewOptions(mode));
      updatePreviewCaption(v, visual); return;
    }
    pendingViewerAbort?.abort(); pendingViewerAbort = null;
    if (viewer) { viewer.dispose(); viewer=null; }
    if (photoViewer) { photoViewer.dispose(); photoViewer=null; }
    viewerKey = key;
    if (visual) {
      v.innerHTML=`<figure class="stage-vehicle-frame"><img class="vehicle-render" data-visual-match="${visual.match}" data-visual-id="${esc(visual.id)}" src="${esc(visuals.imageURL(visual))}" alt="${esc(visual.alt)}" width="${visual.width}" height="${visual.height}"></figure><div class="preview-caption"></div>`;
      v.querySelector('img').addEventListener('error', () => {
        if (viewerKey !== key) return;
        failedVisuals.add(visual.src);
        renderStageView();
      }, { once: true });
      updatePreviewCaption(v,visual);
      try {
        const module = await loadWheelPhoto();
        if (token !== renderToken) return;
        photoViewer = module.mountWheelPhoto(v.querySelector('.stage-vehicle-frame'), visual, photoOptions());
      } catch (error) {
        if (token !== renderToken) return;
        v.querySelector('.stage-vehicle-frame').insertAdjacentHTML('afterend', '<div class="wheel-photo-toolbar"><span class="wheel-photo-status">Náhled nových kol se nepodařilo načíst.</span><button type="button" class="wheel-photo-retry" data-retry-visual>Obnovit náhled kol</button></div>');
      }
      return;
    }
    v.innerHTML='<div class="webgl-view" id="webglView"><div class="viewer-loading"><span></span>Připravuji 3D studio…</div></div>' + (asset ? `<div class="studio-viewpoints" aria-label="Pohled na vůz">${[['perspective','3/4'],['front','Příď'],['side','Bok'],['rear','Záď'],['detail','Detail kola']].map(([id,label])=>`<button type="button" data-camera="${id}">${label}</button>`).join('')}${document.fullscreenEnabled ? '<button type="button" data-studio-fullscreen aria-label="Studio na celou obrazovku">Zvětšit ↗</button>' : ''}</div>` : '') + '<div class="preview-caption"></div>';
    updatePreviewCaption(v,visual);
    const container = v.querySelector('.webgl-view');
    const request = new AbortController(); pendingViewerAbort = request;
    let module;
    try {
      module = await loadShowroom(); if(token!==renderToken)return;
      const result = await module.mount(container, { ...previewOptions(mode), signal: request.signal });
      if(token!==renderToken){result?.dispose();return;}
      viewer=result;
      container.querySelector('.viewer-loading')?.remove();
    } catch(error) {
      if(token!==renderToken)return;
      await renderWheelFallback(container, token, module);
    }
  }
  function renderProductPhotoView(v) {
    const p = product();
    if (!p?.images?.length) {
      v.innerHTML = `<div class="wheel-product-empty"><b>${esc(design().name)}</b><p>Fotografii tohoto modelu připravujeme. Tvůj výběr zůstává uložený.</p><button type="button" class="btn btn--ghost" data-product-catalog>Vybrat kolo s fotkou</button>${sourcePhotoOnly() ? '' : '<button type="button" class="text-link" data-view="wheel">Zpět do 3D náhledu</button>'}</div>`;
      return;
    }
    const index = Math.min(productPhotoIndexes.get(S.design) || 0, p.images.length - 1);
    const photo = p.images[index];
    const selectedDesign = S.design;
    const finish = photo.finish?.label && photo.finish.label !== 'unknown' ? photo.finish.label : '';
    v.innerHTML = `<figure class="wheel-product-figure" data-product-design="${esc(S.design)}"><div class="wheel-product-image-wrap"><img class="wheel-product-image" src="${esc(photo.src)}" alt="${esc(p.name)} — ${esc(photo.label || 'fotografie skutečného kola')}${finish ? ' · ' + esc(finish) : ''}${photo.caption ? ' · ' + esc(photo.caption) : ''}" width="${photo.width}" height="${photo.height}" decoding="async"><div class="wheel-product-error" role="status" hidden><span>Fotografii se nepodařilo načíst.</span><button type="button" class="btn btn--ghost" data-retry-product>Načíst znovu</button></div></div><figcaption><b>${esc(p.name)} <span>${index + 1} / ${p.images.length}</span></b><span>${esc(photo.label || 'Fotografie skutečného kola')}${finish ? ' · ' + esc(finish) : ''}</span><details class="cfg-product-info"><summary>O fotografii a provedení</summary><small>${photo.caption ? esc(photo.caption) + ' ' : ''}${isSourceE6() ? 'Fotografie E6 zachycuje vyfotografovanou barvu a provedení. Vybrané parametry ukládáme do nezávazné poptávky; fotografie se podle nich nemění. 3D rekonstrukce vychází z této fotografie; hloubka a zadní část jsou odhad.' : 'Fotografie zachycuje uvedené provedení. Tvou barvu, rozměry a krytku uvidíš v 3D náhledu.'}</small>${p.sourceUrl ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">Podklad fotografií · ${esc(p.sourceName || design().sourceBrand)}</a>` : `<span class="wheel-product-source">${esc(p.sourceName || 'OARTS')}</span>`}</details></figcaption></figure><div class="wheel-product-gallery" aria-label="Fotografie ${esc(p.name)}">${p.images.map((photo, i) => `<button type="button" data-product-photo="${i}" aria-label="${esc(photo.label || 'Fotografie kola')} ${i + 1}" aria-pressed="${i === index}" class="${i === index ? 'active' : ''}"><img src="${esc(photo.thumb || photo.src)}" alt="" loading="lazy" width="96" height="96"></button>`).join('')}</div>`;
    const photoImage = v.querySelector('.wheel-product-image');
    if (photo.technicalSource === 'assets/reference/bronze-wheel-specification.jpg') {
      const sourceLink = document.createElement('a');
      sourceLink.href = photo.technicalSource; sourceLink.target = '_blank'; sourceLink.rel = 'noopener';
      sourceLink.textContent = 'Původní technický podklad →';
      v.querySelector('figcaption').append(sourceLink);
    }
    photoImage.addEventListener('error', () => {
      if (!isWheelProductView() || S.design !== selectedDesign || !photoImage.isConnected) return;
      photoImage.hidden = true;
      v.querySelector('.wheel-product-error').hidden = false;
    }, { once: true });
  }
  function updatePreviewCaption(v, visual) {
    const caption=v.querySelector('.preview-caption'); if(!caption)return;
    const asset = stageAsset();
    if(asset)caption.innerHTML=`<b>${esc(asset.name)} <span class="studio-badge">360°</span></b><span>Tažením prozkoumej každý úhel. Přibliž si kola i jejich konkávní profil.</span><details class="studio-credit"><summary>O modelu a náhledu</summary><p>${esc(asset.edition)}. Vzorová velikost kol podle 3D podkladu. Rozměry a kompatibilitu ověříme před výrobou.</p><p>Model: <a href="${esc(asset.source)}" target="_blank" rel="noopener">${esc(asset.author)}</a> · <a href="${esc(asset.licenseURL)}" target="_blank" rel="noopener">${esc(asset.license)}</a>. Úpravy: materiály a kola Need For Wheels.</p></details>`;
    else if(visual)caption.innerHTML=`<b>${visual.kind === 'render' ? 'Ilustrační render vybraného provedení' : 'Fotografie vybraného provedení'}</b><span class="vehicle-visual-description">${esc(visual.depicted.label || visual.title)}</span><span>Fotografie odpovídá vybranému provedení. Dostupný náhled nových kol najdeš u fotografie; detail designu můžeš vždy otáčet ve 3D.</span>${visuals.creditHTML(visual)}${!selected3D() ? '<div class="studio-availability"><span>360° model tohoto provedení zatím nemáme.</span><button type="button" data-view="wheel">Prohlédnout vybraná kola ve 3D ↗</button></div>' : ''}`;
    else if(isPhotoView()) {
      const incomplete = !S.year || !S.body || !S.generation;
      const available = visuals?.resolve(S, { allowModelFallback: false });
      const loadFailed = Boolean(available && failedVisuals.has(available.src)) || Boolean(visuals?.errors?.length);
      caption.innerHTML=`<b>${incomplete ? 'Upřesni provedení svého vozu' : loadFailed ? 'Fotografii se nepodařilo načíst' : 'Náhled tohoto provedení připravujeme'}</b><span>${incomplete ? 'Vyber rok, karoserii a generaci. Zatím si můžeš prohlédnout navržené kolo.' : loadFailed ? 'Zobrazuje se samostatný návrh kola. Zkus podklady znovu načíst; vybraný vůz zůstává uložený.' : 'Pro zvolený rok, generaci a karoserii zatím nemáme dostupný ověřený podklad. Zobrazuje se samostatné 3D kolo; tvůj vůz zůstává uložený.'}</span><div class="studio-availability"><button type="button" data-view="own-car">Vyzkoušet kola na fotografii mého auta ↗</button><button type="button" data-view="model-photo">Prohlédnout ukázku modelové řady ↗</button></div>${loadFailed ? '<button class="visual-retry" type="button" data-retry-visual>Obnovit vizuální podklady</button>' : ''}`;
    } else caption.innerHTML=`<div class="cfg-viewer-help"><span>${MOBILE.matches ? 'Tažením otáčej · dvěma prsty přibližuj' : 'Tažením otáčej · kolečkem přibližuj'}</span><details><summary>Ovládání a podklad náhledu</summary><p>Po kliknutí do náhledu otáčej šipkami. Klávesami + a − přiblížíš, klávesou 0 obnovíš pohled.${window.NFWPhotoWheelModels?.[S.design] ? ` Rekonstrukce podle fotografie; hloubka a zadní část jsou odhad. <a href="3d-kolo.html?design=${encodeURIComponent(S.design)}">Porovnat s předlohou a stáhnout 4K render ↗</a>` : ''}</p></details></div>`;
  }

  function renderStageFoot() {
    const sw = sourcePhotoOnly() ? `<p class="e6-photo-parameter-note">${esc(constructionLabel(design()))} · požadovaná barva ${esc(colorName())}. Parametry ověříme při konzultaci.</p>` : isWheelProductView() ? '<button class="text-link wheel-product-config-link" type="button" data-view="wheel">Prohlédnout vlastní barvu a povrch ve 3D →</button>' : stageAsset() ? `<div class="studio-palette"><div><span>Kola</span><div class="swatches">${O.COLORS.map(c => `<button type="button" class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="Kolo ${esc(c.name)}" data-set="color" data-val="${c.id}"></button>`).join('')}</div></div><div><span>Karoserie</span><div class="swatches">${O.BODY_COLORS.map(c => `<button type="button" class="swatch ${S.bodyColor === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="Karoserie ${esc(c.name)}" data-set="bodyColor" data-val="${c.id}"></button>`).join('')}</div></div></div>` : isPhotoView()
      ? `<div class="vehicle-wheel-colours"><div class="swatches">${O.COLORS.map(c => `<button type="button" class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="Kolo ${esc(c.name)}" data-set="color" data-val="${c.id}"></button>`).join('')}</div><button class="text-link" type="button" data-view="wheel">Detail kola ve 3D →</button></div>`
      : `<div class="swatches">${O.COLORS.map(c => `<button type="button" class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="Kolo ${esc(c.name)}" data-set="color" data-val="${c.id}"></button>`).join('')}</div>`;
    $('#stageFoot').innerHTML = `${sw}
      <details class="cfg-preview-spec"><summary>${S.d}″ · ${esc(colorName())}<span>Rozměry k ověření</span></summary><div class="stage-info">
        <div>Průměr<b>${S.d}"</b></div><div>Šířka<b>${nf(S.wf)} / ${nf(S.wr)}"</b></div>
        <div>ET · k ověření<b>${S.etf} / ${S.etr}</b></div><div>PCD · CB · k ověření<b>${esc(S.pcd)} · ${nf(S.cb)}</b></div>
      </div></details>`;
  }

  /* ---------- render: panel ---------- */
  let brandPicker = null;
  let enquiryReady = false;
  // Submission receipts belong to the submitted selection, not to a disposable
  // form node. This session-only map never persists contact data or adds it to URLs.
  const enquiryStates = new Map();
  const enquiryKey = () => JSON.stringify(Object.fromEntries([
    'brand','model','year','generation','body','car','bodyColor','carDetail','design',
    'color','colorHex','finish','lip','cap','d','stag','wf','wr','etf','etr','pcd','cb',
    'side','extras','note','name','email','phone','isElectricVehicle','loadKg','higherLoadConsultation'
  ].map(key => [key, key === 'extras' ? [...S.extras].sort() : S[key]])));
  function syncEnquiryState() {
    const form = $('#enquiryForm');
    if (!form) return;
    const state = enquiryStates.get(enquiryKey());
    const pending = [...enquiryStates.values()].some(item => item.pending);
    const status = form.querySelector('[data-commerce-status]');
    if (state?.reference) form.dataset.enquiryReceived = state.reference;
    else delete form.dataset.enquiryReceived;
    if (pending) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
    status.textContent = pending ? 'Dokončujeme odeslání poptávky…' : state?.message || '';
    status.dataset.state = pending ? 'pending' : state?.status || '';
    document.querySelectorAll('#sendMail, #sendMail2').forEach(button => {
      const disabled = pending || Boolean(state?.reference);
      button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
      if (button.id === 'sendMail2' && state?.reference) button.querySelector('span').textContent = 'Poptávka přijata ✓';
    });
  }
  function renderPanel({ reset = false } = {}) {
    const b = $('#panelBody');
    b.querySelectorAll('[data-flow-detail]').forEach(el => detailState.set(el.dataset.flowDetail, el.open));
    const active = b.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = active?.id ? '#' + CSS.escape(active.id) : active?.dataset.set ? `[data-set="${active.dataset.set}"]${active.dataset.val ? `[data-val="${active.dataset.val}"]` : ''}` : null;
    const selection = active?.id === 'designSearch' ? [active.selectionStart, active.selectionEnd] : null;
    const oldScroll = b.scrollTop;
    brandPicker?.destroy();
    brandPicker = null;
    b.innerHTML = [panelCar, panelDesign, panelSize, panelLook, panelSummary][S.step - 1]();
    const heading = b.querySelector('h2');
    heading.id = 'flowHeading'; heading.tabIndex = -1;
    b.insertAdjacentHTML('beforeend', '<details class="cfg-help"><summary>Vhodnost a dokumentace kol</summary><p>Technická a homologační dokumentace se může lišit podle konkrétního modelu, rozměru a konfigurace kola. Před objednávkou ověříme dostupnou dokumentaci a vhodnost pro tvůj vůz. <a href="index.html#certifikace" target="_blank" rel="noopener">Certifikace &amp; kvalita →</a></p></details>');
    b.setAttribute('aria-labelledby', 'flowHeading');
    b.querySelectorAll('button[data-set][data-val]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
    if (S.step === 1) brandPicker = window.NFWBrandPicker?.enhance($('#vehicleBrand'), { label: 'Značka vozu' }) || null;
    b.scrollTop = reset ? 0 : oldScroll;
    if (!reset && focusKey) {
      const restored = b.querySelector(focusKey);
      restored?.focus({ preventScroll: true });
      if (selection) restored?.setSelectionRange(...selection);
    }
    renderFoot();
  }

  function panelCar() {
    const g = generation(), list = candidates(), years = V.getYears(S.brand, S.model);
    const bodies = V.getBodies(S.brand, S.model, S.year);
    const model = selectedModel();
    const sourceNote = !model ? 'Vyber značku a model svého vozu.' : !g ? S.year ? 'Zvol karoserii a konkrétní provedení.' : 'Doplň rok výroby a potom vyber provedení svého vozu.' : g.confidence === 'verified'
      ? 'Provedení doplněné z podkladů výrobce.' : 'Katalogové provedení. Kód generace a označení faceliftu nemusí být ve zdroji uvedené.';
    const endNote = !g ? '' : g.endBasis === 'inferred' ? 'Hranice období je odvozená z následujícího provedení; přechodový rok se může překrývat.' : g.endBasis === 'open' ? 'Zdroj neuvádí konec období. Katalog je omezen rokem 2026; dostupnost daného ročníku je potřeba ověřit.' : 'V přechodových letech se mohou období překrývat.';
    return `<h2>Začni svým autem.</h2><p class="sub">Vyber značku, model a rok. Přesné provedení pak doladíme.</p>
      <div class="cfg-vehicle-filter" role="group" aria-label="Nabídka vozů">${[['all','Všechny vozy'],['electric','Elektromobily']].map(([value,label])=>`<button type="button" data-vehicle-filter="${value}" aria-pressed="${S.vehicleFilter===value}" class="${S.vehicleFilter===value?'active':''}">${label}</button>`).join('')}</div>
      ${S.vehicleFilter==='electric'?`<p class="cfg-vehicle-filter-note" role="status">${V.electricModelCount} modelových řad s čistě elektrickým pohonem. <a href="elektroauta.html">Prohlédnout nabídku pro elektromobily ↗</a></p>`:''}
      <div class="vehicle-fields">
      <div class="field nfw-brand-field"><label for="vehicleBrand">Značka</label><select id="vehicleBrand" aria-label="Značka"><option value="">Vyber značku</option>${visibleVehicleBrands().map(b=>`<option value="${esc(b.id)}" ${S.brand===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
      <label class="field"><span>Model</span><select id="vehicleModel" aria-label="Model" ${!selectedBrand()?'disabled':''}><option value="">Vyber model</option>${visibleVehicleModels().map(m=>`<option value="${esc(m.id)}" ${S.model===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Rok vozu</span><select id="vehicleYear" aria-label="Rok výroby" ${!model?'disabled':''}>${!years.includes(S.year)?`<option value="${S.year}" selected>${S.year ? S.year+' · mimo doložená období' : 'Vyber rok'}</option>`:''}${years.map(y=>`<option value="${y}" ${S.year===y?'selected':''}>${y}</option>`).join('')}</select></label>
      <label class="field"><span>Karoserie</span><select id="vehicleBody" aria-label="Karoserie" ${!bodies.length?'disabled':''}>${bodies.length!==1 || !S.body?'<option value="">Vyber karoserii</option>':''}${bodies.map(b=>`<option value="${esc(b.id)}" ${S.body===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label class="field vehicle-fields__wide"><span>Generace / provedení ${list.length>1?'· upřesni variantu':''}</span><select id="vehicleGeneration" aria-label="Generace" ${!S.body || !list.length?'disabled':''}>${list.length!==1 || !S.body || !S.generation?'<option value="">Vyber provedení</option>':''}${S.body?list.map(g=>`<option value="${esc(g.id)}" ${S.generation===g.id?'selected':''}>${esc(g.name)} · ${V.periodLabel(g)}${g.status==='announced'?' · oznámeno':''}</option>`).join(''):''}</select></label>
      </div>
      ${model && !S.year?'<div class="note" role="status">Model je vybraný. Doplň rok výroby a upřesni karoserii svého vozu.</div>':model && !years.includes(S.year)?'<div class="note vehicle-warning" role="status">Pro tento rok nemáme doložené provedení. Vyber dostupný ročník nebo chybějící variantu uveď do poznámky.</div>':''}
      <div class="generation-info"><small>${g ? g.confidence==='verified'?'PODKLADY VÝROBCE':'KATALOGOVÝ ZÁZNAM' : 'VÝBĚR PROVEDENÍ'}</small><b>${g?esc(g.name)+' · '+esc(g.bodyName):'Upřesni svůj vůz'}</b><span>${sourceNote}</span>${g?.status==='announced'?`<span class="vehicle-warning">Oznámené provedení · ${esc(g.startBasis || 'Dodávky jsou plánované.')}</span>`:''}</div>
      ${!sourcePhotoOnly() ? '<button type="button" class="cfg-own-photo-link" data-view="own-car">Vyzkoušet kola na fotce mého auta ↗</button>' : ''}
      ${detailsHTML('vehicle-info', 'Upřesnit vůz a jeho požadavky', `${electricVehicleField()}${g?`<details class="vehicle-source"><summary>Období a zdroj údajů</summary><p>${V.periodLabel(g)} · ${esc(g.market)}. ${endNote}</p>${g.startBasis?`<p>${esc(g.startBasis)}</p>`:''}${g.notes?`<p>${esc(g.notes)}</p>`:''}${g.bodyVariants?.length?`<p>Další provedení řady ve zdroji: ${g.bodyVariants.map(esc).join(', ')}. Kombinaci s karoserií upřesni v poznámce.</p>`:''}<a href="${esc(g.source)}" target="_blank" rel="noopener">${esc(g.sourceTitle)} ↗</a>${g.additionalSources?.length?g.additionalSources.map(source=>`<br><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a>`).join(''):''}</details>`:''}
      ${model ? `<a class="text-link vehicle-catalog-link" href="index.html?catalogBrand=${encodeURIComponent(S.brand)}&catalogModel=${encodeURIComponent(model.name)}#auta">Prohlédnout katalog modelu (${model.variants.length} provedení) ↗</a>` : '<a class="text-link vehicle-catalog-link" href="index.html#vehicleCatalogue">Prohlédnout katalog vozů ↗</a>'}
      <label class="field"><span>Upřesnění vozu <em>volitelné</em></span><input type="text" data-set="carDetail" data-type="text" maxlength="80" value="${esc(S.carDetail)}" placeholder="např. kód generace, větší brzdy, chybějící varianta"></label>
      <div class="note">Katalog zahrnuje doložená provedení, historické údaje nemusí být úplné. Rozměry kol a přesnou kompatibilitu ověříme před výrobou.</div>`)} `;
  }

  function panelDesign() {
    const wo = wheelOpts();
    const all = [...O.DESIGNS].sort((a,b) => Number(b.sourceBrand === 'E6') - Number(a.sourceBrand === 'E6'));
    const constructions = [...new Set(all.map(constructionKey))].sort();
    const query = designSearch.trim().toLocaleLowerCase('cs');
    const filtered = all.filter(d => (designConstructionFilter === 'all' || constructionKey(d) === designConstructionFilter) && (!query || `${d.name} ${d.series} ${d.id} ${d.desc || ''}`.toLocaleLowerCase('cs').includes(query)));
    const catalog = filtered.filter(d => d.productPhoto), legacy = filtered.filter(d => !d.productPhoto);
    const cards = (list,id) => `<div class="opt-grid" id="${id}">${list.map(d => `<button type="button" class="opt ${d.sourceBrand === 'E6' ? 'opt--e6-source ' : ''}${S.design === d.id ? 'active' : ''}" data-set="design" data-val="${esc(d.id)}" aria-label="Vybrat ${esc(d.name)}, ${esc(constructionLabel(d))}">
        ${d.productPhoto ? `<img class="wheel-thumb wheel-catalog-photo ${d.sourceBrand === 'E6' ? 'wheel-source-photo' : ''}" src="${esc(d.productPhoto)}" alt="${esc(d.name)} — ${d.sourceBrand === 'E6' ? 'fotografie modelu E6' : 'vizualizace krytky OARTS'}" loading="lazy" width="400" height="400">` : O.renderWheel(Object.assign({}, wo, { design: d.id }), 'od' + d.id)}
        <div><b>${esc(d.name)}</b><span>${esc(d.series)} · ${esc(O.spokesLabel(d))}</span></div>
        <span class="p">${priceLabel(P?.customPrice(designPriceFamily(d.id)?.id, designPriceFamily(d.id)?.diameters.includes(S.d) ? S.d : designPriceFamily(d.id)?.diameters[0], 'set4') ?? null)} / sada 4 kol<br>${esc(constructionLabel(d))}</span></button>`).join('')}</div>`;
    return `<h2>Vyber svůj design.</h2><p class="sub">Najdi model podle názvu nebo zvol konstrukci. Výběr se hned zobrazí vedle.</p>
      <label class="field cfg-design-search"><span>Hledat design</span><input id="designSearch" type="search" value="${esc(designSearch)}" placeholder="Např. AR01, GS4, monoblock…" autocomplete="off" aria-controls="designCatalogOptions designLegacyOptions"></label>
      <div class="wheel-construction-filters" role="group" aria-label="Konstrukce kola">${[['all','Všechny'], ...constructions.map(key => [key,constructionFilterLabel(key)])].map(([id,label]) => `<button type="button" id="constructionFilter-${id}" data-design-construction="${id}" aria-controls="designCatalogOptions designLegacyOptions" aria-pressed="${designConstructionFilter === id}" class="${designConstructionFilter === id ? 'active' : ''}">${label}</button>`).join('')}</div>
      <p class="wheel-construction-status" id="designConstructionCount" role="status">${filtered.length} designů${!filtered.some(d => d.id === S.design) ? ' · vybraný ' + esc(design().name) + ' je mimo filtr' : ''}</p>
      ${!filtered.length ? '<div class="cfg-empty"><p>Pro tento název a konstrukci jsme design nenašli.</p><button type="button" class="btn btn--ghost" data-clear-design-search>Zobrazit všechny designy</button></div>' : ''}
      ${cards(catalog,'designCatalogOptions')}
      ${legacy.length ? `<details class="wheel-legacy-designs" ${design().productPhoto ? '' : 'open'}><summary>Další návrhové designy (${legacy.length})</summary>${cards(legacy,'designLegacyOptions')}</details>` : '<div id="designLegacyOptions"></div>'}
      <div class="note e6-selected-design-note" style="margin-top:14px"><b>${esc(design().name)}</b> – ${esc(design().desc || '')}${isSourceE6() ? ` <span>Požadovanou barvu, rozměry a dostupnost potvrdíme při konzultaci.${design().pieces === null ? ' Přesnou konstrukci potvrdíme s dodavatelem pro konkrétní model.' : ''}</span>${design().sourceUrl ? `<a href="${esc(design().sourceUrl)}" target="_blank" rel="noopener">Model na E6 ↗</a>` : ''}` : directional() ? ' Levé a pravé kolo kujeme zrcadlově, přepínač je nad náhledem.' : ''}</div>`;
  }

  function panelSize() {
    const f = car().fit;
    const chip = (v, key, rec) => `<button type="button" class="chip ${S[key] === v ? 'active' : ''} ${rec ? 'rec' : ''}" data-set="${key}" data-val="${v}" data-type="num"><span>${v}"</span></button>`;
    const range = (key, label, min, max, step, out) => `<label class="field"><span>${label}</span><div class="range"><input type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}" data-set="${key}" data-type="num" data-live="1"><output>${out}</output></div></label>`;
    return `<h2>Zvol velikost kol.</h2><p class="sub">Začni průměrem. Přesnou šířku, ET a vhodnost ověříme pro tvůj vůz.</p>
      <h4>Průměr <em>${S.d}"</em></h4>
      <div class="chips">${designDiameters().map(v => chip(v, 'd', false)).join('')}</div>
      ${isSourceE6() ? '<p class="flow-guidance">Základní ceny E6 odpovídají ceníku custom kol. Další průměry můžeme nacenit individuálně.</p>' : ''}
      <p class="flow-guidance">Nevíš přesné rozměry? Stačí zvolit průměr a pokračovat. Šířku, ET a rozteč spolu ověříme před výrobou.</p>
      ${electricVehicleField()}
      ${detailsHTML('dimensions', 'Šířka, ET a další rozměry', `
      <h4>Rozdílné šířky vpředu a vzadu <label class="toggle"><input type="checkbox" id="stagToggle" ${S.stag ? 'checked' : ''}> ${S.stag ? 'Staggered' : 'Square'}</label></h4>
      <h4>Šířka <em>${nf(S.wf)}" ${S.stag ? '/ ' + nf(S.wr) + '"' : ''}</em></h4>
      <div class="${S.stag ? 'two' : ''}">
        ${range('wf', S.stag ? 'Přední' : 'Všechna kola', 7, 13.5, 0.5, nf(S.wf) + '"')}
        ${S.stag ? range('wr', 'Zadní', 7, 13.5, 0.5, nf(S.wr) + '"') : ''}
      </div>
      <h4>Zális (ET) <em>ET${S.etf}${S.stag ? ' / ET' + S.etr : ''}</em></h4>
      <div class="${S.stag ? 'two' : ''}">
        ${range('etf', S.stag ? 'Přední' : 'Všechna kola', -15, 75, 1, 'ET' + S.etf)}
        ${S.stag ? range('etr', 'Zadní', -15, 75, 1, 'ET' + S.etr) : ''}
      </div>
      <h4>Rozteč a středový otvor</h4>
      <div class="two">
        <label class="field"><span>PCD</span><select data-set="pcd" data-type="text">${O.PCDS.map(p => `<option ${S.pcd === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="field"><span>CB (mm)</span><input type="number" step="0.1" min="50" max="120" value="${S.cb}" data-set="cb" data-type="num"></label>
      </div>
      <div class="note" style="margin-top:10px">Návrhové výchozí hodnoty, nutno ověřit: ${esc(f.pcd)} · CB ${nf(f.cb)} mm · ${f.d} × ${nf(f.wf)}" ET${f.etf}${f.wf !== f.wr ? ' / ' + f.d + ' × ' + nf(f.wr) + '" ET' + f.etr : ''}</div>
      <h4>Poznámka k fitmentu</h4>
      <div class="field"><textarea data-set="note" data-type="text" maxlength="300" aria-label="Poznámka k fitmentu" placeholder="Brzdy (např. PCCB, šestipístové), sražení, podběhy, rozšíření, adaptéry…">${esc(S.note)}</textarea></div>`)} `;
  }

  function panelLook() {
    return `<h2>Dolaď svůj styl.</h2><p class="sub">${isWheelProductView() || sourcePhotoOnly() ? 'Zvol požadovanou barvu a povrch. Fotografie ukazuje původní provedení; tvůj výběr ukládáme do poptávky.' : 'Změň barvu a povrch. Výsledek hned porovnej v náhledu.'}</p>
      <h4>Barva <em>${esc(colorName())}</em></h4>
      <div class="swatches">${O.COLORS.map(c => `<button type="button" class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="${esc(c.name)}" data-set="color" data-val="${c.id}"></button>`).join('')}
        <label class="swatch swatch--custom ${S.color === 'custom' ? 'active' : ''}" title="Vlastní odstín (RAL / HEX)"><input type="color" id="customColor" value="${esc(S.colorHex)}" aria-label="Vlastní odstín"></label></div>
      <p class="hint muted" style="font-size:12px;margin:4px 0 0">Vlastní odstín? Klikni na duhový kruh nebo nám v poznámce napiš kód RAL.</p>
      <h4>Povrchová úprava</h4>
      <div class="opt-list">${O.FINISHES.map(f => `<button type="button" class="opt ${S.finish === f.id ? 'active' : ''}" data-set="finish" data-val="${f.id}" style="grid-template-columns:1fr auto"><div><b>${f.name}</b><span>${f.desc}</span></div><span class="p">${f.quoteOnly ? 'Cena na potvrzení' : design().pieces === 3 ? 'Součást návrhu' : 'v ceně kol'}</span></button>`).join('')}</div>
      ${detailsHTML('finishing', 'Límec, krytka a doplňky', `<h4>Límec</h4>
      <div class="chips">${O.LIPS.map(l => `<button type="button" class="chip ${S.lip === l.id ? 'active' : ''}" data-set="lip" data-val="${l.id}"><span>${l.name}${l.quoteOnly ? ' · Cena na potvrzení' : ''}</span></button>`).join('')}</div>
      <h4>Středová krytka</h4>
      <div class="chips">${O.CAPS.map(c => `<button type="button" class="chip ${S.cap === c.id ? 'active' : ''}" data-set="cap" data-val="${c.id}"><span>${esc(c.name)}${c.quoteOnly ? ' · Cena na potvrzení' : ''}</span></button>`).join('')}</div>
      <h4>Individuální doplňky</h4>
      <div class="opt-list">${EXTRAS.map(x => `<label class="check"><input type="checkbox" data-extra="${x.id}" ${S.extras.includes(x.id) ? 'checked' : ''}><div><b>${x.name}</b><span>${x.desc}</span></div><span class="p">Cena na potvrzení</span></label>`).join('')}</div>
      <div class="note" style="margin-top:12px">Zobrazená částka je výchozí cena sady čtyř kol. Cenu zvláštních povrchů, límce, krytek a doplňků potvrdíme v nabídce.</div>`)} `;
  }

  function panelSummary() {
    const p = price();
    const c = car(), d = design();
    const label = O.labelHTML({
      order: orderNo(), model: vehicleName() + (S.carDetail ? ' / ' + S.carDetail : ''), design: `${d.name} · Series ${d.series}`, pos: 'FL – přední levé',
      size: `${S.d} × ${nf(S.wf)}"`, et: S.etf, pcd: S.pcd, cb: nf(S.cb), color: colorName(),
      finish: `${O.find(O.FINISHES, S.finish).name}${S.lip !== 'same' ? ' + ' + O.find(O.LIPS, S.lip).name.toLowerCase() : ''}`,
      date: new Date().toISOString().slice(0, 10),
    });
    const extras = S.extras.map(id => EXTRAS.find(e => e.id === id)).filter(Boolean);
    return `<h2>Tvůj návrh je připravený.</h2><p class="sub">Zkontroluj výběr a pošli nezávaznou poptávku. Rozměry i konečnou cenu spolu potvrdíme.</p>
      <div class="flow-summary-overview">${[
        [1, 'Tvůj vůz', vehicleName()],
        [2, 'Design', d.name],
        [3, 'Návrh rozměrů · k ověření', `${S.d}\" · ${nf(S.wf)}${S.stag ? ' / ' + nf(S.wr) : ''}\"`],
        [4, 'Vzhled', `${colorName()} · ${O.find(O.FINISHES,S.finish).name}`],
        [3, 'Požadovaná nosnost', `${S.isElectricVehicle ? 'Elektroauto · ' : ''}${loadLabel()}`]
      ].map(([step,label,value])=>`<button type="button" class="flow-summary-edit" data-step="${step}" aria-label="Upravit ${label.toLowerCase()}"><span><small>${label}</small><b>${esc(value)}</b></span><span>Upravit ↗</span></button>`).join('')}</div>
      ${detailsHTML('summary-spec', 'Úplná specifikace a rozpis ceny', `
      <table class="spec">
        <tr><th>Vůz</th><td>${esc(vehicleName())}${S.carDetail ? '<br><span class="muted">' + esc(S.carDetail) + '</span>' : ''}</td></tr>
        <tr><th>Design</th><td>${esc(d.name)} · ${esc(d.series)} · ${esc(constructionLabel(d))}${directional() ? ' · zrcadlová sada L/P' : ''}</td></tr>
        ${isSourceE6() && d.sourceUrl ? `<tr><th>Podklad designu</th><td><a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener">E6 · konkrétní model ↗</a></td></tr>` : ''}
        <tr><th>Přední</th><td>${esc(sizeF())}</td></tr>
        <tr><th>Zadní</th><td>${esc(sizeR())}</td></tr>
        <tr><th>PCD / CB</th><td>${esc(S.pcd)} / ${nf(S.cb)} mm</td></tr>
        <tr><th>Elektroauto</th><td>${S.isElectricVehicle ? 'Ano' : 'Ne'}</td></tr>
        <tr><th>Požadovaná nosnost</th><td>${loadLabel()}</td></tr>
        <tr><th>Barva</th><td>${esc(colorName())} · ${O.find(O.FINISHES, S.finish).name}</td></tr>
        <tr><th>Límec</th><td>${O.find(O.LIPS, S.lip).name}</td></tr>
        <tr><th>Krytka</th><td>${O.find(O.CAPS, S.cap).name}</td></tr>
        <tr><th>Doplňky</th><td>${extras.length ? extras.map(e => esc(e.name)).join(', ') : '<span class="muted">žádné</span>'}</td></tr>
        ${S.note ? `<tr><th>Poznámka</th><td>${esc(S.note)}</td></tr>` : ''}
      </table>
      <h4>Need For Wheels štítek <em>náhled</em></h4>
      <div class="label-svg">${label}</div>
      <p class="hint muted" style="font-size:12px">Každá krabice dostane vlastní štítek s parametry konkrétního kola (FL / FR / RL / RR).</p>
      <h4>Cena za 1 kolo <em>${S.d}"</em></h4>
      ${isSourceE6() ? '<p class="flow-guidance">E6 používá stejný ceník jako custom kola. Konečnou specifikaci potvrdíme v nabídce.</p>' : ''}
      <table class="spec">
        <tr class="total" data-wheel-unit-price><th>Cena za 1 kolo · ${S.d}"</th><td class="r">${priceLabel(p.singleCents)}</td></tr>
        <tr data-wheel-package-price><th>Sada 4 disků · ${S.d}"</th><td class="r">${priceLabel(p.setCents)}</td></tr>
        ${p.options.length ? `<tr><th>Vybrané úpravy a doplňky</th><td class="r">Cena na potvrzení</td></tr>` : ''}
      </table>
      <div class="note note--warn" style="margin-top:10px">Poptávka zahrnuje sadu čtyř disků. ${p.setCents === null ? 'Cenu tohoto provedení potvrdíme v individuální nabídce.' : 'Uvedené částky jsou výchozí ceny. Konečnou cenu potvrdíme podle zvolené specifikace.'}${p.options.length ? ` Cenu vybraných úprav potvrdíme zvlášť: ${p.options.map(esc).join(', ')}.` : ''} Specifikaci a závaznou nabídku potvrdíme před výrobou.</div>`)}
      <form class="flow-enquiry" id="enquiryForm" aria-labelledby="enquiryTitle">
      <h4 id="enquiryTitle" tabindex="-1">Kam se ti ozveme?</h4>
      <p class="flow-guidance">Doplň kontakt. Celou specifikaci odešleme přímo k ověření a nacenění. Jde o nezávaznou poptávku.</p>
      <div class="form">
        <label class="field"><span>Jméno</span><input type="text" data-set="name" data-type="text" maxlength="80" value="${esc(S.name)}" placeholder="Jméno a příjmení" autocomplete="name" required></label>
        <div class="form-row">
          <label class="field"><span>E-mail</span><input type="email" data-set="email" data-type="text" maxlength="80" value="${esc(S.email)}" placeholder="ty@email.cz" autocomplete="email" required></label>
          <label class="field"><span>Telefon</span><input type="tel" data-set="phone" data-type="text" maxlength="30" value="${esc(S.phone)}" placeholder="+420" autocomplete="tel"></label>
        </div>
      </div>
      <details class="cfg-help cfg-enquiry-conditions"><summary>Další postup a podmínky</summary>      <p class="commerce-small">Do poznámek uváděj jen technické informace potřebné pro ověření kol. VIN nebo registrační značku nám sděl pouze tehdy, pokud si je pro konkrétní ověření vyžádáme. Neposílej doklady totožnosti ani údaje platební karty.</p>
      <div class="note note--warn order-conditions-notice"><p><strong>Certifikace &amp; kvalita.</strong> Technická a homologační dokumentace se může lišit podle konkrétního modelu, rozměru a konfigurace kola. Před objednávkou Vám rádi ověříme dostupnou dokumentaci pro konkrétní vůz a konfiguraci.</p><p><strong>Dodání nejpozději do 6 kalendářních měsíců od uzavření smlouvy.</strong> Kratší termín uvedeme v nabídce. Specifikaci a výkres schválíš před uzavřením smlouvy.</p><p>Po potvrzení závazné objednávky uhradíš <strong>zálohu ve výši 50 % sjednané ceny kol</strong>. Kola zadáme do výroby až po připsání této zálohy. Při dobrovolném zrušení individuální zakázky se vypořádá podle <a href="obchodni-podminky.html" target="_blank" rel="noopener">obchodních podmínek</a>. Zákonná práva tím nejsou omezena.</p></div>
</details>
      <div class="actions">
        <button class="btn btn--primary" id="sendMail" type="submit"><span>Odeslat nezávaznou poptávku →</span></button><p class="commerce-small">Údaje použijeme k vyřízení poptávky. <a href="ochrana-osobnich-udaju.html">Ochrana osobních údajů</a> · <a href="obchodni-podminky.html">Podmínky</a> · <a href="reklamace.html">Reklamace</a> · <a href="odstoupeni.html">Odstoupení</a> · <a href="cookies.html">Cookies</a>.</p><p data-commerce-status class="commerce-status" role="status" tabindex="-1"></p>
      </div></form>
      ${detailsHTML('sharing', 'Sdílet nebo uložit návrh', `<p class="commerce-small">Odkaz sdílí zvolený model vozu a parametry kol. Kontakt, upřesnění konkrétního vozu a volné poznámky v něm nejsou. Kopírovaná specifikace a tisk obsahují i údaje, které jsi do návrhu doplnil.</p><div class="actions">
        <button class="btn" type="button" id="copySpec"><span>Kopírovat specifikaci</span></button>
        <button class="btn btn--ghost" type="button" id="shareLink"><span>Kopírovat odkaz na konfiguraci</span></button>
        <button class="btn btn--ghost" type="button" id="printSpec"><span>Uložit jako PDF / tisk</span></button>
        <div class="copied" id="copiedMsg" aria-live="polite"></div>
      </div>`)} `;
  }

  function renderFoot() {
    const p = price();
    $('#panelFoot').innerHTML = `
      <div class="mobile-flow-status"><button type="button" data-flow-preview aria-label="Zobrazit náhled vybraného kola ${esc(design().name)}">${O.renderWheel(wheelOpts())}<span>${esc(design().name)}<small>Náhled ↑</small></span></button><div class="price"><div><small>Sada 4 kol · ${S.d}″</small><b data-wheel-package-price>${priceLabel(p.setCents)}</b></div><div class="per"><span data-wheel-unit-price>1 kolo ${priceLabel(p.singleCents)}</span><span>${p.options.length ? 'Úpravy naceníme zvlášť.' : p.setCents === null ? 'Individuální nabídka' : 'Výchozí cena · neplátce DPH'}</span></div></div></div>
      <div class="panel-nav">
        <button class="btn btn--ghost" type="button" id="prevStep" data-prev ${S.step === 1 ? 'disabled' : ''}><span>← Zpět</span></button>
        ${S.step < 5 ? `<button class="btn btn--primary" type="button" id="nextStep" data-next><span>Pokračovat →</span></button>` : `<a class="btn btn--primary" id="sendMail2" data-flow-enquiry href="#enquiryForm"><span>${!enquiryReady ? 'Zadat kontakt →' : 'Odeslat poptávku →'}</span></a>`}
      </div><div class="flow-next-hint">${S.step < 5 ? `Dále: ${STEPS[S.step]}` : 'Nezávazně · rozměry a cenu ještě potvrdíme'}</div>`;
    syncPreviewState();
    syncEnquiryState();
  }

  /* ---------- specifikace jako text ---------- */
  function specText() {
    const p = price(), c = car(), d = design();
    const extras = S.extras.map(id => (EXTRAS.find(e => e.id === id) || {}).name).filter(Boolean);
    return [
      'NEED FOR WHEELS – POPTÁVKA KOL',
      '==================================',
      `Kontakt: ${S.name || '-'} · ${S.email || '-'} · ${S.phone || '-'}`,
      `Odkaz na konfiguraci: ${shareURL()}`,
      '',
      `Vůz: ${vehicleName()}${S.carDetail ? ' – ' + S.carDetail : ''} (barva: ${O.find(O.BODY_COLORS, S.bodyColor).name})`,
      `Design: ${d.name} · ${d.series} · ${constructionLabel(d)}${directional() ? ' · zrcadlová sada L/P' : ''}`,
      ...(isSourceE6() && d.sourceUrl ? [`Podklad designu: ${d.sourceUrl}`, 'E6 fotografie: původní provedení; požadované parametry a dostupnost k potvrzení.'] : []),
      `Přední: ${sizeF()}`,
      `Zadní: ${sizeR()}`,
      'Rozměry jsou návrhové; vhodnost a přesnou specifikaci ověříme před výrobou.',
      `PCD / CB: ${S.pcd} / ${nf(S.cb)} mm`,
      `Elektroauto: ${S.isElectricVehicle ? 'Ano' : 'Ne'}`,
      `Požadovaná nosnost: ${loadLabel()}`,
      `Barva: ${colorName()} · Povrch: ${O.find(O.FINISHES, S.finish).name}`,
      `Límec: ${O.find(O.LIPS, S.lip).name} · Krytka: ${O.find(O.CAPS, S.cap).name}`,
      `Doplňky: ${extras.length ? extras.join(', ') : 'žádné'}`,
      '',
      `Cena za 1 kolo: ${priceLabel(p.singleCents)}`,
      `Cena kol – sada 4 disků: ${priceLabel(p.setCents)}`,
      p.options.length ? `Cena vybraných úprav na potvrzení: ${p.options.join(', ')}` : null,
      S.note ? '' : null,
      S.note ? `Poznámka: ${S.note}` : null,
    ].filter(l => l !== null).join('\r\n');
  }
  function flash(msg) {
    const el = $('#copiedMsg'); if (!el) return;
    el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 2500);
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); flash(msg); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); flash(msg); }
  }

  /* ---------- aktualizace ---------- */
  function update(opts) {
    opts = opts || {};
    writeURL();
    renderFlowIntro();
    if (opts.stage !== false && !opts.head) renderStageView();
    renderStageFoot();
    if (opts.panel !== false) renderPanel(); else renderFoot();
    if (opts.head) renderStage();
  }
  function goStep(n) {
    if (!Number.isFinite(n)) return;
    S.step = Math.min(5, Math.max(1, Math.round(n)));
    if (MOBILE.matches) previewExpanded = false;
    enquiryReady = false;
    // Keep the preview chosen by the customer when moving between steps.
    // The default mobile entry already starts on the wheel in readURL().
    writeURL();
    renderSteps(); renderStage(); renderPanel({ reset: true });
    announce(`Krok ${S.step} z 5. ${flowCopy(S.step).join(' ')}`);
    if (MOBILE.matches) revealFlow($('#flowHeading'));
    else $('#flowHeading').focus({ preventScroll: true });
  }

  function guideVehicle(id) {
    if (!MOBILE.matches) return;
    const next = id === 'vehicleBrand' ? $('#vehicleModel') : id === 'vehicleModel' ? $('#vehicleYear')
      : id === 'vehicleYear' && (!S.body || V.getBodies(S.brand,S.model,S.year).length > 1) ? $('#vehicleBody')
      : !S.generation && !$('#vehicleGeneration')?.disabled ? $('#vehicleGeneration') : $('#nextStep');
    const prompts = { vehicleModel: 'Teď vyber model.', vehicleYear: 'Pokračuj rokem výroby.', vehicleBody: 'Vyber karoserii svého vozu.', vehicleGeneration: 'Upřesni generaci a provedení.' };
    announce(prompts[next?.id] || 'Výběr vozu zůstává uložený. Pokračuj k designu.');
    if (next?.id === 'nextStep') next.focus({ preventScroll: true });
    else revealFlow(next, { block: 'nearest' });
  }

  function showEnquiry() {
    enquiryReady = true;
    renderFoot();
    announce('Doplň jméno a e-mail. Potom odešleme nezávaznou poptávku s celou specifikací.');
    if (MOBILE.matches) revealFlow($('#enquiryTitle'));
    else { const contact = $('#enquiryForm input'); contact?.focus({preventScroll:true}); contact?.scrollIntoView({block:'center',behavior:reducedMotion()?'instant':'smooth'}); }
  }

  /* ---------- události (delegace) ---------- */
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close-preview]')) {
      previewExpanded = false; syncPreviewState(); renderStageView(); revealFlow($('#flowHeading')); return;
    }
    if (e.target.closest('[data-clear-design-search]')) {
      designSearch = ''; designConstructionFilter = 'all'; renderPanel({reset:true}); $('#designSearch')?.focus({preventScroll:true}); return;
    }
    const vehicleFilter = e.target.closest('[data-vehicle-filter]');
    if (vehicleFilter) {
      const value = vehicleFilter.dataset.vehicleFilter;
      if (!['all','electric'].includes(value)) return;
      S.vehicleFilter = value;
      if (value === 'electric' && S.model && !isKnownElectricModel()) {
        S.model = ''; S.year = 0; S.body = ''; S.generation = ''; S.carDetail = ''; S.isElectricVehicle = false;
      }
      if (!visibleVehicleBrands().some(brand => brand.id === S.brand)) S.brand = '';
      update({head:true});
      document.querySelector(`[data-vehicle-filter="${value}"]`)?.focus({preventScroll:true});
      return;
    }
    const construction = e.target.closest('[data-design-construction]');
    if (construction) {
      const value = construction.dataset.designConstruction;
      if (value !== 'all' && !O.DESIGNS.some(d => constructionKey(d) === value)) return;
      designConstructionFilter = value; renderPanel();
      $('#constructionFilter-' + value)?.focus({preventScroll:true});
      return;
    }
    if (e.target.closest('[data-flow-preview]')) {
      previewExpanded = true;
      writeURL(); renderStage();
      announce(`Náhled ${design().name}. ${colorName()}.`);
      return revealFlow($('#stageHead'), {focus:false});
    }
    const step = e.target.closest('[data-step]');
    if (step) return goStep(Number(step.dataset.step));
    const view = e.target.closest('[data-view]');
    if (view) { S.view = ['car', 'photo', 'model-photo', 'wheel', 'wheel-photo', 'own-car'].includes(view.dataset.view) ? view.dataset.view : 'car'; if (MOBILE.matches) previewExpanded = true; writeURL(); renderStage(); if (S.step === 4) renderPanel(); $('#stageHead').querySelector(`[data-view="${S.view}"]`)?.focus({preventScroll:true}); if (isOwnCarView()) revealFlow($('#stageHead'), {focus:false}); return; }
    if (e.target.closest('[data-retry-own-car]')) { renderStageView(); return; }
    const productPhoto = e.target.closest('[data-product-photo]');
    if (productPhoto) {
      const index = Number(productPhoto.dataset.productPhoto);
      if (!Number.isInteger(index) || index < 0 || index >= (product()?.images.length || 0)) return;
      productPhotoIndexes.set(S.design, index); renderStageView();
      $('#stageView').querySelector(`[data-product-photo="${index}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('[data-retry-product]')) { renderStageView(); return; }
    if (e.target.closest('[data-product-catalog]')) { goStep(2); return; }
    if (e.target.closest('[data-studio-fullscreen]')) {
      if (document.fullscreenElement) document.exitFullscreen();
      else $('#stageView').requestFullscreen?.().catch(() => {});
      return;
    }
    const viewpoint = e.target.closest('[data-camera]');
    if (viewpoint) {
      S.spin = false; const toggle = $('#spinToggle'); if (toggle) toggle.checked = false;
      viewer?.update({ autoRotate: false }); viewer?.setView(viewpoint.dataset.camera);
      return;
    }
    if (e.target.closest('[data-retry-3d]')) { renderStageView(); return; }
    if (e.target.closest('[data-retry-visual]')) {
      failedVisuals.clear();
      const retry = visuals?.retryFailedData();
      renderStageView();
      retry?.then(() => { if (isPhotoView()) renderStageView(); });
      return;
    }
    const side = e.target.closest('[data-side]');
    if (side) { S.side = side.dataset.side === 'L' ? 'L' : 'R'; writeURL(); renderStage(); return; }
    if (e.target.closest('#nextStep')) return goStep(S.step + 1);
    if (e.target.closest('#prevStep')) return goStep(S.step - 1);
    if (e.target.closest('#copySpec')) { e.preventDefault(); return copy(specText(), 'Specifikace zkopírována do schránky.'); }
    if (e.target.closest('#shareLink')) { e.preventDefault(); return copy(shareURL(), ownCarSession?.photos.length ? 'Odkaz zkopírován. Vlastní fotografie neobsahuje; náhled stáhni zvlášť jako JPG.' : 'Odkaz zkopírován. Pošli ho kamarádovi nebo nám.'); }
    if (e.target.closest('#printSpec')) { e.preventDefault(); return window.print(); }
    const mail = e.target.closest('#sendMail2');
    if (mail) {
      e.preventDefault();
      if (mail.getAttribute('aria-disabled') === 'true') return;
      if (S.step !== 5) { goStep(5); return; }
      if (!enquiryReady) { showEnquiry(); return; }
      $('#enquiryForm')?.requestSubmit();
      return;
    }

    const set = e.target.closest('[data-set][data-val]');
    if (set) {
      const key = set.dataset.set;
      const val = set.dataset.type === 'num' ? Number(set.dataset.val) : set.dataset.val;
      if (S[key] === val) return;
      const leavingSourcePhotographs = key === 'design' && sourcePhotoOnly();
      S[key] = val;
      if (leavingSourcePhotographs && !sourcePhotoOnly() && !product()?.images?.length) S.view = 'wheel';
      if (key === 'car') applyCarDefaults(car());
      update({ head: key === 'car' || key === 'design' });
      if (key === 'design') announce(`Vybráno ${design().name}. Prohlédni si náhled nebo pokračuj k rozměrům.`);
      else if (key === 'color' || key === 'finish') announce(`${colorName()}, ${O.find(O.FINISHES,S.finish).name}. ${sourcePhotoOnly() ? 'Požadované provedení je uložené do poptávky; fotografie se nemění.' : 'Náhled je aktualizovaný.'}`);
    }
  });

  document.addEventListener('submit', async e => {
    if (e.target.id !== 'enquiryForm') return;
    e.preventDefault();
    if (S.step === 5) {
      const invalid = [...$('#enquiryForm').querySelectorAll('input[required]')].find(input=>!input.checkValidity());
      if (invalid) { e.preventDefault(); enquiryReady = true; renderFoot(); invalid.reportValidity(); revealFlow(invalid, {block:'nearest'}); return; }
      const container = $('#enquiryForm');
      const key = enquiryKey();
      if ([...enquiryStates.values()].some(item => item.pending) || enquiryStates.get(key)?.reference) { syncEnquiryState(); return; }
      if (!window.NFWCommerce?.submitEnquiry) { const status = container.querySelector('[data-commerce-status]'); status.textContent = 'Online odeslání nyní není dostupné. Zavolej nám na +420 723 958 421. Vyplněné údaje zůstaly zachované.'; status.dataset.state = 'error'; status.focus({preventScroll:true}); return; }
      if (container.dataset.enquiryReceived) { announce('Poptávka již byla přijata. ' + container.dataset.enquiryReceived); return; }
      const configuration = {...S}; delete configuration.name; delete configuration.email; delete configuration.phone; delete configuration.loadKg;
      configuration.fitmentStatus = 'proposal-requires-verification';
      configuration.requiredLoadKg = requiredLoadKg();
      configuration.configuratorWheel = { designId: S.design, diameter: S.d, package: 'set4', quantity: 1, catalogVersion: P?.customVersion };
      const state = {pending:true,reference:'',message:'',status:'pending'};
      enquiryStates.set(key, state);
      const payload = {name:S.name,email:S.email,phone:S.phone,vehicle:vehicleName(),message:specText(),configuration,source:'configurator',website:''};
      const buttons = [...document.querySelectorAll('#sendMail, #sendMail2')];
      syncEnquiryState();
      try {
        await window.NFWCommerce.submitEnquiry(container, payload, buttons);
        state.reference = container.dataset.enquiryReceived || '';
        const status = container.querySelector('[data-commerce-status]');
        state.message = status.textContent;
        state.status = status.dataset.state;
      } catch {
        state.message = 'Odeslání se nepodařilo potvrdit. Než poptávku zopakuješ, zavolej nám prosím na +420 723 958 421.';
        state.status = 'error';
      } finally {
        state.pending = false;
        syncEnquiryState();
      }
      return;
    }

  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'designSearch') { designSearch = t.value; renderPanel(); return; }
    if (t.id === 'customColor') { if (HEX.test(t.value)) { S.color = 'custom'; S.colorHex = t.value.toLowerCase(); update({ panel: false }); } return; }
    if (!t.dataset.set) return;
    const key = t.dataset.set;
    const isNum = t.dataset.type === 'num';
    let val = isNum ? Number(t.value) : t.value;
    if (isNum && (t.value === '' || !Number.isFinite(val))) return;   /* rozepsané / smazané číslo neukládáme */
    if (isNum && LIMITS[key]) val = clamp(key, val);
    S[key] = val;
    if (!S.stag && key === 'wf') S.wr = val;
    if (!S.stag && key === 'etf') S.etr = val;
    const out = t.parentElement && t.parentElement.querySelector('output');
    if (out) out.textContent = key.startsWith('et') ? 'ET' + val : nf(val) + '"';
    /* pole s živou hodnotou nepřekreslujeme (aby posuvník neztratil fokus) */
    writeURL(); renderStageFoot(); renderFoot();
    const field = t.closest('.field');
    const h4 = field && field.parentElement && field.parentElement.previousElementSibling;
    if (h4 && h4.tagName === 'H4' && h4.querySelector('em')) {
      if (key === 'wf' || key === 'wr') h4.querySelector('em').textContent = `${nf(S.wf)}" ${S.stag ? '/ ' + nf(S.wr) + '"' : ''}`;
      if (key === 'etf' || key === 'etr') h4.querySelector('em').textContent = `ET${S.etf}${S.stag ? ' / ET' + S.etr : ''}`;
    }
    if (['pcd','wf','wr','d'].includes(key)) renderStageView();
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'previewView' && ['car','model-photo','photo'].includes(t.value)) {
      S.view = t.value; writeURL(); renderStage(); if (S.step === 4) renderPanel(); $('#previewView')?.focus({preventScroll:true}); return;
    }
    if (t.id === 'electricVehicle') {
      S.isElectricVehicle = isKnownElectricModel() || t.checked;
      if (S.isElectricVehicle && S.loadKg < 850) S.loadKg = null;
      $('#wheelLoad').innerHTML = loadOptions();
      $('#electricVehicleHint').textContent = electricVehicleHint();
      writeURL();
      return;
    }
    if (t.id === 'wheelLoad') {
      S.higherLoadConsultation = t.value === 'higher-consultation';
      const value = Number(t.value);
      S.loadKg = !S.higherLoadConsultation && validLoad(value) && (!S.isElectricVehicle || value >= 850) ? value : null;
      $('#electricVehicleHint').textContent = electricVehicleHint();
      writeURL();
      return;
    }
    if (['vehicleBrand','vehicleModel','vehicleYear','vehicleBody','vehicleGeneration'].includes(t.id)) {
      if (S.view === 'showroom') S.view = 'car';
      if(t.id==='vehicleBrand'){S.brand=t.value;S.model='';S.year=0;S.body='';S.generation='';S.carDetail='';}
      if(t.id==='vehicleModel'){S.model=t.value;S.year=0;S.body='';S.generation='';S.carDetail='';}
      if(t.id==='vehicleYear'){S.year=Number(t.value);S.generation='';}
      if(t.id==='vehicleBody'){S.body=t.value;S.generation='';}
      if(t.id==='vehicleGeneration')S.generation=t.value;
      if (['vehicleBrand','vehicleModel'].includes(t.id)) {
        S.isElectricVehicle = isKnownElectricModel();
        if (S.isElectricVehicle && S.loadKg < 850) S.loadKg = null;
      }
      syncGeneration(); update({head:true});
      if (MOBILE.matches) guideVehicle(t.id);
      else if (t.id === 'vehicleBrand' && brandPicker) brandPicker.trigger.focus({preventScroll:true});
      else document.getElementById(t.id)?.focus({preventScroll:true});
      return;
    }
    if (t.id === 'spinToggle') { S.spin = t.checked; renderStageView(); return; }
    if (t.id === 'stagToggle') { S.stag = t.checked; if (!S.stag) { S.wr = S.wf; S.etr = S.etf; } update({ stage: false }); return; }
    if (t.dataset.extra) {
      const id = t.dataset.extra;
      S.extras = t.checked ? [...new Set([...S.extras, id])] : S.extras.filter(x => x !== id);
      writeURL(); renderFoot(); return;
    }
    if (t.dataset.set === 'cb') { t.value = S.cb; }
  });
  document.addEventListener('keydown', e => {
    if (e.target.closest('.nfw-brand-dialog')) return;
    if (e.target.matches('input, textarea, select')) return;
    if (e.target.closest('.webgl-view')) return;
    if (!e.target.closest('#stepsRail, .panel-nav')) return;
    if (e.key === 'ArrowRight' && S.step < 5) { e.preventDefault(); goStep(S.step + 1); }
    if (e.key === 'ArrowLeft' && S.step > 1) { e.preventDefault(); goStep(S.step - 1); }
  });

  // Keep the footer clear of the software keyboard, without moving the page
  // when someone compares colours, rotates a wheel or opens a native select.
  let viewportBaseline = { width: innerWidth, height: window.visualViewport?.height || innerHeight };
  const syncKeyboard = () => {
    const active = document.activeElement;
    const typing = active?.matches('input[type="text"],input[type="search"],input[type="email"],input[type="tel"],input[type="number"],textarea');
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    if (!typing || Math.abs(innerWidth - viewportBaseline.width) > 20) viewportBaseline = {width:innerWidth,height};
    const open = MOBILE.matches && typing && height < viewportBaseline.height - 120;
    document.body.classList.toggle('flow-keyboard-open', Boolean(open));
    if (open) revealFlow(active, {focus:false,block:'nearest'});
  };
  window.visualViewport?.addEventListener('resize', syncKeyboard);
  document.addEventListener('focusin', event => {
    syncKeyboard();
    if (MOBILE.matches && event.target.closest('#panelBody') && event.target.matches('input:not([type="range"]):not([type="checkbox"]):not([type="color"]),textarea,select')) revealFlow(event.target,{focus:false,block:'nearest'});
  });
  document.addEventListener('focusout', () => queueMicrotask(syncKeyboard));
  MOBILE.addEventListener('change', () => { syncPreviewState(); renderStageView(); renderFoot(); syncKeyboard(); });
  new ResizeObserver(entries => {
    const height = Math.ceil(entries[0].target.getBoundingClientRect().height);
    if (height > 0) document.body.style.setProperty('--flow-footer-height', height + 'px');
  }).observe($('#panelFoot'));
  let printDetails = [];
  window.addEventListener('beforeprint', () => {
    printDetails = [...document.querySelectorAll('[data-flow-detail]')].map(el=>[el,el.open]);
    printDetails.forEach(([el])=>{el.open=true;});
  });
  window.addEventListener('afterprint', () => {
    printDetails.forEach(([el,open])=>{if(el.isConnected)el.open=open;});
    printDetails = [];
  });

  window.addEventListener('pagehide', event => { renderToken++; pendingViewerAbort?.abort(); viewer?.dispose(); viewer = null; photoViewer?.dispose(); photoViewer = null; ownCarViewer?.dispose(); ownCarViewer = null; if (!event.persisted) { ownCarSession?.dispose(); ownCarSession = null; } });
  window.addEventListener('pageshow', event => { if (event.persisted) renderStageView(); });
  document.addEventListener('fullscreenchange', () => {
    const button = $('[data-studio-fullscreen]');
    if (button) { button.textContent = document.fullscreenElement ? 'Zavřít ×' : 'Zvětšit ↗'; button.setAttribute('aria-label', document.fullscreenElement ? 'Ukončit celou obrazovku' : 'Studio na celou obrazovku'); }
  });
  window.addEventListener('hashchange', () => { readURL(); writeURL(); renderSteps(); renderStage(); renderPanel({reset:true}); revealFlow($('#mobileFlowIntro')); });
  /* ---------- start ---------- */
  applyCarDefaults(car());
  readURL();
  previewExpanded = MOBILE.matches && S.view === 'own-car';
  writeURL();
  renderSteps(); renderStage(); renderPanel();
  visuals?.ready.then(() => { if (isPhotoView()) renderStageView(); });
})();
