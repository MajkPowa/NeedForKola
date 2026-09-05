'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const config = base + '/konfigurator.html?brand=bmw&model=x5&year=2020&generation=g05&body=suv&view=car';
const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/bmw-x5-g05-model.json'), 'utf8'));

async function observeContexts(page, errors) {
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.auditContexts = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const context = original.call(this, type, ...args);
      if (type === 'webgl2' && context && !window.auditContexts.some(record => record.context === context)) {
        window.auditContexts.push({ canvas: this, context });
      }
      return context;
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await observeContexts(page, errors);
    let release, metadataRequested = false, released = false, glbRequests = 0;
    const gate = new Promise(resolve => { release = resolve; });
    page.on('request', request => { if (/bmw-x5-g05\.glb/.test(request.url())) glbRequests++; });
    await page.route('**/data/bmw-x5-g05-model.json*', async route => {
      metadataRequested = true;
      await gate;
      try { await route.fulfill({ json: metadata }); } catch { /* The cancelled request may already be closed. */ }
    });
    await page.goto(config, { waitUntil: 'domcontentloaded' });
    await page.locator('.webgl-view canvas').waitFor();
    await page.waitForFunction(() => auditContexts.length > 0);
    assert.equal(metadataRequested, true);
    await page.evaluate(() => { window.cancelledContext = auditContexts[0]; });
    await page.getByRole('button', { name: '3D kolo', exact: true }).click();
    await page.waitForFunction(() => cancelledContext.context.isContextLost(), null, { timeout: 5000 });
    const cancelled = await page.evaluate(() => ({ connected: cancelledContext.canvas.isConnected, lost: cancelledContext.context.isContextLost() }));
    assert.deepEqual(cancelled, { connected: false, lost: true }, 'The pending car GPU context is disposed immediately on switching');
    assert.equal(released, false, 'Cancellation happens before the blocked response is released');
    assert.equal(glbRequests, 0, 'A cancelled metadata request does not start the large model download');
    released = true; release();
    await page.waitForFunction(() => document.querySelector('.webgl-view .showroom-status')?.style.display === 'none');
    assert.equal(await page.locator('.webgl-view canvas').count(), 1);
    assert.equal(await page.locator('[data-vehicle-asset]').count(), 0, 'The cancelled car cannot replace the selected wheel');
    await page.close();
    console.log('PASS pending mount cancellation: detached GPU context lost before metadata release, no GLB download, subsequent wheel remains active.');

    const failure = await browser.newPage({ reducedMotion: 'reduce' });
    await observeContexts(failure, errors);
    const invalid = structuredClone(metadata);
    invalid.wheels.forEach(wheel => { wheel.rimRadius = 0; });
    let invalidGlbRequests = 0;
    failure.on('request', request => { if (/bmw-x5-g05\.glb/.test(request.url())) invalidGlbRequests++; });
    await failure.route('**/data/bmw-x5-g05-model.json*', route => route.fulfill({ json: invalid }));
    await failure.goto(config, { waitUntil: 'domcontentloaded' });
    await failure.locator('[data-retry-3d]').waitFor({ state: 'visible' });
    assert.equal(await failure.locator('[data-mounted-wheels]').count(), 0, 'Invalid zero-size wheels must not report successful mounting');
    assert.equal(await failure.locator('.webgl-view canvas').count(), 0);
    assert.match(await failure.locator('.viewer-fallback').innerText(), /nepodařilo načíst/);
    assert.equal(invalidGlbRequests, 0, 'Malformed metadata is rejected before loading model geometry');
    assert.equal(await failure.evaluate(() => auditContexts.length > 0 && auditContexts.every(record => record.context.isContextLost())), true);
    await failure.close();
    assert.deepEqual(errors, [], 'Cancellation and metadata validation cause no unhandled page errors');
    console.log('PASS invalid metadata: rimRadius=0 gives a visible failure/retry, no mounted-wheel success or GLB request, GPU resources disposed, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
