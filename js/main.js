/* Need For Wheels — reference media and product gallery. */
(function () {
  'use strict';
  const O = window.NFW;
  O.EMAIL = 'info@oarts.cz';
  O.PHONE = '+420 777 000 000';
  O.SITE_URL = 'https://majkpowa.github.io/NeedForKola/';
  O.spokesLabel = d => d.spokesLabel || `${d.spokes} paprsků`;
  O.escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  O.labelHTML = d => '<div class="shipping-label"><header><b>NEED FOR WHEELS</b><span>'+O.escape(d.order)+'</span></header><small>SPECIFIKACE KOLA · NÁHLED</small><dl>'+[['Vůz',d.model],['Design',d.design],['Pozice',d.pos],['Rozměr',d.size],['ET / PCD / CB',d.et+' / '+d.pcd+' / '+d.cb],['Barva',d.color],['Povrch',d.finish],['Hmotnost',d.weight]].map(([k,v])=>'<dt>'+k+'</dt><dd>'+O.escape(v)+'</dd>').join('')+'</dl><footer>'+O.escape(d.date)+' · CUSTOM FORGED WHEELS</footer></div>';

  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  document.querySelectorAll('[data-email]').forEach(el=>{el.textContent=O.EMAIL;if(el.tagName==='A')el.href='mailto:'+O.EMAIL;});
  document.querySelectorAll('[data-phone]').forEach(el=>{el.textContent=O.PHONE;if(el.tagName==='A')el.href='tel:'+O.PHONE.replace(/\s/g,'');});
  const io = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.06});
  const observe = root=>(root||document).querySelectorAll('.reveal').forEach(el=>io.observe(el));
  observe();
  window.addEventListener('beforeprint',()=>document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in')));

  const grid=document.getElementById('designsGrid');
  if(grid){
    const designs = [...O.DESIGNS].sort((a, b) => Number(b.sourceBrand === 'E6') - Number(a.sourceBrand === 'E6'));
    grid.innerHTML = designs.map((d, i) => {
      const e6 = d.sourceBrand === 'E6';
      const construction = d.constructionLabel || (d.pieces === 3 ? 'Třídílné' : d.pieces === 1 ? 'Monoblok' : 'Konstrukce k potvrzení');
      const visual = e6 ? '<img class="wheel-thumb e6-catalog-photo" src="'+O.escape(d.productPhoto)+'" alt="'+O.escape(d.name)+' — původní produktová fotografie E6" width="400" height="400" loading="lazy">' : O.renderWheel({design:d.id});
      const href = 'konfigurator.html?design=' + encodeURIComponent(d.id) + (e6 ? '&view=wheel-photo' : '&color=silver&view=wheel');
      return '<a class="design-card reveal'+(e6?' design-card--e6':'')+'" href="'+href+'"><span class="series">'+String(i+1).padStart(2,'0')+' / '+O.escape(construction)+'</span>'+visual+'<div class="design-card__title"><b>'+O.escape(d.name)+'</b><span aria-hidden="true">↗</span></div><span>'+O.escape(e6?'Fotografie modelu E6 · vybrat provedení':O.spokesLabel(d)+' · prohlédnout ve 3D')+'</span></a>';
    }).join('');
    grid.setAttribute('aria-label', 'Kolekce '+designs.length+' designů kol, všechny modely E6 jako první');
    const position = document.getElementById('collectionPosition');
    if(position)position.textContent='01 / '+designs.length;
    observe(grid);
  }
  const label=document.getElementById('labelMock');
  if(label)label.innerHTML=O.labelHTML({order:'NFW · 001',model:'Tvůj vůz',design:'FORGED 10',pos:'FL — přední levé',size:'20 × 9,0"',et:35,pcd:'5x112',cb:'66,6',color:'Hyper Silver',finish:'Gloss',weight:'Dle schváleného výkresu',date:new Date().toISOString().slice(0,10)});
  const count=document.querySelector('[data-brand-count]');
  if(count && window.NFWVehicles)count.textContent=window.NFWVehicles.brands.length;

  const form=document.getElementById('contactForm');
  form?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(form);const body=['Jméno: '+(f.get('name')||''),'E-mail: '+(f.get('email')||''),'Telefon: '+(f.get('phone')||''),'Vůz: '+(f.get('car')||''),'',f.get('msg')||''].join('\r\n');location.href='mailto:'+O.EMAIL+'?subject='+encodeURIComponent('Need For Wheels — poptávka '+(f.get('car')||'kol'))+'&body='+encodeURIComponent(body);});

  document.querySelectorAll('[data-launch-wheel]').forEach(button=>button.addEventListener('click',async()=>{
    const container=document.getElementById(button.dataset.launchWheel);
    button.disabled=true;
    const fallback=container.innerHTML;
    try{await import('./showroom.js?v=20260906-exact-vehicle');container.replaceChildren();await window.NFWShowroom.mount(container,{mode:'wheel',design:'apex10',color:'#b9bcc2',finish:'gloss',diameter:20,width:9.5,autoRotate:!matchMedia('(prefers-reduced-motion: reduce)').matches});button.hidden=true;}
    catch{container.innerHTML=fallback;button.disabled=false;button.textContent='3D se nepodařilo načíst · zkusit znovu';}
  }));
})();
