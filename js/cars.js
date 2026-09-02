/* ============================================================
   OARTS — katalog vozů + SVG renderer bočního pohledu
   viewBox 0 0 1000 380, vozovka y = 326, auto jede doprava
   ============================================================ */
(function (global) {
  'use strict';
  const O = global.OARTS;

  const BODY_COLORS = [
    { id: 'white',  name: 'Arctic White',  hex: '#e9eaec' },
    { id: 'black',  name: 'Jet Black',     hex: '#17181b' },
    { id: 'nardo',  name: 'Nardo Grey',    hex: '#8d9196' },
    { id: 'silver', name: 'GT Silver',     hex: '#c3c6cb' },
    { id: 'red',    name: 'Racing Red',    hex: '#c41e2a' },
    { id: 'blue',   name: 'Estoril Blue',  hex: '#1f4fb3' },
    { id: 'green',  name: 'Signal Green',  hex: '#2a6b45' },
    { id: 'yellow', name: 'Speed Yellow',  hex: '#f2c12e' },
    { id: 'orange', name: 'Fury Orange',   hex: '#ff5a1f' },
    { id: 'purple', name: 'Ultraviolet',   hex: '#5b2a86' },
  ];

  const PCDS = ['4x100', '4x108', '5x100', '5x108', '5x110', '5x112', '5x114.3', '5x120', '5x130', '6x139.7'];

  const CARS = [
    {
      id: 'gt', name: 'GT COUPE', tag: 'Sportovní kupé', fits: 'Porsche 911 / Cayman, BMW M4, Mercedes-AMG GT',
      body: 'M 96 292 L 96 238 Q 98 206 130 198 Q 300 142 470 122 L 555 122 Q 640 126 715 168 L 850 182 Q 908 190 916 220 L 918 292 Z',
      glass: 'M 206 190 Q 330 146 470 134 L 552 134 Q 626 138 690 176 L 698 192 Z',
      pillars: ['M 470 134 L 470 194', 'M 560 134 L 566 194'],
      doors: ['M 556 196 Q 552 246 562 292'],
      handles: [[604, 214]],
      headlight: 'M 866 186 Q 906 190 912 214 L 900 216 Q 892 198 860 194 Z',
      taillight: 'M 100 212 L 134 205 L 136 221 L 100 228 Z',
      mirror: 'M 696 176 L 720 172 L 724 184 L 702 188 Z',
      extras: [
        { d: 'M 300 292 L 720 292', stroke: '#000', width: 3, opacity: .5 },
        { d: 'M 190 200 Q 500 186 850 186', stroke: '#fff', width: 1.5, opacity: .14 },
      ],
      wheels: { rx: 245, fx: 765, r: 52 },
      fit: { pcd: '5x130', cb: 71.6, diams: [19, 20, 21, 22], d: 21, wf: 9.0, wr: 11.5, etf: 50, etr: 62, weight: 10.5, bodyColor: 'white' },
    },
    {
      id: 'sedan', name: 'SPORT SEDAN', tag: 'Sportovní sedan', fits: 'BMW M3 / M5, Audi RS 4 / RS 6, Mercedes-AMG C / E',
      body: 'M 72 292 L 72 232 Q 74 206 100 200 L 168 196 Q 205 194 255 152 Q 290 128 380 126 L 560 126 Q 655 130 722 178 L 870 188 Q 918 192 924 222 L 926 292 Z',
      glass: 'M 204 194 Q 240 194 270 156 Q 300 138 385 137 L 555 137 Q 642 141 702 186 L 706 194 Z',
      pillars: ['M 385 137 L 383 194', 'M 555 137 L 560 194'],
      doors: ['M 300 194 Q 298 244 306 292', 'M 560 194 Q 558 244 566 292'],
      handles: [[470, 214], [620, 212]],
      headlight: 'M 878 192 Q 916 196 920 218 L 906 218 Q 898 204 872 200 Z',
      taillight: 'M 76 210 L 112 206 L 114 222 L 76 226 Z',
      mirror: 'M 704 180 L 728 176 L 732 188 L 710 192 Z',
      extras: [
        { d: 'M 300 292 L 740 292', stroke: '#000', width: 3, opacity: .5 },
        { d: 'M 170 200 Q 500 190 870 192', stroke: '#fff', width: 1.5, opacity: .14 },
      ],
      wheels: { rx: 235, fx: 770, r: 50 },
      fit: { pcd: '5x112', cb: 66.6, diams: [19, 20, 21], d: 20, wf: 9.5, wr: 10.5, etf: 25, etr: 28, weight: 10.8, bodyColor: 'nardo' },
    },
    {
      id: 'suv', name: 'PERFORMANCE SUV', tag: 'Sportovní SUV', fits: 'VW Tiguan / Touareg, Audi Q5 / Q8, Porsche Cayenne, BMW X5 / X6',
      body: 'M 62 296 L 62 205 Q 64 168 92 156 L 118 108 Q 126 94 152 92 L 630 90 Q 696 94 750 128 L 796 152 L 900 160 Q 938 168 942 206 L 944 296 Z',
      glass: 'M 126 152 L 142 112 Q 148 104 164 104 L 624 102 Q 682 106 730 134 L 764 154 Z',
      pillars: ['M 300 103 L 298 152', 'M 470 103 L 468 152', 'M 632 102 L 656 152'],
      doors: ['M 300 152 Q 298 224 306 296', 'M 470 152 Q 468 224 476 296'],
      handles: [[380, 188], [550, 186]],
      headlight: 'M 888 164 Q 928 172 934 202 L 918 202 Q 912 182 880 174 Z',
      taillight: 'M 66 190 L 98 184 L 98 216 L 66 220 Z',
      mirror: 'M 660 158 L 690 154 L 694 170 L 668 174 Z',
      extras: [
        { d: 'M 160 90 L 626 88', stroke: '#0e0e10', width: 5, opacity: 1 },
        { d: 'M 62 272 L 944 272 L 944 296 L 62 296 Z', fill: '#0f0f11', opacity: .7 },
        { d: 'M 120 158 Q 500 150 900 162', stroke: '#fff', width: 1.5, opacity: .12 },
      ],
      wheels: { rx: 220, fx: 790, r: 58 },
      fit: { pcd: '5x112', cb: 66.5, diams: [20, 21, 22, 23], d: 22, wf: 10.0, wr: 10.5, etf: 30, etr: 35, weight: 13.5, bodyColor: 'white' },
    },
    {
      id: 'hatch', name: 'HOT HATCH', tag: 'Ostrý hatchback', fits: 'VW Golf R / GTI, Audi RS 3, Honda Civic Type R, Toyota GR Yaris',
      body: 'M 122 292 L 122 214 Q 122 178 146 166 L 156 118 Q 162 98 190 96 L 540 94 Q 630 96 700 138 L 742 164 L 858 176 Q 896 184 900 216 L 902 292 Z',
      glass: 'M 168 164 L 178 116 Q 182 108 198 108 L 532 106 Q 610 108 674 150 L 712 166 Z',
      pillars: ['M 290 107 L 288 164', 'M 500 106 L 505 164'],
      doors: ['M 290 166 Q 288 230 296 292', 'M 505 166 Q 503 230 511 292'],
      handles: [[400, 198], [590, 196]],
      headlight: 'M 850 178 Q 890 186 894 214 L 880 214 Q 874 194 844 188 Z',
      taillight: 'M 126 186 L 152 176 L 154 214 L 126 218 Z',
      mirror: 'M 700 170 L 724 166 L 728 178 L 706 182 Z',
      extras: [
        { d: 'M 148 100 L 202 92 L 202 98 L 150 106 Z', fill: '#111114', opacity: 1 },
        { d: 'M 320 292 L 720 292', stroke: '#000', width: 3, opacity: .5 },
        { d: 'M 160 172 Q 500 164 860 178', stroke: '#fff', width: 1.5, opacity: .14 },
      ],
      wheels: { rx: 262, fx: 765, r: 50 },
      fit: { pcd: '5x112', cb: 57.1, diams: [18, 19, 20], d: 19, wf: 8.5, wr: 8.5, etf: 45, etr: 45, weight: 9.2, bodyColor: 'blue' },
    },
    {
      id: 'muscle', name: 'MUSCLE GT', tag: 'Americký muscle car', fits: 'Ford Mustang, Dodge Challenger, Chevrolet Camaro',
      body: 'M 66 292 L 66 226 Q 68 196 98 190 L 196 186 Q 320 152 392 122 Q 425 108 495 108 L 556 108 Q 618 112 676 150 L 716 168 L 876 174 Q 926 180 930 218 L 932 292 Z',
      glass: 'M 228 184 Q 330 160 400 132 Q 432 120 498 120 L 552 120 Q 606 124 656 156 L 696 178 Z',
      pillars: ['M 480 120 L 486 184'],
      doors: ['M 470 186 Q 468 240 476 292'],
      handles: [[530, 206]],
      headlight: 'M 878 176 Q 918 184 922 216 L 906 216 Q 900 194 870 186 Z',
      taillight: 'M 70 204 L 106 200 L 106 226 L 70 230 Z',
      mirror: 'M 690 172 L 716 168 L 720 180 L 696 184 Z',
      extras: [
        { d: 'M 70 186 L 200 178 L 200 186 L 72 194 Z', fill: '#111114', opacity: 1 },
        { d: 'M 730 170 Q 800 160 870 172', stroke: '#000', width: 1.5, opacity: .35 },
        { d: 'M 300 292 L 720 292', stroke: '#000', width: 3, opacity: .5 },
        { d: 'M 200 192 Q 500 176 870 182', stroke: '#fff', width: 1.5, opacity: .12 },
      ],
      wheels: { rx: 232, fx: 758, r: 54 },
      fit: { pcd: '5x114.3', cb: 70.5, diams: [19, 20, 21, 22], d: 20, wf: 10.0, wr: 11.0, etf: 35, etr: 45, weight: 11.4, bodyColor: 'black' },
    },
    {
      id: 'hyper', name: 'HYPERCAR', tag: 'Supersport', fits: 'Lamborghini Huracán, Ferrari 488 / F8, McLaren 720S',
      body: 'M 52 292 L 52 238 Q 54 208 92 202 L 210 196 Q 300 192 350 176 Q 400 122 470 118 L 540 118 Q 650 122 740 168 L 900 190 Q 948 196 952 228 L 954 292 Z',
      glass: 'M 358 176 Q 410 132 476 130 L 536 130 Q 630 134 716 176 L 728 190 L 372 190 Z',
      pillars: ['M 476 130 L 480 190'],
      doors: ['M 560 190 Q 556 240 566 292'],
      handles: [[604, 210]],
      headlight: 'M 898 194 Q 940 202 944 226 L 928 226 Q 922 210 890 204 Z',
      taillight: 'M 56 214 L 92 210 L 92 228 L 56 232 Z',
      mirror: 'M 722 172 L 748 168 L 752 180 L 728 184 Z',
      extras: [
        { d: 'M 60 190 L 200 184 L 200 190 L 62 196 Z', fill: '#111114', opacity: 1 },
        { d: 'M 600 226 L 700 208 L 706 250 L 610 260 Z', fill: '#0b0b0d', opacity: 1 },
        { d: 'M 220 200 L 340 192', stroke: '#000', width: 1.5, opacity: .4 },
        { d: 'M 228 208 L 344 200', stroke: '#000', width: 1.5, opacity: .4 },
        { d: 'M 300 292 L 740 292', stroke: '#000', width: 3, opacity: .5 },
        { d: 'M 220 200 Q 560 186 900 194', stroke: '#fff', width: 1.5, opacity: .14 },
      ],
      wheels: { rx: 250, fx: 772, r: 52 },
      fit: { pcd: '5x112', cb: 66.5, diams: [20, 21], d: 20, wf: 8.5, wr: 11.0, etf: 34, etr: 55, weight: 9.8, bodyColor: 'yellow' },
    },
    {
      id: 'jdm', name: 'JDM LEGEND', tag: 'Japonská legenda', fits: 'Nissan GT-R / 370Z, Toyota Supra, Subaru WRX STI, Honda NSX',
      body: 'M 78 292 L 78 236 Q 80 206 110 200 L 200 194 Q 300 146 420 128 Q 450 122 520 122 L 570 122 Q 650 126 720 172 L 860 184 Q 912 190 918 222 L 920 292 Z',
      glass: 'M 250 194 Q 330 152 430 138 Q 455 134 520 134 L 566 134 Q 636 138 700 178 L 706 192 Z',
      pillars: ['M 470 136 L 472 194', 'M 566 134 L 572 194'],
      doors: ['M 566 196 Q 562 246 572 292'],
      handles: [[612, 214]],
      headlight: 'M 866 188 Q 908 194 914 218 L 900 218 Q 894 200 858 196 Z',
      taillight: 'M 82 212 L 116 208 L 118 226 L 82 230 Z',
      mirror: 'M 700 178 L 726 174 L 730 186 L 706 190 Z',
      extras: [
        { d: 'M 110 200 L 118 174 L 128 174 L 122 200 Z', fill: '#111114', opacity: 1 },
        { d: 'M 188 194 L 196 170 L 206 170 L 200 194 Z', fill: '#111114', opacity: 1 },
        { d: 'M 90 172 L 232 164 L 234 173 L 92 181 Z', fill: '#1a1b1e', opacity: 1 },
        { d: 'M 300 292 L 730 292', stroke: '#000', width: 3, opacity: .5 },
        { d: 'M 210 198 Q 500 188 860 188', stroke: '#fff', width: 1.5, opacity: .14 },
      ],
      wheels: { rx: 240, fx: 762, r: 52 },
      fit: { pcd: '5x114.3', cb: 66.1, diams: [19, 20, 21], d: 20, wf: 10.0, wr: 11.0, etf: 41, etr: 50, weight: 10.6, bodyColor: 'red' },
    },
  ];

  /* ---------- renderer ---------- */
  function carSVG(car, bodyHex, wheelOpts, idp, opts) {
    idp = idp || 'car';
    opts = opts || {};
    const b = bodyHex || '#e9eaec';
    const sh = O.shade;
    /* karoserie je kreslená "dlouhá"; zúžíme ji po X a zvětšíme kola, ať sedí reálné proporce */
    const sx = car.sx || 0.86;
    const tx = x => Math.round((500 + (x - 500) * sx) * 10) / 10;
    const w = { rx: tx(car.wheels.rx), fx: tx(car.wheels.fx), r: car.wheels.r + 10 };
    const cy = 326 - w.r;
    const squash = `transform="translate(${Math.round(500 * (1 - sx) * 10) / 10} 0) scale(${sx} 1)"`;

    const defs = `
      <linearGradient id="${idp}b" gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="300">
        <stop offset="0" stop-color="${sh(b, .5)}"/><stop offset=".28" stop-color="${b}"/>
        <stop offset=".7" stop-color="${sh(b, -.1)}"/><stop offset="1" stop-color="${sh(b, -.55)}"/>
      </linearGradient>
      <linearGradient id="${idp}g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3f4a58"/><stop offset=".55" stop-color="#161c25"/><stop offset="1" stop-color="#0b0f14"/>
      </linearGradient>
      <linearGradient id="${idp}s" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${idp}hl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#dff3ff"/><stop offset="1" stop-color="#7ec8ff"/>
      </linearGradient>
      <clipPath id="${idp}bc"><path d="${car.body}"/></clipPath>
      <clipPath id="${idp}gc"><path d="${car.glass}"/></clipPath>
      <filter id="${idp}bl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
      <filter id="${idp}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>`;

    const shadow = `<ellipse cx="500" cy="330" rx="450" ry="11" fill="#000" opacity=".6" filter="url(#${idp}bl)"/>`;

    const bodySvg = `
      <path d="${car.body}" fill="url(#${idp}b)"/>
      <g clip-path="url(#${idp}bc)">
        <rect x="0" y="150" width="1000" height="60" fill="url(#${idp}s)" opacity=".55"/>
        <rect x="0" y="250" width="1000" height="60" fill="#000" opacity=".22"/>
      </g>
      <path d="${car.body}" fill="none" stroke="#000" stroke-width="1.6" opacity=".55"/>`;

    const wells = `<circle cx="${w.rx}" cy="${cy}" r="${w.r + 8}" fill="#050506"/><circle cx="${w.fx}" cy="${cy}" r="${w.r + 8}" fill="#050506"/>`;

    const glass = `
      <path d="${car.glass}" fill="url(#${idp}g)" stroke="#090c10" stroke-width="2"/>
      <g clip-path="url(#${idp}gc)"><path d="M 0 0 L 1000 0 L 1000 30 Q 500 90 0 60 Z" transform="translate(0 100)" fill="#fff" opacity=".07"/></g>
      ${car.pillars.map(p => `<path d="${p}" stroke="#090c10" stroke-width="4" fill="none"/>`).join('')}`;

    const details = `
      ${car.doors.map(p => `<path d="${p}" stroke="#000" stroke-width="1.6" fill="none" opacity=".45"/>`).join('')}
      ${car.handles.map(([x, y]) => `<rect x="${x - 16}" y="${y - 3}" width="32" height="6" rx="3" fill="${sh(b, -.45)}" stroke="#000" stroke-width=".8" opacity=".9"/>`).join('')}
      <path d="${car.headlight}" fill="url(#${idp}hl)" filter="url(#${idp}glow)" opacity=".8"/>
      <path d="${car.headlight}" fill="url(#${idp}hl)" stroke="#0a0a0c" stroke-width="1"/>
      <path d="${car.taillight}" fill="#ff2a2a" filter="url(#${idp}glow)" opacity=".7"/>
      <path d="${car.taillight}" fill="#d3121c" stroke="#0a0a0c" stroke-width="1"/>
      <path d="${car.mirror}" fill="url(#${idp}b)" stroke="#000" stroke-width="1" opacity=".95"/>
      ${car.extras.map(e => `<path d="${e.d}" ${e.fill ? `fill="${e.fill}"` : 'fill="none"'} ${e.stroke ? `stroke="${e.stroke}" stroke-width="${e.width || 1}" stroke-linecap="round"` : ''} opacity="${e.opacity == null ? 1 : e.opacity}"/>`).join('')}`;

    const wo = Object.assign({}, wheelOpts || {});
    const spin = opts.spin ? `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${opts.spin}s" repeatCount="indefinite"/>` : '';
    const wheel = (x, id) => `<g transform="translate(${x} ${cy}) scale(${(w.r / 100).toFixed(3)})">${O.wheelGroup(wo, id, 0).replace('<g class="spokes" transform="rotate(0)">', `<g class="spokes">${spin}`)}</g>`;
    const wheelsSvg = wheel(w.rx, idp + 'r') + wheel(w.fx, idp + 'f');

    return `<svg viewBox="0 0 1000 380" xmlns="http://www.w3.org/2000/svg" ${opts.attrs || ''}><defs>${defs}</defs>${shadow}<g ${squash}>${bodySvg}</g>${wells}<g ${squash}>${glass}${details}</g>${wheelsSvg}</svg>`;
  }

  Object.assign(O, { CARS, BODY_COLORS, PCDS, carSVG });
})(window);
