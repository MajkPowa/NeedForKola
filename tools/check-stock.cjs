'use strict';
/** Read-only stock UI checks against a running static server.
 * PLAYWRIGHT_MODULE optionally points to the installed Playwright module.
 * NFW_BASE_URL defaults to http://127.0.0.1:8765 and may include a Pages subpath.
 * Inventory fixtures exist only in intercepted responses/browser memory.
 * Generated screenshots stay under the ignored tools/.cache-wheel-fit folder.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const shots = path.resolve(__dirname, '.cache-wheel-fit/stock-qa');
fs.mkdirSync(shots, { recursive: true });
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Keep the empty-state check independent of future real stock records.
 await page.route('**/js/stock-data.js*', route => route.fulfill({contentType:'text/javascript', body:'window.NFWStock={updatedAt:null,items:[]};'}));
 await page.route('**/assets/stock/qa-missing.webp', route => route.fulfill({status:404,body:'Expected missing fixture image'}));
 await page.route('**/stock-qa.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="cs"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="css/premium.css"><link rel="stylesheet" href="css/luxury.css"><link rel="stylesheet" href="css/stock.css"><main><section class="section" id="skladem"><div class="wrap"><div class="section__head"><div><span class="eyebrow">Aktuální nabídka</span><h2>Skladová kola</h2></div></div><div id="stockInventory"></div></div></section></main><script src="js/stock-data.js"></script><script src="js/stock.js"></script></html>'}));
 await page.goto(base+'/stock-qa.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('.stock-empty img').naturalWidth>0);
 assert.equal(await page.locator('[data-stock-state="unconfirmed"]').count(),1);assert.equal(await page.locator('.stock-card').count(),0);
 assert.doesNotMatch(await page.locator('#stockInventory').innerText(),/vyprodáno|0 Kč|skladem\s*·/i);
 assert.match(await page.locator('.stock-empty__image-note').innerText(),/Ilustrační/);
 let href=await page.locator('.stock-cta').getAttribute('href');assert.ok(href.startsWith('mailto:info@oarts.cz?'));assert.match(decodeURIComponent(href),/Dotaz na skladová kola/);
 await page.screenshot({path:shots+'/stock-empty-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:shots+'/stock-empty-mobile.png',fullPage:true});
 console.log('PASS empty inventory: honest state, illustrative silver image, mailto and mobile layout');
 const fixture={updatedAt:'2026-09-06',items:[{id:'qa-sada',title:'TESTOVACÍ SADA — pouze neveřejné QA',design:'Test desetipaprsku',frontSize:'20 × 9J · ET 35',rearSize:'20 × 10J · ET 40',color:'Stříbrná',finish:'Lesk',pcd:'5 × 112',centerBore:'66,6 mm',wheelsPerSet:4,quantity:2,price:{amount:25000,currency:'CZK',vatIncluded:true},image:{src:'assets/stock/qa-missing.webp',alt:'Test neexistující fotografie'},note:'Testovací údaj, není veřejná nabídka.'},{id:'qa-text',title:'<img src=x onerror="alert(1)">',frontSize:'<script>alert(1)</script>',rearSize:'',color:'Test',quantity:1,price:{amount:-100,currency:'CZK'},image:{src:'javascript:alert(1)',alt:'bad'}},{id:'qa-zero',title:'nulové množství',quantity:0},{id:'qa-invalid',title:'textové množství',quantity:'2'},{id:'qa-sada',title:'duplicitní id',quantity:5}]};
 await page.evaluate(data=>NFWStockView.render(document.getElementById('stockInventory'),data),fixture);
 await page.waitForFunction(()=>document.querySelectorAll('.stock-card__image-missing').length===2);
 assert.equal(await page.locator('.stock-card').count(),2);assert.equal(await page.locator('#stockInventory img,#stockInventory script').count(),0);
 assert.equal(await page.locator('.stock-quantity').first().innerText(),'Skladem · 2 sady');
 assert.match(await page.locator('.stock-price').first().innerText(),/25\s*000,00\s*Kč[\s\S]*včetně DPH/);
 assert.match(await page.locator('.stock-price').last().innerText(),/Cena na dotaz/);
 assert.match(await page.locator('.stock-card h3').last().innerText(),/<img/);
 href=await page.locator('.stock-cta').first().getAttribute('href');const parsed=new URL(href);assert.equal(parsed.pathname,'info@oarts.cz');assert.match(parsed.searchParams.get('body'),/qa-sada[\s\S]*20 × 9J[\s\S]*66,6 mm[\s\S]*25/);assert.equal(parsed.searchParams.size,2);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:shots+'/stock-fixture-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:960});await page.screenshot({path:shots+'/stock-fixture-desktop.png',fullPage:true});
 console.log('PASS fixtures: quantity, axle sizes, PCD/CB, VAT/currency, price-on-request, mailto specification, duplicate/zero invalid records and safe literal text');
 await page.evaluate(()=>NFWStockView.render(document.getElementById('stockInventory'),{updatedAt:'2099-12-31',items:[]}));assert.equal(await page.locator('.stock-empty').count(),1);assert.equal(await page.locator('.stock-list-meta').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS rerender and zero page errors; fixture never written to public data');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
