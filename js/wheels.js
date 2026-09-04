/* Need For Wheels — product data. No vector wheel stand-ins. */
(function (global) {
'use strict';
  const DESIGNS = [
    { id: 'apex10', name: 'FORGED 10', series: 'F10', style: 'straight', spokes: 10, base: 0, pieces: 1, desc: 'Deset štíhlých paprsků a hluboký konkáv podle dodaného bronzového kola.' },
    { id: 'mono5',    name: 'MONO 5',    series: 'M1', style: 'straight', spokes: 5,  base: 0,     pieces: 1, desc: 'Klasický pětipaprsek. Čistý, agresivní, nadčasový.' },
    { id: 'deep7',    name: 'DEEP 7',    series: 'C2', style: 'concave',  spokes: 7,  base: 3500,  pieces: 1, desc: 'Hluboký konkáv s ostrou hranou. Vrhá stíny jako nůž.' },
    { id: 'yfork10',  name: 'Y-FORK 10', series: 'Y3', style: 'y',        spokes: 10, base: 4200,  pieces: 1, desc: 'Vidlicové paprsky. Lehká konstrukce s motorsport DNA.' },
    { id: 'twist9',   name: 'TWIST 9',   series: 'T4', style: 'twist',    spokes: 9,  base: 3900,  pieces: 1, desc: 'Směrové zakřivené paprsky. Levá a pravá strana zrcadlově.' },
    { id: 'mesh30',   name: 'MESH 30',   series: 'X5', style: 'mesh',     spokes: 15, spokesLabel: '30 paprsků (15 křížů)', base: 5200,  pieces: 1, desc: 'Křížová mřížka. Ikona osmdesátek, znovu vykovaná.' },
    { id: 'split6',   name: 'SPLIT 6',   series: 'S6', style: 'split',    spokes: 6, spokesLabel: '12 paprsků (6 párů)', base: 3200, pieces: 1, desc: 'Dvojité paprsky s mezerou. Šest párů čisté geometrie.' },
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

  const escape = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const renderWheel = (opts = {}) => {
    const d = find(DESIGNS, opts.design);
    return `<img class="wheel-thumb" src="assets/renders/${d.id}.webp" alt="${escape(d.name)} — prostorový render disku" loading="lazy" width="384" height="384">`;
  };
  global.NFW = Object.assign(global.NFW || {}, { DESIGNS, COLORS, FINISHES, LIPS, CAPS, find, renderWheel });
})(window);
