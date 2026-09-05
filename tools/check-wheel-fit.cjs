'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const readJSON = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8').replace(/^\uFEFF/, ''));
const inventory = readJSON('data/wheel-photo-inventory.json');
const manifest = readJSON('data/wheel-fitments.json');
const configURL = base + '/konfigurator.html?brand=bmw&model=x5&year=2020&generation=g05&body=suv&view=car';
const moduleURL = base + '/js/wheel-fit-preview.js?v=20260905-wheel-fit';
const ready = (page, design, color) => page.waitForFunction(({ design, color }) => {
  const canvas = document.querySelector('.vehicle-wheel-overlay');
  return canvas?.dataset.ready === 'true' && !canvas.hidden &&
    (!design || canvas.dataset.design === design) && (!color || canvas.dataset.color === color) &&
    !document.querySelector('.wheel-photo-status')?.textContent.includes('Připravuji');
}, { design, color });

function schemaChecks() {
  assert.equal(inventory.total, 430);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.coordinateSystem, 'normalized-image');
  assert.equal(manifest.rotationUnit, 'radians');
  assert.deepEqual(Object.keys(manifest.photos).sort(), inventory.photos.map(photo => photo.src).sort(), 'Every one of the 430 exact source images has wheel placements');
  let wheelCount = 0;
  for (const photo of inventory.photos) {
    const placement = manifest.photos[photo.src];
    assert.deepEqual([placement.width, placement.height], [photo.width, photo.height], photo.src + ' dimensions');
    assert.equal(placement.sourceSha1 || '', photo.sourceSha1 || '', photo.src + ' upstream identity');
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, photo.src))).digest('hex');
    assert.equal(placement.localSha256, actualHash, photo.src + ' placements belong to these actual local image bytes');
    assert.ok(Array.isArray(placement.wheels) && placement.wheels.length > 0 && placement.wheels.length <= 4, photo.src);
    for (const wheel of placement.wheels) {
      assert.ok(['cx', 'cy', 'rx', 'ry', 'rotation'].every(key => Number.isFinite(wheel[key])), photo.src + ' finite ellipse');
      assert.ok(wheel.cx > 0 && wheel.cx < 1 && wheel.cy > 0 && wheel.cy < 1, photo.src + ' normalized centre');
      assert.ok(wheel.rx > 0 && wheel.rx < .3 && wheel.ry > 0 && wheel.ry < .5, photo.src + ' positive plausible radii');
      assert.ok(Math.abs(wheel.rotation) <= Math.PI, photo.src + ' rotation is in radians');
      if (wheel.clip !== undefined) {
        assert.ok(Array.isArray(wheel.clip) && wheel.clip.length >= 3 && wheel.clip.length <= 32, photo.src + ' visible polygon vertex count');
        assert.ok(wheel.clip.every(point => Array.isArray(point) && point.length === 2 && point.every(value => Number.isFinite(value) && value >= 0 && value <= 1)), photo.src + ' normalized visible polygon');
      }
      wheelCount++;
    }
  }
  console.log(`PASS placement data: 430 source identities/dimensions/local hashes, ${wheelCount} finite normalized rim ellipses. Geometric appearance is reviewed separately.`);
}

