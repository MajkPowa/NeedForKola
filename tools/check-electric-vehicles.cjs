'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/vehicle-variants.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/electric-vehicles.json'), 'utf8'));
const context = vm.createContext({ window: {} });
for (const file of ['vehicle-data.js', 'vehicles.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
const V = context.window.NFWVehicles;
assert.equal(V.brandCount, 53);
assert.equal(V.modelCount, 401);
assert.equal(V.variantCount, 2736);
assert.equal(V.electricModelCount, 26);
assert.equal(Object.keys(data.electricModels).length, source.models.length);
assert.equal(V.getElectricModels('Tesla').length, 4);
assert.equal(V.getElectricModels('BMW').length, 4);
assert.equal(V.getElectricModels('Audi').length, 3);
assert.equal(V.getElectricModels('missing').length, 0);
assert.ok(Object.isFrozen(V.getElectricModels()));
for (const { brand, model } of V.getElectricModels()) {
  assert.ok(model.variants.length);
  assert.ok(V.isElectricModel(brand.id, model.id));
  assert.ok(Object.isFrozen(model.electricSource));
  assert.match(model.electricSource.source, /^https:\/\//);
  assert.equal(model.electricSource.verifiedOn, '2026-10-11');
  // BEV classification adds no fitment dimensions to catalogue records.
  assert.ok(!Object.keys(model.electricSource).some(key => ['pcd', 'cb', 'd', 'et', 'loadKg'].includes(key)));
}
for (const [brand, model] of [['bmw','rada-5'],['porsche','macan'],['hyundai','kona'],['kia','niro'],['renault','megane'],['byd','seal-u'],['mg','zs'],['volvo','xc40']]) {
  assert.ok(V.getModel(brand, model), 'Mixed family exists: ' + brand + '/' + model);
  assert.equal(V.isElectricModel(brand, model), false, 'Mixed families must not all be marked BEV');
  assert.equal(V.getModel(brand, model).powertrain, null);
}
assert.equal(V.isElectricModel('missing', '<script>'), false);
const baselineIndex = process.argv.indexOf('--baseline');
if (baselineIndex !== -1) {
  const baseline = JSON.parse(fs.readFileSync(process.argv[baselineIndex + 1], 'utf8'));
  assert.deepEqual(data.models, baseline.models, 'Every existing variant, ID and source is preserved');
  assert.deepEqual(data.stats, baseline.stats, 'Original catalogue statistics are preserved');
}
console.log('PASS 26 sourced BEV families; mixed families remain unclassified; 401 models and 2736 variants retained');
const html = fs.readFileSync(path.join(root, 'elektroauta.html'), 'utf8');
const entryLinks = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]).filter(tag => /href="konfigurator\.html\?/.test(tag));
assert.equal(entryLinks.filter(tag => /\bdata-ev-fallback\b/.test(tag)).length, 3);
for (const tag of entryLinks) {
  const href = tag.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
  const params = new URL(href, 'https://oarts.cz').searchParams;
  const fallback = /\bdata-ev-fallback\b/.test(tag);
  assert.equal(params.get('vehicleFilter'), fallback ? 'all' : 'electric');
  assert.equal(params.get('ev'), '1');
  assert.equal(params.get('year'), '0');
  if (fallback) {
    assert.equal(params.has('brand'), false);
    assert.equal(params.has('model'), false);
  }
}
assert.match(html, /otevři úplný katalog v konfigurátoru/i);
console.log('PASS three unlisted/mixed EV fallback links open all models; hero, footer and curated model links retain the electric filter');
if (process.argv.includes('--data-only')) process.exit(0);

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/elektroauta.html', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-ev-model]').count(), 26);
    assert.equal(await page.locator('[data-ev-brand]:visible').count(), 12);
    for (const link of await page.locator('[data-ev-model]').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
      const params = new URL(link, base).searchParams;
      assert.ok(V.isElectricModel(params.get('brand'), params.get('model')));
      assert.equal(params.get('year'), '0');
      assert.equal(params.get('generation'), '');
      assert.equal(params.get('body'), '');
      assert.equal(params.get('ev'), '1');
      assert.equal(params.get('vehicleFilter'), 'electric');
      assert.equal(params.get('view'), 'car');
      assert.equal(params.has('loadKg'), false);
    }
    await page.selectOption('#evBrand', 'tesla');
    assert.equal(await page.locator('[data-ev-model]:visible').count(), 4);
    await page.locator('#evSearch').fill('Model Y');
    assert.equal(await page.locator('[data-ev-model]:visible').count(), 1);
    await page.locator('[data-ev-model="model-y"]').click();
    await page.locator('#vehicleModel').waitFor();
    assert.equal(await page.locator('#vehicleBrand').inputValue(), 'tesla');
    assert.equal(await page.locator('#vehicleModel').inputValue(), 'model-y');
    assert.equal(await page.locator('#vehicleYear').inputValue(), '0');
    assert.equal(await page.locator('#vehicleGeneration').inputValue(), '');
    assert.ok(await page.locator('#electricVehicle').isChecked());
    console.log('PASS real EV landing → Tesla Model Y click preserves model, unresolved year and EV setting');
    await page.goto(base + '/elektroauta.html?brand=tesla&model=model-y&utm_source=qa', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-ev-model]:visible').count(), 1);
    await page.locator('#evSearch').fill('unknown-model');
    assert.ok(await page.locator('.ev-empty').isVisible());
    await page.locator('#evReset').click();
    assert.equal(await page.locator('[data-ev-model]:visible').count(), 26);
    assert.equal(new URL(page.url()).searchParams.get('utm_source'), 'qa');
    await page.locator('#evSearch').fill('Skoda');
    assert.equal(await page.locator('[data-ev-model]:visible').count(), 2);
    await page.locator('#evReset').click();
    await page.locator('#evSearch').fill('<script>alert(1)</script>');
    assert.ok(await page.locator('.ev-empty').isVisible());
    assert.equal(await page.locator('script:not([src])').count(), 0);
    console.log('PASS brand/model ad URLs, accent-insensitive search, no-results and reset retain unrelated URL parameters');
    await page.locator('#evReset').click();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow at ' + width);
      assert.ok(await page.locator('h1').isVisible());
      assert.ok(await page.locator('[data-ev-model="enyaq"]').isVisible());
      const images = await page.locator('img').evaluateAll(images => images.filter(image => image.loading !== 'lazy' && (!image.complete || !image.naturalWidth)).map(image => image.src));
      assert.deepEqual(images, []);
      if ([1440, 390].includes(width)) {
        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({top: 0, behavior: 'instant'}); });
        await page.screenshot({ path: path.join(root, `docs/qa/ev-landing-${width}-2026-10-11.png`), fullPage: true });
      }
    }
    const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await noJs.goto(base + '/elektroauta.html');
    assert.equal(await noJs.locator('[data-ev-model]:visible').count(), 26);
    assert.ok(await noJs.locator('.ev-filters').isHidden());
    await noJs.close();
    assert.deepEqual(errors, []);
    console.log('PASS 320–1440px, local images, every model available without JS and no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
