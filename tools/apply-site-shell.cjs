'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {PAGES, VERSION, transformHTML} = require('./site-shell.cjs');
const root = path.resolve(__dirname, '..');
const externalMissing = process.argv.includes('--external-missing');
const externalRoutes = externalMissing ? Object.keys(PAGES).filter(filename => !fs.existsSync(path.join(root, filename))) : [];
const files = Object.keys(PAGES).filter(filename => !externalMissing || fs.existsSync(path.join(root, filename)));
const logo = fs.existsSync(path.join(root, 'assets/brand/oarts-logo-256.webp')) ? 'assets/brand/oarts-logo-256.webp' : 'assets/brand/oarts-logo.png';
let changed = 0;
for (const filename of files) {
  const file = path.join(root, filename);
  const original = fs.readFileSync(file, 'utf8');
  const transformed = transformHTML(original, filename, {externalRoutes, logo});
  if (transformed !== original) {fs.writeFileSync(file, transformed); changed++;}
}
console.log(JSON.stringify({pages: files.length, changed, externalRoutes, version: VERSION}));
