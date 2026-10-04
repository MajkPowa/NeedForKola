'use strict';
// All /api requests are intercepted. This test never creates production records or emails.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const output = path.join(__dirname, '.cache-wheel-fit/commerce-qa');
const legalSource = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/legal/pages.json'), 'utf8'));
const termsSnapshot = { version: 'test-20261004', company: legalSource.company, pages: legalSource.pages.filter(page => ['obchodni-podminky', 'reklamacni-rad', 'odstoupeni'].includes(page.id)) };
termsSnapshot.pages[0].sections.push({ title: 'Test archivovaného znění', html: '<p>Přesný text z testovací nabídky.</p><img src="https://invalid.example.test/tracker"><script>window.snapshotInjected=true</script><a href="javascript:window.snapshotInjected=true">Neaktivní odkaz</a>' });
const catalogue = { orderingEnabled: true, items: [{ id: 'test-silver-set', version: 1, sku: 'TEST-001', title: 'Testovací stříbrná sada', description: 'Pouze simulovaný API test', specs: [{ label: 'Rozměr', value: '20 × 9' }], image: 'assets/real-wheels/nfw-r027/asset-067.webp', priceCents: 1234500, currency: 'CZK', stockAvailable: 2, wheelsPerSet: 4 }], checkout: { version: 1, shippingMethods: [{ id: 'pickup', label: 'Osobní odběr', priceCents: 0, deliveryText: 'Po domluvě' }, { id: 'delivery', label: 'Doručení', priceCents: 10000, deliveryText: 'Do 3 dnů' }], paymentMethods: [{ id: 'bank_transfer', label: 'Bankovní převod', instructions: 'Dle potvrzené objednávky' }], termsVersion: 'test-20261004', taxMode: 'vat_included' } };
const offer = { id: 'offer-test', title: 'Ověřená testovací nabídka', specification: '4 kola\nPřední 20 × 9\nZadní 20 × 10', subtotalCents: 2000000, shipping: { id: 'delivery', label: 'Doručení', priceCents: 10000, deliveryText: 'Dle termínu výroby' }, payment: { id: 'bank_transfer', label: 'Bankovní převod', instructions: 'Záloha podle nabídky' }, totalCents: 2010000, currency: 'CZK', deliveryText: 'Výroba 6 týdnů', termsVersion: 'test-20261004', taxMode: 'vat_included', status: 'open', expiresAt: 1900000000 };
catalogue.checkout.termsSnapshot = termsSnapshot; offer.termsSnapshot = termsSnapshot;
const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
async function fillContact(form) { await form.locator('[name=name]').fill('UI Test'); await form.locator('[name=email]').fill('ui-test@example.test'); await form.locator('[name=phone]').fill('+420 777 111 222'); }
async function fillCustomer(form) { await fillContact(form); await form.locator('[name=address]').fill('Testovací 1'); await form.locator('[name=city]').fill('Praha'); await form.locator('[name=postalCode]').fill('11000'); await form.locator('[name=terms]').check(); }
async function noOverflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow'); }
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const requests = [], errors = [], fontRequests = []; let enquiryFails = true, checkoutFails = true, versionConflict = false;
    page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/fonts\.(googleapis|gstatic)/.test(request.url())) fontRequests.push(request.url()); });
    await page.route('**/api/**', async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() === 'OPTIONS') return reply(route, {});
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      if (body) { assert.equal(request.headers()['x-nfw-request'], '1'); requests.push({ pathname, body }); }
      if (pathname === '/api/catalog') return reply(route, catalogue);
      if (pathname === '/api/enquiries') {
        if (enquiryFails) { enquiryFails = false; return reply(route, { error: { code: 'TEST', message: 'Testovaná chyba. Údaje zůstávají vyplněné.' } }, 503); }
        return reply(route, { id: 'test', reference: 'NFW-P-TEST', status: 'received', emailStatus: 'blocked' }, 201);
      }
      if (pathname === '/api/checkout') {
        if (checkoutFails) { checkoutFails = false; return route.abort('failed'); }
        if (versionConflict) { versionConflict = false; catalogue.items[0].version = 2; catalogue.items[0].priceCents = 1334500; catalogue.checkout.version = 2; return reply(route, { error: { code: 'changed', message: 'Nabídka se změnila.' } }, 409); }
        return reply(route, { id: 'order-test', reference: 'NFW-O-TEST', status: 'pending', totalCents: catalogue.items[0].priceCents * body.items[0].quantity + catalogue.checkout.shippingMethods.find(item => item.id === body.shippingMethod).priceCents, currency: 'CZK', emailStatus: 'blocked' }, 201);
      }
      if (pathname === '/api/offers/view') return reply(route, offer);
      if (pathname === '/api/offers/accept') return reply(route, { id: 'offer-order', reference: 'NFW-O-OFFER', status: 'pending', totalCents: offer.totalCents, currency: 'CZK', emailStatus: 'blocked' }, 201);
      throw new Error('Unexpected API request ' + pathname);
    });
    await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
    const contact = page.locator('#contactForm'); await contact.scrollIntoViewIfNeeded(); await fillContact(contact);
    await contact.locator('[name=car]').fill('BMW 5 G31 2019'); await contact.locator('[name=msg]').fill('Test formuláře bez skutečného odeslání.'); await contact.locator('[type=submit]').click();
    await contact.locator('[data-commerce-status][data-state=error]').waitFor(); assert.equal(await contact.locator('[name=email]').inputValue(), 'ui-test@example.test');
    await contact.locator('[type=submit]').click(); await contact.locator('[data-commerce-status][data-state=success]').waitFor();
    assert.ok((await contact.locator('[data-commerce-status]').innerText()).includes('NFW-P-TEST')); assert.equal(requests.at(-1).body.source, 'contact'); await noOverflow(page);
    await page.goto(base + '/objednavka.html?reference=NFW-R027&source=gallery', { waitUntil: 'networkidle' });
    assert.ok((await page.locator('#quoteContext').innerText()).includes('NFW-R027')); assert.match(await page.locator('#quoteContext img').getAttribute('src'), /nfw-r027\/asset-067.webp/);
    const quote = page.locator('#quoteForm'); await fillContact(quote); await quote.locator('[name=vehicle]').fill('Ferrari — specifikaci ověřit'); await quote.locator('[type=submit]').click(); await quote.locator('[data-state=success]').waitFor(); assert.equal(requests.at(-1).body.reference, 'NFW-R027'); assert.equal(requests.at(-1).body.source, 'gallery');
    await noOverflow(page); await page.screenshot({ path: path.join(output, '390-quote.png'), fullPage: true });
    await page.goto(base + '/objednavka.html?product=test-silver-set', { waitUntil: 'networkidle' });
    const checkout = page.locator('#checkoutForm'); await fillCustomer(checkout); await checkout.locator('[name=quantity]').fill('2'); await checkout.locator('[name=shippingMethod]').selectOption('delivery');
    assert.ok((await page.locator('#checkoutSummary').innerText()).includes('24')); await checkout.locator('[type=submit]').click(); await checkout.locator('[data-state=error]').waitFor();
    const first = requests.at(-1).body; assert.equal(first.items[0].quantity, 2); assert.equal(first.items[0].version,1); assert.equal(first.catalogVersion,1); assert.equal(first.shippingMethod, 'delivery'); assert.equal(first.termsAccepted, true); assert.equal(first.termsVersion, 'test-20261004'); assert.ok(!('priceCents' in first.items[0]));
    await checkout.locator('[type=submit]').click(); await checkout.locator('[data-state=success]').waitFor(); assert.deepEqual(requests.at(-1).body, first, 'uncertain retry preserves full request and idempotency key');
    await noOverflow(page); await page.screenshot({ path: path.join(output, '390-checkout.png'), fullPage: true });
    versionConflict = true; await page.goto(base + '/objednavka.html?product=test-silver-set', { waitUntil: 'networkidle' });
    await fillCustomer(checkout); await checkout.locator('[type=submit]').click(); await page.waitForFunction(() => document.querySelector('#checkoutForm [data-commerce-status]')?.textContent.includes('Načetli jsme aktuální cenu'));
    assert.equal(await checkout.locator('[name=email]').inputValue(), 'ui-test@example.test'); assert.equal(await checkout.locator('[name=terms]').isChecked(), false, 'changed price requires new review and agreement');
    await checkout.locator('[name=terms]').check(); await checkout.locator('[type=submit]').click(); await checkout.locator('[data-state=success]').waitFor(); assert.equal(requests.at(-1).body.items[0].version, 2); assert.equal(requests.at(-1).body.catalogVersion, 2);
    const token = 'a'.repeat(64); const before = requests.filter(r => r.pathname === '/api/offers/accept').length;
    await page.goto(base + '/nabidka.html#token=' + token, { waitUntil: 'networkidle' }); assert.equal(requests.at(-1).body.token, token); assert.equal(requests.filter(r => r.pathname === '/api/offers/accept').length, before, 'opening offer never accepts it');
    assert.ok((await page.locator('#checkoutSummary').innerText()).includes(offer.specification)); assert.ok((await page.locator('#checkoutSummary').innerText()).includes('6 týdnů'));
    await page.locator('.commerce-terms-link').click(); assert.equal(await page.locator('[data-archived-terms]').getAttribute('open'), '');
    assert.ok((await page.locator('[data-archived-terms]').innerText()).includes('Přesný text z testovací nabídky.')); assert.equal(await page.locator('[data-archived-terms] article').count(), 3);
    assert.equal(await page.locator('[data-archived-terms] img,[data-archived-terms] script,[data-archived-terms] a[href^="javascript:"]').count(), 0); assert.equal(await page.evaluate(() => window.snapshotInjected), undefined);
    assert.ok(page.url().endsWith('#token=' + token), 'reading terms retains private offer fragment');
    const downloadReady = page.waitForEvent('download'); await page.getByRole('button', { name: 'Stáhnout toto znění podmínek', exact: true }).click(); const download = await downloadReady;
    assert.ok(fs.readFileSync(await download.path(), 'utf8').includes('Přesný text z testovací nabídky.'));
    await page.locator('[data-archived-terms] summary').click();
    await fillCustomer(page.locator('#checkoutForm')); await page.locator('#placeOrder').click(); await page.locator('#checkoutForm [data-state=success]').waitFor(); assert.equal(requests.at(-1).body.token, token); assert.equal(requests.at(-1).body.termsVersion, offer.termsVersion);
    await noOverflow(page); await page.screenshot({ path: path.join(output, '390-offer.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/konfigurator.html#brand=bmw&model=x5&year=2020&step=5&view=wheel', { waitUntil: 'networkidle' });
    await page.locator('input[data-set=name]').fill('Konfigurátor Test'); await page.locator('input[data-set=email]').fill('config-test@example.test'); await page.locator('#sendMail').click(); await page.locator('#enquiryForm [data-state=success]').waitFor();
    assert.equal(requests.at(-1).body.source, 'configurator'); assert.ok(requests.at(-1).body.configuration.design); assert.ok(requests.at(-1).body.message.includes('Přední:')); assert.equal(requests.at(-1).body.configuration.email, undefined);
    await noOverflow(page); assert.deepEqual(errors, []); assert.deepEqual(fontRequests, []);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 1000 });
      for (const [name, url] of [['quote', '/objednavka.html?reference=NFW-R027&source=gallery'], ['checkout', '/objednavka.html?product=test-silver-set'], ['offer', '/nabidka.html#token=' + token]]) {
        await page.goto(base + url, { waitUntil: 'networkidle' }); await noOverflow(page); await page.screenshot({ path: path.join(output, width + '-' + name + '.png'), fullPage: true });
      }
    }
    console.log('PASS: contact error/retry; photo reference; checkout total/terms and version conflict; immutable idempotent retry; explicit offer acceptance; full configurator enquiry; zero external font requests; layouts 320/390/1440px. API mocked, no production writes.');
    await page.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
