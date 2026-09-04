/* ============================================================
   Need For Wheels — konfigurátor kol
   Kroky: 1 Auto · 2 Design · 3 Rozměry · 4 Vzhled · 5 Souhrn
   Stav se zrcadlí do URL (#hash), takže jde konfiguraci sdílet.
   Vše, co přijde z URL, se validuje proti katalogu a limitům.
   ============================================================ */
(function () {
  'use strict';
  const O = window.NFW;
  const V = window.NFWVehicles;
  const $ = s => document.querySelector(s);
  const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';
  const nf = n => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const HEX = /^#[0-9a-f]{6}$/i;

  const EXTRAS = [
    { id: 'hidden',   name: 'Skryté šrouby',            desc: 'Spojovací šrouby límce schované za čelem (u třídílných kol)', price: 2400 },
    { id: 'titanium', name: 'Titanové šrouby / matice', desc: 'Sada 20 ks, lehčí než ocelové',                              price: 9800 },
    { id: 'engrave',  name: 'Gravírování',              desc: 'Vlastní text nebo logo na paprsku',                          price: 1200 },
    { id: 'tpms',     name: 'TPMS senzory',             desc: 'Namontované v kole, párování s vozem provede servis',        price: 3200 },
    { id: 'ceramic',  name: 'Keramická ochrana',        desc: 'Ochranná vrstva proti solím a prachu',                       price: 2900 },
  ];
  const STEPS = ['Auto', 'Design', 'Rozměry', 'Vzhled', 'Souhrn'];
  const DIAMS = [18, 19, 20, 21, 22, 23, 24];
  const LIMITS = { d: [18, 24], wf: [7, 13.5], wr: [7, 13.5], etf: [-15, 75], etr: [-15, 75], cb: [50, 120], weight: [7, 16] };

  /* ---------- stav ---------- */
  const S = {
    step: 1, view: 'wheel', spin: !matchMedia('(prefers-reduced-motion: reduce)').matches, side: 'R',
    brand: 'bmw', model: 'x5', year: 2020, generation: 'g05', body: 'suv',
    car: 'suv', bodyColor: 'white', carDetail: '',
    design: 'apex10', color: 'bronze', colorHex: '#ff4d1c', finish: 'gloss', lip: 'same', cap: 'black',
    d: 21, stag: true, wf: 9, wr: 11.5, etf: 50, etr: 62, pcd: '5x130', cb: 71.6, weight: 10.5,
    extras: [], note: '', name: '', email: '', phone: '',
  };
  const INITIAL = { ...S };
  const car = () => O.find(O.CARS, S.car);
  const selectedBrand = () => V.getBrand(S.brand);
  const selectedModel = () => V.getModel(S.brand, S.model);
  const candidates = () => V.getCandidates(S.brand, S.model, S.year, S.body);
  const generation = () => S.body ? candidates().find(g => g.id === S.generation) || null : null;
  const vehicleName = () => `${selectedBrand()?.name || ''} ${selectedModel()?.name || ''} · ${S.year || 'rok neurčen'}${generation() ? ' · ' + generation().name + ' · ' + generation().bodyName : S.body ? ' · ' + (V.getBodies(S.brand,S.model,S.year).find(b=>b.id===S.body)?.name || '') + ' · provedení neurčeno' : ' · provedení neurčeno'}`;
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
  const bodyHex = () => O.find(O.BODY_COLORS, S.bodyColor).hex;
  const colorHex = () => S.color === 'custom' ? S.colorHex : O.find(O.COLORS, S.color).hex;
  const colorName = () => S.color === 'custom' ? 'Vlastní ' + S.colorHex.toUpperCase() : O.find(O.COLORS, S.color).name;
  const directional = () => ['twist', 'turbine'].includes(design().style);
  const wheelOpts = () => ({ design: S.design, colorHex: colorHex(), finish: S.finish, lip: S.lip, cap: S.cap, bolts: parseInt(S.pcd, 10) || 5, mirror: directional() && S.side === 'L' });
  const sizeF = () => `${S.d} × ${nf(S.wf)}" ET${S.etf}`;
  const sizeR = () => `${S.d} × ${nf(S.wr)}" ET${S.etr}`;
  const clamp = (k, v) => Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v));

  function applyCarDefaults(c) {
    const f = c.fit;
    Object.assign(S, { d: f.d, wf: f.wf, wr: f.wr, etf: f.etf, etr: f.etr, pcd: f.pcd, cb: f.cb, weight: f.weight, bodyColor: f.bodyColor, stag: f.wf !== f.wr });
  }

  /* ---------- cena a váha ---------- */
  function price() {
    const dsg = design();
    const avgW = (S.wf + S.wr) / 2;
    const base = 21900 + (S.d - 18) * 1900;
    const width = Math.max(0, avgW - 9) * 900;
    const fin = O.find(O.FINISHES, S.finish).price;
    const lip = O.find(O.LIPS, S.lip).price;
    const cap = O.find(O.CAPS, S.cap).price;
    const perWheel = base + dsg.base + width + fin + lip + cap;
    const set = perWheel * 4;
    const extras = S.extras.reduce((a, id) => a + ((EXTRAS.find(e => e.id === id) || {}).price || 0), 0);
    return { base, design: dsg.base, width, fin, lip, cap, perWheel, set, extras, total: set + extras };
  }
  function weightEst() {
    const avgW = (S.wf + S.wr) / 2;
    return Math.round((8.2 + (S.d - 18) * .55 + (avgW - 8) * .35 + (design().pieces === 3 ? 1.2 : 0)) * 10) / 10;
  }
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
    else if (!V.getModel(S.brand, S.model)) S.model = selectedBrand().models[0].id;
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
    if (['car','wheel','showroom'].includes(src.get('view'))) S.view = src.get('view');
    if (has(O.CARS, src.get('car'))) { S.car = src.get('car'); applyCarDefaults(car()); }
    if (has(O.DESIGNS, src.get('design'))) { S.design = src.get('design'); if (src === p) S.step = 2; }
    if (has(O.COLORS, src.get('color'))) S.color = src.get('color');
    if (has(O.FINISHES, src.get('finish'))) S.finish = src.get('finish');
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
    if (!DIAMS.includes(S.d)) S.d = car().fit.d;
    S.stag = h.get('stag') !== '0';
    if (!S.stag) { S.wr = S.wf; S.etr = S.etf; }
    const st = parseInt(h.get('step'), 10);
    if (st >= 1 && st <= 5) S.step = st;
    if (h.get('side') === 'L') S.side = 'L';
    if (h.get('x')) S.extras = [...new Set(h.get('x').split(',').filter(id => EXTRAS.some(e => e.id === id)))];
    S.carDetail = (h.get('carDetail') || '').slice(0, 80);
    S.note = (h.get('note') || '').slice(0, 300);
  }
  const KEYS = ['brand', 'model', 'year', 'generation', 'body', 'view', 'car', 'bodyColor', 'design', 'color', 'colorHex', 'finish', 'lip', 'cap', 'd', 'wf', 'wr', 'etf', 'etr', 'pcd', 'cb', 'weight', 'side', 'step'];
  function writeURL() {
    const h = new URLSearchParams();
    KEYS.forEach(k => h.set(k, String(S[k])));
    h.set('stag', S.stag ? '1' : '0');
    if (S.extras.length) h.set('x', S.extras.join(','));
    if (S.carDetail) h.set('carDetail', S.carDetail);
    if (S.note) h.set('note', S.note);
    history.replaceState(null, '', '#' + h.toString());
  }
  /* z file:// by se sdílel lokální soubor – použijeme veřejnou adresu webu */
  const shareURL = () => location.protocol === 'file:' ? O.SITE_URL + 'konfigurator.html' + location.hash : location.href;

  /* ---------- render: kroky ---------- */
  function renderSteps() {
    $('#stepsRail').innerHTML = STEPS.map((t, i) => {
      const n = i + 1;
      const cls = n === S.step ? 'active' : n < S.step ? 'done' : '';
      return `<button class="cfg-step ${cls}" type="button" data-step="${n}" aria-current="${n === S.step ? 'step' : 'false'}"><b><span>${n < S.step ? '✓' : n}</span></b><span class="t">${t}</span></button>`;
    }).join('');
  }

  /* ---------- render: scéna ---------- */
  function stageTitle() {
    const heading = S.view === 'showroom' ? 'Ferrari 458 Italia' : vehicleName();
    const subtitle = S.view === 'showroom' ? '3D showroom · ukázkový vůz' : `Konfigurátor · krok ${S.step} / 5`;
    return `<small>${subtitle}</small>${esc(heading)} <span class="accent">×</span> ${esc(design().name)}`;
  }
  let showroomModule, viewer, viewerKey = '', renderToken = 0;
  const loadShowroom = () => showroomModule || (showroomModule = import('./showroom.js').catch(e => { showroomModule = null; throw e; }));
  const previewOptions = mode => ({ mode, design: S.design, color: colorHex(), colorHex: colorHex(), finish: S.finish, lip: S.lip, cap: S.cap, diameter: S.d, width: S.wf, autoRotate: S.spin, bodyColor: bodyHex(), mirror: S.side === 'L', bolts: parseInt(S.pcd,10) || 5 });
  function renderStage() {
    $('#stageHead').innerHTML = `<h1>${stageTitle()}</h1><div class="stage-controls"><div class="seg" aria-label="Typ náhledu">${[['wheel','3D kolo'],['car','Můj vůz'],['showroom','3D showroom']].map(([id,label])=>`<button type="button" class="${S.view===id?'active':''}" data-view="${id}" aria-pressed="${S.view===id}"><span>${label}</span></button>`).join('')}</div>${S.view!=='car'?`<label class="toggle"><input type="checkbox" id="spinToggle" ${S.spin?'checked':''}> Rotace</label>`:''}</div>`;
    renderStageView(); renderStageFoot();
  }
  async function renderStageView() {
    const v = $('#stageView'), g = generation();
    const asset = S.view === 'car' ? g?.asset : null;
    const mode = S.view === 'showroom' ? 'car' : 'wheel';
    const key = asset ? 'image:' + asset : mode;
    const token = ++renderToken;
    if (viewer && viewerKey === key) {
      viewer.update(previewOptions(mode));
      updatePreviewCaption(v, asset); return;
    }
    if (viewer) { viewer.dispose(); viewer=null; }
    viewerKey = key;
    if (asset) {
      v.innerHTML=`<img class="vehicle-render" src="${esc(asset)}" alt="Ilustrační render ${esc(vehicleName())}"><div class="preview-caption"></div>`;
      updatePreviewCaption(v,asset); return;
    }
    v.innerHTML='<div class="webgl-view" id="webglView"><div class="viewer-loading"><span></span>Připravuji 3D studio…</div></div><div class="preview-caption"></div>';
    updatePreviewCaption(v,asset);
    const container = v.querySelector('.webgl-view');
    try {
      await loadShowroom(); if(token!==renderToken)return;
      const result = await window.NFWShowroom.mount(container, previewOptions(mode));
      if(token!==renderToken){result?.dispose();return;}
      viewer=result;
      container.querySelector('.viewer-loading')?.remove();
    } catch(error) {
      if(token!==renderToken)return;
      container.innerHTML='<div class="viewer-fallback"><img src="assets/reference/bronze-wheel-pair.jpg" alt="Fotografie referenčního bronzového kola"><p>3D náhled se nepodařilo načíst. Zobrazuje se fotografie referenčního kola.</p><button class="btn btn--ghost" type="button" data-retry-3d>Zkusit znovu</button></div>';
    }
  }
  function updatePreviewCaption(v, asset) {
    const caption=v.querySelector('.preview-caption'); if(!caption)return;
    if(asset)caption.innerHTML=`<b>${esc(vehicleName())}</b><span>Ilustrační render · barva a kola na obrázku jsou pevné. Své volby upravíš v náhledu 3D kola.</span>`;
    else if(S.view==='showroom')caption.innerHTML='<b>Ferrari 458 Italia · 3D showroom</b><span>Vybraný design kol na ukázkovém voze. Montážní rozměry jsou ilustrační. Model: vicent091036 / Three.js.</span>';
    else if(S.view==='car')caption.innerHTML=`<b>${esc(vehicleName())}</b><span>Pro tento vůz zatím nemáme přesný vizuální podklad. Zobrazuje se 3D vybraného kola; vůz je uložený v poptávce.</span>`;
    else caption.innerHTML='<b>360° STUDIO <span class="live-dot"></span></b><span>Tažením otáčej · kolečkem přibližuj · dvojklikem obnov pohled</span>';
  }
  function renderStageFoot() {
    const sw = S.view === 'car' ? '<button class="text-link" type="button" data-view="wheel">Upravit kolo ve 3D →</button>' : S.view === 'showroom'
      ? `<div class="swatches">${O.BODY_COLORS.map(c => `<button type="button" class="swatch ${S.bodyColor === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="Karoserie ${esc(c.name)}" data-set="bodyColor" data-val="${c.id}"></button>`).join('')}</div>`
      : `<div class="swatches">${O.COLORS.map(c => `<button type="button" class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="Kolo ${esc(c.name)}" data-set="color" data-val="${c.id}"></button>`).join('')}</div>`;
    $('#stageFoot').innerHTML = `${sw}
      <div class="stage-info">
        <div>Průměr<b>${S.d}"</b></div><div>Šířka<b>${nf(S.wf)} / ${nf(S.wr)}"</b></div>
        <div>ET<b>${S.etf} / ${S.etr}</b></div><div>PCD · CB<b>${esc(S.pcd)} · ${nf(S.cb)}</b></div>
        <div>Odhad váhy<b>~${nf(weightEst())} kg</b></div>
      </div>`;
  }

  /* ---------- render: panel ---------- */
  function renderPanel() {
    const b = $('#panelBody');
    b.innerHTML = [panelCar, panelDesign, panelSize, panelLook, panelSummary][S.step - 1]();
    b.scrollTop = 0;
    renderFoot();
  }

  function panelCar() {
    const g = generation(), list = candidates(), years = V.getYears(S.brand, S.model);
    const bodies = V.getBodies(S.brand, S.model, S.year);
    const model = selectedModel();
    const sourceNote = !g ? 'Zvol karoserii a konkrétní provedení.' : g.confidence === 'verified'
      ? 'Provedení doplněné z podkladů výrobce.' : 'Katalogové provedení. Kód generace a označení faceliftu nemusí být ve zdroji uvedené.';
    const endNote = !g ? '' : g.endBasis === 'inferred' ? 'Hranice období je odvozená z následujícího provedení; přechodový rok se může překrývat.' : g.endBasis === 'open' ? 'Zdroj neuvádí konec období. Katalog je omezen rokem 2026; dostupnost daného ročníku je potřeba ověřit.' : 'V přechodových letech se mohou období překrývat.';
    return `<div class="panel-kicker">01 / TVŮJ VŮZ</div><h2>Začni svým autem.</h2><p class="sub">${V.brandCount} značek · ${V.modelCount} modelů · ročníky do ${V.through}. Generace, facelifty a karoserie se ukládají s konfigurací.</p>
      <div class="vehicle-fields">
      <label class="field"><span>Značka</span><select id="vehicleBrand" aria-label="Značka">${V.brands.map(b=>`<option value="${esc(b.id)}" ${S.brand===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Model</span><select id="vehicleModel" aria-label="Model">${selectedBrand().models.map(m=>`<option value="${esc(m.id)}" ${S.model===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Rok vozu</span><select id="vehicleYear" aria-label="Rok výroby">${!years.includes(S.year)?`<option value="${S.year}" selected>${S.year ? S.year+' · mimo doložená období' : 'Vyber rok'}</option>`:''}${years.map(y=>`<option value="${y}" ${S.year===y?'selected':''}>${y}</option>`).join('')}</select></label>
      <label class="field"><span>Karoserie</span><select id="vehicleBody" aria-label="Karoserie" ${!bodies.length?'disabled':''}>${bodies.length!==1 || !S.body?'<option value="">Vyber karoserii</option>':''}${bodies.map(b=>`<option value="${esc(b.id)}" ${S.body===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label class="field vehicle-fields__wide"><span>Generace / provedení ${list.length>1?'· upřesni variantu':''}</span><select id="vehicleGeneration" aria-label="Generace" ${!S.body || !list.length?'disabled':''}>${list.length!==1 || !S.body || !S.generation?'<option value="">Vyber provedení</option>':''}${S.body?list.map(g=>`<option value="${esc(g.id)}" ${S.generation===g.id?'selected':''}>${esc(g.name)} · ${V.periodLabel(g)}${g.status==='announced'?' · oznámeno':''}</option>`).join(''):''}</select></label>
      </div>
      ${!years.includes(S.year)?'<div class="note vehicle-warning" role="status">Pro tento rok nemáme doložené provedení. Vyber dostupný ročník nebo chybějící variantu uveď do poznámky.</div>':''}
      <div class="generation-info"><small>${g ? g.confidence==='verified'?'PODKLADY VÝROBCE':'KATALOGOVÝ ZÁZNAM' : 'VÝBĚR PROVEDENÍ'}</small><b>${g?esc(g.name)+' · '+esc(g.bodyName):'Upřesni svůj vůz'}</b><span>${sourceNote}</span>${g?.status==='announced'?`<span class="vehicle-warning">Oznámené provedení · ${esc(g.startBasis || 'Dodávky jsou plánované.')}</span>`:''}</div>
      ${g?`<details class="vehicle-source"><summary>Období a zdroj údajů</summary><p>${V.periodLabel(g)} · ${esc(g.market)}. ${endNote}</p>${g.startBasis?`<p>${esc(g.startBasis)}</p>`:''}${g.notes?`<p>${esc(g.notes)}</p>`:''}${g.bodyVariants?.length?`<p>Další provedení řady ve zdroji: ${g.bodyVariants.map(esc).join(', ')}. Kombinaci s karoserií upřesni v poznámce.</p>`:''}<a href="${esc(g.source)}" target="_blank" rel="noopener">${esc(g.sourceTitle)} ↗</a>${g.additionalSources?.length?g.additionalSources.map(source=>`<br><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a>`).join(''):''}</details>`:''}
      <a class="text-link vehicle-catalog-link" href="index.html?catalogBrand=${encodeURIComponent(S.brand)}&catalogModel=${encodeURIComponent(model.name)}#auta">Prohlédnout katalog modelu (${model.variants.length} provedení) ↗</a>
      <label class="field"><span>Upřesnění vozu <em>volitelné</em></span><input type="text" data-set="carDetail" data-type="text" maxlength="80" value="${esc(S.carDetail)}" placeholder="např. kód generace, větší brzdy, chybějící varianta"></label>
      <div class="note">Katalog zahrnuje doložená provedení, historické údaje nemusí být úplné. Rozměry kol a přesnou kompatibilitu ověříme před výrobou.</div>`;
  }

  function panelDesign() {
    const wo = wheelOpts();
    return `<h2>02 · Vyber design</h2><p class="sub">Třináct návrhových designů v prostorovém náhledu. Finální provedení potvrdíme v technickém výkresu.</p>
      <div class="opt-grid">${O.DESIGNS.map(d => `<button type="button" class="opt ${S.design === d.id ? 'active' : ''}" data-set="design" data-val="${d.id}">
        ${O.renderWheel(Object.assign({}, wo, { design: d.id }), 'od' + d.id)}
        <div><b>${esc(d.name)}</b><span>Series ${d.series} · ${O.spokesLabel(d)}</span></div>
        <span class="p">${d.pieces === 3 ? 'třídílné · ' : ''}${d.base ? '+' + kc(d.base) + ' / kolo' : 'v ceně'}</span></button>`).join('')}</div>
      <div class="note" style="margin-top:14px"><b>${esc(design().name)}</b> – ${esc(design().desc)}${directional() ? ' Levé a pravé kolo kujeme zrcadlově, přepínač je nad náhledem.' : ''}</div>`;
  }

  function panelSize() {
    const f = car().fit;
    const chip = (v, key, rec) => `<button type="button" class="chip ${S[key] === v ? 'active' : ''} ${rec ? 'rec' : ''}" data-set="${key}" data-val="${v}" data-type="num"><span>${v}"</span></button>`;
    const range = (key, label, min, max, step, out) => `<label class="field"><span>${label}</span><div class="range"><input type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}" data-set="${key}" data-type="num" data-live="1"><output>${out}</output></div></label>`;
    return `<h2>03 · Rozměry</h2><p class="sub">Navrhni rozměry pro ${esc(vehicleName())}. Jde o zadání k ověření, nikoli potvrzenou kompatibilitu.</p>
      <h4>Průměr <em>${S.d}"</em></h4>
      <div class="chips">${DIAMS.map(v => chip(v, 'd', false)).join('')}</div>
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
      <h4>Cílová váha kola <em>${nf(S.weight)} kg</em></h4>
      <div class="range"><input type="range" min="7" max="16" step="0.1" value="${S.weight}" data-set="weight" data-type="num" data-live="1" aria-label="Cílová váha kola"><output>${nf(S.weight)} kg</output></div>
      <p class="hint muted" style="font-size:12px;margin:6px 0 0">Odhad pro tuto konfiguraci: ~${nf(weightEst())} kg. Nižší cíl znamená více frézování a tenčí profily – potvrdíme ho v technickém výkresu.</p>
      <h4>Poznámka k fitmentu</h4>
      <div class="field"><textarea data-set="note" data-type="text" maxlength="300" aria-label="Poznámka k fitmentu" placeholder="Brzdy (např. PCCB, šestipístové), sražení, podběhy, rozšíření, adaptéry…">${esc(S.note)}</textarea></div>`;
  }

  function panelLook() {
    return `<h2>04 · Vzhled</h2><p class="sub">Barva, povrch, límec, krytka. Tady se rodí charakter kola.</p>
      <h4>Barva <em>${esc(colorName())}</em></h4>
      <div class="swatches">${O.COLORS.map(c => `<button type="button" class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="${esc(c.name)}" data-set="color" data-val="${c.id}"></button>`).join('')}
        <label class="swatch swatch--custom ${S.color === 'custom' ? 'active' : ''}" title="Vlastní odstín (RAL / HEX)"><input type="color" id="customColor" value="${esc(S.colorHex)}" aria-label="Vlastní odstín"></label></div>
      <p class="hint muted" style="font-size:12px;margin:4px 0 0">Vlastní odstín? Klikni na duhový kruh nebo nám v poznámce napiš kód RAL.</p>
      <h4>Povrchová úprava</h4>
      <div class="opt-list">${O.FINISHES.map(f => `<button type="button" class="opt ${S.finish === f.id ? 'active' : ''}" data-set="finish" data-val="${f.id}" style="grid-template-columns:1fr auto"><div><b>${f.name}</b><span>${f.desc}</span></div><span class="p">${f.price ? '+' + kc(f.price) + ' / kolo' : 'v ceně'}</span></button>`).join('')}</div>
      <h4>Límec</h4>
      <div class="chips">${O.LIPS.map(l => `<button type="button" class="chip ${S.lip === l.id ? 'active' : ''}" data-set="lip" data-val="${l.id}"><span>${l.name}${l.price ? ' · +' + kc(l.price) : ''}</span></button>`).join('')}</div>
      <h4>Středová krytka</h4>
      <div class="chips">${O.CAPS.map(c => `<button type="button" class="chip ${S.cap === c.id ? 'active' : ''}" data-set="cap" data-val="${c.id}"><span>${esc(c.name)}${c.price ? ' · +' + kc(c.price) : ''}</span></button>`).join('')}</div>
      <h4>Individuální doplňky <em>za sadu</em></h4>
      <div class="opt-list">${EXTRAS.map(x => `<label class="check"><input type="checkbox" data-extra="${x.id}" ${S.extras.includes(x.id) ? 'checked' : ''}><div><b>${x.name}</b><span>${x.desc}</span></div><span class="p">+${kc(x.price)}</span></label>`).join('')}</div>`;
  }

  function panelSummary() {
    const p = price();
    const c = car(), d = design();
    const label = O.labelHTML({
      order: orderNo(), model: vehicleName() + (S.carDetail ? ' / ' + S.carDetail : ''), design: `${d.name} · Series ${d.series}`, pos: 'FL – přední levé',
      size: `${S.d} × ${nf(S.wf)}"`, et: S.etf, pcd: S.pcd, cb: nf(S.cb), color: colorName(),
      finish: `${O.find(O.FINISHES, S.finish).name}${S.lip !== 'same' ? ' + ' + O.find(O.LIPS, S.lip).name.toLowerCase() : ''}`,
      weight: `cíl ${nf(S.weight)} kg`, date: new Date().toISOString().slice(0, 10),
    });
    const extras = S.extras.map(id => EXTRAS.find(e => e.id === id)).filter(Boolean);
    return `<h2>05 · Souhrn</h2><p class="sub">Zkontroluj konfiguraci. Po odeslání proběhne konzultace, výrobce připraví technický výkres ke schválení a teprve pak začíná výroba.</p>
      <table class="spec">
        <tr><th>Vůz</th><td>${esc(vehicleName())}${S.carDetail ? '<br><span class="muted">' + esc(S.carDetail) + '</span>' : ''}</td></tr>
        <tr><th>Design</th><td>${esc(d.name)} · Series ${d.series} · ${d.pieces === 3 ? 'třídílné' : 'monoblok'}${directional() ? ' · ' + (S.side === 'L' ? 'zrcadlová sada L/P' : 'zrcadlová sada L/P') : ''}</td></tr>
        <tr><th>Přední</th><td>${esc(sizeF())}</td></tr>
        <tr><th>Zadní</th><td>${esc(sizeR())}</td></tr>
        <tr><th>PCD / CB</th><td>${esc(S.pcd)} / ${nf(S.cb)} mm</td></tr>
        <tr><th>Barva</th><td>${esc(colorName())} · ${O.find(O.FINISHES, S.finish).name}</td></tr>
        <tr><th>Límec</th><td>${O.find(O.LIPS, S.lip).name}</td></tr>
        <tr><th>Krytka</th><td>${O.find(O.CAPS, S.cap).name}</td></tr>
        <tr><th>Cílová váha</th><td>${nf(S.weight)} kg <span class="muted">(odhad ~${nf(weightEst())} kg)</span></td></tr>
        <tr><th>Doplňky</th><td>${extras.length ? extras.map(e => esc(e.name)).join(', ') : '<span class="muted">žádné</span>'}</td></tr>
        ${S.note ? `<tr><th>Poznámka</th><td>${esc(S.note)}</td></tr>` : ''}
      </table>
      <h4>Need For Wheels štítek <em>náhled</em></h4>
      <div class="label-svg">${label}</div>
      <p class="hint muted" style="font-size:12px">Každá krabice dostane vlastní štítek s parametry konkrétního kola (FL / FR / RL / RR).</p>
      <h4>Orientační cena <em>sada 4 kol</em></h4>
      <table class="spec">
        <tr><th>Základ ${S.d}"</th><td class="r">${kc(p.base)} / kolo</td></tr>
        ${p.design ? `<tr><th>Design ${esc(d.name)}</th><td class="r">+${kc(p.design)} / kolo</td></tr>` : ''}
        ${p.width ? `<tr><th>Šířka nad 9"</th><td class="r">+${kc(p.width)} / kolo</td></tr>` : ''}
        ${p.fin ? `<tr><th>Povrch</th><td class="r">+${kc(p.fin)} / kolo</td></tr>` : ''}
        ${p.lip ? `<tr><th>Límec</th><td class="r">+${kc(p.lip)} / kolo</td></tr>` : ''}
        ${p.cap ? `<tr><th>Krytka</th><td class="r">+${kc(p.cap)} / kolo</td></tr>` : ''}
        <tr><th>Sada 4 kol</th><td class="r">${kc(p.set)}</td></tr>
        ${p.extras ? `<tr><th>Doplňky</th><td class="r">+${kc(p.extras)}</td></tr>` : ''}
        <tr class="total"><th>Celkem</th><td class="r">${kc(p.total)}</td></tr>
      </table>
      <div class="note note--warn" style="margin-top:10px">Cena je orientační, bez DPH a dopravy. Závaznou nabídku potvrdíme společně s technickým výkresem.</div>
      <h4>Kontakt na tebe</h4>
      <div class="form">
        <label class="field"><span>Jméno</span><input type="text" data-set="name" data-type="text" maxlength="80" value="${esc(S.name)}" placeholder="Jméno a příjmení" autocomplete="name"></label>
        <div class="form-row">
          <label class="field"><span>E-mail</span><input type="email" data-set="email" data-type="text" maxlength="80" value="${esc(S.email)}" placeholder="ty@email.cz" autocomplete="email"></label>
          <label class="field"><span>Telefon</span><input type="tel" data-set="phone" data-type="text" maxlength="30" value="${esc(S.phone)}" placeholder="+420" autocomplete="tel"></label>
        </div>
      </div>
      <div class="actions">
        <a class="btn btn--primary" id="sendMail" href="#"><span>Odeslat poptávku e-mailem</span></a>
        <button class="btn" type="button" id="copySpec"><span>Kopírovat specifikaci</span></button>
        <button class="btn btn--ghost" type="button" id="shareLink"><span>Kopírovat odkaz na konfiguraci</span></button>
        <button class="btn btn--ghost" type="button" id="printSpec"><span>Uložit jako PDF / tisk</span></button>
        <div class="copied" id="copiedMsg" aria-live="polite"></div>
      </div>`;
  }

  function renderFoot() {
    const p = price();
    $('#panelFoot').innerHTML = `
      <div class="price"><div><small>Orientační cena · sada 4 kol · bez DPH</small><b>${kc(p.total)}</b></div><div class="per">${kc(p.perWheel)} / kolo<br>~${nf(weightEst())} kg / kolo</div></div>
      <div class="panel-nav">
        <button class="btn btn--ghost" type="button" id="prevStep" ${S.step === 1 ? 'disabled' : ''}><span>← Zpět</span></button>
        ${S.step < 5 ? `<button class="btn btn--primary" type="button" id="nextStep"><span>${STEPS[S.step]} →</span></button>` : `<a class="btn btn--primary" id="sendMail2" href="#"><span>Odeslat poptávku</span></a>`}
      </div>`;
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
      `Design: ${d.name} · Series ${d.series} · ${d.pieces === 3 ? 'třídílné' : 'monoblok'}${directional() ? ' · zrcadlová sada L/P' : ''}`,
      `Přední: ${sizeF()}`,
      `Zadní: ${sizeR()}`,
      `PCD / CB: ${S.pcd} / ${nf(S.cb)} mm`,
      `Barva: ${colorName()} · Povrch: ${O.find(O.FINISHES, S.finish).name}`,
      `Límec: ${O.find(O.LIPS, S.lip).name} · Krytka: ${O.find(O.CAPS, S.cap).name}`,
      `Cílová váha: ${nf(S.weight)} kg (odhad ~${nf(weightEst())} kg)`,
      `Doplňky: ${extras.length ? extras.join(', ') : 'žádné'}`,
      '',
      `Orientační cena: ${kc(p.total)} bez DPH (${kc(p.perWheel)} / kolo)`,
      S.note ? '' : null,
      S.note ? `Poznámka: ${S.note}` : null,
    ].filter(l => l !== null).join('\r\n');
  }
  function mailtoHref() {
    return `mailto:${O.EMAIL}?subject=${encodeURIComponent(`Poptávka Need For Wheels – ${vehicleName()} × ${design().name} ${S.d}"`)}&body=${encodeURIComponent(specText())}`;
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
    if (opts.stage !== false && !opts.head) renderStageView();
    renderStageFoot();
    if (opts.panel !== false) renderPanel(); else renderFoot();
    if (opts.head) renderStage();
  }
  function goStep(n) {
    S.step = Math.min(5, Math.max(1, Math.round(n)));
    writeURL();
    renderSteps(); renderStage(); renderPanel();
    if (window.innerWidth <= 900) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- události (delegace) ---------- */
  document.addEventListener('click', e => {
    const step = e.target.closest('[data-step]');
    if (step) return goStep(Number(step.dataset.step));
    const view = e.target.closest('[data-view]');
    if (view) { S.view = view.dataset.view; writeURL(); renderStage(); return; }
    if (e.target.closest('[data-retry-3d]')) { renderStageView(); return; }
    const side = e.target.closest('[data-side]');
    if (side) { S.side = side.dataset.side === 'L' ? 'L' : 'R'; writeURL(); renderStage(); return; }
    if (e.target.closest('#nextStep')) return goStep(S.step + 1);
    if (e.target.closest('#prevStep')) return goStep(S.step - 1);
    if (e.target.closest('#copySpec')) { e.preventDefault(); return copy(specText(), 'Specifikace zkopírována do schránky.'); }
    if (e.target.closest('#shareLink')) { e.preventDefault(); return copy(shareURL(), 'Odkaz zkopírován. Pošli ho kamarádovi nebo nám.'); }
    if (e.target.closest('#printSpec')) { e.preventDefault(); return window.print(); }
    const mail = e.target.closest('#sendMail, #sendMail2');
    if (mail) { mail.href = mailtoHref(); if (S.step !== 5) { e.preventDefault(); goStep(5); } return; }

    const set = e.target.closest('[data-set][data-val]');
    if (set) {
      const key = set.dataset.set;
      const val = set.dataset.type === 'num' ? Number(set.dataset.val) : set.dataset.val;
      if (S[key] === val) return;
      S[key] = val;
      if (key === 'car') applyCarDefaults(car());
      update({ head: key === 'car' || key === 'design' });
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
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
    if (out) out.textContent = key.startsWith('et') ? 'ET' + val : key === 'weight' ? nf(val) + ' kg' : nf(val) + '"';
    /* pole s živou hodnotou nepřekreslujeme (aby posuvník neztratil fokus) */
    writeURL(); renderStageFoot(); renderFoot();
    const field = t.closest('.field');
    const h4 = field && field.parentElement && field.parentElement.previousElementSibling;
    if (h4 && h4.tagName === 'H4' && h4.querySelector('em')) {
      if (key === 'wf' || key === 'wr') h4.querySelector('em').textContent = `${nf(S.wf)}" ${S.stag ? '/ ' + nf(S.wr) + '"' : ''}`;
      if (key === 'etf' || key === 'etr') h4.querySelector('em').textContent = `ET${S.etf}${S.stag ? ' / ET' + S.etr : ''}`;
    }
    if (key === 'weight') { const em = t.closest('.range').previousElementSibling.querySelector('em'); if (em) em.textContent = nf(val) + ' kg'; }
    if (['pcd','wf','wr','d'].includes(key)) renderStageView();
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (['vehicleBrand','vehicleModel','vehicleYear','vehicleBody','vehicleGeneration'].includes(t.id)) {
      if(t.id==='vehicleBrand'){S.brand=t.value;S.model=selectedBrand().models[0].id;S.body='';S.generation='';S.carDetail='';}
      if(t.id==='vehicleModel'){S.model=t.value;S.body='';S.generation='';S.carDetail='';}
      if(t.id==='vehicleYear'){S.year=Number(t.value);S.generation='';}
      if(t.id==='vehicleBody'){S.body=t.value;S.generation='';}
      if(t.id==='vehicleGeneration')S.generation=t.value;
      if(t.id==='vehicleBrand' || t.id==='vehicleModel'){const years=V.getYears(S.brand,S.model);if(!years.includes(S.year))S.year=years[0] || 0;}
      syncGeneration(); update({head:true});
      document.getElementById(t.id)?.focus(); return;
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
    if (e.target.matches('input, textarea, select')) return;
    if (e.target.closest('.webgl-view')) return;
    if (e.key === 'ArrowRight' && S.step < 5) goStep(S.step + 1);
    if (e.key === 'ArrowLeft' && S.step > 1) goStep(S.step - 1);
  });

  window.addEventListener('pagehide', () => { renderToken++; viewer?.dispose(); viewer = null; });
  window.addEventListener('pageshow', event => { if (event.persisted) renderStageView(); });
  window.addEventListener('hashchange', () => { readURL(); writeURL(); renderSteps(); renderStage(); renderPanel(); });
  /* ---------- start ---------- */
  applyCarDefaults(car());
  readURL();
  writeURL();
  renderSteps(); renderStage(); renderPanel();
})();
