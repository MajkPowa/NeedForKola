/* ============================================================
   OARTS — procedurální SVG renderer kol
   Každé kolo se generuje z parametrů (design, barva, povrch,
   límec, středová krytka) — žádné obrázky.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- barvy ---------- */
  function hexToRgb(h) {
    h = String(h || '#888').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  /* amt > 0 zesvětlí, amt < 0 ztmaví */
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    if (amt >= 0) return rgbToHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]);
    return rgbToHex([r * (1 + amt), g * (1 + amt), b * (1 + amt)]);
  }
  function luma(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function polar(r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  function fmt(n) { return Math.round(n * 100) / 100; }
  /* mezikruhová výseč (pro třmen brzdy apod.) */
  function sector(rIn, rOut, a1, a2) {
    const [x1, y1] = polar(rOut, a1), [x2, y2] = polar(rOut, a2);
    const [x3, y3] = polar(rIn, a2), [x4, y4] = polar(rIn, a1);
    const large = (a2 - a1) > 180 ? 1 : 0;
    return `M ${fmt(x1)} ${fmt(y1)} A ${rOut} ${rOut} 0 ${large} 1 ${fmt(x2)} ${fmt(y2)} L ${fmt(x3)} ${fmt(y3)} A ${rIn} ${rIn} 0 ${large} 0 ${fmt(x4)} ${fmt(y4)} Z`;
  }

  /* ---------- katalog ---------- */
  const DESIGNS = [
    { id: 'mono5',    name: 'MONO 5',    series: 'M1', style: 'straight', spokes: 5,  base: 0,     pieces: 1, desc: 'Klasický pětipaprsek. Čistý, agresivní, nadčasový.' },
    { id: 'deep7',    name: 'DEEP 7',    series: 'C2', style: 'concave',  spokes: 7,  base: 3500,  pieces: 1, desc: 'Hluboký konkáv s ostrou hranou. Vrhá stíny jako nůž.' },
    { id: 'yfork10',  name: 'Y-FORK 10', series: 'Y3', style: 'y',        spokes: 10, base: 4200,  pieces: 1, desc: 'Vidlicové paprsky. Lehká konstrukce s motorsport DNA.' },
    { id: 'twist9',   name: 'TWIST 9',   series: 'T4', style: 'twist',    spokes: 9,  base: 3900,  pieces: 1, desc: 'Směrové zakřivené paprsky. Levá a pravá strana zrcadlově.' },
    { id: 'mesh30',   name: 'MESH 30',   series: 'X5', style: 'mesh',     spokes: 15, spokesLabel: '30 paprsků (15 křížů)', base: 5200,  pieces: 1, desc: 'Křížová mřížka. Ikona osmdesátek, znovu vykovaná.' },
    { id: 'split6',   name: 'SPLIT 6',   series: 'S6', style: 'split',    spokes: 6,  base: 3200,  pieces: 1, desc: 'Dvojité paprsky s mezerou. Šest párů čisté geometrie.' },
    { id: 'turbine8', name: 'TURBINE 8', series: 'R7', style: 'turbine',  spokes: 8,  base: 4800,  pieces: 1, desc: 'Lopatky turbíny. Vypadá rychle, i když stojí.' },
    { id: 'blade12',  name: 'BLADE 12',  series: 'B8', style: 'blade',    spokes: 12, base: 3600,  pieces: 1, desc: 'Dvanáct tenkých čepelí. Maximální průhled na brzdy.' },
    { id: 'star5',    name: 'STAR 5',    series: 'K9', style: 'star',     spokes: 5,  base: 2800,  pieces: 1, desc: 'Široké hvězdicové paprsky. Masivní a pevné.' },
    { id: 'concave9', name: 'CONCAVE 9', series: 'C2', style: 'concave',  spokes: 9,  base: 4100,  pieces: 1, desc: 'Devět konkávních paprsků. Hutný, sportovní profil.' },
    { id: 'dish3pc',  name: 'DISH 3PC',  series: 'D3', style: 'dish',     spokes: 5,  base: 9000,  pieces: 3, lipInner: 58, desc: 'Třídílné kolo s hlubokým leštěným límcem. Stance klasika.' },
    { id: 'mesh3pc',  name: 'MESH 3PC',  series: 'D3', style: 'mesh',     spokes: 15, spokesLabel: '30 paprsků (15 křížů)', base: 11500, pieces: 3, lipInner: 60, desc: 'Třídílná mřížka s límcem. Retro na maximum.' },
  ];

  const COLORS = [
    { id: 'gunmetal', name: 'Gunmetal',      hex: '#4a4d53' },
    { id: 'black',    name: 'Deep Black',    hex: '#141416' },
    { id: 'silver',   name: 'Hyper Silver',  hex: '#b9bcc2' },
    { id: 'white',    name: 'Pearl White',   hex: '#e8e8ea' },
    { id: 'bronze',   name: 'Bronze',        hex: '#9a6d3a' },
    { id: 'gold',     name: 'Gold',          hex: '#c9a13b' },
    { id: 'copper',   name: 'Copper',        hex: '#b26a3c' },
    { id: 'red',      name: 'Candy Red',     hex: '#b3121f' },
    { id: 'blue',     name: 'Midnight Blue', hex: '#1c3a7a' },
    { id: 'green',    name: 'British Green', hex: '#174a35' },
    { id: 'purple',   name: 'Ultraviolet',   hex: '#4a1f7a' },
    { id: 'orange',   name: 'Fury Orange',   hex: '#ff4d1c' },
  ];

  const FINISHES = [
    { id: 'gloss',   name: 'Gloss',   desc: 'Vysoký lesk',        price: 0 },
    { id: 'satin',   name: 'Satin',   desc: 'Hedvábný polomat',   price: 0 },
    { id: 'matte',   name: 'Matte',   desc: 'Hluboký mat',        price: 0 },
    { id: 'brushed', name: 'Brushed', desc: 'Kartáčovaný hliník', price: 2200 },
    { id: 'chrome',  name: 'Chrome',  desc: 'Zrcadlový chrom',    price: 6500 },
  ];

  const LIPS = [
    { id: 'same',     name: 'Shodný s kolem',  price: 0 },
    { id: 'polished', name: 'Leštěný límec',   price: 1500 },
    { id: 'machined', name: 'Frézovaný límec', price: 1800 },
    { id: 'black',    name: 'Černý límec',     price: 900 },
  ];

  const CAPS = [
    { id: 'black',  name: 'Černá krytka',      price: 0 },
    { id: 'silver', name: 'Stříbrná krytka',   price: 0 },
    { id: 'body',   name: 'V barvě kola',      price: 600 },
    { id: 'carbon', name: 'Karbonová krytka',  price: 3900 },
    { id: 'none',   name: 'Bez krytky (open)', price: 0 },
  ];

  const find = (list, id, fallback) => list.find(x => x.id === id) || list[fallback || 0];
  const HEX = /^#[0-9a-f]{6}$/i;

  /* ---------- gradienty povrchů ---------- */
  function faceFill(id, color, finish) {
    const L = shade(color, .55), l = shade(color, .2), d = shade(color, -.3), D = shade(color, -.6);
    switch (finish) {
      case 'satin':
        return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="-30" cy="-40" r="150"><stop offset="0" stop-color="${l}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${d}"/></radialGradient>`;
      case 'matte':
        return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100"><stop offset="0" stop-color="${shade(color, .05)}"/><stop offset=".75" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -.18)}"/></radialGradient>`;
      case 'chrome':
        return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="-80" y1="-80" x2="80" y2="80"><stop offset="0" stop-color="${shade(color, .92)}"/><stop offset=".22" stop-color="${shade(color, .25)}"/><stop offset=".45" stop-color="${shade(color, .9)}"/><stop offset=".62" stop-color="${shade(color, -.45)}"/><stop offset=".8" stop-color="${shade(color, .6)}"/><stop offset="1" stop-color="${shade(color, -.2)}"/></linearGradient>`;
      case 'brushed':
        return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="-60" y1="-90" x2="60" y2="90"><stop offset="0" stop-color="${shade(color, .3)}"/><stop offset=".3" stop-color="${color}"/><stop offset=".5" stop-color="${shade(color, -.22)}"/><stop offset=".7" stop-color="${shade(color, .05)}"/><stop offset="1" stop-color="${shade(color, .25)}"/></linearGradient>`;
      default: /* gloss */
        return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="-35" cy="-45" r="165"><stop offset="0" stop-color="${L}"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="${D}"/></radialGradient>`;
    }
  }
  const HIGHLIGHT = { gloss: .26, satin: .13, matte: 0, chrome: .38, brushed: .1 };

  function lipSpec(lipId, color, finish) {
    switch (lipId) {
      case 'polished': return { color: '#c9ccd1', finish: 'chrome' };
      case 'machined': return { color: '#b4b7bc', finish: 'brushed' };
      case 'black':    return { color: '#141416', finish: 'gloss' };
      default:         return { color, finish };
    }
  }

  /* ---------- geometrie paprsků (lokálně: paprsek míří nahoru) ---------- */
  function spokeShapes(style, r0, r1) {
    const m = -(r0 + (r1 - r0) * 0.48);
    switch (style) {
      case 'concave':
        return [
          { d: `M -12 ${-r0} L -8 ${-r1} L 0 ${-r1} L 0 ${-r0} Z` },
          { d: `M 0 ${-r0} L 0 ${-r1} L 8 ${-r1} L 12 ${-r0} Z`, dark: .32 },
          { d: `M 0 ${-r0} L 0 ${-r1}`, edge: true },
        ];
      case 'y':
        return [
          { d: `M -9 ${-r0} L -7 ${m} L 7 ${m} L 9 ${-r0} Z` },
          { d: `M -7 ${m + 2} L -19 ${-r1} L -8 ${-r1} L 3 ${m + 8} Z` },
          { d: `M 7 ${m + 2} L 19 ${-r1} L 8 ${-r1} L -3 ${m + 8} Z`, dark: .22 },
        ];
      case 'twist':
        return [
          { d: `M -9 ${-r0} Q -28 ${m} -7 ${-r1} L 5 ${-r1} Q -9 ${m} 9 ${-r0} Z` },
          { d: `M -9 ${-r0} Q -28 ${m} -7 ${-r1}`, edge: true },
        ];
      case 'turbine':
        return [
          { d: `M -15 ${-r0} Q -46 ${m} -15 ${-r1} L 3 ${-r1} Q -18 ${m} 15 ${-r0} Z` },
          { d: `M -15 ${-r0} Q -46 ${m} -15 ${-r1}`, edge: true },
        ];
      case 'split':
        return [
          { d: `M -12 ${-r0} L -10 ${-r1} L -3 ${-r1} L -3 ${-r0} Z` },
          { d: `M 3 ${-r0} L 3 ${-r1} L 10 ${-r1} L 12 ${-r0} Z`, dark: .18 },
        ];
      case 'blade':
        return [{ d: `M -7 ${-r0} L -3.5 ${-r1} L 3.5 ${-r1} L 7 ${-r0} Z` }, { d: `M -7 ${-r0} L -3.5 ${-r1}`, edge: true }];
      case 'mesh':
        return [
          { d: `M -4 ${-r0} L -17 ${-r1} L -11 ${-r1} L 2 ${-r0} Z` },
          { d: `M 4 ${-r0} L 17 ${-r1} L 11 ${-r1} L -2 ${-r0} Z`, dark: .2 },
        ];
      case 'star':
        return [
          { d: `M -18 ${-r0} L -7 ${-r1} L 0 ${-r1} L 0 ${-r0} Z` },
          { d: `M 0 ${-r0} L 0 ${-r1} L 7 ${-r1} L 18 ${-r0} Z`, dark: .28 },
        ];
      case 'dish':
        return [
          { d: `M -11 ${-r0} L -8 ${-r1} L 8 ${-r1} L 11 ${-r0} Z` },
          { d: `M -11 ${-r0} L -8 ${-r1}`, edge: true },
        ];
      default: /* straight */
        return [
          { d: `M -11 ${-r0} L -7.5 ${-r1} L 7.5 ${-r1} L 11 ${-r0} Z` },
          { d: `M -11 ${-r0} L -7.5 ${-r1}`, edge: true },
        ];
    }
  }

  /* ---------- vykreslení skupiny kola (souřadnice -100..100) ---------- */
  function wheelGroup(o, id, rot) {
    o = o || {};
    id = id || 'w';
    rot = rot || 0;
    const design = find(DESIGNS, o.design);
    /* barva se do SVG dostane jen jako platný #rrggbb – nikdy syrový text z URL */
    const color = HEX.test(o.colorHex || '') ? o.colorHex.toLowerCase() : find(COLORS, o.color).hex;
    const finish = FINISHES.some(f => f.id === o.finish) ? o.finish : 'gloss';
    const lip = lipSpec(o.lip || 'same', color, finish);
    const lipInner = design.lipInner || 74;
    /* špička paprsku má půlšířku tipX; r1 zkrátíme tak, aby ani roh špičky nepřesáhl otvor límce */
    const tipX = { y: 19, mesh: 17, turbine: 15, star: 7, dish: 8 }[design.style] || 11;
    const r0 = 22, r1 = Math.round((Math.sqrt(lipInner * lipInner - tipX * tipX) - 1) * 10) / 10;
    const bolts = Math.min(8, Math.max(4, parseInt(o.bolts, 10) || 5));
    const mirror = o.mirror ? -1 : 1;
    const spinDur = Number(o.spin) > 0 ? Number(o.spin) : 0;
    const spinAnim = spinDur ? `<animateTransform attributeName="transform" type="rotate" from="${rot}" to="${rot + 360}" dur="${spinDur}s" repeatCount="indefinite"/>` : '';

    const defs = [
      faceFill(id + 'f', color, finish),
      faceFill(id + 'l', lip.color, lip.finish),
      `<radialGradient id="${id}t" cx=".5" cy=".5" r=".5"><stop offset=".8" stop-color="#2a2a2d"/><stop offset=".92" stop-color="#18181a"/><stop offset="1" stop-color="#0a0a0b"/></radialGradient>`,
      `<radialGradient id="${id}d" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2c2c31"/><stop offset=".55" stop-color="#3b3b41"/><stop offset=".6" stop-color="#26262b"/><stop offset="1" stop-color="#1a1a1e"/></radialGradient>`,
      `<radialGradient id="${id}h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
      `<clipPath id="${id}c"><circle r="80"/></clipPath>`,
      `<pattern id="${id}cf" patternUnits="userSpaceOnUse" width="4" height="4"><rect width="4" height="4" fill="#161618"/><path d="M0 0h2v2H0z M2 2h2v2H2z" fill="#2a2a2e"/></pattern>`,
    ].join('');

    /* pneumatika */
    let tread = '';
    for (let i = 0; i < 40; i++) {
      tread += `<rect x="-2.2" y="-101" width="4.4" height="6" rx="1" fill="#0b0b0c" transform="rotate(${i * 9})"/>`;
    }
    const tire = `<circle r="100" fill="url(#${id}t)"/><g class="tread">${spinAnim}${tread}</g><circle r="88" fill="none" stroke="#111" stroke-width="1.2"/><circle r="82" fill="none" stroke="#000" stroke-width="2" opacity=".6"/>`;

    /* límec + dutina + brzda */
    let pieces = '';
    if (design.pieces === 3) {
      for (let i = 0; i < 24; i++) {
        const [x, y] = polar(lipInner + 4, i * 15);
        pieces += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="1.5" fill="#1a1a1c" stroke="${shade(lip.color, .45)}" stroke-width=".5"/>`;
      }
    }
    const lipSvg = `<circle r="80" fill="url(#${id}l)"/><circle r="80" fill="none" stroke="#000" stroke-width=".8" opacity=".5"/><circle r="${lipInner + 1}" fill="none" stroke="${shade(lip.color, -.55)}" stroke-width="1.2"/>${pieces}<circle r="${lipInner}" fill="#09090b"/>`;

    let vents = '';
    for (let i = 0; i < 10; i++) {
      vents += `<rect x="-1.6" y="${-(lipInner - 12)}" width="3.2" height="14" rx="1.5" fill="#141417" transform="rotate(${i * 36 + 18})"/>`;
    }
    /* třmen se přizpůsobí hloubce límce (u 3-dílných kol je prstenec užší) */
    const cOut = lipInner - 8, cIn = Math.min(38, cOut - 16);
    const caliper = `<path d="${sector(cIn, cOut, 20, 62)}" fill="#c8141c"/><path d="${sector(cIn + 2, cOut - 2, 24, 58)}" fill="none" stroke="#7d0a10" stroke-width="1"/><path d="${sector(cIn + 6, cOut - 6, 30, 52)}" fill="#a10f16"/>`;
    const brake = `<circle r="${lipInner - 4}" fill="url(#${id}d)"/>${vents}<circle r="30" fill="#202024"/><circle r="${lipInner - 4}" fill="none" stroke="#111" stroke-width="1"/>${caliper}`;

    /* paprsky */
    const shapes = spokeShapes(design.style, r0, r1);
    let spokes = '';
    const step = 360 / design.spokes;
    for (let i = 0; i < design.spokes; i++) {
      let s = '';
      shapes.forEach(sh => {
        if (sh.edge) {
          s += `<path d="${sh.d}" fill="none" stroke="${shade(color, finish === 'matte' ? .12 : .5)}" stroke-width="1" opacity=".7"/>`;
        } else {
          s += `<path d="${sh.d}" fill="url(#${id}f)"/>`;
          if (sh.dark) s += `<path d="${sh.d}" fill="#000" opacity="${sh.dark}"/>`;
          s += `<path d="${sh.d}" fill="none" stroke="#000" stroke-width=".6" opacity=".35"/>`;
        }
      });
      spokes += `<g transform="scale(${mirror} 1) rotate(${fmt(i * step)})">${s}</g>`;
    }

    /* náboj + šrouby + krytka */
    let boltsSvg = '';
    for (let i = 0; i < bolts; i++) {
      const [x, y] = polar(15.5, i * 360 / bolts);
      boltsSvg += `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="2.4" fill="#1a1a1c" stroke="${shade(color, .45)}" stroke-width=".6"/>`;
    }
    let cap = '';
    const capId = o.cap || 'black';
    if (capId !== 'none') {
      const capFill = capId === 'silver' ? '#c5c8cd' : capId === 'body' ? color : capId === 'carbon' ? `url(#${id}cf)` : '#111113';
      const light = capId === 'silver' || (capId === 'body' && luma(color) > .55);
      const logo = light ? '#111' : '#ff4d1c';
      cap = `<circle r="9.5" fill="${capFill}" stroke="${shade(color, .4)}" stroke-width=".8"/><circle r="4.2" fill="none" stroke="${logo}" stroke-width="1.6"/>`;
    } else {
      cap = `<circle r="9" fill="#0c0c0e"/><circle r="5" fill="#1d1d21"/>`;
    }
    const hub = `<circle r="${r0 + 4}" fill="url(#${id}f)"/><circle r="${r0 + 4}" fill="none" stroke="#000" stroke-width=".7" opacity=".45"/><circle r="${r0 - 4}" fill="none" stroke="${shade(color, -.35)}" stroke-width="1"/>${boltsSvg}${cap}`;

    /* odlesk */
    const hl = HIGHLIGHT[finish] || 0;
    const highlight = hl ? `<g clip-path="url(#${id}c)"><ellipse cx="-34" cy="-40" rx="52" ry="24" transform="rotate(-42 -34 -40)" fill="url(#${id}h)" opacity="${hl}"/></g>` : '';

    const spokesOpen = spinAnim ? `<g class="spokes">${spinAnim}` : `<g class="spokes" transform="rotate(${rot})">`;
    return `<g class="wheel"><defs>${defs}</defs>${tire}${lipSvg}${brake}${spokesOpen}${spokes}${hub}</g>${highlight}</g>`;
  }

  function renderWheel(o, id, attrs) {
    return `<svg viewBox="-104 -104 208 208" xmlns="http://www.w3.org/2000/svg" ${attrs || ''}>${wheelGroup(o, id, 0)}</svg>`;
  }

  global.OARTS = global.OARTS || {};
  Object.assign(global.OARTS, {
    DESIGNS, COLORS, FINISHES, LIPS, CAPS,
    wheelGroup, renderWheel, shade, luma, find, polar, fmt,
  });
})(window);
