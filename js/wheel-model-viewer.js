import { mount, prepareWheelGeometry, supports3DDesign } from './showroom.js?v=20261009-photo-3d';
import { PHOTO_WHEEL_MODELS } from './wheel-reconstruction-catalog.js?v=20261009-photo-3d';
const $ = id => document.getElementById(id);
const designs = window.NFW?.DESIGNS || [], projects = window.NFWEditorial?.projects || [];
const entries = new Map(designs.filter(d => !['dish3pc','mesh3pc'].includes(d.id) && supports3DDesign(d.id)).map(d => [d.id,{title:d.name,concept:!PHOTO_WHEEL_MODELS[d.id]}]));
for (const [id, model] of Object.entries(PHOTO_WHEEL_MODELS)) entries.set(id,{...model,title:designs.find(d=>d.id===id)?.name || (projects.find(p=>p.id===id) ? projects.find(p=>p.id===id).vehicle+' · '+projects.find(p=>p.id===id).title : model.title)});
const groups = [['e6','E6'],['configurator','OARTS / Motivo'],['ready','Hotová kola'],['project','Custom projekty'],['concept','Původní návrhy']];
for (const [group,label] of groups) {
  const el = document.createElement('optgroup'); el.label = label;
  for (const [id,entry] of entries) if ((entry.group || (entry.concept?'concept':'configurator')) === group) {
    const option=document.createElement('option'); option.value=id; option.textContent=entry.title;el.append(option);
  }
  if(el.children.length)$('modelDesign').append(el);
}
let studio, version=0, abort, design, rotate=false;
const setBusy = busy => { $('modelExport').disabled=busy; $('modelFinish').disabled=busy; $('modelColour').disabled=busy; };
async function open(id) {
  const token=++version; abort?.abort(); abort=new AbortController(); studio?.dispose(); studio=null;
  const entry=entries.get(id); if(!entry)return; design=id;
  $('modelDesign').value=id;$('modelTitle').textContent=entry.title;$('modelStatus').textContent='Načítám individuální geometrii…';setBusy(true);
  const url=new URL(location.href);url.searchParams.set('design',id);history.replaceState(null,'',url);
  $('modelCanvas').replaceChildren();$('modelSource').removeAttribute('src');$('modelSourceLink').removeAttribute('href');
  $('modelRenderDownload').hidden=true;$('modelRenderDownload').removeAttribute('href');
  try {
    const record=await prepareWheelGeometry(id,abort.signal,true);if(token!==version)return;
    if(record){
      $('modelFinish').value=record.defaultOptions?.finish || 'satin';$('modelColour').value=record.defaultOptions?.color || '#b9bcc2';
      const shownSource=record.surfaceSource || record.source;
      $('modelSource').src=shownSource.src;$('modelSourceLink').href=shownSource.src;
      $('modelSourceCaption').textContent=(shownSource.kind==='technical'?'Technický podklad':'Původní podklad')+' · '+(record.source.sourceView==='angled'?'šikmý pohled':'čelní pohled');
      $('modelDownload').href=entry.glb+(entry.revision?'?v='+entry.revision:'');$('modelDownload').download=id+'.glb';$('modelDownload').hidden=false;
      $('modelSurface').disabled=record.provenance.rectificationApproximate;$('modelSurface').checked=!record.provenance.rectificationApproximate;
      $('modelProvenance').textContent='3D rekonstrukce podle obrazové předlohy. Hloubka, konkávnost a zadní část jsou odhad.'+(record.provenance.rectificationApproximate?' Čelo je ručně interpretované ze šikmého pohledu.':'');
    }else{
      const photo=window.NFW?.WHEEL_PRODUCTS?.[id]?.images?.[0];if(photo){$('modelSource').src=photo.src;$('modelSourceLink').href=photo.src;}
      $('modelSourceCaption').textContent='Původní návrh';$('modelDownload').hidden=true;$('modelSurface').disabled=true;$('modelSurface').checked=false;
      $('modelProvenance').textContent='Původní prostorový návrh. Pro tento design není samostatná produktová fotografie k přesné rekonstrukci.';
    }
    rotate=false;$('modelRotate').setAttribute('aria-pressed','false');
    const mounted=await mount($('modelCanvas'),{...record?.defaultOptions,design:id,mode:'wheel',referenceSurface:$('modelSurface').checked,finish:$('modelFinish').value,color:$('modelColour').value,autoRotate:false,highQuality:true,signal:abort.signal});
    if(token!==version){mounted.dispose();return;}studio=mounted;
    $('modelCanvas').dataset.modelId=id;$('modelStatus').textContent='3D model připraven.';setBusy(false);
  }catch(error){if(token!==version||error.name==='AbortError')return;$('modelStatus').textContent='3D model se nepodařilo načíst. '+error.message;setBusy(true);}
}
$('modelDesign').addEventListener('change',()=>open($('modelDesign').value));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{studio?.setView(button.dataset.view);rotate=false;$('modelRotate').setAttribute('aria-pressed','false');}));
$('modelRotate').addEventListener('click',()=>{rotate=!rotate;$('modelRotate').setAttribute('aria-pressed',String(rotate));studio?.update({autoRotate:rotate});});
async function appearance(surface=false){if(!studio)return;setBusy(true);try{await studio.update({color:$('modelColour').value,finish:$('modelFinish').value,referenceSurface:surface});$('modelStatus').textContent='Povrch aktualizován.';}catch(e){$('modelStatus').textContent=e.message;}finally{setBusy(false);}}
$('modelColour').addEventListener('input',()=>{$('modelSurface').checked=false;appearance();});
$('modelFinish').addEventListener('change',()=>appearance($('modelSurface').checked));
$('modelSurface').addEventListener('change',()=>appearance($('modelSurface').checked));
$('modelExport').addEventListener('click',()=>{if(!studio)return;try{const link=$('modelRenderDownload');link.download=design+'-render-4k.png';link.href=studio.captureHighResolution(4096);link.hidden=false;$('modelStatus').textContent='Render ve vysokém rozlišení je připraven. Stáhni jej jako PNG.';}catch(error){$('modelStatus').textContent='Render se nepodařilo exportovat. '+error.message;}});
window.addEventListener('pagehide',()=>{abort?.abort();studio?.dispose();});
const initial=new URL(location.href).searchParams.get('design');open(entries.has(initial)?initial:entries.keys().next().value);
