'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const output = path.resolve(__dirname, '../docs/qa');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const importMap = JSON.stringify({ imports: { three: base + '/assets/vendor/three/three.module.js', 'three/addons/': base + '/assets/vendor/three/addons/' } });
    await page.route('**/nfw-wheel-face-test.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><script type="importmap">${importMap}</script><div id="studio" style="width:400px;height:400px;position:relative"></div>` }));
    await page.goto(base + '/nfw-wheel-face-test.html');
    const result = await page.evaluate(async moduleURL => {
      const module = await import(moduleURL);
      const main = await module.mount(document.getElementById('studio'), { design: 'deep7', color: '#acacac', autoRotate: false, thumbnail: true });
      await new Promise(requestAnimationFrame);
      const before = main.capture('image/png');
      const bronzeOptions = { design: 'apex10', colorHex: '#a6793e', finish: 'gloss', cap: 'black', lip: 'same', size: 512 };
      const [bronze, mono, silver, cached, threePiece] = await Promise.all([
        module.renderWheelFace(bronzeOptions),
        module.renderWheelFace({ ...bronzeOptions, design: 'mono5' }),
        module.renderWheelFace({ ...bronzeOptions, colorHex: '#bfc5cd' }),
        module.renderWheelFace(bronzeOptions),
        module.renderWheelFace({ design: 'mesh3pc', colorHex: '#bfc5cd', finish: 'chrome', cap: 'carbon', lip: 'polished', size: 256 })
      ]);
      const pixels = image => image.canvas.getContext('2d').getImageData(0, 0, image.width, image.height).data;
      const a = pixels(bronze), b = pixels(mono), c = pixels(silver);
      const change = other => {
        let changed = 0, total = 0;
        for (let i = 0; i < a.length; i += 4) {
          const difference = Math.abs(a[i] - other[i]) + Math.abs(a[i + 1] - other[i + 1]) + Math.abs(a[i + 2] - other[i + 2]);
          if (difference > 15) changed++;
          total += difference;
        }
        return { changedFraction: changed / (a.length / 4), meanChannelDifference: total / (a.length / 4 * 3) };
      };
      const alphaStats = image => {
        const rgba = pixels(image), size = image.width;
        const alpha = (x, y) => rgba[(y * size + x) * 4 + 3];
        let transparentInterior = 0, minX = size, maxX = 0, minY = size, maxY = 0, antialiased = 0;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const value = alpha(x, y), distance = Math.hypot(x + .5 - image.centerX, y + .5 - image.centerY);
          if (distance < image.radius * .95 && value !== 255) transparentInterior++;
          if (value) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
          if (value > 0 && value < 255) antialiased++;
        }
        return { corners: [alpha(0, 0), alpha(size - 1, 0), alpha(0, size - 1), alpha(size - 1, size - 1)], transparentInterior, minX, maxX, minY, maxY, antialiased };
      };
      const afterFaces = main.capture('image/png');
      module.disposeWheelFaces();
      const cachedAfterDispose = await module.renderWheelFace(bronzeOptions);
      const angled = await module.renderWheelFace({ ...bronzeOptions, yaw: .38, pitch: -.12 });
      const stableAfterDispose = main.capture('image/png') === before && !main.renderer.getContext().isContextLost();
      const result = {
        apiExposed: window.NFWShowroom.renderWheelFace === module.renderWheelFace,
        bronze: bronze.src, mono: mono.src, silver: silver.src, threePiece: threePiece.src, angled: angled.src,
        bronzeSize: [bronze.width, bronze.height], threePieceSize: [threePiece.width, threePiece.height],
        centre: [bronze.centerX, bronze.centerY], radius: bronze.radius,
        alpha: alphaStats(bronze), threePieceAlpha: alphaStats(threePiece),
        designChange: change(b), colourChange: change(c),
        cachedIdentity: bronze === cached && bronze.canvas === cached.canvas,
        survivesDisposal: cachedAfterDispose.canvas === bronze.canvas && cachedAfterDispose.src === bronze.src,
        existingShowroomStable: before === afterFaces && stableAfterDispose,
        angledDiffers: angled.src !== bronze.src,
        options: bronze.options,
        mainCanvases: document.querySelectorAll('#studio canvas').length
      };
      module.disposeWheelFaces({ clearCache: true }); main.dispose();
      return result;
    }, base + '/js/showroom.js');
    assert.equal(result.apiExposed, true);
    assert.deepEqual(result.bronzeSize, [512, 512]);
    assert.deepEqual(result.threePieceSize, [256, 256]);
    assert.deepEqual(result.centre, [256, 256]);
    assert.ok(result.radius > 248 && result.radius < 256);
    for (const stats of [result.alpha, result.threePieceAlpha]) {
      assert.deepEqual(stats.corners, [0, 0, 0, 0], 'No background or floor outside the rim');
      assert.equal(stats.transparentInterior, 0, 'The original photographed wheel cannot show through the spokes');
      assert.ok(stats.antialiased > 30, 'Rim silhouette is antialiased');
      assert.ok(Math.abs(stats.minX - stats.minY) <= 1 && Math.abs(stats.maxX - stats.maxY) <= 1, 'Straight-on circular footprint is centred and symmetric');
    }
    assert.ok(result.designChange.changedFraction > .025, 'A different spoke design must change actual visible pixels');
    assert.ok(result.colourChange.meanChannelDifference > 1, 'A different wheel colour must change actual visible pixels');
    assert.equal(result.options.color, '#a6793e');
    assert.equal(result.cachedIdentity, true, 'Identical concurrent requests reuse a completed cached snapshot');
    assert.equal(result.survivesDisposal, true, 'GPU cleanup does not invalidate existing raster snapshots');
    assert.equal(result.existingShowroomStable, true, 'Temporary face rendering must not reset or destroy the visible showroom');
    assert.equal(result.mainCanvases, 1);
    assert.equal(result.angledDiffers, true, 'Optional yaw/pitch alter the actual geometry projection');
    assert.deepEqual(errors, []);
    fs.mkdirSync(output, { recursive: true });
    for (const key of ['bronze', 'mono', 'silver', 'threePiece', 'angled']) fs.writeFileSync(path.join(output, 'wheel-face-' + key + '.png'), Buffer.from(result[key].split(',')[1], 'base64'));
    console.log('PASS wheel faces: real design/colour pixel changes, 256/512px alpha snapshots, opaque brakes, antialiased circular rim, queued cache, yaw/pitch, independent GPU disposal and unchanged existing showroom.');
    console.log(JSON.stringify({ designChange: result.designChange, colourChange: result.colourChange, alpha: result.alpha, radius: result.radius }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
