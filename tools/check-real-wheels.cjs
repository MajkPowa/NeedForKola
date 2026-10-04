'use strict';
/** Read-only QA for reviewed real wheel media and the published gallery.
 * PLAYWRIGHT_MODULE selects an installed Playwright runtime.
 * NFW_BASE_URL defaults to the local static preview and accepts a Pages subpath.
 * NFW_STATIC_ONLY=1 verifies evidence/assets without launching a browser.
 * Screenshots are saved only in the ignored tools/.cache-wheel-fit directory.
 * Email links are inspected, never opened or sent.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const output = path.join(__dirname, '.cache-wheel-fit/real-wheels-qa');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/real-wheels-data.js'), 'utf8'), context);
const data = JSON.parse(JSON.stringify(context.window.NFWRealWheels));
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'data/real-wheel-media-inventory.json'), 'utf8'));
const review = JSON.parse(fs.readFileSync(path.join(root, 'data/real-wheels-review.json'), 'utf8'));
const rows = inventory.files;
const collections = data.collections;
const media = collections.flatMap(item => item.media);
const imagesToDecode = new Set();
const unique = (values, message) => assert.equal(new Set(values).size, values.length, message);
function localAsset(src, video = false) {
  assert.match(src, video ? /^assets\/real-wheels\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:mp4|webm)$/i : /^assets\/real-wheels\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|jpe?g|png|avif)$/i, 'safe local media path: ' + src);
  const resolved = path.resolve(root, src);
  assert.ok(resolved.startsWith(root + path.sep), 'media stays inside repository');
  assert.ok(fs.statSync(resolved).size > 0, 'nonempty file exists: ' + src);
  if (!video) imagesToDecode.add(src);
}
assert.equal(rows.length, 74, '62 Drive sources and 12 supplied photographs are inventoried');
assert.equal(review.files.length, rows.length, 'review and final inventory have the same source count');
unique(rows.map(row => row.id), 'source evidence IDs are unique');
unique(rows.map(row => row.number), 'source evidence numbers are unique');
assert.deepEqual(rows.map(row => row.id).sort(), review.files.map(row => row.id).sort(), 'no source file lost between review and conversion');
const kinds = {};
for (const row of rows) {
  kinds[row.kind] = (kinds[row.kind] || 0) + 1;
  assert.ok(row.originalName && row.sourceBytes > 0, 'source provenance for ' + row.id);
  if (row.sourceType === 'user-attachment') {
    assert.equal(row.sourceUrl, null, 'local attachments have no invented public source URL');
    assert.ok(inventory.sourceBatches.some(batch => batch.id === row.sourceBatchId), 'attachment references an evidenced batch');
    assert.match(row.originalName, /^WhatsApp Image 2026-10-01 at 18\.44\.05(?: \(\d+\))?\.jpeg$/, 'only supplied product JPEGs are imported');
    assert.equal(row.sourceSha256, row.sha256, 'attachment bytes match reviewed original');
  } else assert.match(row.sourceUrl, /^https:\/\/drive\.google\.com\/file\/d\//, 'original Drive provenance remains intact');
  assert.match(row.sha256, /^[a-f0-9]{64}$/i, 'source fingerprint for ' + row.id);
  assert.ok(Array.isArray(row.originalDimensions) && row.originalDimensions.every(value => Number.isInteger(value) && value > 0), 'source dimensions for ' + row.id);
  if (row.publish) {
    assert.ok(['product-photo', 'product-video', 'manufacturing-video'].includes(row.kind), 'reference material never published as actual wheel photography');
    assert.ok(row.web && row.web.id === row.id, 'published source maps to web media');
    localAsset(row.web.src, row.web.type === 'video'); localAsset(row.web.thumb);
    if (row.web.poster) localAsset(row.web.poster);
  } else assert.ok(!row.web, 'unpublished source has no website media: ' + row.id);
}
assert.equal(rows.filter(row => row.sourceType === 'user-attachment').length, 12, 'all twelve supplied wheel photos included');
assert.equal(rows.filter(row => row.sourceType !== 'user-attachment').length, 62, 'all original Drive sources preserved');
assert.deepEqual(kinds, { 'product-video': 6, 'duplicate': 1, 'product-photo': 46, 'manufacturing-video': 2, 'catalogue-reference': 9, 'design-sheet': 6, 'brand-reference': 1, 'engineering-reference': 3 }, 'reviewed classification totals');
assert.equal(rows.filter(row => row.publish).length, 54, '52 gallery media plus two manufacturing videos');
const duplicates = rows.filter(row => row.kind === 'duplicate');
for (const duplicate of duplicates) {
  const original = rows.find(row => row.id === duplicate.duplicateOf);
  assert.ok(original && !duplicate.publish, 'duplicate points to an inventoried original and is not published');
  assert.equal(duplicate.sha256, original.sha256, 'duplicate is confirmed by identical bytes');
}
assert.equal(collections.length, 29, '29 visually reviewed collections');
unique(collections.map(item => item.id), 'collection IDs unique');
unique(collections.map(item => item.reference), 'customer references unique');
assert.equal(media.length, 52, '52 unique actual gallery media');
unique(media.map(item => item.id), 'a source is not repeated between collections');
assert.equal(media.filter(item => item.type === 'image').length, 46);
assert.equal(media.filter(item => item.type === 'video').length, 6);
for (const item of collections) {
  assert.equal(item.availability, 'unconfirmed', 'photographs do not prove stock availability');
  assert.ok(item.title && item.reference && ['silver', 'black', 'bronze', 'other'].includes(item.tone));
  assert.ok(item.media.length > 0); localAsset(item.cover.src); localAsset(item.cover.thumb);
  for (const entry of item.media) {
    const record = rows.find(row => row.id === entry.id);
    assert.ok(record && record.publish && ['product-photo', 'product-video'].includes(record.kind), 'gallery contains only reviewed actual photographs/videos');
    assert.equal(record.collectionId, item.id, 'correct source-to-collection link');
    assert.deepEqual(entry, record.web, 'gallery media matches conversion inventory');
    assert.ok(entry.alt && entry.width > 0 && entry.height > 0, 'described, dimensioned media');
  }
}
const production = rows.filter(row => row.kind === 'manufacturing-video');
assert.ok(production.every(row => !media.some(entry => entry.id === row.id)), 'production footage stays separate from product gallery');
for (const id of ['nfw-r026', 'nfw-r027', 'nfw-r028', 'nfw-r029']) {
  const item = collections.find(entry => entry.id === id);
  assert.equal(item.media.length, 3, 'each October design keeps three distinct views');
  assert.ok(item.media.every(entry => rows.find(row => row.id === entry.id).sourceBatchId === 'whatsapp-20261001'), 'October photos are not assigned to an unverified prior design');
}
console.log('PASS evidence: 74 sources; 29 collections; 46 photos + 6 product videos; 2 production videos; duplicate and reference material excluded; local assets exist');
if (process.env.NFW_STATIC_ONLY === '1') process.exit(0);

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const settled = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function noOverflow(page, where) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), where + ': document has no horizontal overflow');
  if (await page.locator('.real-wheel-dialog').count()) assert.ok(await page.locator('.real-wheel-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1), where + ': dialog has no horizontal overflow');
}
async function targetSize(locator, message) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, message + ': 44px minimum target');
}
async function decodeImages(page) {
  const failures = await page.evaluate(async paths => {
    const failed = [], queue = [...paths];
    async function worker() {
      while (queue.length) {
        const source = queue.shift();
        try {
          await new Promise((resolve, reject) => {
            const img = new Image(), timeout = setTimeout(() => reject(new Error('timeout')), 20000);
            img.onload = async () => { try { await img.decode(); if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty image'); clearTimeout(timeout); resolve(); } catch (error) { clearTimeout(timeout); reject(error); } };
            img.onerror = () => { clearTimeout(timeout); reject(new Error('load error')); };
            img.src = source;
          });
        } catch (error) { failed.push(source + ': ' + error.message); }
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    return failed;
  }, [...imagesToDecode]);
  assert.deepEqual(failures, [], 'every original-sized image, thumbnail and video poster decodes in the browser');
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [width, height] of [[1440, 1000], [390, 844], [320, 568], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 1000, hasTouch: width < 1000, reducedMotion: 'reduce' });
      const errors = [], videoRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/\/assets\/real-wheels\/.*\.(mp4|webm)(?:\?|$)/.test(request.url())) videoRequests.push(request.url()); });
      await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
      const gallery = page.locator('#realWheelsGallery'); await gallery.waitFor(); await gallery.scrollIntoViewIfNeeded(); await settled(page);
      const batch = width <= 650 ? 6 : 9;
      assert.equal(await gallery.locator('.real-wheel-card').count(), batch, 'initial catalogue is paginated');
      assert.deepEqual(videoRequests, [], 'no real wheel video download before opening a detail');
      assert.ok(await gallery.locator('.real-wheel-card img').evaluateAll(images => images.every(img => img.loading === 'lazy' && /-thumb\./.test(img.getAttribute('src')))), 'cards only load lazy thumbnails');
      for (const row of production) {
        const video = page.locator('video[src="' + row.web.src + '"], video:has(source[src="' + row.web.src + '"])');
        assert.equal(await video.count(), 1, 'manufacturing video is placed once outside the product gallery');
        assert.equal(await video.getAttribute('preload'), 'none'); assert.equal(await video.getAttribute('autoplay'), null);
      }
      for (const tone of ['silver', 'black', 'bronze', 'other']) {
        const expected = collections.filter(item => item.tone === tone);
        const chip = gallery.locator('[data-tone="' + tone + '"]');
        if (!expected.length) { assert.equal(await chip.count(), 0); continue; }
        await targetSize(chip, 'color filter'); await chip.click();
        assert.equal(await chip.getAttribute('aria-pressed'), 'true');
        assert.equal(await gallery.locator('.real-wheel-card').count(), Math.min(batch, expected.length));
        const ids = await gallery.locator('.real-wheel-card').evaluateAll(cards => cards.map(card => card.dataset.realWheelId));
        assert.deepEqual(ids, expected.slice(0, batch).map(item => item.id), 'filter preserves reviewed order and identities');
      }
      await gallery.locator('[data-tone="all"]').click();
      while (await gallery.locator('.real-wheels-more__button').isVisible()) await gallery.locator('.real-wheels-more__button').click();
      assert.equal(await gallery.locator('.real-wheel-card').count(), collections.length, 'load more reaches all collections');
      unique(await gallery.locator('.real-wheel-card').evaluateAll(cards => cards.map(card => card.dataset.realWheelId)), 'paging introduces no duplicate cards');
      await noOverflow(page, width + 'px gallery');
      const sample = collections.find(item => item.media.some(entry => entry.type === 'video') && item.media.length > 1);
      const opener = gallery.locator('[data-real-wheel-id="' + sample.id + '"] .real-wheel-card__open');
      await opener.click();
      const dialog = page.locator('.real-wheel-dialog'); await dialog.waitFor();
      assert.equal(await dialog.getAttribute('open'), '');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'real-wheel-close');
      await targetSize(dialog.locator('.real-wheel-close'), 'dialog close');
      await targetSize(dialog.locator('.real-wheel-arrow').first(), 'previous photo');
      await targetSize(dialog.locator('.real-wheel-arrow').last(), 'next photo');
      await dialog.locator('.real-wheel-viewer__media img').evaluate(img => img.decode());
      const preview = await dialog.locator('.real-wheel-viewer__media img').evaluate(img => {
        const photo = img.getBoundingClientRect(), frame = img.closest('.real-wheel-viewer__frame').getBoundingClientRect();
        return { usable: photo.width > 200 && photo.height > 100 && photo.left >= frame.left - 1 && photo.right <= frame.right + 1 && photo.top >= frame.top - 1 && photo.bottom <= frame.bottom + 1, photo: photo.toJSON(), frame: frame.toJSON() };
      });
      assert.ok(preview.usable, 'initial wheel preview has usable dimensions and stays inside its frame: ' + JSON.stringify(preview));
      assert.ok(await dialog.locator('.real-wheel-arrow').last().evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'initial photo arrows are visible without scrolling');
      await page.screenshot({ path: path.join(output, width + 'x' + height + '-initial-detail.png') });
      assert.equal(await dialog.locator('.real-wheel-viewer__caption').innerText(), sample.media[0].alt);
      await dialog.locator('.real-wheel-arrow').last().click();
      assert.equal(await dialog.locator('.real-wheel-viewer__caption').innerText(), sample.media[1].alt);
      await dialog.locator('.real-wheel-arrow').first().click();
      assert.equal(await dialog.locator('.real-wheel-viewer__caption').innerText(), sample.media[0].alt);
      await page.keyboard.press('ArrowLeft');
      assert.equal(await dialog.locator('.real-wheel-viewer__caption').innerText(), sample.media.at(-1).alt, 'keyboard previous wraps');
      await page.keyboard.press('ArrowRight');
      assert.equal(await dialog.locator('.real-wheel-viewer__caption').innerText(), sample.media[0].alt, 'keyboard next wraps');
      const videoIndex = sample.media.findIndex(entry => entry.type === 'video');
      await dialog.locator('.real-wheel-thumb').nth(videoIndex).click();
      const video = dialog.locator('video'); assert.equal(await video.count(), 1);
      assert.equal(await video.getAttribute('preload'), 'none'); assert.equal(await video.getAttribute('autoplay'), null);
      assert.equal(await video.evaluate(el => el.paused), true, 'video waits for user playback');
      assert.equal(await dialog.locator('.real-wheel-viewer__caption').innerText(), sample.media[videoIndex].alt);
      if (width === 1440) {
        await video.evaluate(async el => { el.muted = true; await el.play(); });
        await page.waitForFunction(() => document.querySelector('.real-wheel-dialog video')?.currentTime > 0.15);
        assert.ok(await video.evaluate(el => el.videoWidth > 0 && el.videoHeight > 0 && el.duration > 0), 'converted gallery MP4 decodes and plays after explicit action');
        await video.evaluate(el => el.pause());
      }
      await dialog.locator('.real-wheel-thumb').first().click();
      await dialog.locator('.real-wheel-viewer__media img').evaluate(img => img.decode());
      assert.equal(await dialog.locator('.real-wheel-thumb[aria-current="true"]').count(), 1);
      const href = await dialog.locator('.real-wheel-enquiry').getAttribute('href');
      const enquiry = new URL(href, base + '/index.html');
      assert.ok(enquiry.pathname.endsWith('/objednavka.html')); assert.equal(enquiry.searchParams.size, 2);
      assert.equal(enquiry.searchParams.get('reference'), sample.reference, 'poptavka retains exact collection identity');
      assert.equal(enquiry.searchParams.get('source'), 'gallery');
      await noOverflow(page, width + 'px dialog');
      await dialog.locator('.real-wheel-close').focus();
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'real-wheel-enquiry', 'backwards tab stays inside dialog');
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'real-wheel-close', 'forwards tab stays inside dialog');
      await dialog.evaluate(el => { el.scrollTop = 0; }); await settled(page);
      await page.screenshot({ path: path.join(output, width + 'x' + height + '-detail.png') });
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
      assert.equal(await opener.evaluate(el => el === document.activeElement), true, 'Escape restores the opening button focus');
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'background scrolling restored');
      await gallery.locator('[data-tone="all"]').click(); await gallery.evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, width + 'x' + height + '-gallery.png') });
      if (width === 1440) {
        await decodeImages(page); console.log('PASS image decode: ' + imagesToDecode.size + ' full images, thumbnails and posters');
        const productionVideo = page.locator('video:has(source[src="' + production[0].web.src + '"])');
        await productionVideo.evaluate(el => new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('production metadata timeout')), 20000);
          el.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
          el.addEventListener('error', () => { clearTimeout(timer); reject(new Error('production video decode error')); }, { once: true });
          el.preload = 'metadata'; el.load();
        }));
        assert.ok(await productionVideo.evaluate(el => el.videoWidth > 0 && el.videoHeight > 0 && el.duration > 0), 'manufacturing MP4 has playable metadata');
        console.log('PASS video decode: product MP4 plays after explicit action; production MP4 metadata loads');
      }
      assert.deepEqual(errors, [], 'zero runtime errors');
      console.log('PASS ' + width + '×' + height + ': filtering, paging, media detail, keyboard, focus, mail reference, lazy videos, no overflow or runtime errors');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
