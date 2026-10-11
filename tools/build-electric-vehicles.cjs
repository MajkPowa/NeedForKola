'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['vehicle-data.js', 'vehicles.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
const V = context.window.NFWVehicles;
const entries = V.getElectricModels();
if (!entries.length) throw new Error('BEV collection must not be empty');
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const groups = new Map();
for (const entry of entries) {
  if (!groups.has(entry.brand.id)) groups.set(entry.brand.id, { brand: entry.brand, models: [] });
  groups.get(entry.brand.id).models.push(entry.model);
}
const brandOptions = '<option value="">Všechny značky</option>' + [...groups.values()]
  .sort((a, b) => a.brand.name.localeCompare(b.brand.name, 'cs'))
  .map(({brand}) => `<option value="${esc(brand.id)}">${esc(brand.name)}</option>`).join('');
const cards = [...groups.values()].map(({brand, models}) => {
  const sources = [...new Map(models.map(model => [model.electricSource.source, model.electricSource])).values()];
  const list = models.map(model => {
    const params = new URLSearchParams({brand: brand.id, model: model.id, year: '0', generation: '', body: '', view: 'car', ev: '1', vehicleFilter: 'electric'});
    return `<li><a href="konfigurator.html?${esc(params.toString())}" data-ev-model="${esc(model.id)}" data-ev-brand-id="${esc(brand.id)}" data-ev-model-name="${esc(model.name)}" data-ev-search="${esc(brand.name + ' ' + model.name)}" aria-label="Navrhnout kola pro ${esc(brand.name + ' ' + model.name)}"><span>${esc(model.name)}</span><b aria-hidden="true">↗</b></a></li>`;
  }).join('');
  return `<article class="ev-model-card" data-ev-brand="${esc(brand.id)}"><div class="ev-card-heading"><img src="assets/brands/${esc(brand.id)}.png" alt="" width="128" height="128" loading="lazy" decoding="async"><h3>${esc(brand.name)}</h3></div><ul>${list}</ul><details><summary>Podklady výrobce</summary>${sources.map(source => `<p><a href="${esc(source.source)}" target="_blank" rel="noopener">${esc(source.sourceTitle)} ↗</a></p>`).join('')}</details></article>`;
}).join('\n');
const file = path.join(root, 'elektroauta.html');
let html = fs.readFileSync(file, 'utf8');
for (const [marker, content] of [['EV_BRAND_OPTIONS', brandOptions], ['EV_MODEL_CARDS', cards]]) {
  const pattern = new RegExp(`(<!-- ${marker}_START -->)[\\s\\S]*?(<!-- ${marker}_END -->)`);
  if (!pattern.test(html)) throw new Error('Missing page marker: ' + marker);
  html = html.replace(pattern, (_, start, end) => start + '\n' + content + '\n' + end);
}
html = html.replace(/(<p id="evResultCount"[^>]*>)[^<]*(<\/p>)/, `$1${entries.length} vybraných modelových řad · ${groups.size} značek$2`);
// Unlisted and mixed-powertrain families need the full catalogue. Keep these
// fallback entry points separate from the curated BEV model deep links.
const fallbackHref = 'konfigurator.html?' + esc(new URLSearchParams({vehicleFilter: 'all', ev: '1', year: '0'}).toString());
let fallbackCount = 0;
html = html.replace(/(<a\b(?=[^>]*\bdata-ev-fallback\b)[^>]*\bhref=")[^"]*(")/g, (_, start, end) => {
  fallbackCount++;
  return start + fallbackHref + end;
});
if (fallbackCount !== 3) throw new Error('Expected three full-catalogue EV fallback links');
fs.writeFileSync(file, html);
console.log(JSON.stringify({electricModels: entries.length, brands: groups.size, page: 'elektroauta.html'}));
