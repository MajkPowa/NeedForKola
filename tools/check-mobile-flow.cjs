'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const output = path.join(__dirname, '.cache-wheel-fit/mobile-flow-qa');
const state = page => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.hash.slice(1))));
const settled = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function visibleControl(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.height >= 44 && box.width >= 44, selector + ' needs a 44px target');
  assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 1, selector + ' must stay in viewport');
  assert.ok(await page.locator(selector).evaluate(element => {
    const r = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  }), selector + ' must not be obscured');
}
async function focusVisible(page, id) {
  await page.waitForFunction(id => document.activeElement?.id === id, id);
  await settled(page);
  assert.ok(await page.locator('#' + id).evaluate(element => {
    const r = element.getBoundingClientRect(), nav = document.querySelector('.nav').getBoundingClientRect();
    const foot = document.querySelector('#panelFoot').getBoundingClientRect();
    return r.top >= nav.bottom - 1 && r.bottom <= foot.top + 1;
  }), id + ' focused above footer and below header');
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const shot = name => page.screenshot({ path: path.join(output, `${width}x${height}-${name}.png`) });
      await page.goto(base + '/konfigurator.html?brand=bmw&model=rada-5&year=2019&body=wagon', { waitUntil: 'networkidle' });
      await page.locator('#stageView canvas').waitFor(); await settled(page);
      assert.equal((await state(page)).view, 'wheel', 'fresh mobile configuration starts with wheel');
      assert.equal((await state(page)).generation, 'v-1b3b3ef6ba08', 'exact G31 identity preserved');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
      await visibleControl(page, '#nextStep'); await visibleControl(page, '[data-flow-preview]');
      assert.ok(await page.locator('#stageView canvas').evaluate(canvas => {
        const r = canvas.getBoundingClientRect(), footer = document.querySelector('#panelFoot').getBoundingClientRect();
        return Math.min(r.bottom, footer.top) - Math.max(r.top, document.querySelector('.nav').getBoundingClientRect().bottom) >= 90;
      }), 'first screen includes a usable wheel preview');
      assert.equal(await page.locator('#prevStep').isDisabled(), true);
      assert.equal(await page.locator('[data-flow-detail="vehicle-info"]').getAttribute('open'), null);
      await shot('start');
      await page.selectOption('#vehicleModel', 'x3'); await focusVisible(page, 'vehicleYear');
      assert.equal((await state(page)).step, '1', 'vehicle choice does not auto advance step');
      await page.selectOption('#vehicleModel', 'rada-5'); await focusVisible(page, 'vehicleYear');
      await page.selectOption('#vehicleYear', '2019'); await focusVisible(page, 'vehicleBody');
      await page.selectOption('#vehicleBody', 'wagon');
      await page.waitForFunction(() => document.activeElement?.id === 'nextStep');
      assert.equal((await state(page)).generation, 'v-1b3b3ef6ba08');
      await page.locator('#nextStep').click(); await page.waitForFunction(() => document.activeElement?.id === 'mobileFlowIntro');
      assert.equal((await state(page)).step, '2');
      const design = page.locator('#panelBody [data-set="design"]').last();
      const chosen = await design.getAttribute('data-val');
      await design.click(); await settled(page);
      assert.equal((await state(page)).design, chosen);
      assert.equal(await page.locator(`#panelBody [data-val="${chosen}"]`).getAttribute('aria-pressed'), 'true');
      await visibleControl(page, '[data-flow-preview]'); await visibleControl(page, '#nextStep');
      await page.locator('[data-flow-preview]').click(); await settled(page);
      assert.equal((await state(page)).view, 'wheel');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'mobileFlowIntro');
      await shot('chosen-wheel');
      await page.locator('#nextStep').click(); await settled(page);
      assert.equal((await state(page)).step, '3');
      const dimensions = page.locator('[data-flow-detail="dimensions"]');
      assert.equal(await dimensions.getAttribute('open'), null);
      await dimensions.locator('summary').click();
      await page.locator('#stagToggle').uncheck(); await settled(page);
      assert.notEqual(await dimensions.getAttribute('open'), null, 'advanced details stay open after rerender');
      await page.locator('#nextStep').click(); await settled(page);
      const finishing = page.locator('[data-flow-detail="finishing"]');
      assert.equal(await finishing.getAttribute('open'), null);
      await page.locator('#panelBody [data-set="color"][data-val="gunmetal"]').click();
      await finishing.locator('summary').click();
      const cap = page.locator('#panelBody [data-set="cap"]').last(), chosenCap = await cap.getAttribute('data-val');
      await cap.click(); await settled(page);
      assert.notEqual(await finishing.getAttribute('open'), null, 'finishing stays open after choice');
      await page.locator('#nextStep').click(); await settled(page);
      assert.equal((await state(page)).step, '5');
      assert.equal((await state(page)).cap, chosenCap);
      assert.equal(await page.locator('.flow-summary-edit').count(), 4);
      assert.match(await page.locator('#sendMail2').innerText(), /Zadat kontakt/);
      await shot('summary');
      await page.locator('#sendMail2').click(); await focusVisible(page, 'enquiryTitle');
      assert.match(await page.locator('#sendMail2').innerText(), /Připravit e-mail/);
      assert.equal((await state(page)).step, '5', 'contact handoff must not replace configuration hash');
      await shot('contact');
      // Inspect the prepared mail without opening an external mail application.
      await page.evaluate(() => document.addEventListener('click', event => {
        if (event.target.closest('#sendMail, #sendMail2')) event.preventDefault();
      }));
      await page.locator('#sendMail2').click();
      await page.waitForFunction(() => document.activeElement?.dataset.set === 'name');
      await page.locator('[data-set="name"]').fill('Kontrola mobilního návrhu');
      await page.locator('[data-set="email"]').fill('kontrola@example.test');
      await page.setViewportSize({ width, height: Math.max(220, height - 300) });
      await page.waitForFunction(() => document.body.classList.contains('flow-keyboard-open'));
      assert.equal(await page.locator('#panelFoot').isVisible(), false, 'keyboard gets clear viewport');
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() => !document.body.classList.contains('flow-keyboard-open'));
      await settled(page);
      await page.locator('#sendMail2').click();
      const prepared = await page.locator('#sendMail2').getAttribute('href');
      assert.match(prepared, /^mailto:/);
      const mail = new URL(prepared), body = mail.searchParams.get('body');
      assert.match(body, /kontrola@example.test/); assert.match(body, /2019.*Touring/);
      const shared = new URL((body.match(/Odkaz na konfiguraci: (.+)/) || [])[1]);
      assert.equal(new URLSearchParams(shared.hash.slice(1)).get('design'), chosen);
      assert.ok(!shared.hash.includes('example.test'), 'private contact never enters shared URL');
      await page.locator('#prevStep').click(); await page.waitForFunction(() => document.activeElement?.id === 'mobileFlowIntro');
      assert.equal((await state(page)).step, '4'); assert.equal((await state(page)).color, 'gunmetal');
      await page.locator('#nextStep').click(); await settled(page);
      assert.equal(await page.locator('[data-set="name"]').inputValue(), 'Kontrola mobilního návrhu');
      await visibleControl(page, '#prevStep'); await visibleControl(page, '#sendMail2');
      await page.locator('.burger').click();
      assert.equal(await page.locator('main').evaluate(element => element.inert), true);
      assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest('.nav'))));
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('main').evaluate(element => element.inert), false);
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains('burger')), true);
      await page.goto(shared.href, { waitUntil: 'networkidle' });
      await page.reload({ waitUntil: 'networkidle' });
      const restored = await state(page);
      assert.equal(restored.design, chosen); assert.equal(restored.cap, chosenCap);
      assert.equal(restored.color, 'gunmetal'); assert.equal(restored.generation, 'v-1b3b3ef6ba08');
      assert.equal(restored.step, '5');
      assert.equal(await page.locator('[data-set="email"]').inputValue(), '', 'shared link contains no private contact');
      if (width === 390) {
        await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
        await page.locator('.burger').click();
        await page.locator('.nav__links a[href="#vehicleCatalogue"]').click();
        await page.waitForFunction(() => location.hash === '#vehicleCatalogue');
        await page.waitForFunction(() => document.activeElement?.id === 'catalogTitle');
        await page.locator('#catalogSearch').fill('Audi A1');
        assert.equal(await page.locator('#discoveryDock').isVisible(), false, 'search is clear of floating CTA');
        await page.locator('#catalogSearch').press('Tab');
        await page.waitForFunction(() => document.querySelector('#discoveryDock a')?.href.includes('model=a1'));
        await page.locator('#discoveryDock a').click();
        await page.locator('#vehicleModel').waitFor();
        assert.equal((await state(page)).model, 'a1'); assert.equal((await state(page)).view, 'wheel');
        await page.goBack(); await page.locator('#catalogSearch').waitFor();
        assert.equal(await page.locator('#catalogSearch').inputValue(), 'Audi A1', 'browser Back restores searched model');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}x${height}: controls, vehicle guidance, wheel, advanced details, summary/contact, keyboard, menu, privacy, Back/Next and URL restore`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
