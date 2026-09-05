'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const output = path.join(root, 'docs/qa');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    const importMap = JSON.stringify({ imports: { three: base + '/assets/vendor/three/three.module.js', 'three/addons/': base + '/assets/vendor/three/addons/' } });
    await page.route('**/nfw-wheel-projection-test.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><script type="importmap">${importMap}</script><style>body{margin:0;background:#171b20;color:#eee;font:18px Arial}canvas{max-width:100%;height:auto}</style>` }));
    await page.goto(base + '/nfw-wheel-projection-test.html');
    const result = await page.evaluate(async base => {
      const api = await import(base + '/js/wheel-fit-preview.js?v=20260905-360');
      const { wheelPhotoAngles: angles, validPlacement, paintWheelFaces: paint } = api;
      const pair = { width: 960, height: 600, wheels: [{ cx: .35, cy: .7, rx: .07, ry: .16, rotation: .1 }, { cx: .8, cy: .6, rx: .045, ry: .11, rotation: .05 }] };
      const pairAngles = pair.wheels.map((_, index) => angles(pair, index));
      const opposite = { ...pair, wheels: pair.wheels.map(wheel => ({ ...wheel, cx: 1 - wheel.cx })) };
      const explicit = { ...pair, wheels: [{ ...pair.wheels[0], yaw: -.31, pitch: .12 }, { ...pair.wheels[1], yaw: 0, pitch: 0 }] };
      const ambiguous = { ...pair, wheels: pair.wheels.map(wheel => ({ ...wheel, ry: .13 })) };
      const single = { ...pair, wheels: [pair.wheels[0]] };
      const invalidAngles = [NaN, null, '0.3', 2].map(yaw => !validPlacement({ ...pair, wheels: [{ ...pair.wheels[0], yaw }] }));
      invalidAngles.push(!validPlacement({ ...pair, wheels: [{ ...pair.wheels[0], pitch: -.9 }] }));
      const opts = { design: 'apex10', colorHex: '#a6793e', finish: 'gloss', size: 512 };
      const frontal = await NFWShowroom.renderWheelFace(opts);
      const positive = await NFWShowroom.renderWheelFace({ ...opts, yaw: .72, pitch: -.16 });
      const negative = await NFWShowroom.renderWheelFace({ ...opts, yaw: -.72, pitch: .13 });
      const cached = await NFWShowroom.renderWheelFace({ ...opts, yaw: .72, pitch: -.16 });
      const placement = { width: 420, height: 300, wheels: [{ cx: .52, cy: .53, rx: .155, ry: .34, rotation: .21 }] };
      const render = (faces, at = placement) => { const canvas = document.createElement('canvas'); paint(canvas, at, faces); return canvas; };
      const straight = render(frontal), angled = render(positive), reversed = render(negative);
      const pixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const a = pixels(straight), b = pixels(angled), c = pixels(reversed);
      let visible = 0, changed = 0, signChanged = 0, alphaMismatch = 0, maxAlphaDifference = 0, interiorTransparent = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] > 250) {
          visible++;
          if (b[i + 3] !== 255 || c[i + 3] !== 255) interiorTransparent++;
          if ([0, 1, 2].reduce((sum, ch) => sum + Math.abs(a[i + ch] - b[i + ch]), 0) > 20) changed++;
          if ([0, 1, 2].reduce((sum, ch) => sum + Math.abs(c[i + ch] - b[i + ch]), 0) > 20) signChanged++;
        }
        const alphaDifference = Math.abs(a[i + 3] - b[i + 3]);
        maxAlphaDifference = Math.max(maxAlphaDifference, alphaDifference);
        if (alphaDifference > 1) alphaMismatch++;
      }
      const bounds = data => {
        const box = [420, 300, 0, 0];
        for (let y = 0; y < 300; y++) for (let x = 0; x < 420; x++) if (data[(y * 420 + x) * 4 + 3] > 127) {
          box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
        }
        return box;
      };
      const silhouetteBounds = [a, b, c].map(bounds);
      let leaksOutsideEllipse = 0, transparentInsideEllipse = 0;
      const target = placement.wheels[0], cosine = Math.cos(target.rotation), sine = Math.sin(target.rotation);
      for (let y = 0; y < 300; y++) for (let x = 0; x < 420; x++) {
        const dx = x + .5 - target.cx * 420, dy = y + .5 - target.cy * 300;
        const distance = Math.hypot((dx * cosine + dy * sine) / (target.rx * 420), (-dx * sine + dy * cosine) / (target.ry * 300));
        for (const data of [b, c]) {
          const alpha = data[(y * 420 + x) * 4 + 3];
          if (distance > 1.025 && alpha) leaksOutsideEllipse++;
          if (distance < .975 && alpha !== 255) transparentInsideEllipse++;
        }
      }
      // The projected rim basis must account for yaw AND pitch shear in canvas axes.
      const [u, v, w, z] = positive.rimBasis, r = positive.radius;
      const expectedBasis = [r * Math.cos(.72), 0, -r * Math.sin(.72) * Math.sin(-.16), r * Math.cos(-.16)];
      const basisError = Math.max(...[u, v, w, z].map((value, index) => Math.abs(value - expectedBasis[index])));
      const legacy = { ...frontal }; delete legacy.rimBasis;
      const legacyPixels = pixels(render(legacy));
      const legacyEqual = a.every((value, index) => value === legacyPixels[index]);
      const dual = render([positive, negative], pair), repeat = render(positive, pair);
      const arrayDiffers = dual.toDataURL() !== repeat.toDataURL();
      const clipped = render(positive, { ...placement, wheels: [{ ...placement.wheels[0], clip: [[.52, 0], [1, 0], [1, 1], [.52, 1]] }] });
      const clippedPixels = pixels(clipped);
      let outsideClip = 0;
      for (let y = 0; y < 300; y++) for (let x = 0; x < Math.floor(420 * .52); x++) outsideClip += clippedPixels[(y * 420 + x) * 4 + 3];
      let rejectedBasis = false;
      try { render({ ...positive, rimBasis: [1, 1, 1, 1] }); } catch { rejectedBasis = true; }
      window.projectionQA = { api, frontal, opts };
      return { pairAngles, opposite: opposite.wheels.map((_, i) => angles(opposite, i)), explicit: explicit.wheels.map((_, i) => angles(explicit, i)),
        ambiguous: ambiguous.wheels.map((_, i) => angles(ambiguous, i)), single: angles(single, 0), invalidAngles,
        changedFraction: changed / visible, signChangedFraction: signChanged / visible, alphaMismatch, maxAlphaDifference, interiorTransparent, silhouetteBounds, leaksOutsideEllipse, transparentInsideEllipse,
        basisError, legacyEqual, arrayDiffers, outsideClip, rejectedBasis, cached: positive === cached,
        straight: straight.toDataURL(), angled: angled.toDataURL(), reversed: reversed.toDataURL() };
    }, base);
    assert.ok(result.pairAngles.every(value => value.yaw > 0 && value.yaw <= .65 && value.pitch === 0));
    assert.ok(result.opposite.every((value, i) => value.yaw === -result.pairAngles[i].yaw));
    assert.deepEqual(result.explicit, [{ yaw: -.31, pitch: .12 }, { yaw: 0, pitch: 0 }]);
    assert.ok([...result.ambiguous, result.single].every(value => value.yaw === 0 && value.pitch === 0));
    assert.ok(result.invalidAngles.every(Boolean));
    assert.ok(result.changedFraction > .12 && result.signChangedFraction > .12, 'Viewing angle changes actual recessed spoke/brake pixels');
    assert.ok(result.silhouetteBounds.every(box => box.every((value, index) => Math.abs(value - result.silhouetteBounds[0][index]) <= 1)), 'Different projection angles retain the calibrated ellipse silhouette within edge antialiasing');
    assert.equal(result.leaksOutsideEllipse, 0, 'Projected barrels cannot escape the calibrated rim');
    assert.equal(result.transparentInsideEllipse, 0, 'The target ellipse remains completely covered between spokes');
    assert.ok(result.interiorTransparent < 50, 'No old wheel can leak through an angled rim');
    assert.ok(result.basisError < 1e-8, 'Returned basis follows the full yaw/pitch projection including its shear');
    assert.equal(result.legacyEqual, true, 'Legacy single-face API without basis remains supported');
    assert.equal(result.arrayDiffers, true, 'Each wheel can use a different view');
    assert.equal(result.outsideClip, 0, 'KEEP mask remains fixed in photo coordinates for angled faces');
    assert.equal(result.rejectedBasis, true);
    assert.equal(result.cached, true);
    fs.mkdirSync(output, { recursive: true });
    for (const key of ['straight', 'angled', 'reversed']) fs.writeFileSync(path.join(output, `wheel-projection-${key}.png`), Buffer.from(result[key].split(',')[1], 'base64'));
    console.log('PASS wheel projection: conservative/explicit angle selection, signed depth changes, stable fitted silhouettes, no transparent interior, projection shear, legacy and per-wheel API, fixed KEEP polygon, cache.');
    console.log(JSON.stringify({ changedFraction: result.changedFraction, signChangedFraction: result.signChangedFraction, alphaMismatch: result.alphaMismatch, maxAlphaDifference: result.maxAlphaDifference, interiorTransparent: result.interiorTransparent }));
    const inventory = JSON.parse(fs.readFileSync(path.join(root, 'data/wheel-photo-inventory.json'))).photos;
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/wheel-fitments.json')));
    const samples = [2, 358, 394, 397, 422, 429].map(number => ({ number, ...inventory[number - 1], placement: manifest.photos[inventory[number - 1].src] }));
    for (const sample of samples) {
      const evidence = await page.evaluate(async ({ sample, base }) => {
        const { api, frontal, opts } = window.projectionQA;
        const image = new Image(); image.src = base + '/' + sample.src; await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = sample.width * 2; canvas.height = sample.height + 34;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#171b20'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const angles = sample.placement.wheels.map((_, index) => api.wheelPhotoAngles(sample.placement, index));
        const faces = [];
        for (const orientation of angles) faces.push(await NFWShowroom.renderWheelFace({ ...opts, ...orientation }));
        for (const [index, face] of [[0, frontal], [1, faces]]) {
          const overlay = document.createElement('canvas'); api.paintWheelFaces(overlay, sample.placement, face);
          ctx.drawImage(image, index * sample.width, 34); ctx.drawImage(overlay, index * sample.width, 34);
          ctx.fillStyle = '#eeeeee'; ctx.font = '19px Arial'; ctx.fillText(`${sample.number} ${sample.key} | ${index ? 'New per-wheel projection' : 'Frontal reference'}`, index * sample.width + 10, 24);
        }
        return canvas.toDataURL('image/jpeg', .93);
      }, { sample, base });
      fs.writeFileSync(path.join(output, `wheel-projection-photo-${sample.number}.jpg`), Buffer.from(evidence.split(',')[1], 'base64'));
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
