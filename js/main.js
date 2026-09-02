/* ============================================================
   OARTS — společné chování webu (nav, reveal, hero, galerie, štítek)
   ============================================================ */
(function () {
  'use strict';
  const O = window.OARTS;
  O.EMAIL = 'info@oarts.cz';          /* <- kontaktní e-mail (poptávky) */
  O.PHONE = '+420 777 000 000';       /* <- telefon */

  /* ---------- navigace ---------- */
  const nav = document.querySelector('.nav');
  const burger = document.querySelector('.burger');
  if (burger) burger.addEventListener('click', () => nav.classList.toggle('open'));
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav__links a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('open'));
    const href = (a.getAttribute('href') || '').split('#')[0].toLowerCase();
    if (href && href === here) a.classList.add('active');
  });

  /* ---------- reveal při scrollu ---------- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  const observe = root => (root || document).querySelectorAll('.reveal').forEach(el => io.observe(el));
  observe();

  /* ---------- pomocník: roztočení paprsků v hotovém SVG ---------- */
  O.spin = (svg, dur) => svg.replace(
    '<g class="spokes" transform="rotate(0)">',
    `<g class="spokes"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${dur}s" repeatCount="indefinite"/>`
  );

  /* ---------- OARTS štítek (SVG) ---------- */
  O.labelSVG = function (d) {
    const rows = [
      ['MODEL', d.model], ['DESIGN', d.design], ['POZICE', d.pos], ['ROZMĚR', d.size],
      ['ET / PCD / CB', `ET${d.et} / ${d.pcd} / ${d.cb}`], ['BARVA', d.color], ['POVRCH', d.finish], ['VÁHA', d.weight],
    ];
    let seed = 7;
    for (const ch of String(d.order)) seed = (seed * 31 + ch.charCodeAt(0)) & 0xffff;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
    let bars = '', x = 20;
    for (let i = 0; i < 60; i++) { const w = 1 + (rnd() >> 4) % 3; if ((rnd() >> 8) % 2) bars += `<rect x="${x}" y="186" width="${w}" height="30" fill="#111"/>`; x += w + 1; }
    let qr = '';
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const finder = (r < 2 && c < 2) || (r > 4 && c < 2) || (r < 2 && c > 4);
      if (finder || (rnd() >> 9) % 2) qr += `<rect x="${316 + c * 9}" y="${62 + r * 9}" width="8" height="8" fill="#111"/>`;
    }
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" font-family="'Barlow Condensed','Arial Narrow',Arial,sans-serif">
      <rect width="400" height="240" fill="#fff"/>
      <rect width="400" height="44" fill="#111"/>
      <rect y="44" width="400" height="4" fill="#ff4d1c"/>
      <text x="18" y="32" font-size="28" font-weight="700" fill="#fff" letter-spacing="5">OARTS</text>
      <text x="126" y="31" font-size="11" fill="#bbb" letter-spacing="3">CUSTOM FORGED WHEELS</text>
      <text x="382" y="31" font-size="14" fill="#ff4d1c" font-weight="700" text-anchor="end" letter-spacing="2">${esc(d.order)}</text>
      ${rows.map(([k, v], i) => `<text x="20" y="${72 + i * 14}" font-size="8.5" fill="#777" letter-spacing="2">${esc(k)}</text><text x="118" y="${72 + i * 14}" font-size="12" font-weight="700" fill="#111">${esc(v)}</text>`).join('')}
      ${qr}
      <text x="347" y="140" font-size="7" fill="#777" text-anchor="middle" letter-spacing="1">SCAN · SPEC SHEET</text>
      ${bars}
      <text x="20" y="230" font-size="8" fill="#777" letter-spacing="2">${esc(d.order)} · ${esc(d.date)} · OARTS.CZ</text>
      <text x="382" y="230" font-size="8" fill="#111" font-weight="700" text-anchor="end" letter-spacing="2">MADE TO ORDER</text>
    </svg>`;
  };

  /* ---------- hero kolo ---------- */
  const hero = document.getElementById('heroWheel');
  if (hero) {
    const combos = [
      { design: 'deep7', color: 'gunmetal', finish: 'gloss', lip: 'polished' },
      { design: 'yfork10', color: 'bronze', finish: 'satin' },
      { design: 'mesh3pc', color: 'gold', finish: 'gloss', lip: 'polished' },
      { design: 'turbine8', color: 'black', finish: 'gloss', lip: 'machined' },
      { design: 'twist9', color: 'silver', finish: 'chrome' },
      { design: 'dish3pc', color: 'red', finish: 'gloss', lip: 'polished', cap: 'body' },
      { design: 'concave9', color: 'white', finish: 'satin', lip: 'black' },
    ];
    const tag = document.getElementById('heroTag');
    let i = 0;
    const draw = () => {
      hero.innerHTML = O.spin(O.renderWheel(combos[i], 'hero' + i), 7);
      if (tag) {
        const d = O.find(O.DESIGNS, combos[i].design);
        tag.innerHTML = `<b>${d.name}</b>Series ${d.series} · ${O.find(O.COLORS, combos[i].color).name} · ${O.find(O.FINISHES, combos[i].finish).name}`;
      }
    };
    draw();
    setInterval(() => {
      hero.classList.add('swap');
      setTimeout(() => { i = (i + 1) % combos.length; draw(); hero.classList.remove('swap'); }, 260);
    }, 4200);
  }

  /* ---------- karty aut ---------- */
  const cg = document.getElementById('carsGrid');
  if (cg) {
    const wheelCols = ['gunmetal', 'black', 'silver', 'bronze', 'gunmetal', 'gold', 'black'];
    const wheelDes = ['deep7', 'yfork10', 'turbine8', 'blade12', 'star5', 'mesh30', 'twist9'];
    cg.innerHTML = O.CARS.map((c, i) => {
      const body = O.find(O.BODY_COLORS, c.fit.bodyColor).hex;
      const wheel = { design: wheelDes[i], color: wheelCols[i], finish: 'gloss', lip: i % 2 ? 'polished' : 'same' };
      return `<a class="car-card reveal" data-n="0${i + 1}" data-delay="${i % 3}" href="konfigurator.html?car=${c.id}">
        <span class="tag">${c.tag}</span>${O.carSVG(c, body, wheel, 'cg' + i)}
        <h3>${c.name}</h3><p>${c.fits}</p></a>`;
    }).join('');
    observe(cg);
  }

  /* ---------- galerie designů ---------- */
  const dg = document.getElementById('designsGrid');
  if (dg) {
    const cols = ['gunmetal', 'bronze', 'black', 'silver', 'gold', 'blue', 'red', 'white', 'copper', 'green', 'purple', 'orange'];
    const fins = ['gloss', 'satin', 'gloss', 'chrome', 'gloss', 'gloss', 'gloss', 'satin', 'brushed', 'matte', 'gloss', 'satin'];
    dg.innerHTML = O.DESIGNS.map((d, i) => `<a class="design-card reveal" data-delay="${i % 3}" href="konfigurator.html?design=${d.id}&color=${cols[i]}&finish=${fins[i]}">
      <span class="series">SERIES ${d.series}</span>
      ${O.renderWheel({ design: d.id, color: cols[i], finish: fins[i], lip: d.pieces === 3 ? 'polished' : 'same' }, 'dg' + i)}
      <b>${d.name}</b><span>${d.pieces === 3 ? '3-dílné' : 'monoblok'} · ${d.spokes} paprsků</span></a>`).join('');
    observe(dg);
  }

  /* ---------- ukázkový štítek na homepage ---------- */
  const lm = document.getElementById('labelMock');
  if (lm) {
    lm.innerHTML = O.labelSVG({
      order: 'OA-2409-117', model: 'Porsche 911 Carrera 4S (992)', design: 'DEEP 7 · Series C2', pos: 'FL – přední levé',
      size: '21 × 9.0"', et: 50, pcd: '5x130', cb: '71.6', color: 'Gunmetal', finish: 'Gloss + leštěný límec', weight: '10.4 kg', date: '2026-09-02',
    });
  }

  /* ---------- kontaktní formulář → mailto ---------- */
  const cf = document.getElementById('contactForm');
  if (cf) {
    cf.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(cf);
      const body = [
        `Jméno: ${f.get('name') || ''}`, `E-mail: ${f.get('email') || ''}`, `Telefon: ${f.get('phone') || ''}`,
        `Vůz: ${f.get('car') || ''}`, '', 'Zpráva:', f.get('msg') || '',
      ].join('\n');
      location.href = `mailto:${O.EMAIL}?subject=${encodeURIComponent('Poptávka OARTS – ' + (f.get('car') || 'custom kola'))}&body=${encodeURIComponent(body)}`;
    });
  }

  /* ---------- rok v patičce, kontakty ---------- */
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  document.querySelectorAll('[data-email]').forEach(el => { el.textContent = O.EMAIL; if (el.tagName === 'A') el.href = 'mailto:' + O.EMAIL; });
  document.querySelectorAll('[data-phone]').forEach(el => { el.textContent = O.PHONE; if (el.tagName === 'A') el.href = 'tel:' + O.PHONE.replace(/\s/g, ''); });
})();
