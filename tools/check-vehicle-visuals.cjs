'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadCatalogue } = require('./check-catalog.cjs');
const root = path.resolve(__dirname, '..');
const V = loadCatalogue();
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/vehicle-visuals.json'), 'utf8').replace(/^\uFEFF/, ''));
const variantData = JSON.parse(fs.readFileSync(path.join(root, 'data/vehicle-visual-variants.json'), 'utf8').replace(/^\uFEFF/, ''));
const code = fs.readFileSync(path.join(root, 'js/vehicle-visuals.js'), 'utf8');
const base = process.env.NFW_BASE_URL || 'http://127.0.0.1:8765';

async function loadVisuals(modelData = data, exactData = variantData, failModel = false) {
  const requested = [];
  const context = vm.createContext({
    window: { NFWVehicles: V }, URL,
    document: { currentScript: { src: 'https://test.example/NeedForKola/js/vehicle-visuals.js' } },
    fetch: async url => {
      requested.push(String(url));
      const exact = String(url).endsWith('vehicle-visual-variants.json');
      return { ok: exact || !failModel, status: exact || !failModel ? 200 : 503, json: async () => exact ? exactData : modelData };
    }
  });
  vm.runInContext(code, context);
  const api = context.window.NFWVehicleVisuals;
  assert.equal(api.isReady, false);
  const status = await api.ready;
  assert.equal(api.isReady, true);
  assert.ok(requested.every(url => url.startsWith('https://test.example/NeedForKola/data/')), 'Subdirectory hosting resolves both data files correctly');
  return { api, status };
}

async function unitChecks() {
  const { api, status } = await loadVisuals();
  assert.deepEqual([...status.errors], []);
  assert.equal(api.modelCount, 401, 'Every requested family has its own model photograph');
  for (const brand of V.brands) for (const model of brand.models) {
    const image = api.getModel(brand.id, model.id);
    assert.ok(image, brand.id + '/' + model.id);
    assert.equal(image.match, 'model');
    assert.equal(image.kind, 'photo');
    assert.ok(image.sourceUrl.startsWith('https://'));
    assert.ok(image.author && image.license && image.depicted.label);
    for (const src of [image.src, image.thumb]) {
      const asset = path.resolve(root, src);
      assert.ok(asset.startsWith(root + path.sep));
      assert.ok(fs.statSync(asset).size > 100, src);
    }
    assert.ok(Object.isFrozen(image) && Object.isFrozen(image.depicted));
  }
  assert.equal(api.getModel('unknown', 'x5'), null);
  assert.equal(api.resolve({ brand: 'audi', model: 'x5', year: 2020, generation: 'g05', body: 'suv' }), null);
  const x5 = { brand: 'bmw', model: 'x5', year: 2020, generation: 'g05', body: 'suv' };
  assert.equal(api.resolve(x5).src, 'assets/cars/bmw-x5-g05.webp', 'Existing exact illustrative render takes precedence');
  for (const mismatch of [{ year: 2008 }, { body: 'wagon' }, { generation: '' }, { year: 2027 }, { year: 'wrong' }]) {
    assert.equal(api.resolve({ ...x5, ...mismatch }, { allowModelFallback: false }), null);
    assert.equal(api.resolve({ ...x5, ...mismatch }).match, 'model');
  }
  for (const [key, value] of Object.entries(variantData.variants)) {
    const [brand, model, generation] = key.split('/');
    const g = V.getGenerations(brand, model).find(candidate => candidate.id === generation);
    assert.ok(g, key);
    const year = Math.max(g.from, value.depicted.from);
    const image = api.resolve({ brand, model, generation, body: g.body, year }, { allowModelFallback: false });
    assert.equal(image?.match, 'variant', key);
    assert.ok(fs.statSync(path.resolve(root, image.src)).size > 100);
    assert.equal(api.resolve({ brand, model, generation, body: 'incorrect-body', year }, { allowModelFallback: false }), null);
  }

  const specimen = V.getModel('skoda', 'octavia').variants.find(g => !g.asset && g.body !== 'unknown' && g.to - g.from > 4);
  const key = 'skoda/octavia/' + specimen.id;
  const exact = { ...data.models['skoda/octavia'], id: 'test-exact', match: 'variant', depicted: { label: 'Test depiction', body: specimen.body, from: specimen.from + 1, to: specimen.to - 1 } };
  const synthetic = await loadVisuals(data, { schemaVersion: 1, variants: { [key]: exact } });
  const selection = { brand: 'skoda', model: 'octavia', generation: specimen.id, body: specimen.body, year: specimen.from + 1 };
  assert.equal(synthetic.api.resolve(selection, { allowModelFallback: false }).id, 'test-exact');
  assert.equal(synthetic.api.resolve({ ...selection, year: specimen.from }, { allowModelFallback: false }), null, 'Image year bounds are stricter than variant bounds');
  assert.equal(synthetic.api.resolve({ ...selection, year: specimen.to }, { allowModelFallback: false }), null);
  const malicious = await loadVisuals({ schemaVersion: 1, models: { 'bmw/x5': { ...data.models['bmw/x5'], src: 'javascript:alert(1)' } } }, { schemaVersion: 1, variants: { [key]: { ...exact, depicted: { label: 'Missing evidence' } } } });
  assert.equal(malicious.api.getModel('bmw', 'x5'), null);
  assert.equal(malicious.api.resolve(selection, { allowModelFallback: false }), null, 'Missing explicit body/year evidence cannot be exact');
  const credit = api.creditHTML({ kind: 'photo', author: '<img src=x onerror=alert(1)>', sourceUrl: 'javascript:alert(1)', license: '<script>', licenseUrl: 'data:text/html,boom' });
  assert.ok(!credit.includes('<img') && !credit.includes('<script>') && !credit.includes('href='));
  assert.ok(credit.includes('&lt;img'));
  const unavailable = await loadVisuals(data, variantData, true);
  assert.equal(unavailable.status.errors.length, 1);
  assert.equal(unavailable.api.getModel('bmw', 'x5'), null);
  assert.equal(unavailable.api.resolve(x5).match, 'variant', 'Built-in exact render survives an unavailable model catalogue');
  console.log(`PASS visual data: 401 model photos, ${api.variantCount} mapped variants, local assets/credits, strict body/year selection, frozen metadata, safe URLs and fetch failure.`);
}

