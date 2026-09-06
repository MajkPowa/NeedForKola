'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.NFW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const home = async query => { await page.goto(base + '/index.html' + (query || '') + '#vehicleCatalogue'); await page.locator('#catalogSearch').waitFor(); };
    const dock = page.locator('#discoveryDock a');
    const selection = async () => Object.fromEntries(new URL(await dock.getAttribute('href'), base).searchParams);
    const search = async value => {
      await page.locator('#catalogSearch').fill(value);
      await page.waitForFunction(value => new URLSearchParams(location.search).get('catalogSearch') === value, value);
    };
    await home();
    const explicit = await page.locator('.generation-card--studio').getAttribute('href');
    await search('Audi A1');
    assert.deepEqual(await selection(),{ brand:'audi',model:'a1',year:'0',generation:'',body:'',view:'car' });
    assert.match(await page.locator('#discoveryDock > div').innerText(),/Audi A1/);
    assert.equal(await page.locator('.nav a[data-configure-vehicle]').getAttribute('href'),await dock.getAttribute('href'));
    assert.equal(await page.locator('.generation-card--studio').getAttribute('href'),explicit,'Explicit BMW studio stays explicit');
    // Actual user click, not merely inspection of generated query parameters.
    await page.locator('#vehicleCatalogue').scrollIntoViewIfNeeded();
    await dock.click(); await page.locator('#vehicleModel').waitFor();
    assert.equal(await page.locator('#vehicleBrand').inputValue(),'audi');
    assert.equal(await page.locator('#vehicleModel').inputValue(),'a1');
    assert.equal(await page.locator('#vehicleYear').inputValue(),'0');
    assert.equal(await page.locator('#vehicleGeneration').inputValue(),'');
    assert.match(await page.locator('#panelBody').innerText(),/Model je vybraný/);
    assert.doesNotMatch(await page.locator('#panelBody').innerText(),/Pro tento rok nemáme/);
    assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('view'),'car');
    console.log('PASS typed Audi A1 → real CTA click → Audi A1 selected, missing year remains unselected');

    await home('?catalogSearch=BMW%20X5&catalogYear=2020');
    assert.deepEqual(await selection(),{ brand:'bmw',model:'x5',year:'2020',generation:'g05',body:'suv',view:'car' });
    await page.selectOption('#catalogYear','2023');
    assert.equal((await selection()).generation,'','Transition year must not guess a generation');
    await home('?catalogSearch=%C5%A0koda%20Octavia&catalogYear=2020');
    assert.equal((await selection()).model,'octavia');assert.equal((await selection()).year,'2020');
    assert.equal((await selection()).body,'','Multiple bodies remain a choice');
    assert.equal((await selection()).generation,'');
    console.log('PASS selected year and unique generation transfer; transition/body ambiguity remains explicit');

    await home(); await search('Corolla');
    assert.equal((await selection()).model,'corolla','Exact model name wins over Corolla Cross');
    await search('Audi');
    assert.equal(await dock.getAttribute('href'),'#vehicleCatalogue','A brand alone never silently picks its first model');
    const modelLink=page.locator('[data-catalog-key="audi/a3"] .catalog-model-configure');
    const modelParams=new URL(await modelLink.getAttribute('href'),base).searchParams;
    assert.equal(modelParams.get('model'),'a3');assert.equal(modelParams.get('year'),'0');
    await search('zzzzmissing');
    assert.equal(await dock.getAttribute('href'),'#vehicleCatalogue');
    await page.locator('#catalogReset').click();
    assert.equal(await dock.getAttribute('href'),'konfigurator.html','Reset clears the old selection');
    // The input and activation occur in one task, before the 120ms result debounce.
    await page.evaluate(() => {
      const input=document.querySelector('#catalogSearch');input.value='Tesla Model Y';input.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('#discoveryDock a').click();
    });
    await page.locator('#vehicleModel').waitFor();
    assert.equal(await page.locator('#vehicleBrand').inputValue(),'tesla');
    assert.equal(await page.locator('#vehicleModel').inputValue(),'model-y');
    console.log('PASS exact/ambiguous/empty/reset cases, model-level CTA and activation before debounce');

    await page.setViewportSize({width:390,height:844});
    await home('?catalogModel=Superb&catalogBrand=skoda&catalogYear=2020');
    assert.equal((await selection()).model,'superb');
    await page.locator('#vehicleCatalogue').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await dock.click();await page.locator('#vehicleModel').waitFor();
    assert.equal(await page.locator('#vehicleModel').inputValue(),'superb');
    assert.equal(await page.locator('#vehicleYear').inputValue(),'2020');
    // Mobile entry links retain the chosen car and start with the wheel preview.
    await page.goto(base+'/konfigurator.html?brand=audi&model=a1&year=2020&view=showroom');
    await page.locator('#vehicleModel').waitFor();
    await page.selectOption('#vehicleModel','a3');
    assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('view'),'wheel');
    assert.match(await page.locator('#stageHead').textContent(),/Audi A3/i);
    assert.doesNotMatch(await page.locator('#stageHead').textContent(),/ukázkový vůz|BMW X5/i);
    assert.deepEqual(errors,[]);
    console.log('PASS mobile URL restore/click, selected year, and showroom → selected vehicle on model change; no page errors');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
