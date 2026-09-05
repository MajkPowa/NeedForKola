'use strict';
/** Non-destructive visual QA using the same WebGL face and painter as the website.
 * node tools/render-wheel-fit-qa.cjs [--start 1] [--end 430] [--allow-missing]
 *   [--overrides tools/wheel-fit-overrides.json] [--out tools/.cache-wheel-fit/composite-review]
 * All generated images stay in the ignored tools/.cache-wheel-fit directory.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const args = process.argv.slice(2);
const argNumber = (name, fallback) => args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback;
const argPath = (name, fallback) => {
  if (!args.includes(name)) return path.join(root, fallback);
  const value = args[args.indexOf(name) + 1];
  if (!value || value.startsWith('--')) throw new Error('Missing path for ' + name);
  return path.resolve(root, value);
};
const output = argPath('--out', 'tools/.cache-wheel-fit/composite-review');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'data/wheel-photo-inventory.json'), 'utf8')).photos;
const fitments = JSON.parse(fs.readFileSync(path.join(root, 'data/wheel-fitments.json'), 'utf8'));
const overrides = {};
const overrideFiles = args.includes('--overrides') ? [argPath('--overrides')] :
  fs.readdirSync(__dirname).filter(name => /^wheel-fit-overrides(?:-[a-z-]+)?\.json$/.test(name)).sort().map(name => path.join(__dirname, name));
for (const file of overrideFiles) {
  Object.assign(overrides, JSON.parse(fs.readFileSync(file, 'utf8')));
}
const first = argNumber('--start', 1), last = Math.min(argNumber('--end', inventory.length), inventory.length);
const faceOptions = { design: 'apex10', colorHex: '#a6793e', finish: 'gloss', cap: 'black', lip: 'same', size: 768 };
if (!Number.isInteger(first) || first < 1 || !Number.isInteger(last) || last < first) throw new Error('Invalid --start/--end');
if (fitments.schemaVersion !== 1 || !fitments.photos) throw new Error('Unknown fitment schema');
const photos = inventory.slice(first - 1, last).map((photo, offset) => ({
  ...photo, number: first + offset,
  placement: fitments.photos[photo.src] ? { ...fitments.photos[photo.src], ...overrides[photo.src] } : null,
  manuallyCorrected: Boolean(overrides[photo.src])
}));
const missing = photos.filter(photo => !photo.placement?.wheels?.length);
if (missing.length && !args.includes('--allow-missing')) throw new Error(`${missing.length} photos lack rim placements: ${missing.slice(0, 12).map(p => p.id).join(', ')}`);
const sourceHash = crypto.createHash('sha256');
for (const file of ['js/showroom.js', 'js/wheel-fit-preview.js']) sourceHash.update(fs.readFileSync(path.join(root, file)));
const rendererHash = sourceHash.digest('hex');
for (const folder of ['photos', 'overlays', 'sheets']) fs.mkdirSync(path.join(output, folder), { recursive: true });
const writeURL = (filename, dataURL) => fs.writeFileSync(filename, Buffer.from(dataURL.split(',')[1], 'base64'));

(async () => {
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const importMap = JSON.stringify({ imports: { three: base + '/assets/vendor/three/three.module.js', 'three/addons/': base + '/assets/vendor/three/addons/' } });
    await page.route('**/nfw-wheel-fit-qa.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><script type="importmap">${importMap}</script>` }));
    await page.goto(base + '/nfw-wheel-fit-qa.html');
    await page.evaluate(async ({ base, faceOptions }) => {
      const showroom = await import(base + '/js/showroom.js?v=20260905-wheel-fit');
      const painter = await import(base + '/js/wheel-fit-preview.js?v=20260905-wheel-fit');
      const face = await showroom.renderWheelFace(faceOptions);
      window.qa = { face, painter, faceOptions };
      window.qa.loadImage = async src => {
        const img = new Image(); img.src = src;
        await img.decode(); return img;
      };
    }, { base, faceOptions });
    let sheet = [], rendered = 0;
    const index = [];
    async function finishSheet() {
      if (!sheet.length) return;
      const number = Math.floor((sheet[0].number - 1) / 4) + 1;
      const dataURL = await page.evaluate(async rows => {
        const canvas = document.createElement('canvas'); canvas.width = 2000; canvas.height = 1900;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#14202b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const row of rows) {
          const panel = (row.number - 1) % 4, x = (panel % 2) * 1000, y = Math.floor(panel / 2) * 950;
          ctx.fillStyle = '#eef5fa'; ctx.font = 'bold 23px Arial';
          ctx.fillText(`${String(row.number).padStart(3, '0')} | ${row.key} | ${row.width} × ${row.height}`, x + 20, y + 30);
          ctx.font = '16px Arial'; ctx.fillStyle = '#bdccd8'; ctx.fillText(row.id, x + 20, y + 55);
          const original = await window.qa.loadImage(row.originalURL);
          const image = await window.qa.loadImage(row.compositeURL);
          const scale = Math.min(940 / image.width, 590 / image.height);
          ctx.drawImage(image, x + (1000 - image.width * scale) / 2, y + 68 + (590 - image.height * scale) / 2, image.width * scale, image.height * scale);
          const wheels = [...(row.placement?.wheels || [])].sort((a, b) => b.ry - a.ry).slice(0, 2);
          ctx.font = '17px Arial'; ctx.fillStyle = wheels.length ? '#bdccd8' : '#ff9c87';
          ctx.fillText(wheels.length ? `Bronze apex10 • ${row.manuallyCorrected ? 'manual correction' : 'automatic fit'} • detail: original / replacement` : 'MISSING PLACEMENT — original shown', x + 20, y + 690);
          for (let i = 0; i < wheels.length; i++) {
            const w = wheels[i], radius = Math.max(w.rx * row.width, w.ry * row.height) * 1.48;
            const left = w.cx * row.width - radius, top = w.cy * row.height - radius;
            const dx = x + 20 + i * 490, dy = y + 710;
            for (let side = 0; side < 2; side++) {
              ctx.fillStyle = '#0a1016'; ctx.fillRect(dx + side * 235, dy, 220, 220);
              ctx.drawImage(side ? image : original, left, top, radius * 2, radius * 2, dx + side * 235, dy, 220, 220);
            }
          }
        }
        return canvas.toDataURL('image/jpeg', .95);
      }, sheet);
      writeURL(path.join(output, 'sheets', `composites-${String(number).padStart(3, '0')}.jpg`), dataURL);
      sheet = [];
    }
    for (const photo of photos) {
      if (sheet.length && (photo.number - 1) % 4 === 0) await finishSheet();
      const result = await page.evaluate(async ({ photo, base }) => {
        const image = await window.qa.loadImage(base + '/' + photo.src + '?qa=' + photo.localSha256);
        if (image.naturalWidth !== photo.width || image.naturalHeight !== photo.height) throw new Error('Source dimensions changed: ' + photo.id);
        const overlay = document.createElement('canvas'); overlay.width = photo.width; overlay.height = photo.height;
        if (photo.placement) {
          if (!window.qa.painter.validPlacement(photo.placement)) throw new Error('Invalid placement: ' + photo.id);
          if (photo.placement.width !== photo.width || photo.placement.height !== photo.height) throw new Error('Fit dimensions stale: ' + photo.id);
          window.qa.painter.paintWheelFaces(overlay, photo.placement, window.qa.face, window.qa.faceOptions);
        }
        const composite = document.createElement('canvas'); composite.width = photo.width; composite.height = photo.height;
        const ctx = composite.getContext('2d'); ctx.drawImage(image, 0, 0); ctx.drawImage(overlay, 0, 0);
        return { overlay: overlay.toDataURL('image/png'), composite: composite.toDataURL('image/png') };
      }, { photo, base });
      writeURL(path.join(output, 'photos', photo.id + '.png'), result.composite);
      writeURL(path.join(output, 'overlays', photo.id + '.png'), result.overlay);
      sheet.push({ ...photo, originalURL: base + '/' + photo.src, compositeURL: result.composite });
      index.push({ number: photo.number, id: photo.id, src: photo.src, wheels: photo.placement?.wheels || [], manuallyCorrected: photo.manuallyCorrected, sheet: `sheets/composites-${String(Math.floor((photo.number - 1) / 4) + 1).padStart(3, '0')}.jpg`, composite: `photos/${photo.id}.png`, overlay: `overlays/${photo.id}.png` });
      if (++rendered % 40 === 0) console.log(`Rendered ${rendered}/${photos.length} photographs`);
    }
    await finishSheet();
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(path.join(output, `index-${first}-${last}.json`), JSON.stringify({ createdAt: new Date().toISOString(), rendererHash, faceOptions, first, last, missing: missing.map(p => p.id), photos: index }, null, 2) + '\n');
    console.log(`QA complete: ${photos.length} photographs, ${missing.length} missing, actual production painter + bronze WebGL wheel. Output: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
