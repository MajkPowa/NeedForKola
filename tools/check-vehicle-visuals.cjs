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
  assert.deepEqual([...api.errors], []);
  assert.ok(Object.isFrozen(api.errors), 'Load errors are read-only snapshots');
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
    const family = { brand: brand.id, model: model.id };
    assert.equal(api.resolve(family), null, 'Family photographs are never an implicit selected-vehicle preview');
    assert.equal(api.resolve(family, { allowModelFallback: true }).id, image.id, 'Catalogue browsing explicitly opts into its family reference');
    for (const partial of [{ year: 2020 }, { body: 'wagon' }, { generation: model.variants[0]?.id || 'missing' }]) {
      assert.equal(api.resolve({ ...family, ...partial }), null);
      assert.equal(api.resolve({ ...family, ...partial }, { allowModelFallback: true }), null, 'Opt-in family browsing cannot override a selected year, body or generation');
    }
  }
  assert.equal(api.getModel('unknown', 'x5'), null);
  assert.equal(api.resolve({ brand: 'audi', model: 'x5', year: 2020, generation: 'g05', body: 'suv' }), null);
  const x5 = { brand: 'bmw', model: 'x5', year: 2020, generation: 'g05', body: 'suv' };
  assert.equal(api.resolve(x5).src, variantData.variants['bmw/x5/g05'].src, 'Reviewed G05 photograph takes precedence over the legacy illustration');
  assert.equal(api.resolve(x5).kind, 'photo');
  const e70 = { ...x5, year: 2008, generation: 'e70' };
  assert.equal(api.resolve(e70).src, variantData.variants['bmw/x5/e70'].src, 'Reviewed E70 photograph takes precedence over the legacy illustration');
  assert.equal(api.resolve(e70).kind, 'photo');
  for (const mismatch of [{ year: 2008 }, { body: 'wagon' }, { body: 'unknown' }, { generation: '' }, { year: 2027 }, { year: 'wrong' }, { year: [2020] }]) {
    assert.equal(api.resolve({ ...x5, ...mismatch }, { allowModelFallback: false }), null);
    assert.equal(api.resolve({ ...x5, ...mismatch }), null);
    assert.equal(api.resolve({ ...x5, ...mismatch }, { allowModelFallback: true }), null);
  }
  assert.equal(api.resolve({ ...x5, year: 2023, generation: '' }), null, 'A transition year never guesses which facelift is pictured');
  assert.equal(api.resolve({ ...x5, year: '2020' }).src, api.resolve(x5).src, 'An explicit numeric year from a select remains supported');
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
  const touring = V.getCandidates('bmw', 'rada-5', 2019, 'wagon').find(g => g.id === 'v-1b3b3ef6ba08');
  assert.ok(touring, 'The reported BMW 5 Series 2019 Touring exists in the catalogue');
  const touringKey = 'bmw/rada-5/' + touring.id;
  const touringSelection = { brand: 'bmw', model: 'rada-5', year: 2019, body: 'wagon', generation: touring.id };
  assert.equal(api.resolve(touringSelection)?.src, 'assets/vehicles/variants/bmw--rada-5--v-1b3b3ef6ba08.webp', 'The real 2019 G31 Touring uses its reviewed wagon photograph');
  for (const candidate of V.getGenerations('bmw', 'rada-5').filter(g => g.body === 'sedan' || (g.body === 'wagon' && g.from === 2020))) {
    assert.equal(api.resolve({ ...touringSelection, generation: candidate.id }), null, 'Sedan and facelift variant IDs cannot stand in for the 2019 wagon');
  }
  const modelOnly = await loadVisuals(data, { schemaVersion: 1, variants: {} });
  assert.equal(modelOnly.api.resolve(x5).src, 'assets/cars/bmw-x5-g05.webp', 'The correctly matched legacy illustration remains available when no exact photo exists');
  assert.equal(modelOnly.api.resolve(x5).kind, 'render');
  assert.equal(modelOnly.api.resolve(touringSelection), null, '2019 Touring must not show the latest 5 Series sedan family photograph');
  assert.equal(modelOnly.api.resolve(touringSelection, { allowModelFallback: true }), null);
  const touringPhoto = { ...data.models['bmw/rada-5'], id: 'test-g31-photo', match: 'variant', depicted: { label: 'BMW G31 Touring', generation: touring.id, body: 'wagon', from: 2017, to: 2020 } };
  const mappedTouring = await loadVisuals(data, { schemaVersion: 1, variants: { [touringKey]: touringPhoto } });
  assert.equal(mappedTouring.api.resolve(touringSelection)?.id, touringPhoto.id, 'An explicitly mapped G31 wagon photograph resolves');
  for (const mismatch of [{ body: 'sedan' }, { year: 2024 }, { generation: '' }, { generation: 'g60' }, { model: 'rada-3' }, { brand: 'audi', model: 'a6' }]) {
    assert.equal(mappedTouring.api.resolve({ ...touringSelection, ...mismatch }, { allowModelFallback: true }), null, 'A mapped photograph cannot cross year, body, generation or model boundaries');
  }
  for (const mismatch of [{ body: 'sedan' }, { from: 2023, to: 2026 }, { from: 2016 }, { to: 2021 }, { generation: 'g60' }]) {
    const wrongDepiction = await loadVisuals(data, { schemaVersion: 1, variants: { [touringKey]: { ...touringPhoto, depicted: { ...touringPhoto.depicted, ...mismatch } } } });
    assert.equal(wrongDepiction.api.resolve(touringSelection), null, 'Contradictory visual metadata must be rejected at load time');
  }
  for (const [brand, model, year, body] of [['audi', 'a4', 2019, 'wagon'], ['skoda', 'superb', 2019, 'wagon'], ['tesla', 'model-y', 2020, 'suv']]) {
    assert.equal(api.resolve({ brand, model, year, body }, { allowModelFallback: true }), null, 'Year/body alone never infer a generation, even when only one candidate exists');
    const candidate = V.getCandidates(brand, model, year, body)[0];
    assert.ok(candidate);
    assert.equal(modelOnly.api.resolve({ brand, model, year, body, generation: candidate.id }), null, 'Other model families also stay unavailable when no exact depiction is mapped');
  }
  const malicious = await loadVisuals({ schemaVersion: 1, models: { 'bmw/x5': { ...data.models['bmw/x5'], src: 'javascript:alert(1)' } } }, { schemaVersion: 1, variants: { [key]: { ...exact, depicted: { label: 'Missing evidence' } } } });
  assert.equal(malicious.api.getModel('bmw', 'x5'), null);
  assert.equal(malicious.api.resolve(selection, { allowModelFallback: false }), null, 'Missing explicit body/year evidence cannot be exact');
  const credit = api.creditHTML({ kind: 'photo', author: '<img src=x onerror=alert(1)>', sourceUrl: 'javascript:alert(1)', license: '<script>', licenseUrl: 'data:text/html,boom' });
  assert.ok(!credit.includes('<img') && !credit.includes('<script>') && !credit.includes('href='));
  assert.ok(credit.includes('&lt;img'));
  const unavailable = await loadVisuals(data, variantData, true);
  assert.equal(unavailable.status.errors.length, 1);
  assert.equal(unavailable.api.errors.length, 1, 'Completed failed loads still expose their error for the retry UI');
  assert.ok(Object.isFrozen(unavailable.api.errors));
  assert.equal(unavailable.api.getModel('bmw', 'x5'), null);
  assert.equal(unavailable.api.resolve(x5).match, 'variant', 'Exact variant data survives an unavailable family catalogue');
  assert.equal(unavailable.api.resolve(x5).kind, 'photo');
  console.log(`PASS visual data: 401 opt-in family references, ${api.variantCount} mapped variants, strict generation/body/year, BMW 2019 Touring regression, cross-model isolation, local assets/credits, safe URLs and fetch failure.`);
}