async function clipping(browser, errors) {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const importMap = JSON.stringify({ imports: { three: base + '/assets/vendor/three/three.module.js', 'three/addons/': base + '/assets/vendor/three/addons/' } });
  await page.route('**/nfw-wheel-clip-test.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><script type="importmap">${importMap}</script>` }));
  await page.goto(base + '/nfw-wheel-clip-test.html');
  const result = await page.evaluate(async moduleURL => {
    const { paintWheelFaces, validPlacement } = await import(moduleURL);
    const face = await NFWShowroom.renderWheelFace({ design: 'apex10', colorHex: '#a6793e', size: 256 });
    const wheel = { cx: .6, cy: .55, rx: .15, ry: .36, rotation: .48 };
    const placement = { width: 320, height: 180, wheels: [wheel] };
    const clip = [[.6, 0], [1, 0], [1, 1], [.6, 1]];
    const baseline = document.createElement('canvas'), clipped = document.createElement('canvas');
    paintWheelFaces(baseline, placement, face);
    paintWheelFaces(clipped, { ...placement, wheels: [{ ...wheel, clip }] }, face);
    const rgba = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const a = rgba(baseline), b = rgba(clipped);
    let removed = 0, hiddenAlpha = 0, retained = 0, retainedDifference = 0, retainedMaxDifference = 0, opaqueMaxDifference = 0;
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
      const offset = (y * 320 + x) * 4;
      if (x < 192) { if (a[offset + 3]) removed++; hiddenAlpha += b[offset + 3]; }
      else if (a[offset + 3]) {
        retained++;
        for (let channel = 0; channel < 4; channel++) {
          const difference = Math.abs(a[offset + channel] - b[offset + channel]);
          retainedDifference += difference;
          retainedMaxDifference = Math.max(retainedMaxDifference, difference);
          if (a[offset + 3] === 255 && b[offset + 3] === 255) opaqueMaxDifference = Math.max(opaqueMaxDifference, difference);
        }
      }
    }
    const invalid = [null, [], [[0, 0], [1, 1]], Array.from({ length: 33 }, () => [0, 0]),
      [[0, 0], [1, 0], [1, 2]], [[0, 0], [1, 0], ['.5', 1]], [[0, 0], [1, 0], [NaN, 1]], [[0, 0], [1, 0], [1, 1, 1]]];
    const rejects = invalid.map(value => !validPlacement({ ...placement, wheels: [{ ...wheel, clip: value }] }));
    paintWheelFaces(clipped, { ...placement, wheels: [{ ...wheel, clip }, { ...wheel, cx: .15, rx: .08, ry: .18 }] }, face);
    const secondWheelAlpha = clipped.getContext('2d').getImageData(48, 99, 1, 1).data[3];
    NFWShowroom.disposeWheelFaces({ clearCache: true });
    return { removed, hiddenAlpha, retained, retainedDifference, retainedMaxDifference, opaqueMaxDifference, secondWheelAlpha, rejects, valid: validPlacement({ ...placement, wheels: [{ ...wheel, clip }] }) };
  }, moduleURL);
  assert.equal(result.valid, true);
  assert.ok(result.rejects.every(Boolean), 'Invalid visibility polygons fail closed');
  assert.ok(result.removed > 2000 && result.retained > 2000, 'The test covers both sides of a real rendered, rotated wheel');
  assert.equal(result.hiddenAlpha, 0, 'Occluded wheel pixels are transparent in absolute photo coordinates despite wheel rotation');
  assert.ok(result.opaqueMaxDifference <= 2 && result.retainedDifference / (result.retained * 4) < .1, 'Visible wheel pixels keep the same rendering and alignment within antialiasing/readback rounding: ' + JSON.stringify(result));
  assert.equal(result.secondWheelAlpha, 255, 'A visibility polygon does not leak into subsequent wheels');
  console.log('PASS occlusion: normalized polygon validation, real rotated wheel pixels clipped in photo coordinates, visible pixels unchanged, context restored between wheels.');
  await page.close();
}

async function savePixels(page, name) {
  return page.locator('.vehicle-wheel-overlay').evaluate((canvas, key) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    window.__fitPixels ||= {};
    window.__fitPixels[key] = data;
    return canvas.toDataURL();
  }, name);
}

async function pixelDifference(page, before) {
  return page.locator('.vehicle-wheel-overlay').evaluate((canvas, key) => {
    const a = window.__fitPixels[key];
    const b = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0, visible = 0, totalDifference = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] || b[i + 3]) visible++;
      const difference = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      if (difference > 15) changed++;
      totalDifference += difference;
    }
    return { changed, visible, fraction: changed / visible, meanChannelDifference: totalDifference / (visible * 3) };
  }, before);
}

