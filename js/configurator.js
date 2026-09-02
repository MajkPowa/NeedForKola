/* ============================================================
   OARTS — konfigurátor kol
   Kroky: 1 Auto · 2 Design · 3 Rozměry · 4 Vzhled · 5 Souhrn
   Stav se zrcadlí do URL (#hash), takže jde konfiguraci sdílet.
   ============================================================ */
(function () {
  'use strict';
  const O = window.OARTS;
  const $ = s => document.querySelector(s);
  const kc = n => Math.round(n).toLocaleString('cs-CZ') + ' Kč';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const EXTRAS = [
    { id: 'hidden',   name: 'Skryté šrouby',             desc: 'Krytka bez viditelných spojů',          price: 2400 },
    { id: 'titanium', name: 'Titanové šrouby / matice',  desc: 'Sada 20 ks, úspora cca 0,5 kg',         price: 9800 },
    { id: 'engrave',  name: 'Gravírování',               desc: 'Vlastní text nebo logo na paprsku',     price: 1200 },
    { id: 'tpms',     name: 'TPMS senzory',              desc: 'Namontované a spárované s vozem',       price: 3200 },
    { id: 'ceramic',  name: 'Keramická ochrana',         desc: 'Ochranná vrstva proti solím a prachu',  price: 2900 },
  ];
  const STEPS = ['Auto', 'Design', 'Rozměry', 'Vzhled', 'Souhrn'];
  const DIAMS = [18, 19, 20, 21, 22, 23, 24];

  /* ---------- stav ---------- */
  const S = {
    step: 1, view: 'car', spin: true,
    car: 'gt', bodyColor: 'white', carDetail: '',
    design: 'mono5', color: 'gunmetal', colorHex: '#ff4d1c', finish: 'gloss', lip: 'same', cap: 'black',
    d: 21, stag: true, wf: 9, wr: 11.5, etf: 50, etr: 62, pcd: '5x130', cb: 71.6, weight: 10.5,
    extras: [], note: '', name: '', email: '', phone: '',
  };
  const car = () => O.find(O.CARS, S.car);
  const design = () => O.find(O.DESIGNS, S.design);
  const bodyHex = () => O.find(O.BODY_COLORS, S.bodyColor).hex;
  const colorHex = () => S.color === 'custom' ? S.colorHex : O.find(O.COLORS, S.color).hex;
  const colorName = () => S.color === 'custom' ? 'Vlastní ' + S.colorHex.toUpperCase() : O.find(O.COLORS, S.color).name;
  const wheelOpts = () => ({ design: S.design, colorHex: colorHex(), finish: S.finish, lip: S.lip, cap: S.cap, bolts: parseInt(S.pcd) || 5 });
  const sizeF = () => `${S.d} × ${S.wf.toFixed(1)}" ET${S.etf}`;
  const sizeR = () => `${S.d} × ${S.wr.toFixed(1)}" ET${S.etr}`;

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
  const KEYS = ['car', 'bodyColor', 'design', 'color', 'colorHex', 'finish', 'lip', 'cap', 'd', 'wf', 'wr', 'etf', 'etr', 'pcd', 'cb', 'weight', 'stag', 'step'];
  const NUM = new Set(['d', 'wf', 'wr', 'etf', 'etr', 'cb', 'weight', 'step']);
  function readURL() {
    const p = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (p.get('car') && O.CARS.some(c => c.id === p.get('car'))) { S.car = p.get('car'); applyCarDefaults(car()); }
    if (p.get('design') && O.DESIGNS.some(d => d.id === p.get('design'))) { S.design = p.get('design'); S.step = 2; }
    if (p.get('color') && O.COLORS.some(c => c.id === p.get('color'))) S.color = p.get('color');
    if (p.get('finish') && O.FINISHES.some(f => f.id === p.get('finish'))) S.finish = p.get('finish');
    if (h.get('car')) {
      KEYS.forEach(k => {
        if (!h.has(k)) return;
        const v = h.get(k);
        S[k] = k === 'stag' ? v === '1' : NUM.has(k) ? Number(v) : v;
      });
      if (h.get('x')) S.extras = h.get('x').split(',').filter(id => EXTRAS.some(e => e.id === id));
      if (!O.CARS.some(c => c.id === S.car)) S.car = 'gt';
      if (!O.DESIGNS.some(d => d.id === S.design)) S.design = 'mono5';
      S.step = Math.min(5, Math.max(1, S.step || 1));
    }
  }
  function writeURL() {
    const h = new URLSearchParams();
    KEYS.forEach(k => h.set(k, k === 'stag' ? (S.stag ? '1' : '0') : String(S[k])));
    if (S.extras.length) h.set('x', S.extras.join(','));
    history.replaceState(null, '', location.pathname + '#' + h.toString());
  }
  const shareURL = () => location.origin && location.origin !== 'null' ? location.href : location.href;

  /* ---------- render: kroky ---------- */
  function renderSteps() {
    $('#stepsRail').innerHTML = STEPS.map((t, i) => {
      const n = i + 1;
      const cls = n === S.step ? 'active' : n < S.step ? 'done' : '';
      return `<button class="cfg-step ${cls}" data-step="${n}"><b><span>${n < S.step ? '✓' : n}</span></b><span class="t">${t}</span></button>`;
    }).join('');
  }

  /* ---------- render: scéna ---------- */
  function renderStage() {
    $('#stageHead').innerHTML = `
      <h1><small>Konfigurátor · krok ${S.step} / 5</small>${esc(car().name)} <span class="accent">×</span> ${esc(design().name)}</h1>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="seg"><button class="${S.view === 'car' ? 'active' : ''}" data-view="car"><span>Auto</span></button><button class="${S.view === 'wheel' ? 'active' : ''}" data-view="wheel"><span>Kolo</span></button></div>
        <label class="toggle"><input type="checkbox" id="spinToggle" ${S.spin ? 'checked' : ''}> Rotace</label>
      </div>`;
    renderStageView();
    renderStageFoot();
  }
  function renderStageView() {
    const v = $('#stageView');
    if (S.view === 'car') {
      v.innerHTML = `<div class="stage-bg"><span>${esc(car().name)}</span></div><div class="floor"></div>
        <div class="stage-canvas">${O.carSVG(car(), bodyHex(), wheelOpts(), 'st', { spin: S.spin ? 1.6 : 0 })}</div>`;
    } else {
      let svg = O.renderWheel(wheelOpts(), 'stw');
      if (S.spin) svg = O.spin(svg, 8);
      v.innerHTML = `<div class="stage-bg"><span>${esc(design().name)}</span></div><div class="stage-canvas wheel">${svg}</div>`;
    }
  }
  function renderStageFoot() {
    const sw = S.view === 'car'
      ? `<div class="swatches">${O.BODY_COLORS.map(c => `<button class="swatch ${S.bodyColor === c.id ? 'active' : ''}" style="background:${c.hex}" title="${c.name}" data-set="bodyColor" data-val="${c.id}"></button>`).join('')}</div>`
      : `<div class="swatches">${O.COLORS.map(c => `<button class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${c.name}" data-set="color" data-val="${c.id}"></button>`).join('')}</div>`;
    $('#stageFoot').innerHTML = `${sw}
      <div class="stage-info">
        <div>Průměr<b>${S.d}"</b></div><div>Šířka<b>${S.wf.toFixed(1)} / ${S.wr.toFixed(1)}"</b></div>
        <div>ET<b>${S.etf} / ${S.etr}</b></div><div>PCD · CB<b>${esc(S.pcd)} · ${S.cb}</b></div>
        <div>Odhad váhy<b>~${weightEst()} kg</b></div>
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
    const wo = wheelOpts();
    return `<h2>01 · Vyber auto</h2><p class="sub">Třída vozu nastaví výchozí rozteč, středový otvor a doporučené rozměry. Všechno jde v dalších krocích změnit.</p>
      <div class="opt-list">${O.CARS.map(c => `<button class="opt ${S.car === c.id ? 'active' : ''}" data-set="car" data-val="${c.id}">
        <span class="opt__car">${O.carSVG(c, O.find(O.BODY_COLORS, S.car === c.id ? S.bodyColor : c.fit.bodyColor).hex, wo, 'oc' + c.id)}</span>
        <div><b>${esc(c.name)}</b><span>${esc(c.fits)}</span></div><span class="p">${esc(c.fit.pcd)}</span></button>`).join('')}</div>
      <h4>Barva karoserie <em>${esc(O.find(O.BODY_COLORS, S.bodyColor).name)}</em></h4>
      <div class="swatches">${O.BODY_COLORS.map(c => `<button class="swatch ${S.bodyColor === c.id ? 'active' : ''}" style="background:${c.hex}" title="${c.name}" data-set="bodyColor" data-val="${c.id}"></button>`).join('')}</div>
      <h4>Tvůj konkrétní vůz <em>volitelné</em></h4>
      <div class="field"><input type="text" data-set="carDetail" data-type="text" value="${esc(S.carDetail)}" placeholder="např. Porsche 911 Carrera 4S (992), 2022"><span class="hint">Model, generace a rok nám pomůžou s přesným fitmentem a brzdami.</span></div>`;
  }

  function panelDesign() {
    const wo = wheelOpts();
    return `<h2>02 · Vyber design</h2><p class="sub">Dvanáct vzorů OARTS. Každý kujeme z bloku 6061-T6 a frézujeme přesně na tvůj rozměr.</p>
      <div class="opt-grid">${O.DESIGNS.map(d => `<button class="opt ${S.design === d.id ? 'active' : ''}" data-set="design" data-val="${d.id}">
        ${O.renderWheel(Object.assign({}, wo, { design: d.id }), 'od' + d.id)}
        <div><b>${esc(d.name)}</b><span>Series ${d.series} · ${d.spokes} paprsků</span></div>
        <span class="p">${d.pieces === 3 ? '3-dílné · ' : ''}${d.base ? '+' + kc(d.base) + ' / kolo' : 'v základu'}</span></button>`).join('')}</div>
      <div class="note" style="margin-top:14px"><b>${esc(design().name)}</b> – ${esc(design().desc)}</div>`;
  }

  function panelSize() {
    const f = car().fit;
    const chip = (v, key, rec) => `<button class="chip ${S[key] === v ? 'active' : ''} ${rec ? 'rec' : ''}" data-set="${key}" data-val="${v}" data-type="num"><span>${v}"</span></button>`;
    return `<h2>03 · Rozměry</h2><p class="sub">Hodnoty doporučené pro ${esc(car().name)} jsou označené ★. Chceš jinak? Kola kujeme přesně podle tebe.</p>
      <h4>Průměr <em>${S.d}"</em></h4>
      <div class="chips">${DIAMS.map(v => chip(v, 'd', f.diams.includes(v))).join('')}</div>
      <h4>Rozdílné šířky vpředu a vzadu <label class="toggle"><input type="checkbox" id="stagToggle" ${S.stag ? 'checked' : ''}> ${S.stag ? 'Staggered' : 'Square'}</label></h4>
      <h4>Šířka <em>${S.wf.toFixed(1)}" ${S.stag ? '/ ' + S.wr.toFixed(1) + '"' : ''}</em></h4>
      <div class="${S.stag ? 'two' : ''}">
        <div class="field"><label>${S.stag ? 'Přední' : 'Všechna kola'}</label><div class="range"><input type="range" min="7" max="13" step="0.5" value="${S.wf}" data-set="wf" data-type="num" data-live="1"><output>${S.wf.toFixed(1)}"</output></div></div>
        ${S.stag ? `<div class="field"><label>Zadní</label><div class="range"><input type="range" min="7" max="13.5" step="0.5" value="${S.wr}" data-set="wr" data-type="num" data-live="1"><output>${S.wr.toFixed(1)}"</output></div></div>` : ''}
      </div>
      <h4>Zális (ET) <em>ET${S.etf}${S.stag ? ' / ET' + S.etr : ''}</em></h4>
      <div class="${S.stag ? 'two' : ''}">
        <div class="field"><label>${S.stag ? 'Přední' : 'Všechna kola'}</label><div class="range"><input type="range" min="-15" max="75" step="1" value="${S.etf}" data-set="etf" data-type="num" data-live="1"><output>ET${S.etf}</output></div></div>
        ${S.stag ? `<div class="field"><label>Zadní</label><div class="range"><input type="range" min="-15" max="75" step="1" value="${S.etr}" data-set="etr" data-type="num" data-live="1"><output>ET${S.etr}</output></div></div>` : ''}
      </div>
      <h4>Rozteč a středový otvor</h4>
      <div class="two">
        <div class="field"><label>PCD</label><select data-set="pcd" data-type="text">${O.PCDS.map(p => `<option ${S.pcd === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><label>CB (mm)</label><input type="number" step="0.1" min="50" max="120" value="${S.cb}" data-set="cb" data-type="num"></div>
      </div>
      <div class="note" style="margin-top:10px">Výchozí pro ${esc(car().name)}: ${esc(f.pcd)} · CB ${f.cb} mm · ${f.d} × ${f.wf.toFixed(1)}" ET${f.etf}${f.wf !== f.wr ? ' / ' + f.d + ' × ' + f.wr.toFixed(1) + '" ET' + f.etr : ''}</div>
      <h4>Cílová váha kola <em>${S.weight.toFixed(1)} kg</em></h4>
      <div class="range"><input type="range" min="7" max="16" step="0.1" value="${S.weight}" data-set="weight" data-type="num" data-live="1"><output>${S.weight.toFixed(1)} kg</output></div>
      <p class="hint muted" style="font-size:12px;margin:6px 0 0">Odhad pro tuto konfiguraci: ~${weightEst()} kg. Nižší cíl znamená více frézování a tenčí profily, potvrdíme v technickém výkresu.</p>
      <h4>Poznámka k fitmentu</h4>
      <div class="field"><textarea data-set="note" data-type="text" placeholder="Brzdy (např. PCCB, 6pístové), sražení, podběhy, rozšíření, adaptéry…">${esc(S.note)}</textarea></div>`;
  }

  function panelLook() {
    return `<h2>04 · Vzhled</h2><p class="sub">Barva, povrch, límec, krytka. Tady se rodí charakter kola.</p>
      <h4>Barva <em>${esc(colorName())}</em></h4>
      <div class="swatches">${O.COLORS.map(c => `<button class="swatch ${S.color === c.id ? 'active' : ''}" style="background:${c.hex}" title="${c.name}" data-set="color" data-val="${c.id}"></button>`).join('')}
        <label class="swatch swatch--custom ${S.color === 'custom' ? 'active' : ''}" title="Vlastní odstín (RAL / HEX)"><input type="color" id="customColor" value="${S.colorHex}"></label></div>
      <p class="hint muted" style="font-size:12px;margin:4px 0 0">Vlastní odstín? Klikni na duhový kruh nebo nám v poznámce napiš kód RAL.</p>
      <h4>Povrchová úprava</h4>
      <div class="opt-list">${O.FINISHES.map(f => `<button class="opt ${S.finish === f.id ? 'active' : ''}" data-set="finish" data-val="${f.id}" style="grid-template-columns:1fr auto"><div><b>${f.name}</b><span>${f.desc}</span></div><span class="p">${f.price ? '+' + kc(f.price) + ' / kolo' : 'v ceně'}</span></button>`).join('')}</div>
      <h4>Límec</h4>
      <div class="chips">${O.LIPS.map(l => `<button class="chip ${S.lip === l.id ? 'active' : ''}" data-set="lip" data-val="${l.id}"><span>${l.name}${l.price ? ' · +' + kc(l.price) : ''}</span></button>`).join('')}</div>
      <h4>Středová krytka</h4>
      <div class="chips">${O.CAPS.map(c => `<button class="chip ${S.cap === c.id ? 'active' : ''}" data-set="cap" data-val="${c.id}"><span>${c.name}${c.price ? ' · +' + kc(c.price) : ''}</span></button>`).join('')}</div>
      <h4>Individuální doplňky <em>za sadu</em></h4>
      <div class="opt-list">${EXTRAS.map(x => `<label class="check"><input type="checkbox" data-extra="${x.id}" ${S.extras.includes(x.id) ? 'checked' : ''}><div><b>${x.name}</b><span>${x.desc}</span></div><span class="p">+${kc(x.price)}</span></label>`).join('')}</div>`;
  }

  function panelSummary() {
    const p = price();
    const c = car(), d = design();
    const label = O.labelSVG({
      order: orderNo(), model: S.carDetail || c.name, design: `${d.name} · Series ${d.series}`, pos: 'FL – přední levé',
      size: `${S.d} × ${S.wf.toFixed(1)}"`, et: S.etf, pcd: S.pcd, cb: S.cb, color: colorName(),
      finish: `${O.find(O.FINISHES, S.finish).name}${S.lip !== 'same' ? ' + ' + O.find(O.LIPS, S.lip).name.toLowerCase() : ''}`,
      weight: `cíl ${S.weight.toFixed(1)} kg`, date: new Date().toISOString().slice(0, 10),
    });
    const extras = S.extras.map(id => EXTRAS.find(e => e.id === id)).filter(Boolean);
    return `<h2>05 · Souhrn</h2><p class="sub">Zkontroluj konfiguraci. Po odeslání ti připravíme technický výkres ke schválení, teprve pak začíná výroba.</p>
      <table class="spec">
        <tr><th>Vůz</th><td>${esc(c.name)}${S.carDetail ? '<br><span class="muted">' + esc(S.carDetail) + '</span>' : ''}</td></tr>
        <tr><th>Design</th><td>${esc(d.name)} · Series ${d.series} · ${d.pieces === 3 ? '3-dílné' : 'monoblok'}</td></tr>
        <tr><th>Přední</th><td>${esc(sizeF())}</td></tr>
        <tr><th>Zadní</th><td>${esc(sizeR())}</td></tr>
        <tr><th>PCD / CB</th><td>${esc(S.pcd)} / ${S.cb} mm</td></tr>
        <tr><th>Barva</th><td>${esc(colorName())} · ${O.find(O.FINISHES, S.finish).name}</td></tr>
        <tr><th>Límec</th><td>${O.find(O.LIPS, S.lip).name}</td></tr>
        <tr><th>Krytka</th><td>${O.find(O.CAPS, S.cap).name}</td></tr>
        <tr><th>Cílová váha</th><td>${S.weight.toFixed(1)} kg <span class="muted">(odhad ~${weightEst()} kg)</span></td></tr>
        <tr><th>Doplňky</th><td>${extras.length ? extras.map(e => esc(e.name)).join(', ') : '<span class="muted">žádné</span>'}</td></tr>
        ${S.note ? `<tr><th>Poznámka</th><td>${esc(S.note)}</td></tr>` : ''}
      </table>
      <h4>OARTS štítek <em>náhled</em></h4>
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
        <div class="field"><label>Jméno</label><input type="text" data-set="name" data-type="text" value="${esc(S.name)}" placeholder="Jméno a příjmení"></div>
        <div class="form-row">
          <div class="field"><label>E-mail</label><input type="email" data-set="email" data-type="text" value="${esc(S.email)}" placeholder="ty@email.cz"></div>
          <div class="field"><label>Telefon</label><input type="tel" data-set="phone" data-type="text" value="${esc(S.phone)}" placeholder="+420"></div>
        </div>
      </div>
      <div class="actions">
        <a class="btn btn--primary" id="sendMail" href="#"><span>Odeslat poptávku e-mailem</span></a>
        <button class="btn" id="copySpec"><span>Kopírovat specifikaci</span></button>
        <button class="btn btn--ghost" id="shareLink"><span>Kopírovat odkaz na konfiguraci</span></button>
        <button class="btn btn--ghost" id="printSpec"><span>Uložit jako PDF / tisk</span></button>
        <div class="copied" id="copiedMsg"></div>
      </div>`;
  }

  function renderFoot() {
    const p = price();
    $('#panelFoot').innerHTML = `
      <div class="price"><div><small>Orientační cena · sada 4 kol · bez DPH</small><b>${kc(p.total)}</b></div><div class="per">${kc(p.perWheel)} / kolo<br>~${weightEst()} kg / kolo</div></div>
      <div class="panel-nav">
        <button class="btn btn--ghost" id="prevStep" ${S.step === 1 ? 'disabled' : ''}><span>← Zpět</span></button>
        ${S.step < 5 ? `<button class="btn btn--primary" id="nextStep"><span>${STEPS[S.step]} →</span></button>` : `<a class="btn btn--primary" id="sendMail2" href="#"><span>Odeslat poptávku</span></a>`}
      </div>`;
  }

  /* ---------- specifikace jako text ---------- */
  function specText() {
    const p = price(), c = car(), d = design();
    const extras = S.extras.map(id => (EXTRAS.find(e => e.id === id) || {}).name).filter(Boolean);
    return [
      'OARTS – POPTÁVKA CUSTOM FORGED KOL',
      '==================================',
      `Vůz: ${c.name}${S.carDetail ? ' – ' + S.carDetail : ''} (barva: ${O.find(O.BODY_COLORS, S.bodyColor).name})`,
      `Design: ${d.name} · Series ${d.series} · ${d.pieces === 3 ? '3-dílné' : 'monoblok'}`,
      `Přední: ${sizeF()}`,
      `Zadní: ${sizeR()}`,
      `PCD / CB: ${S.pcd} / ${S.cb} mm`,
      `Barva: ${colorName()} · Povrch: ${O.find(O.FINISHES, S.finish).name}`,
      `Límec: ${O.find(O.LIPS, S.lip).name} · Krytka: ${O.find(O.CAPS, S.cap).name}`,
      `Cílová váha: ${S.weight.toFixed(1)} kg (odhad ~${weightEst()} kg)`,
      `Doplňky: ${extras.length ? extras.join(', ') : 'žádné'}`,
      S.note ? `Poznámka: ${S.note}` : null,
      '',
      `Orientační cena: ${kc(p.total)} bez DPH (${kc(p.perWheel)} / kolo)`,
      '',
      `Kontakt: ${S.name || '-'} · ${S.email || '-'} · ${S.phone || '-'}`,
      `Odkaz na konfiguraci: ${shareURL()}`,
    ].filter(l => l !== null).join('\n');
  }
  function mailtoHref() {
    return `mailto:${O.EMAIL}?subject=${encodeURIComponent(`Poptávka OARTS – ${car().name} × ${design().name} ${S.d}"`)}&body=${encodeURIComponent(specText())}`;
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
    if (opts.stage !== false) renderStageView();
    renderStageFoot();
    if (opts.panel !== false) renderPanel(); else renderFoot();
    if (opts.steps) renderSteps();
    if (opts.head) $('#stageHead').querySelector('h1').innerHTML = `<small>Konfigurátor · krok ${S.step} / 5</small>${esc(car().name)} <span class="accent">×</span> ${esc(design().name)}`;
  }
  function goStep(n) {
    S.step = Math.min(5, Math.max(1, n));
    writeURL();
    renderSteps(); renderStage(); renderPanel();
    if (window.innerWidth <= 900) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- události (delegace) ---------- */
  document.addEventListener('click', e => {
    const step = e.target.closest('[data-step]');
    if (step) return goStep(Number(step.dataset.step));
    const view = e.target.closest('[data-view]');
    if (view) { S.view = view.dataset.view; renderStage(); return; }
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
      if (key === 'color') { /* vlastní barva se drží v colorHex */ }
      update({ head: key === 'car' || key === 'design' });
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'customColor') { S.color = 'custom'; S.colorHex = t.value; update({ panel: false }); return; }
    if (t.dataset.set) {
      const key = t.dataset.set;
      const val = t.dataset.type === 'num' ? Number(t.value) : t.value;
      S[key] = val;
      if (!S.stag && key === 'wf') S.wr = val;
      if (!S.stag && key === 'etf') S.etr = val;
      const out = t.parentElement && t.parentElement.querySelector('output');
      if (out) out.textContent = key.startsWith('et') ? 'ET' + val : key === 'weight' ? val.toFixed(1) + ' kg' : val.toFixed(1) + '"';
      /* pole s živou hodnotou nepřekreslujeme (aby posuvník neztratil fokus) */
      writeURL(); renderStageFoot(); renderFoot();
      const h4 = t.closest('.field') && t.closest('.field').parentElement && t.closest('.field').parentElement.previousElementSibling;
      if (h4 && h4.tagName === 'H4' && h4.querySelector('em')) {
        if (key === 'wf' || key === 'wr') h4.querySelector('em').textContent = `${S.wf.toFixed(1)}" ${S.stag ? '/ ' + S.wr.toFixed(1) + '"' : ''}`;
        if (key === 'etf' || key === 'etr') h4.querySelector('em').textContent = `ET${S.etf}${S.stag ? ' / ET' + S.etr : ''}`;
      }
      if (key === 'weight') { const em = t.closest('.range').previousElementSibling.querySelector('em'); if (em) em.textContent = val.toFixed(1) + ' kg'; }
      if (key === 'pcd') update({ panel: false });
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'spinToggle') { S.spin = t.checked; renderStageView(); return; }
    if (t.id === 'stagToggle') { S.stag = t.checked; if (!S.stag) { S.wr = S.wf; S.etr = S.etf; } update({ stage: false }); return; }
    if (t.dataset.extra) {
      const id = t.dataset.extra;
      S.extras = t.checked ? [...new Set([...S.extras, id])] : S.extras.filter(x => x !== id);
      writeURL(); renderFoot(); return;
    }
    if (t.dataset.set === 'cb') { S.cb = Number(t.value) || S.cb; writeURL(); renderStageFoot(); }
  });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight' && S.step < 5) goStep(S.step + 1);
    if (e.key === 'ArrowLeft' && S.step > 1) goStep(S.step - 1);
  });

  /* ---------- start ---------- */
  applyCarDefaults(car());
  readURL();
  writeURL();
  renderSteps(); renderStage(); renderPanel();
})();
