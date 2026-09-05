'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const base = process.env.NFW_BASE_URL || 'http://127.0.0.1:8765';
const shots = path.join(root, 'docs/qa');
global.window = global;
require('../js/vehicle-models.js');
const registry = NFWVehicleModels;
const selections = [
  {brand:'bmw',model:'x5',year:2020,generation:'g05',body:'suv'},
  {brand:'tesla',model:'model-3',year:2018,generation:'v-6710df4e3223',body:'sedan'},
];
const url = selection => base + '/konfigurator.html#' + new URLSearchParams({...selection,view:'car'});
for (const selection of selections) {
  const asset = registry.resolve(selection); assert.ok(asset);
  for (const change of [{year:2026},{generation:''},{body:''},{generation:'g05-lci'},{brand:'skoda'},{body:'estate'}]) {
    assert.equal(registry.resolve({...selection,...change}), null, JSON.stringify(change));
  }
  const meta = JSON.parse(fs.readFileSync(path.join(root, asset.metadata)));
  const bytes = fs.readFileSync(path.join(root, asset.src));
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  const gltf = JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.equal(meta.wheels.length,4);
  assert.equal(new Set(meta.wheels.map(w=>w.anchor)).size,4);
  for (const w of meta.wheels) {
    assert.ok(w.rimRadius>.15 && w.rimRadius<.4);
    assert.equal(gltf.nodes.filter(n=>n.name===w.anchor).length,1);
  }
  assert.ok(meta.paintMaterials.every(name=>gltf.materials.some(m=>m.name===name)));
  assert.equal(meta.source.license,'CC BY 4.0');
}
console.log('PASS exact identity/year/body boundaries, 2 licensed GLBs and 8 distinct rim mounts');