async function mainUI(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(configURL, { waitUntil: 'networkidle' });
  await ready(page, 'apex10');
  const modelSource = await page.locator('.vehicle-render').getAttribute('src');
  const validation = await page.evaluate(async ({ moduleURL, manifest }) => {
    const api = await import(moduleURL);
    const wheel = { cx: .3, cy: .6, rx: .07, ry: .13, rotation: .1 };
    const good = { width: 960, height: 600, wheels: [wheel] };
    const invalid = [null, {}, { ...good, wheels: [] }, { ...good, wheels: [null] }, { ...good, width: 0 },
      { ...good, wheels: [{ ...wheel, cx: 2 }] }, { ...good, wheels: [{ ...wheel, rx: -1 }] },
      { ...good, wheels: [{ ...wheel, rotation: NaN }] }];
    return { allValid: Object.values(manifest.photos).every(api.validPlacement), rejects: invalid.map(value => !api.validPlacement(value)) };
  }, { moduleURL, manifest });
  assert.equal(validation.allValid, true);
  assert.ok(validation.rejects.every(Boolean), 'Malformed placement data fails closed');

  await savePixels(page, 'initial');
  await page.locator('[data-step="2"]').click();
  await page.locator('[data-set="design"][data-val="mono5"]').click();
  await ready(page, 'mono5');
  const designDifference = await pixelDifference(page, 'initial');
  assert.ok(designDifference.fraction > .1, 'Changing the chosen wheel design changes visible rim pixels');
  await savePixels(page, 'design');
  const silver = await page.evaluate(() => NFW.COLORS.find(color => color.id === 'silver').hex);
  await page.locator('#stageFoot [data-set="color"][data-val="silver"]').click();
  await ready(page, 'mono5', silver);
  const colorDifference = await pixelDifference(page, 'design');
  assert.ok(colorDifference.meanChannelDifference > 1, 'Changing the chosen colour changes visible rim pixels');
  await page.locator('[data-step="4"]').click();
  await ready(page, 'mono5', silver);
  const finishBefore = await savePixels(page, 'color');
  await page.locator('[data-set="finish"][data-val="matte"]').click();
  await page.waitForFunction(before => {
    const canvas = document.querySelector('.vehicle-wheel-overlay');
    return canvas?.dataset.ready === 'true' && !document.querySelector('.wheel-photo-status').textContent.includes('Připravuji') && canvas.toDataURL() !== before;
  }, finishBefore);
  const finishDifference = await pixelDifference(page, 'color');
  assert.ok(finishDifference.meanChannelDifference > .5, 'Changing the selected finish changes actual light and material pixels');
  assert.equal(await page.locator('.vehicle-render').getAttribute('src'), modelSource, 'Wheel edits preserve the complete original car photo');
  const fittedScreenshot = await page.locator('.stage-vehicle-frame').screenshot();
  await savePixels(page, 'fitted');
  await page.getByRole('button', { name: 'Porovnat s původními koly' }).click();
  assert.equal(await page.locator('.wheel-photo-compare').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.vehicle-wheel-overlay').isVisible(), false);
  assert.equal(await page.locator('.stage-vehicle-frame').getAttribute('data-wheel-view'), 'original');
  assert.ok(!(await page.locator('.vehicle-render').getAttribute('alt')).includes('Osazeno návrhem'));
  const originalScreenshot = await page.locator('.stage-vehicle-frame').screenshot();
  assert.ok(!fittedScreenshot.equals(originalScreenshot), 'Original/new wheel comparison visibly changes the photograph, not just a label');
  await page.getByRole('button', { name: 'Porovnat s původními koly' }).click();
  await ready(page, 'mono5', silver);
  assert.equal((await pixelDifference(page, 'fitted')).changed, 0, 'Comparison restores the same visible wheel pixels');

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await page.evaluate(() => {
      const photo = document.querySelector('.vehicle-render'), canvas = document.querySelector('.vehicle-wheel-overlay');
      const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, top: r.top }; };
      const data = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
      return { photo: rect(photo), canvas: rect(canvas), natural: [photo.naturalWidth, photo.naturalHeight], intrinsic: [canvas.width, canvas.height],
        fit: [getComputedStyle(photo).objectFit, getComputedStyle(canvas).objectFit], transparentCorner: data[3],
        caption: rect(document.querySelector('.preview-caption')), toolbar: rect(document.querySelector('.wheel-photo-toolbar')),
        footer: rect(document.getElementById('stageFoot')), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(bounds.photo[key] - bounds.canvas[key]) < .6, `Overlay shares photo ${key} at ${width}px`);
    assert.deepEqual(bounds.natural, bounds.intrinsic, 'Source pixel aspect ratios agree, including letterboxing');
    assert.deepEqual(bounds.fit, ['contain', 'contain']);
    assert.equal(bounds.transparentCorner, 0, 'The overlay preserves surrounding car/body pixels');
    assert.ok(bounds.toolbar.bottom <= bounds.caption.top + 1, `Wheel controls precede caption at ${width}px`);
    assert.ok(bounds.caption.bottom <= bounds.footer.top + 1, `Photo caption/attribution clears footer at ${width}px`);
    assert.ok(bounds.overflow <= 1, `No horizontal overflow at ${width}px`);
    await page.locator('#stageView').screenshot({ path: path.join(root, `docs/qa/wheel-fit-${width}.png`) });
  }
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.vehicle-visual-description').evaluate(element => { element.textContent = 'Na obrázku: ' + 'Dlouhý konkrétní popis fotografie včetně generace, karoserie a provedení. '.repeat(3); });
    assert.ok(await page.evaluate(() => document.querySelector('.preview-caption').getBoundingClientRect().bottom <= document.getElementById('stageFoot').getBoundingClientRect().top + 1), `Long photo credit remains separate from stage controls at ${width}px`);
  }
  await page.getByRole('button', { name: '3D kolo', exact: true }).click();
  await page.locator('.webgl-view canvas').waitFor();
  assert.equal(await page.locator('.vehicle-wheel-overlay,.wheel-photo-toolbar').count(), 0, 'Photo controller is disposed when switching into actual 3D');
  await page.getByRole('button', { name: 'Můj vůz', exact: true }).click();
  await ready(page, 'mono5', silver);
  assert.equal(await page.locator('.vehicle-wheel-overlay').count(), 1);
  assert.equal(await page.locator('.wheel-photo-toolbar').count(), 1);
  assert.equal(await page.locator('.webgl-view canvas').count(), 0);
  console.log('PASS photo UI: visible design/colour/finish pixel changes, original comparison, responsive alignment and caption bounds, 3D/photo disposal.');
  console.log(JSON.stringify({ designDifference, colorDifference, finishDifference }));
  await page.close();
}

