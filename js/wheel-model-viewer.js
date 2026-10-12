import { mount, prepareWheelGeometry, supports3DDesign } from './showroom.js?v=20261011-wheel-fidelity-v1';
import { PHOTO_WHEEL_MODELS } from './wheel-reconstruction-catalog.js?v=20261011-wheel-fidelity-v1';
import { wheelGLBURL } from './wheel-asset-url.js?v=20261011-wheel-fidelity-v1';
const $ = id => document.getElementById(id);
// The reviewed default solid is prebuilt; appearance edits stay fully editable.
const USE_EXPORTED_GEOMETRY = true;
const designs = window.NFW?.DESIGNS || [], projects = window.NFWEditorial?.projects || [];
const projectTitles = {
  'audi-rs3-drag-race-gloss-black': 'Audi RS3 · Drag race',
  'bmw-m2-competition-chrome': 'BMW M2 Competition · Chrom',
  'ferrari-812-gloss-black': 'Ferrari 812 · Lesklá černá',
  'ferrari-812-gunmetal-machined': 'Ferrari 812 · Gunmetal',
  'lamborghini-urus-gloss-black-machined': 'Urus · Černá / frézované čelo',
  'lamborghini-urus-matte-tx-gold-machined': 'Urus · Matná TX zlatá',
  'mustang-gt-50-gloss-black': 'Mustang GT 5.0 · Lesklá černá',
  'mustang-track-gold': 'Mustang · Okruh (zlatá)',
  'rolls-royce-ghost-2017-brushed-silver': 'Rolls-Royce Ghost · Broušené stříbro',
};
const studioConcepts = new Set(['mono5', 'deep7', 'yfork10', 'twist9', 'mesh30',
  'split6', 'turbine8', 'blade12', 'star5', 'concave9']);
const entries = new Map(designs.filter(d => supports3DDesign(d.id)
  && (PHOTO_WHEEL_MODELS[d.id] || studioConcepts.has(d.id)))
  .map(d => [d.id,{title:d.name,concept:!PHOTO_WHEEL_MODELS[d.id]}]));
for (const [id, model] of Object.entries(PHOTO_WHEEL_MODELS)) entries.set(id,{...model,title:projectTitles[id] || designs.find(d=>d.id===id)?.name || (projects.find(p=>p.id===id) ? projects.find(p=>p.id===id).vehicle+' · '+projects.find(p=>p.id===id).title : model.title)});
const groups = [['e6','E6'],['configurator','OARTS / Motivo'],['ready','Hotová kola'],['project','Custom projekty'],['concept','Původní návrhy']];
for (const [group,label] of groups) {
  const el = document.createElement('optgroup'); el.label = label;
  for (const [id,entry] of entries) if ((entry.group || (entry.concept?'concept':'configurator')) === group) {
    const option=document.createElement('option'); option.value=id; option.textContent=entry.title;el.append(option);
  }
  if(el.children.length)$('modelDesign').append(el);
}
let studio, version=0, selectionAbort, design, rotate=false, mounting;
let studioLifetime = new AbortController();
const setBusy = busy => { $('modelExport').disabled=busy; $('modelFinish').disabled=busy; $('modelColour').disabled=busy; $('modelCanvas').setAttribute('aria-busy',String(busy)); };

function sharedStudio(settings) {
  if(studio)return Promise.resolve(studio);
  if(mounting)return mounting;
  const lifetime=studioLifetime;
  const pending=mount($('modelCanvas'),{...settings,signal:lifetime.signal}).then(controller=>{
    if(lifetime.signal.aborted || lifetime!==studioLifetime){controller.dispose();throw new DOMException('Náhled byl zrušen.','AbortError');}
    studio=controller;return controller;
  }).finally(()=>{if(mounting===pending)mounting=null;});
  mounting=pending;return pending;
}