async function browserChecks() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const shots = path.join(root, 'tools/.cache-wheel-fit/vehicle-visuals-strict-qa');
  fs.mkdirSync(shots, { recursive: true });
  const touringURL = base + '/konfigurator.html?brand=bmw&model=rada-5&year=2019&body=wagon&generation=v-1b3b3ef6ba08&view=car';
  const touringImage = 'bmw--rada-5--v-1b3b3ef6ba08.webp';
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
    await page.locator('.catalog-card').screenshot({ path: path.join(shots, 'vehicle-photo-catalog.png'), style: '.nav,.discovery-dock{visibility:hidden!important}' });

    await page.goto(base + '/konfigurator.html?brand=bmw&model=x5&year=2008&view=car', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.vehicle-render')?.naturalWidth > 0);
    assert.equal(await page.locator('.vehicle-render').getAttribute('data-visual-match'), 'variant');
    assert.match(await page.locator('.vehicle-render').getAttribute('src'), /e70/);
    await page.selectOption('#vehicleYear', '2023');
    assert.equal(await page.locator('#vehicleGeneration').inputValue(), '');
    await page.locator('.is-wheel-reference .webgl-view canvas').waitFor();
    assert.equal(await page.locator('.vehicle-render').count(), 0, 'An ambiguous facelift year never displays a family reference');
    assert.match(await page.locator('.preview-caption').innerText(), /Upřesni provedení svého vozu/);
    assert.ok(!(await page.locator('#stageHead h1').innerText()).includes('×'), 'Photograph title keeps the selected vehicle readable');
    await page.locator('#stageView').screenshot({ path: path.join(shots, 'vehicle-photo-unavailable.png') });
    await page.getByRole('button', { name: '3D kolo', exact: true }).click();
    await page.locator('.webgl-view canvas').waitFor();
    assert.equal(await page.locator('.vehicle-render').count(), 0);
    await page.getByRole('button', { name: 'Můj vůz', exact: true }).click();
    await page.locator('.is-wheel-reference .webgl-view canvas').waitFor();
    assert.equal(await page.locator('.vehicle-render').count(), 0, 'Returning to the selected vehicle retains the honest unavailable state');

    await page.goto(touringURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.vehicle-render')?.naturalWidth > 0);
    assert.ok((await page.locator('.vehicle-render').getAttribute('src')).includes(touringImage), 'The reported 2019 BMW Touring shows the reviewed G31 wagon');
    assert.equal(await page.locator('.vehicle-render').getAttribute('data-visual-match'), 'variant');
    assert.match(await page.locator('.preview-caption').innerText(), /G31/);
    await page.selectOption('#vehicleBody', 'sedan');
    await page.locator('.is-wheel-reference .webgl-view canvas').waitFor();
    assert.equal(await page.locator('.vehicle-render').count(), 0, 'The G31 wagon photo cannot remain after selecting sedan');
    await page.selectOption('#vehicleBody', 'wagon');
    await page.waitForFunction(() => document.querySelector('.vehicle-render')?.naturalWidth > 0);
    assert.ok((await page.locator('.vehicle-render').getAttribute('src')).includes(touringImage));
    await page.locator('#stageView').screenshot({ path: path.join(shots, 'vehicle-photo-config.png') });
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
    await page.locator('#stageView').screenshot({ path: path.join(shots, 'vehicle-photo-config-mobile.png') });

    // Hold both metadata requests while the user changes model and view.
    const delayed = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    delayed.on('pageerror', error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await delayed.route('**/data/vehicle-visual*.json*', async route => { await gate; await route.continue(); });
    await delayed.goto(base + '/konfigurator.html?brand=bmw&model=x5&year=2020&view=photo', { waitUntil: 'domcontentloaded' });
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
    await delayed.locator('.is-wheel-reference .webgl-view canvas').waitFor();
    assert.equal(await delayed.locator('.vehicle-render').count(), 0, 'Unmapped Tesla remains unavailable after delayed metadata completes');
    assert.equal(await delayed.locator('[data-vehicle-asset]').count(), 0, 'Another model cannot silently become a BMW demo');
    await delayed.close();

    const broken = await browser.newPage({ reducedMotion: 'reduce' });
    broken.on('pageerror', error => errors.push(error.message));
    let imageRequests = 0;
    await broken.route('**/assets/vehicles/variants/' + touringImage + '*', route => ++imageRequests === 1 ? route.abort() : route.continue());
    await broken.goto(touringURL, { waitUntil: 'networkidle' });
    await broken.locator('.is-wheel-reference .webgl-view canvas').waitFor();
    assert.equal(await broken.locator('.vehicle-render').count(), 0, 'Broken photo falls back to actual selected wheel instead of the wrong car');
    assert.match(await broken.locator('.preview-caption').innerText(), /Fotografii se nepodařilo načíst/);
    assert.equal(await broken.locator('#vehicleModel').inputValue(), 'rada-5');
    await broken.locator('[data-retry-visual]').click();
    await broken.waitForFunction(() => document.querySelector('.vehicle-render')?.naturalWidth > 0);
    assert.equal(imageRequests, 2, 'Retry reloads the failed exact photo');
    assert.ok((await broken.locator('.vehicle-render').getAttribute('src')).includes(touringImage));
    assert.equal(await broken.locator('.vehicle-render').getAttribute('data-visual-match'), 'variant');
    await broken.close();

    const retry = await browser.newPage({ reducedMotion: 'reduce' });
    retry.on('pageerror', error => errors.push(error.message));
    let manifestRequests = 0;
    await retry.route('**/data/vehicle-visual-variants.json*', route => ++manifestRequests === 1 ? route.fulfill({ status: 503, body: 'Temporarily unavailable' }) : route.continue());
    await retry.goto(touringURL, { waitUntil: 'networkidle' });
    await retry.locator('.is-wheel-reference .webgl-view canvas').waitFor();
    assert.equal(await retry.locator('.vehicle-render').count(), 0, 'A successful model manifest does not replace a failed exact-variant manifest');
    assert.equal(await retry.evaluate(() => NFWVehicleVisuals.errors.length), 1);
    await retry.locator('[data-retry-visual]').click();
    await retry.waitForFunction(() => document.querySelector('.vehicle-render')?.naturalWidth > 0);
    assert.equal(manifestRequests, 2, 'Retry must fetch a previously failed manifest again');
    assert.equal(await retry.locator('.vehicle-render').getAttribute('data-visual-match'), 'variant');
    assert.ok((await retry.locator('.vehicle-render').getAttribute('src')).includes(touringImage));
    assert.equal(await retry.locator('#vehicleModel').inputValue(), 'rada-5');
    assert.equal(await retry.evaluate(() => NFWVehicleVisuals.errors.length), 0, 'Successful retry clears the load error');
    await retry.close();
    assert.deepEqual(errors, []);
    console.log('PASS visual UI: labels/credits, exact variant layout, transition ambiguity, wheel/photo switching, mobile caption bounds, delayed-fetch safety, broken image fallback and 503-to-200 manifest retry.');
  } finally { await browser.close(); }
}

(async () => { await unitChecks(); if (!process.argv.includes('--unit-only')) await browserChecks(); })().catch(error => { console.error(error); process.exitCode = 1; });
