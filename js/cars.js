/* Legacy size presets only; never used to represent a specific vehicle. */
(function (global) {
'use strict';
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
    { id: 'gt', name: 'GT COUPE', tag: 'Sportovní kupé', fits: 'Porsche 911 / Cayman / Boxster', fit: { pcd: '5x130', cb: 71.6, diams: [19, 20, 21, 22], d: 21, wf: 9.0, wr: 11.5, etf: 50, etr: 62, weight: 10.5, bodyColor: 'white' } },
    { id: 'sedan', name: 'SPORT SEDAN', tag: 'Sportovní sedan', fits: 'BMW M3 / M5, Audi RS 4 / RS 6, Mercedes-AMG C / E', fit: { pcd: '5x112', cb: 66.6, diams: [19, 20, 21], d: 20, wf: 9.5, wr: 10.5, etf: 25, etr: 28, weight: 10.8, bodyColor: 'nardo' } },
    { id: 'suv', name: 'PERFORMANCE SUV', tag: 'Sportovní SUV', fits: 'VW Tiguan / Touareg, Audi Q5 / Q8, BMW X5 / X6', fit: { pcd: '5x112', cb: 66.5, diams: [20, 21, 22, 23], d: 22, wf: 10.0, wr: 10.5, etf: 30, etr: 35, weight: 13.5, bodyColor: 'white' } },
    { id: 'hatch', name: 'HOT HATCH', tag: 'Ostrý hatchback', fits: 'VW Golf R / GTI, Audi RS 3 / S3, Škoda Octavia RS, Cupra Leon', fit: { pcd: '5x112', cb: 57.1, diams: [18, 19, 20], d: 19, wf: 8.5, wr: 8.5, etf: 45, etr: 45, weight: 9.2, bodyColor: 'blue' } },
    { id: 'muscle', name: 'MUSCLE GT', tag: 'Americký muscle car', fits: 'Ford Mustang GT / Shelby (2005 a novější)', fit: { pcd: '5x114.3', cb: 70.5, diams: [19, 20, 21, 22], d: 20, wf: 10.0, wr: 11.0, etf: 35, etr: 45, weight: 11.4, bodyColor: 'black' } },
    { id: 'hyper', name: 'HYPERCAR', tag: 'Supersport', fits: 'Lamborghini Huracán / Gallardo, Audi R8', fit: { pcd: '5x112', cb: 66.5, diams: [20, 21], d: 20, wf: 8.5, wr: 11.0, etf: 34, etr: 55, weight: 9.8, bodyColor: 'yellow' } },
    { id: 'jdm', name: 'JDM LEGEND', tag: 'Japonská legenda', fits: 'Nissan GT-R / 370Z / Skyline, Infiniti Q50 / Q60', fit: { pcd: '5x114.3', cb: 66.1, diams: [19, 20, 21], d: 20, wf: 10.0, wr: 11.0, etf: 41, etr: 50, weight: 10.6, bodyColor: 'red' } }
  ];
Object.assign(global.NFW, { BODY_COLORS, PCDS, CARS });
})(window);