async function open(id) {
  const token=++version; selectionAbort?.abort(); selectionAbort=new AbortController();
  if(studioLifetime.signal.aborted){studioLifetime=new AbortController();mounting=null;studio=null;}
  const entry=entries.get(id); if(!entry)return; design=id;
  $('modelDesign').value=id;$('modelTitle').textContent=entry.title;$('modelStatus').textContent='Načítám individuální geometrii…';setBusy(true);
  const url=new URL(location.href);url.searchParams.set('design',id);history.replaceState(null,'',url);
  if(!studio&&!mounting)$('modelCanvas').replaceChildren();
  $('modelSource').removeAttribute('src');$('modelSourceLink').removeAttribute('href');
  document.querySelector('.model-reference').hidden=true;
  $('modelRenderDownload').hidden=true;$('modelRenderDownload').removeAttribute('href');
  try {
    const record=await prepareWheelGeometry(id,selectionAbort.signal,false,USE_EXPORTED_GEOMETRY);if(token!==version)return;
    if(record){
      $('modelFinish').value=record.defaultOptions?.finish || 'satin';$('modelColour').value=record.defaultOptions?.color || '#b9bcc2';
      const shownSource=record.surfaceSource || record.source;
      $('modelSource').src=shownSource.src;$('modelSourceLink').href=shownSource.src;
      document.querySelector('.model-reference').hidden=false;
      $('modelSourceCaption').textContent=(shownSource.kind==='technical'?'Technický podklad':'Původní podklad')+' · '+(record.source.sourceView==='angled'?'šikmý pohled':'čelní pohled');
      $('modelDownload').href=wheelGLBURL(entry).href;$('modelDownload').download=id+'.glb';$('modelDownload').hidden=false;
      $('modelSurface').disabled=record.provenance.rectificationApproximate;$('modelSurface').checked=false;
      $('modelProvenance').textContent='3D rekonstrukce podle obrazové předlohy. Hloubka, konkávnost a zadní část jsou odhad.'+(record.provenance.rectificationApproximate?' Čelo je ručně interpretované ze šikmého pohledu.':'');
    }else{
      const photo=window.NFW?.WHEEL_PRODUCTS?.[id]?.images?.[0];if(photo){$('modelSource').src=photo.src;$('modelSourceLink').href=photo.src;document.querySelector('.model-reference').hidden=false;}
      $('modelSourceCaption').textContent='Původní návrh';$('modelDownload').hidden=true;$('modelSurface').disabled=true;$('modelSurface').checked=false;
      $('modelProvenance').textContent='Původní prostorový návrh. Pro tento design není samostatná produktová fotografie k přesné rekonstrukci.';
    }
    rotate=false;$('modelRotate').setAttribute('aria-pressed','false');
    const settings={diameter:20,width:10,lip:'same',cap:'black',bolts:5,mirror:false,...record?.defaultOptions,
      design:id,mode:'wheel',referenceSurface:false,preferExportedGeometry:USE_EXPORTED_GEOMETRY,finish:$('modelFinish').value,color:$('modelColour').value,
      autoRotate:false,highQuality:true};
    const mounted=await sharedStudio(settings);if(token!==version)return;
    await mounted.update(settings);if(token!==version)return;
    mounted.reset();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(token!==version)return;
    $('modelCanvas').dataset.modelId=id;$('modelStatus').textContent='3D model připraven.';setBusy(false);
  }catch(error){if(token!==version||error.name==='AbortError')return;studioLifetime.abort();studio?.dispose();studio=null;mounting=null;$('modelStatus').textContent='3D model se nepodařilo načíst. '+error.message;setBusy(true);}
}
$('modelDesign').addEventListener('change',()=>open($('modelDesign').value));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{studio?.setView(button.dataset.view);rotate=false;$('modelRotate').setAttribute('aria-pressed','false');}));
$('modelRotate').addEventListener('click',()=>{rotate=!rotate;$('modelRotate').setAttribute('aria-pressed',String(rotate));studio?.update({autoRotate:rotate});});
async function appearance(surface=false){if(!studio)return;setBusy(true);try{await studio.update({color:$('modelColour').value,finish:$('modelFinish').value,referenceSurface:surface,preferExportedGeometry:false});$('modelStatus').textContent='Povrch aktualizován.';}catch(e){$('modelStatus').textContent=e.message;}finally{setBusy(false);}}
$('modelColour').addEventListener('input',()=>{$('modelSurface').checked=false;appearance();});
$('modelFinish').addEventListener('change',()=>appearance($('modelSurface').checked));
$('modelSurface').addEventListener('change',()=>appearance($('modelSurface').checked));
$('modelExport').addEventListener('click',()=>{if(!studio)return;try{const link=$('modelRenderDownload');link.download=design+'-render-4k.png';link.href=studio.captureHighResolution(4096);link.hidden=false;$('modelStatus').textContent='Render ve vysokém rozlišení je připraven. Stáhni jej jako PNG.';}catch(error){$('modelStatus').textContent='Render se nepodařilo exportovat. '+error.message;}});
window.addEventListener('pagehide',()=>{version++;selectionAbort?.abort();studioLifetime.abort();studio?.dispose();studio=null;});
window.addEventListener('pageshow',event=>{if(event.persisted)open(design||$('modelDesign').value);});
const initial=new URL(location.href).searchParams.get('design');open(entries.has(initial)?initial:entries.keys().next().value);
