'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NFW_BASE_URL || 'http://127.0.0.1:8765';
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const observeErrors = page => page.on('pageerror', error => errors.push(error.message));
  const activeIndex = page => page.locator('[data-hero-slide]').evaluateAll(slides => slides.findIndex(slide => !slide.hidden));
  const isPlaying = page => page.locator('.hero-carousel').evaluate(hero => hero.classList.contains('is-playing'));
  const settle = async (page, predicate, message) => {
    // IntersectionObserver/layout callbacks remain real browser events with a mocked clock.
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await predicate()) return;
      if (page.clock) await page.clock.runFor(30);
      await wait(40);
    }
    assert.ok(await predicate(), message);
  };
  try {
    const autoplay = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    observeErrors(autoplay);
    await autoplay.clock.install({ time: new Date('2026-09-05T10:00:00Z') });
    await autoplay.goto(base + '/index.html', { waitUntil: 'networkidle' });
    await autoplay.clock.pauseAt(new Date('2026-09-05T10:01:00Z'));
    await autoplay.locator('[data-hero-to="0"]').click();
    await autoplay.mouse.move(4, 4);
    await autoplay.locator('.nav .logo').focus();
    await settle(autoplay, () => isPlaying(autoplay), 'Autoplay is active while the visible hero is idle');
    let initial = await activeIndex(autoplay);
    await autoplay.clock.runFor(7600);
    assert.equal(await activeIndex(autoplay), (initial + 1) % 3, 'Autoplay advances one slide');

    await autoplay.locator('.hero-carousel').hover({ position: { x: 1200, y: 350 } });
    initial = await activeIndex(autoplay);
    assert.equal(await isPlaying(autoplay), false, 'Hover pauses automatic movement');
    await autoplay.clock.runFor(16000);
    assert.equal(await activeIndex(autoplay), initial);
    await autoplay.mouse.move(4, 4);
    await autoplay.locator('[data-hero-next]').focus();
    initial = await activeIndex(autoplay);
    assert.equal(await isPlaying(autoplay), false, 'Keyboard focus pauses automatic movement');
    await autoplay.clock.runFor(16000);
    assert.equal(await activeIndex(autoplay), initial);

    await autoplay.locator('[data-hero-pause]').click();
    assert.equal(await autoplay.locator('[data-hero-pause]').getAttribute('aria-pressed'), 'true');
    await autoplay.mouse.move(4, 4);
    await autoplay.locator('.nav .logo').focus();
    initial = await activeIndex(autoplay);
    await autoplay.clock.runFor(16000);
    assert.equal(await activeIndex(autoplay), initial, 'Explicit pause persists after pointer and focus leave');
    await autoplay.locator('[data-hero-pause]').click();
    assert.equal(await isPlaying(autoplay), true, 'Explicit Play starts playback even with focus on its button');
    initial = await activeIndex(autoplay);
    await autoplay.clock.runFor(7600);
    assert.equal(await activeIndex(autoplay), (initial + 1) % 3, 'Explicit Play advances with its button still focused');

    await autoplay.mouse.move(4, 4);
    await autoplay.locator('.nav .logo').focus();
    await autoplay.locator('#designy').evaluate(section => section.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await settle(autoplay, async () => !(await isPlaying(autoplay)), 'Offscreen hero stops autoplay');
    initial = await activeIndex(autoplay);
    await autoplay.clock.runFor(16000);
    assert.equal(await activeIndex(autoplay), initial, 'Slides do not advance offscreen');
    await autoplay.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await settle(autoplay, () => isPlaying(autoplay), 'Autoplay resumes when the hero returns onscreen');
    console.log('PASS landing autoplay: 7.5-second cadence, hover, focus, explicit pause/play and offscreen suspension.');
    await autoplay.close();

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    observeErrors(page);
    await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-hero-slide]').count(), 3);
    assert.equal(await page.locator('[data-hero-slide]:visible').count(), 1);
    assert.equal(await page.locator('[data-hero-pause]').isDisabled(), true);
    assert.equal(await isPlaying(page), false);
    await page.locator('[data-hero-next]').click();
    assert.equal(await activeIndex(page), 1);
    assert.equal(await page.locator('[data-hero-to="1"]').getAttribute('aria-current'), 'true');
    assert.match(await page.locator('#heroStatus').innerText(), /2 ze 3/);
    assert.equal(await page.locator('[data-hero-slide]:visible .btn').getAttribute('href'), '#vehicleCatalogue');
    await page.locator('[data-hero-prev]').click();
    assert.equal(await activeIndex(page), 0);
    await page.locator('[data-hero-to="2"]').click();
    assert.equal(await activeIndex(page), 2);
    await page.locator('[data-hero-next]').click();
    assert.equal(await activeIndex(page), 0, 'Carousel wraps forward');
    await page.locator('[data-hero-prev]').click();
    assert.equal(await activeIndex(page), 2, 'Carousel wraps backward');
    await page.locator('[data-hero-to="1"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await activeIndex(page), 0, 'Carousel supports keyboard navigation');
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    initial = await activeIndex(page);
    await page.clock.runFor(23000);
    assert.equal(await activeIndex(page), initial, 'Reduced motion never autoplays');
    await page.clock.resume();
    console.log('PASS landing controls: three slides, arrows/dots/wrap/keyboard/status and no autoplay with reduced motion.');

    const track = page.locator('#designsGrid');
    const collectionNext = page.locator('[data-design-next]');
    const collectionPrev = page.locator('[data-design-prev]');
    assert.equal(await track.locator('a.design-card').count(), 13);
    const designIds = await track.locator('a.design-card').evaluateAll(links => links.map(link => new URL(link.href).searchParams.get('design')));
    assert.equal(new Set(designIds).size, 13);
    assert.ok(designIds.every(Boolean), 'Every design links to its own configurator');
    await track.scrollIntoViewIfNeeded();
    assert.equal(await collectionPrev.isDisabled(), true);
    assert.equal(await collectionNext.isDisabled(), false);
    await collectionNext.click();
    await page.waitForFunction(() => document.getElementById('designsGrid').scrollLeft > 100);
    await page.waitForFunction(() => !document.querySelector('[data-design-prev]').disabled);
    assert.equal(await collectionPrev.isDisabled(), false);
    assert.notEqual(await page.locator('#collectionPosition').innerText(), '01 / 13');
    await collectionPrev.click();
    await page.waitForFunction(() => document.getElementById('designsGrid').scrollLeft < 3);
    await track.focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.getElementById('designsGrid').scrollLeft > 100);
    await track.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await page.waitForFunction(() => document.querySelector('[data-design-next]').disabled);
    assert.equal(await collectionNext.isDisabled(), true);
    const lastCardVisible = await track.evaluate(element => {
      const trackRect = element.getBoundingClientRect();
      const lastRect = element.lastElementChild.getBoundingClientRect();
      return lastRect.right <= trackRect.right + 2 && lastRect.left >= trackRect.left;
    });
    assert.ok(lastCardVisible, 'The last design is reachable inside the collection');
    console.log('PASS collection: all 13 exact links, horizontal arrows/keyboard and reachable last design.');

    await page.selectOption('#catalogBrand', 'skoda');
    await page.locator('#catalogSearch').fill('Octavia');
    await page.waitForFunction(() => document.querySelectorAll('.catalog-card').length === 1);
    await page.selectOption('#catalogYear', '2020');
    await page.locator('[data-discover-brand="bmw"]').click();
    assert.equal(await page.locator('#catalogBrand').inputValue(), 'bmw');
    assert.equal(await page.locator('#catalogSearch').inputValue(), '');
    assert.equal(await page.locator('#catalogYear').inputValue(), '');
    assert.match(await page.locator('.catalog-brand-field .nfw-brand-trigger').innerText(), /BMW/);
    assert.match(await page.locator('#catalogResultCount').innerText(), /20 model/);
    assert.equal(await page.locator('#brandRibbonLogos a img').count(), 8);
    const filterUrl = new URL(page.url());
    assert.equal(filterUrl.searchParams.get('catalogBrand'), 'bmw');
    assert.equal(filterUrl.searchParams.has('catalogSearch'), false);
    assert.equal(filterUrl.searchParams.has('catalogYear'), false);
    console.log('PASS discovery links: eight real logos and brand choice clears old model/year filters.');

    const dock = page.locator('#discoveryDock');
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForFunction(() => document.getElementById('discoveryDock').hidden);
      assert.equal(await dock.isVisible(), false, 'Dock hidden in hero');
      for (const target of ['#uvod', '#designy', '#vehicleCatalogue', '#kontakt']) {
        await page.locator(target).evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'start' }));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal overflow at ${width}px / ${target}`);
        if (target === '#designy' || target === '#vehicleCatalogue') {
          await page.waitForFunction(() => !document.getElementById('discoveryDock').hidden);
          assert.equal(await dock.isVisible(), true, 'Dock appears between hero and contact');
        }
        if (target === '#kontakt') {
          await page.waitForFunction(() => document.getElementById('discoveryDock').hidden);
          assert.equal(await dock.isVisible(), false, 'Dock stays out of the contact form');
        }
      }
    }
    assert.ok(await page.evaluate(() => Number(document.documentElement.style.getPropertyValue('--reading-progress')) > 0.5));
    assert.deepEqual(errors, []);
    console.log('PASS responsive landing: 390/768/1440px, no horizontal overflow, dock hidden at hero/contact, reading progress, no runtime errors.');
    await page.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
