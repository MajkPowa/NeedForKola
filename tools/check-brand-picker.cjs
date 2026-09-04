'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NFW_BASE_URL || 'http://127.0.0.1:8765';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/index.html#vehicleCatalogue', { waitUntil: 'networkidle' });
    const trigger = page.locator('.catalog-brand-field .nfw-brand-trigger');
    await trigger.click();
    const dialog = page.locator('.nfw-brand-dialog[open]');
    assert.equal(await dialog.count(), 1);
    assert.equal(await dialog.locator('[data-brand]').count(), 54);
    assert.equal(await dialog.locator('.nfw-brand-logo').count(), 53);
    assert.equal(await dialog.locator('[role=combobox]').count(), 0);
    assert.ok(await dialog.locator('input').evaluate(element => element === document.activeElement));
    await dialog.locator('input').fill('skoda');
    assert.equal(await dialog.locator('[data-brand]').count(), 1);
    await dialog.locator('input').press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#catalogBrand').inputValue(), 'skoda');
    assert.match(await trigger.innerText(), /Škoda/);
    assert.equal(await page.locator('.nfw-brand-dialog[open]').count(), 0);
    assert.ok(await trigger.evaluate(element => element === document.activeElement));
    assert.equal(await page.locator('.catalog-card-brand .nfw-brand-logo').count(), 6);
    await page.locator('#catalogReset').click();
    assert.match(await trigger.innerText(), /Všechny značky/);
    await page.selectOption('#catalogBrand', 'bmw');
    assert.match(await trigger.innerText(), /BMW/);
    await trigger.click();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    assert.ok(await trigger.evaluate(element => element === document.activeElement));
    await trigger.click();
    await page.mouse.click(5, 5);
    assert.equal(await dialog.count(), 0);

    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.click();
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391 && bounds.y >= 0 && bounds.y + bounds.height <= 845, 'Mobile modal stays inside viewport');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile horizontal overflow');
    await dialog.locator('input').fill('nonexistent');
    await dialog.locator('.nfw-brand-clear').click();
    assert.equal(await dialog.locator('[data-brand]').count(), 54);
    await dialog.screenshot({ path: path.resolve(__dirname, '../docs/qa/brand-picker-mobile.png') });
    await page.keyboard.press('Escape');

    await page.goto(base + '/konfigurator.html?brand=bmw&model=x5&year=2020', { waitUntil: 'networkidle' });
    const configTrigger = page.locator('.nfw-brand-field .nfw-brand-trigger');
    for (const brand of ['audi', 'tesla', 'skoda']) {
      await configTrigger.click();
      await dialog.locator('input').fill(brand);
      await dialog.locator(`[data-brand="${brand}"]`).click();
      assert.equal(await page.locator('#vehicleBrand').inputValue(), brand);
      assert.ok(await configTrigger.evaluate(element => element === document.activeElement));
      assert.equal(await page.locator('.nfw-brand-dialog').count(), 1, 'Old dialogs are disposed when the panel rerenders');
    }
    await page.selectOption('#vehicleBrand', 'bmw');
    assert.match(await configTrigger.innerText(), /BMW/);
    await page.locator('#nextStep').click();
    assert.equal(await page.locator('.nfw-brand-dialog').count(), 0);
    await page.locator('#prevStep').click();
    assert.equal(await page.locator('.nfw-brand-dialog').count(), 1);
    await configTrigger.click();
    await dialog.locator('input').fill('bmw');
    await dialog.locator('[data-brand="bmw"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#vehicleModel').count(), 1, 'Picker arrows do not change the configurator step');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log('PASS brand picker: all 53 logos, search/keyboard/Escape/backdrop, focus return, native select sync, reset, mobile bounds, configurator rerender/disposal and step shortcut isolation.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