async function delayedUI(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  let release, requests = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/data/wheel-fitments.json*', async route => { requests++; await gate; await route.fulfill({ json: manifest }); });
  await page.goto(configURL, { waitUntil: 'domcontentloaded' });
  await page.locator('.vehicle-wheel-overlay').waitFor({ state: 'attached' });
  await page.selectOption('#vehicleBrand', 'tesla');
  await page.selectOption('#vehicleModel', 'model-y');
  await page.locator('[data-step="2"]').click();
  await page.locator('[data-set="design"][data-val="deep7"]').click();
  const silver = await page.evaluate(() => NFW.COLORS.find(color => color.id === 'silver').hex);
  await page.locator('#stageFoot [data-set="color"][data-val="silver"]').click();
  await page.getByRole('button', { name: '3D kolo', exact: true }).click();
  release();
  await page.locator('.webgl-view canvas').waitFor();
  assert.equal(await page.locator('.vehicle-wheel-overlay,.wheel-photo-toolbar').count(), 0, 'Late photo renders cannot replace the subsequently selected 3D mode');
  await page.getByRole('button', { name: 'Můj vůz', exact: true }).click();
  await ready(page, 'deep7', silver);
  assert.match(await page.locator('.vehicle-render').getAttribute('src'), /tesla--model-y/);
  assert.equal(await page.locator('.vehicle-wheel-overlay').count(), 1);
  assert.equal(await page.locator('.wheel-photo-toolbar').count(), 1);
  assert.ok(requests >= 1);
  await page.close();
}