async function browserChecks() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/index.html?catalogBrand=skoda&catalogModel=Octavia#vehicleCatalogue', { waitUntil: 'networkidle' });
    await page.evaluate(() => NFWVehicleVisuals.ready);
    assert.equal(await page.locator('.catalog-model-visual [data-visual-match="model"]').count(), 1);
    assert.match(await page.locator('.catalog-model-visual').innerText(), /Reference modelové řady/i);
    assert.ok(await page.locator('.catalog-model-visual .vehicle-visual-credit a').count() >= 1);
    await page.locator('.catalog-variants summary').click();
    assert.ok(await page.locator('.catalog-variant-visual [data-visual-match="variant"]').count() > 0);
    const contentWidth = await page.locator('.catalog-variant:has([data-visual-match="variant"]) .catalog-variant-content').first().evaluate(element => element.getBoundingClientRect().width);
    assert.ok(contentWidth > 200, 'Exact variant photo must not push its name into the narrow year column');
    await page.locator('.catalog-model-visual img').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.catalog-model-visual img').naturalWidth > 0);
    await page.locator('.catalog-card').screenshot({ path: path.join(root, 'docs/qa/vehicle-photo-catalog.png'), style: '.nav,.discovery-dock{visibility:hidden!important}' });

    await page.goto(base + '/konfigurator.html?brand=bmw&model=x5&year=2008&view=car', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.vehicle-render')?.naturalWidth > 0);
    assert.equal(await page.locator('.vehicle-render').getAttribute('data-visual-match'), 'variant');
    assert.match(await page.locator('.vehicle-render').getAttribute('src'), /e70/);
    await page.selectOption('#vehicleYear', '2023');
    assert.equal(await page.locator('#vehicleGeneration').inputValue(), '');
    assert.equal(await page.locator('.vehicle-render').getAttribute('data-visual-match'), 'model');
    assert.match(await page.locator('.preview-caption').innerText(), /Reference modelové řady/i);
    assert.match(await page.locator('.preview-caption').innerText(), /nemusí odpovídat vybranému roku/);
    assert.ok(!(await page.locator('#stageHead h1').innerText()).includes('×'), 'Photograph title keeps the selected vehicle readable');
    await page.locator('#stageView').screenshot({ path: path.join(root, 'docs/qa/vehicle-photo-config.png') });
    await page.getByRole('button', { name: '3D kolo', exact: true }).click();
    await page.locator('.webgl-view canvas').waitFor();
    assert.equal(await page.locator('.vehicle-render').count(), 0);
    await page.getByRole('button', { name: 'Můj vůz', exact: true }).click();
    assert.equal(await page.locator('.webgl-view canvas').count(), 0);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile photo keeps full frame without horizontal overflow');
      const captionBottom = await page.locator('.preview-caption').evaluate(element => element.getBoundingClientRect().bottom);
      const footTop = await page.locator('#stageFoot').evaluate(element => element.getBoundingClientRect().top);
      assert.ok(captionBottom <= footTop, `Photo caption and credit must finish above the stage controls at ${width}px`);
    }
    const actualDescription = await page.locator('.vehicle-visual-description').textContent();
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.vehicle-visual-description').evaluate(element => { element.textContent = 'Na obrázku: ' + 'Dlouhý skutečný popis modelové řady, karoserie a fotografie. '.repeat(3); });
      assert.ok(await page.evaluate(() => document.querySelector('.preview-caption').getBoundingClientRect().bottom <= document.querySelector('#stageFoot').getBoundingClientRect().top), `A long photo description must not overlap stage controls at ${width}px`);
    }
    await page.locator('.vehicle-visual-description').evaluate((element, value) => { element.textContent = value; }, actualDescription);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#stageView').screenshot({ path: path.join(root, 'docs/qa/vehicle-photo-config-mobile.png') });

    // Hold both metadata requests while the user changes model and view.
    const delayed = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    delayed.on('pageerror', error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await delayed.route('**/data/vehicle-visual*.json*', async route => { await gate; await route.continue(); });
    await delayed.goto(base + '/konfigurator.html?brand=bmw&model=x5&year=2020&view=car', { waitUntil: 'domcontentloaded' });
    await delayed.locator('#vehicleBrand').waitFor({ state: 'attached' });
    await delayed.selectOption('#vehicleBrand', 'tesla');
    await delayed.selectOption('#vehicleModel', 'model-y');
    await delayed.getByRole('button', { name: '3D kolo', exact: true }).click();
    release();
    await delayed.evaluate(() => NFWVehicleVisuals.ready);
    await delayed.locator('.webgl-view canvas').waitFor();
    assert.equal(await delayed.locator('.vehicle-render').count(), 0, 'Late photos cannot replace a subsequently selected 3D mode');
    await delayed.getByRole('button', { name: 'Můj vůz', exact: true }).click();
    assert.equal(await delayed.locator('#vehicleBrand').inputValue(), 'tesla');
    assert.equal(await delayed.locator('#vehicleModel').inputValue(), 'model-y');
    assert.match(await delayed.locator('.vehicle-render').getAttribute('src'), /tesla--model-y/);
    assert.equal(await delayed.locator('.vehicle-render').getAttribute('data-visual-match'), 'model');
    await delayed.close();

    const broken = await browser.newPage({ reducedMotion: 'reduce' });
    broken.on('pageerror', error => errors.push(error.message));
    await broken.route('**/assets/vehicles/tesla--model-y.webp*', route => route.abort());
    await broken.goto(base + '/konfigurator.html?brand=tesla&model=model-y&year=2020&view=car', { waitUntil: 'networkidle' });
    await broken.locator('.webgl-view canvas').waitFor();
    assert.equal(await broken.locator('.vehicle-render').count(), 0, 'Broken photo falls back to actual selected wheel instead of the wrong car');
    assert.match(await broken.locator('.preview-caption').innerText(), /Fotografie nyní není dostupná/);
    assert.equal(await broken.locator('#vehicleModel').inputValue(), 'model-y');
    await broken.close();

    const retry = await browser.newPage({ reducedMotion: 'reduce' });
    retry.on('pageerror', error => errors.push(error.message));
    let manifestRequests = 0;
    await retry.route('**/data/vehicle-visuals.json*', route => ++manifestRequests === 1 ? route.fulfill({ status: 503, body: 'Temporarily unavailable' }) : route.continue());
    await retry.goto(base + '/konfigurator.html?brand=tesla&model=model-y&year=2020&view=car', { waitUntil: 'networkidle' });
    await retry.locator('.webgl-view canvas').waitFor();
    await retry.locator('[data-retry-visual]').click();
    await retry.waitForFunction(() => document.querySelector('.vehicle-render')?.naturalWidth > 0);
    assert.equal(manifestRequests, 2, 'Retry must fetch a previously failed manifest again');
    assert.equal(await retry.locator('.vehicle-render').getAttribute('data-visual-match'), 'model');
    assert.equal(await retry.locator('#vehicleModel').inputValue(), 'model-y');
    await retry.close();
    assert.deepEqual(errors, []);
    console.log('PASS visual UI: labels/credits, exact variant layout, transition ambiguity, wheel/photo switching, mobile caption bounds, delayed-fetch safety, broken image fallback and 503-to-200 manifest retry.');
  } finally { await browser.close(); }
}

(async () => { await unitChecks(); if (!process.argv.includes('--unit-only')) await browserChecks(); })().catch(error => { console.error(error); process.exitCode = 1; });
