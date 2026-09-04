/* Need For Wheels — shared navigation, reference media and product gallery. */
(function () {
  'use strict';
  const O = window.NFW;
  O.EMAIL = 'info@oarts.cz';
  O.PHONE = '+420 777 000 000';
  O.SITE_URL = 'https://majkpowa.github.io/NeedForKola/';
  O.spokesLabel = d => d.spokesLabel || `${d.spokes} paprsků`;
  O.escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  O.labelHTML = d => '<div class="shipping-label"><header><b>NEED FOR WHEELS</b><span>'+O.escape(d.order)+'</span></header><small>SPECIFIKACE KOLA · NÁHLED</small><dl>'+[['Vůz',d.model],['Design',d.design],['Pozice',d.pos],['Rozměr',d.size],['ET / PCD / CB',d.et+' / '+d.pcd+' / '+d.cb],['Barva',d.color],['Povrch',d.finish],['Hmotnost',d.weight]].map(([k,v])=>'<dt>'+k+'</dt><dd>'+O.escape(v)+'</dd>').join('')+'</dl><footer>'+O.escape(d.date)+' · CUSTOM FORGED WHEELS</footer></div>';

  const nav = document.querySelector('.nav'), burger = document.querySelector('.burger');
  const close = () => {nav?.classList.remove('open'); burger?.setAttribute('aria-expanded','false');};
  burger?.addEventListener('click',()=>{const open=nav.classList.toggle('open');burger.setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('.nav__links a').forEach(a=>a.addEventListener('click',close));
  document.addEventListener('keydown', e=>{if(e.key==='Escape')close();});
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  document.querySelectorAll('[data-email]').forEach(el=>{el.textContent=O.EMAIL;if(el.tagName==='A')el.href='mailto:'+O.EMAIL;});
  document.querySelectorAll('[data-phone]').forEach(el=>{el.textContent=O.PHONE;if(el.tagName==='A')el.href='tel:'+O.PHONE.replace(/\s/g,'');});
  const io = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.06});
  const observe = root=>(root||document).querySelectorAll('.reveal').forEach(el=>io.observe(el));
  observe();
  window.addEventListener('beforeprint',()=>document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in')));

  const grid=document.getElementById('designsGrid');
  if(grid){
    grid.innerHTML=O.DESIGNS.map((d,i)=>'<a class="design-card reveal" href="konfigurator.html?design='+d.id+'&color=bronze&view=wheel"><span class="series">'+String(i+1).padStart(2,'0')+' / '+(d.pieces===3?'MULTI PIECE':'MONOBLOCK')+'</span>'+O.renderWheel({design:d.id})+'<div class="design-card__title"><b>'+d.name+'</b><span aria-hidden="true">↗</span></div><span>'+O.spokesLabel(d)+' · prohlédnout ve 3D</span></a>').join('');
    observe(grid);
  }
  const label=document.getElementById('labelMock');
  if(label)label.innerHTML=O.labelHTML({order:'NFW · 001',model:'BMW X5 · G05 · 2020',design:'FORGED 10',pos:'FL — přední levé',size:'20 × 9,0"',et:35,pcd:'5x112',cb:'66,6',color:'Bronze',finish:'Gloss',weight:'Dle schváleného výkresu',date:new Date().toISOString().slice(0,10)});
  const count=document.querySelector('[data-brand-count]');
  if(count && window.NFWVehicles)count.textContent=window.NFWVehicles.brands.length;

  const form=document.getElementById('contactForm');
  form?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(form);const body=['Jméno: '+(f.get('name')||''),'E-mail: '+(f.get('email')||''),'Telefon: '+(f.get('phone')||''),'Vůz: '+(f.get('car')||''),'',f.get('msg')||''].join('\r\n');location.href='mailto:'+O.EMAIL+'?subject='+encodeURIComponent('Need For Wheels — poptávka '+(f.get('car')||'kol'))+'&body='+encodeURIComponent(body);});

  document.querySelectorAll('[data-launch-wheel]').forEach(button=>button.addEventListener('click',async()=>{
    const container=document.getElementById(button.dataset.launchWheel);
    button.disabled=true;
    const fallback=container.innerHTML;
    try{await import('./showroom.js');container.replaceChildren();await window.NFWShowroom.mount(container,{mode:'wheel',design:'apex10',color:'#9a6d3a',finish:'gloss',diameter:20,width:9.5,autoRotate:!matchMedia('(prefers-reduced-motion: reduce)').matches});button.hidden=true;}
    catch{container.innerHTML=fallback;button.disabled=false;button.textContent='3D se nepodařilo načíst · zkusit znovu';}
  }));
})();