async function pendingRevision(browser, errors) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  let release, requests = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/data/wheel-fitments.json*', async route => {
    requests++;
    if (requests === 2) await gate;
    await route.fulfill({ json: manifest });
  });
  const importMap = JSON.stringify({ imports: { three: base + '/assets/vendor/three/three.module.js', 'three/addons/': base + '/assets/vendor/three/addons/' } });
  await page.route('**/nfw-wheel-fit-test.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><script type="importmap">${importMap}</script><figure id="frame"><img></figure>` }));
  await page.goto(base + '/nfw-wheel-fit-test.html');
  const visual = inventory.photos.find(photo => photo.src === 'assets/vehicles/tesla--model-y.webp');
  await page.evaluate(async ({ moduleURL, visual }) => {
    window.__wheelFit = await import(moduleURL);
    const img = document.querySelector('img'); img.src = visual.src; await img.decode();
    window.__firstWheel = { design: 'apex10', colorHex: '#a6793e', finish: 'gloss', label: 'A' };
    window.__controller = __wheelFit.mountWheelPhoto(document.getElementById('frame'), visual, __firstWheel);
  }, { moduleURL, visual });
  await ready(page, 'apex10', '#a6793e');
  await savePixels(page, 'A');
  await page.evaluate(() => {
    window.__reload = __wheelFit.loadWheelFitments(true);
    __controller.update({ ...__firstWheel, design: 'mono5', label: 'B' });
  });
  await page.waitForTimeout(100); // Allow B to pass its debounce and await the held manifest.
  assert.equal(requests, 2);
  await page.evaluate(() => __controller.update(__firstWheel));
  release();
  await page.evaluate(() => window.__reload);
  await page.waitForTimeout(100);
  await ready(page, 'apex10', '#a6793e');
  const staleDifference = await pixelDifference(page, 'A');
  // Chrome can round a few channels by one level when its canvas readback path
  // changes; compare rendered pixels, not PNG encoder byte-for-byte output.
  assert.equal(staleDifference.changed, 0, 'A → pending B → A cannot paint stale B after its late fetch resolves');
  await page.evaluate(() => __controller.dispose());
  assert.equal(await page.locator('canvas,.wheel-photo-toolbar').count(), 0);
  await page.close();
}

async function recovery(browser, errors, mismatch) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  let requests = 0;
  await page.route('**/data/wheel-fitments.json*', route => {
    requests++;
    if (requests > 1) return route.fulfill({ json: manifest });
    if (!mismatch) return route.fulfill({ status: 503, body: 'Temporarily unavailable' });
    const bad = structuredClone(manifest);
    bad.photos['assets/vehicles/tesla--model-y.webp'].sourceSha1 = 'different-photograph';
    return route.fulfill({ json: bad });
  });
  await page.goto(base + '/konfigurator.html?brand=tesla&model=model-y&year=2020&view=car', { waitUntil: 'networkidle' });
  await page.locator('.wheel-photo-retry').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.vehicle-wheel-overlay').isVisible(), false);
  assert.equal(await page.locator('.wheel-photo-compare').isDisabled(), true);
  assert.equal(await page.locator('.stage-vehicle-frame').getAttribute('data-wheel-view'), 'unavailable');
  assert.ok(await page.locator('.vehicle-render').evaluate(img => img.naturalWidth > 0));
  await page.locator('.wheel-photo-retry').click();
  await ready(page, 'apex10');
  assert.equal(requests, 2, 'Retry makes a fresh metadata request after failure/mismatch');
  assert.equal(await page.locator('#vehicleModel').inputValue(), 'model-y');
  assert.equal(await page.locator('.wheel-photo-retry').isVisible(), false);
  await page.close();
}

(async () => {
  schemaChecks();
  if (process.argv.includes('--schema-only')) return;
  fs.mkdirSync(path.join(root, 'docs/qa'), { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    await clipping(browser, errors);
    if (process.argv.includes('--clip-only')) { assert.deepEqual(errors, []); return; }
    await mainUI(browser, errors);
    await delayedUI(browser, errors);
    await pendingRevision(browser, errors);
    await recovery(browser, errors, false);
    await recovery(browser, errors, true);
    assert.deepEqual(errors, []);
    console.log('PASS async safety: rapid car/design/colour changes, delayed switch to 3D, A → B → A revision cancellation, 503 retry, source-photo identity mismatch recovery, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
