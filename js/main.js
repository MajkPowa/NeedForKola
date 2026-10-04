/* Need For Wheels — reference media and product gallery. */
(function () {
  'use strict';
  const O = window.NFW;
  O.EMAIL = window.NFW_SITE?.email || 'info@oarts.cz';
  O.PHONE = window.NFW_SITE?.phone || '+420 723 958 421';
  O.SITE_URL = window.NFW_SITE?.siteUrl || 'https://oarts.cz/';
  O.spokesLabel = d => d.spokesLabel || `${d.spokes} paprsků`;
  O.escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  O.labelHTML = d => '<div class="shipping-label"><header><b>NEED FOR WHEELS</b><span>'+O.escape(d.order)+'</span></header><small>SPECIFIKACE KOLA · NÁHLED</small><dl>'+[['Vůz',d.model],['Design',d.design],['Pozice',d.pos],['Rozměr',d.size],['ET / PCD / CB',d.et+' / '+d.pcd+' / '+d.cb],['Barva',d.color],['Povrch',d.finish],['Hmotnost',d.weight]].map(([k,v])=>'<dt>'+k+'</dt><dd>'+O.escape(v)+'</dd>').join('')+'</dl><footer>'+O.escape(d.date)+' · CUSTOM FORGED WHEELS</footer></div>';

  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  document.querySelectorAll('[data-email]').forEach(el=>{const ready=window.NFW_SITE?.emailEnabled===true;el.textContent=O.EMAIL+(ready?'':' · připravujeme');if(el.tagName==='A'){if(ready)el.href='mailto:'+O.EMAIL;else{el.removeAttribute('href');el.setAttribute('aria-disabled','true');}}});
  document.querySelectorAll('[data-phone]').forEach(el=>{el.textContent=O.PHONE;if(el.tagName==='A')el.href='tel:'+O.PHONE.replace(/\s/g,'');});
  const io = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.06});
  const observe = root=>(root||document).querySelectorAll('.reveal').forEach(el=>io.observe(el));
  observe();
  window.addEventListener('beforeprint',()=>document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in')));

  const grid=document.getElementById('designsGrid');
  if(grid){
    grid.innerHTML=O.DESIGNS.map((d,i)=>'<a class="design-card reveal" href="konfigurator.html?design='+d.id+'&color=silver&view=wheel"><span class="series">'+String(i+1).padStart(2,'0')+' / '+(d.pieces===3?'MULTI PIECE':'MONOBLOCK')+'</span>'+O.renderWheel({design:d.id})+'<div class="design-card__title"><b>'+d.name+'</b><span aria-hidden="true">↗</span></div><span>'+O.spokesLabel(d)+' · prohlédnout ve 3D</span></a>').join('');
    observe(grid);
  }
  const label=document.getElementById('labelMock');
  if(label)label.innerHTML=O.labelHTML({order:'NFW · 001',model:'BMW X5 · G05 · 2020',design:'FORGED 10',pos:'FL — přední levé',size:'20 × 9,0"',et:35,pcd:'5x112',cb:'66,6',color:'Hyper Silver',finish:'Gloss',weight:'Dle schváleného výkresu',date:new Date().toISOString().slice(0,10)});
  const count=document.querySelector('[data-brand-count]');
  if(count && window.NFWVehicles)count.textContent=window.NFWVehicles.brands.length;

  const form=document.getElementById('contactForm');
  window.NFWCommerce?.bindEnquiry(form, f => ({name:f.get('name'),email:f.get('email'),phone:f.get('phone'),vehicle:f.get('car'),message:f.get('msg'),source:'contact',website:f.get('website')||''}));

  document.querySelectorAll('[data-launch-wheel]').forEach(button=>button.addEventListener('click',async()=>{
    const container=document.getElementById(button.dataset.launchWheel);
    button.disabled=true;
    const fallback=container.innerHTML;
    try{await import('./showroom.js?v=20260906-exact-vehicle');container.replaceChildren();await window.NFWShowroom.mount(container,{mode:'wheel',design:'apex10',color:'#b9bcc2',finish:'gloss',diameter:20,width:9.5,autoRotate:!matchMedia('(prefers-reduced-motion: reduce)').matches});button.hidden=true;}
    catch{container.innerHTML=fallback;button.disabled=false;button.textContent='3D se nepodařilo načíst · zkusit znovu';}
  }));
})();
