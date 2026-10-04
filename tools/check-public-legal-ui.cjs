'use strict';
// All API traffic is mocked; this test never sends customer records or e-mails.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const output = path.join(__dirname, '.cache-wheel-fit/launch-public-qa');
const routes = { 'obchodni-podminky': 'obchodni-podminky.html', 'reklamacni-rad': 'reklamace.html', odstoupeni: 'odstoupeni.html', soukromi: 'ochrana-osobnich-udaju.html', cookies: 'cookies.html' };
const aliases = new Set([...Object.values(routes), 'kontakt.html', 'pravni.html']);
const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
let checkedLinks = 0;
for (const name of htmlFiles) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  for (const [, raw] of source.matchAll(/\bhref=["']([^"']+)["']/g)) {
    const url = new URL(raw.replace(/&amp;/g, '&'), base + '/' + name);
    if (url.origin !== new URL(base).origin) continue;
    let target = url.pathname.split('/').at(-1);
    if (!aliases.has(target)) continue;
    if (target === 'pravni.html' && url.searchParams.has('doc')) { assert.ok(routes[url.searchParams.get('doc')], 'known legacy document: ' + raw); target = routes[url.searchParams.get('doc')]; }
    assert.ok(fs.existsSync(path.join(root, target)), name + ': existing legal target ' + raw);
    if (url.hash) { const targetHTML = fs.readFileSync(path.join(root, target), 'utf8'); assert.ok(targetHTML.includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"'), name + ': existing legal anchor ' + raw); }
    checkedLinks++;
  }
}
const reply = (route, data, status = 200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
async function noOverflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow: ' + page.url()); }
(async () => {
  fs.mkdirSync(output, {recursive:true}); const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const errors = [], posts = [], fonts = [], failures = new Set();
    page.on('pageerror',error=>errors.push(error.message)); page.on('request',request=>{if(/fonts\.(googleapis|gstatic)/.test(request.url()))fonts.push(request.url());});
    await page.route('**/api/**',async route=>{
      const request=route.request(),pathname=new URL(request.url()).pathname;
      if(request.method()==='OPTIONS')return reply(route,{});
      if(pathname==='/api/catalog')return reply(route,{orderingEnabled:false,items:[],checkout:{}});
      assert.equal(request.method(),'POST'); assert.equal(request.headers()['x-nfw-request'],'1');
      const body=request.postDataJSON();posts.push({pathname,body}); const kind=body.kind||body.source;
      if(!failures.has(kind)){failures.add(kind);return reply(route,{error:{code:'TEST',message:'Simulovaná chyba příjmu.'}},503);}
      assert.ok(['/api/enquiries','/api/requests'].includes(pathname));
      return reply(route,{id:'test-'+kind,reference:'NFW-TEST-'+kind.toUpperCase(),status:'received',emailStatus:'blocked'},201);
    });
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:width===390?844:1000});
      for(const name of [...Object.values(routes),'kontakt.html','pravni.html']){await page.goto(base+'/'+name,{waitUntil:'networkidle'});await noOverflow(page);assert.equal(await page.locator('h1').count(),1);}
      await page.goto(base+'/kontakt.html',{waitUntil:'networkidle'});await page.screenshot({path:path.join(output,width+'-kontakt.png'),fullPage:true});
      await page.goto(base+'/index.html#realna-kola',{waitUntil:'networkidle'});const gallery=page.locator('#realWheelsGallery');await gallery.scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('#realWheelsGallery').scrollIntoView({block:'start',behavior:'instant'}));await noOverflow(page);await page.screenshot({path:path.join(output,width+'-galerie.png')});
      assert.equal(await gallery.locator('.real-wheel-card').count(),width===390?6:9);
    }
    await page.setViewportSize({width:390,height:844});
    for(const [filename,kind]of [['kontakt.html','contact'],['reklamace.html','complaint'],['odstoupeni.html','withdrawal']]){
      await page.goto(base+'/'+filename,{waitUntil:'networkidle'});const form=page.locator('[data-service-form]');await form.scrollIntoViewIfNeeded();assert.equal(await form.getAttribute('method'),'post');
      await form.locator('[name=name]').fill('Právní UI test');await form.locator('[name=email]').fill('legal-ui@example.test');await form.locator('[name=phone]').fill('+420 777 111 222');await form.locator('[name=message]').fill('Pouze automatický test s mock API. Žádné skutečné podání.');
      await form.locator('[type=submit]').click();await form.locator('[data-status][data-state=error]').waitFor();assert.equal(await form.locator('[name=email]').inputValue(),'legal-ui@example.test');assert.match(await form.locator('[name=message]').inputValue(),/mock API/);assert.equal(await form.locator('[type=submit]').isDisabled(),false);
      await form.locator('[type=submit]').click();await form.locator('[data-status][data-state=success]').waitFor();assert.equal(posts.at(-1).pathname,kind==='contact'?'/api/enquiries':'/api/requests');assert.equal(posts.at(-1).body[kind==='contact'?'source':'kind'],kind);assert.equal(posts.at(-1).body.website,'');assert.equal(await form.locator('[type=submit]').isDisabled(),true);assert.ok((await form.locator('[data-status]').innerText()).includes('NFW-TEST-'+kind.toUpperCase()));assert.ok((await form.locator('[data-status]').innerText()).includes('není odesíláno'));
      const downloadReady=page.waitForEvent('download');await form.getByRole('button',{name:'Stáhnout kopii podání',exact:true}).click();const download=await downloadReady;const text=fs.readFileSync(await download.path(),'utf8');assert.ok(text.includes('NFW-TEST-'+kind.toUpperCase()));assert.ok(text.includes('Právní UI test'));await noOverflow(page);
    }
    for(const [doc,file]of Object.entries(routes)){const anchor=doc==='odstoupeni'?'#formular-odstoupeni':doc==='reklamacni-rad'?'#formular-reklamace':'';await page.goto(base+'/pravni.html?doc='+doc+anchor,{waitUntil:'networkidle'});await page.waitForURL(base+'/'+file+anchor);if(anchor)assert.equal(await page.locator(anchor).count(),1);}
    // HTML remains safe even if scripts fail: no GET form leaks and no enabled submit.
    const noJS=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
    for(const file of ['index.html','kontakt.html','reklamace.html','odstoupeni.html','objednavka.html','nabidka.html']){await noJS.goto(base+'/'+file);for(const form of await noJS.locator('form').all()){assert.equal(await form.getAttribute('method'),'post',file+' uses POST fallback');for(const button of await form.locator('[type=submit]').all())assert.equal(await button.isDisabled(),true,file+' waits for JS handler');}}
    await noJS.close();assert.deepEqual(errors,[]);assert.deepEqual(fonts,[]);await page.close();
    console.log('PASS: '+checkedLinks+' internal legal/contact links and all five legacy redirects; legal/contact layouts 390/1440px; contact, complaint and withdrawal simulated failure/retry/receipt/download; preserved data; safe no-JS forms. Screenshots: '+output+'. No production writes.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
