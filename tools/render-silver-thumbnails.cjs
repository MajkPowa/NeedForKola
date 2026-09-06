'use strict';
// Rebuild silver and legacy bronze previews from the live 3D geometry and supplied cap logo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const runtime = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (fs.existsSync(runtime) ? runtime : 'playwright'));
const root = path.resolve(__dirname, '..');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const destination = path.join(root, 'assets/renders/silver');

(async () => {
  fs.mkdirSync(destination, { recursive: true });
  const importMap = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<script\s+type="importmap">([\s\S]*?)<\/script>/)[1];
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(base + '/__silver_renderer__', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><script type="importmap">${importMap}</script></head><body></body></html>` }));
    await page.goto(base + '/__silver_renderer__');
    await page.addScriptTag({ url: base + '/js/wheels.js' });
    await page.evaluate(async url => { await import(url); }, base + '/js/showroom.js?v=silver-render-source');
    assert.equal(await page.evaluate(() => window.NFWShowroom.capLogoReady), true, 'The supplied logo must load before rebuilding product assets');
    const designs = await page.evaluate(() => window.NFW.DESIGNS.map(({ id, name }) => ({ id, name })));
    assert.equal(designs.length, 13);
    const hashes = new Set();
    const silver = { colour: '#b9bcc2', transparent: true, folder: 'silver' };
    const jobs = [...designs.map(d => ({ ...silver, ...d, file: d.id, size: 600 })), { ...silver, id: 'apex10', name: 'FORGED 10', file: 'apex10-feature', size: 900 },
      ...designs.map(d => ({ ...d, file: d.id, size: 400, colour: '#9a6d3a', transparent: false, folder: '' }))];
    for (const job of jobs) {
      const output = await page.evaluate(async ({ id, size, colour, transparent }) => {
        const data = await window.NFWShowroom.renderThumbnail({ design: id, color: colour, finish: 'gloss', lip: 'same', cap: 'black', diameter: 20, width: 9.5, size, transparent, shadows: true, quality: .97 });
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, size, size).data;
        let occupied = 0, bright = 0, grey = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 220) continue;
          occupied++;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          if (Math.min(r, g, b) > 105) { bright++; if (Math.max(r, g, b) - Math.min(r, g, b) < 35) grey++; }
        }
        const corners = [0, size - 1, size * (size - 1), size * size - 1].map(i => pixels[i * 4 + 3]);
        return { data, width: image.naturalWidth, height: image.naturalHeight, corners, occupied, bright, grey };
      }, job);
      assert.equal(output.width, job.size); assert.equal(output.height, job.size);
      assert.deepEqual(output.corners, Array(4).fill(job.transparent ? 0 : 255), job.file + ': expected background alpha');
      assert.ok(output.occupied > job.size * job.size * .12, job.file + ': complete 3D wheel is present');
      if (job.folder === 'silver') assert.ok(output.bright > 100 && output.grey / output.bright > .8, job.file + ': bright neutral silver, not bronze');
      const bytes = Buffer.from(output.data.split(',')[1], 'base64');
      if (job.folder === 'silver' && job.file === job.id) hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
      fs.writeFileSync(path.join(root, 'assets/renders', job.folder, job.file + '.webp'), bytes);
      console.log(`${job.folder || 'bronze'}/${job.file}: ${job.size} px, ${Math.round(bytes.length / 1024)} KB`);
    }
    assert.equal(hashes.size, 13, 'Every design has its own geometry/render');
    // The new export options must not change the established 400 px opaque API.
    const legacy = await page.evaluate(async () => {
      const src = await window.NFWShowroom.renderThumbnail({ design: 'mono5', color: '#b9bcc2' });
      const image = new Image(); image.src = src; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 400;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return { width: image.width, alpha: ctx.getImageData(0, 0, 1, 1).data[3] };
    });
    assert.deepEqual(legacy, { width: 400, alpha: 255 });
    const capVariants = await page.evaluate(() => ['black','carbon','silver','body','none'].map(cap => {
      const wheel = window.NFWShowroom.createWheel({ cap, color: '#b9bcc2' });
      const badge = wheel.getObjectByName('Oarts_cap_logo');
      const result = { cap, branded: Boolean(badge), source: badge?.material.map.userData.logoSource || null };
      const geometries = new Set(), materials = new Set(), textures = new Set();
      wheel.traverse(mesh => { if (mesh.geometry) geometries.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) materials.add(material); });
      materials.forEach(material => { Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); }); material.dispose(); });
      textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose());
      return result;
    }));
    assert.ok(capVariants.every(row => row.cap === 'none' ? !row.branded : row.branded && row.source === 'reference'), 'All fitted cap variants carry the supplied logo; none stays open');
    await page.evaluate(() => window.NFWShowroom.disposeThumbnails());
    assert.deepEqual(errors, []);
    console.log('PASS: 13 silver and 13 bronze 3D renders, 900 px feature, supplied logo on all caps, correct alpha, neutral silver, legacy API, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