(async()=>{
  fs.mkdirSync(shots,{recursive:true});
  if(process.argv.includes('--smoke')) fs.mkdirSync(path.join(root,'tools/.cache-wheel-fit'),{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    page.setDefaultTimeout(90000);
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    // Observe the public mount API without adding a testing backdoor to the product.
    await page.addInitScript(()=>window.addEventListener('nfw:showroom-ready',()=>{
      const mount=NFWShowroom.mount;
      NFWShowroom.mount=async(...args)=>{const studio=await mount(...args); window.testStudio=studio; return studio;};
    }));
    const ready=async id=>{
      await page.locator(`[data-vehicle-asset="${id}"][data-mounted-wheels="4"]`).waitFor();
      await page.waitForFunction(id=>window.testStudio?.view.assetId===id&&!document.querySelector('.viewer-loading'),id);
    };
    const pixels=()=>page.evaluate(async()=>{
      const img=new Image();img.src=testStudio.capture('image/png');await img.decode();
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,160,100);return Array.from(ctx.getImageData(0,0,160,100).data);
    });
    const diff=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;
    for(const selection of process.argv.includes('--reliability-only') ? [] : selections){
      const asset=registry.resolve(selection);
      await page.goto(url(selection),{waitUntil:'domcontentloaded'}); await ready(asset.id);
      assert.equal(await page.locator('.vehicle-render').count(),0,'Mesh instead of photo');
      assert.equal(await page.locator('#spinToggle').isChecked(),false,'Reduced motion respected');
      if(process.argv.includes('--smoke')) {
        assert.equal(await page.locator('.webgl-view canvas').count(),1);
        await page.locator('#stageView').screenshot({path:path.join(root,'tools/.cache-wheel-fit',asset.id+'-public.png')});
        console.log('PASS live 360 model: '+asset.id+' with four mounted wheels'); continue;
      }
      const initial=await pixels();
      await page.locator('[data-camera="rear"]').click();
      const rear=await pixels();assert.ok(diff(initial,rear)>3,'Opposite view actually renders different body geometry');
      assert.ok((await page.evaluate(()=>testStudio.view.camera))[0]>0,'Rear camera is behind model');
      await page.locator('[data-camera="detail"]').click();
      await page.locator('#stageView').screenshot({path:path.join(shots,asset.id+'-wheel-detail.png')});
      const bronze=await pixels();
      await page.locator('.stage-foot [data-set="color"][data-val="blue"]').click();
      const blue=await pixels();assert.ok(diff(bronze,blue)>.1,'Mounted wheel colour changes rendered pixels');
      await page.locator('[data-step="2"]').click();
      await page.locator('[data-set="design"][data-val="mono5"]').click();
      assert.ok(diff(blue,await pixels())>.1,'Mounted design changes rendered geometry');
      await page.locator('[data-camera="perspective"]').click();
      const white=await pixels();
      await page.locator('.stage-foot [data-set="bodyColor"][data-val="black"]').click();
      assert.ok(diff(white,await pixels())>1,'Body colour changes independently');
      assert.equal(await page.evaluate(()=>testStudio.view.mountedWheels),4);
      // Rotate through >360 degrees with the accessible orbit control.
      const canvas=page.locator('.webgl-view canvas');await canvas.focus();
      for(let i=0;i<46;i++)await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(()=>testStudio.view.mountedWheels),4);
      await page.locator('[data-camera="perspective"]').click();
      await page.locator('.stage-foot [data-set="color"][data-val="bronze"]').click();
      await page.locator('#stageView').screenshot({path:path.join(shots,asset.id+'-360.png')});
      if(await page.locator('[data-studio-fullscreen]').count()){
        await page.locator('[data-studio-fullscreen]').click();
        await page.waitForFunction(()=>!!document.fullscreenElement);
        await page.locator('[data-studio-fullscreen]').click();
        await page.waitForFunction(()=>!document.fullscreenElement);
      }
      await page.setViewportSize({width:390,height:844});
      await page.locator('[data-camera="perspective"]').click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(shots,asset.id+'-mobile.png')});
      await page.setViewportSize({width:1440,height:1000});
      console.log('PASS '+asset.id+': 4 wheels, materials/design, real orbit, viewpoints, fullscreen and mobile');
    }
    if(process.argv.includes('--smoke')) { assert.deepEqual(errors,[]); return; }
    await page.goto(url({...selections[0],year:2008,generation:'e70'}));
    await page.locator('.vehicle-render').waitFor();
    assert.equal(await page.locator('[data-vehicle-asset]').count(),0,'E70 must not receive G05 geometry');
    await page.locator('[data-view="showroom"]').first().click();await ready('bmw-x5-g05');
    assert.match(await page.locator('#stageHead').innerText(),/ukázkový vůz/i);
    assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('generation'),'e70','Demo preserves chosen vehicle');
    console.log('PASS unavailable generation stays photo; demo identity remains explicit');

    await page.route('**/assets/models/bmw-x5-g05.glb',r=>r.abort());
    await page.goto(url(selections[0]));await page.reload();await page.locator('[data-retry-3d]').waitFor();
    assert.equal(await page.locator('.webgl-view canvas').count(),0,'Failed mesh leaves no stale canvas');
    await page.unroute('**/assets/models/bmw-x5-g05.glb');
    await page.locator('[data-retry-3d]').click();await ready('bmw-x5-g05');
    console.log('PASS model-load failure cleanup and successful retry');

    // A slow previous model must not replace the later selected vehicle.
    let release;const gate=new Promise(resolve=>release=resolve);
    await page.route('**/assets/models/bmw-x5-g05.glb',async r=>{await gate;await r.continue();});
    await page.goto(url(selections[0]),{waitUntil:'domcontentloaded'});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!document.querySelector('#vehicleBrand'));
    await page.evaluate(hash=>location.hash=hash,new URL(url(selections[1])).hash);
    release(); await ready('tesla-model-3-2018');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('[data-vehicle-asset="bmw-x5-g05"]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS slow model switching and zero uncaught browser errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
