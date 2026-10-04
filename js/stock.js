/* Stock comes from the server catalogue; gallery photos do not prove inventory. */
(function () {
  'use strict';
  const C = window.NFWCommerce;
  const node = (tag, css, text) => { const el = document.createElement(tag); if (css) el.className=css; if (text !== undefined) el.textContent=String(text); return el; };
  function cta(href, text) { const link=node('a','btn btn--primary stock-cta'); link.href=href; link.append(node('span','',text)); return link; }
  function empty(container, failed=false) {
    const panel=node('div','stock-empty'); panel.dataset.stockState='unconfirmed';
    const visual=node('div','stock-empty__visual'), img=node('img'); img.src='assets/real-wheels/nfw-r001/asset-055-thumb.webp'; img.alt='Skutečné provedení stříbrného disku; dostupnost na dotaz'; img.loading='lazy'; visual.append(img,node('span','stock-empty__image-note','Ukázka provedení · dostupnost na dotaz'));
    const copy=node('div','stock-empty__copy'); copy.append(node('span','eyebrow','Vybereme kola pro tvé auto'),node('h3','',failed?'Dostupnost ověříme osobně.':'Aktuální skladovou nabídku připravujeme.'),node('p','','Napiš nám vůz, požadovaný rozměr a barvu. Potvrdíme konkrétní sadu, cenu a termín.'),cta('objednavka.html?source=stock','Zeptat se na dostupné sady →'),node('small','stock-email-hint','Nezávazná poptávka. Odeslání samo sadu nerezervuje.'));
    panel.append(visual,copy); container.replaceChildren(panel);
  }
  function render(container,data) {
    if (!container) return;
    const items=(Array.isArray(data?.items)?data.items:[]).filter(item=>C?.validProduct(item));
    if (!items.length) { empty(container); return; }
    const grid=node('div','stock-grid');grid.dataset.stockState='listed';
    for (const item of items) {
      const card=node('article','stock-card');card.dataset.stockId=item.id;const visual=node('div','stock-card__visual');
      if (C.photoPath(item.image)) { const img=node('img');img.src=item.image;img.alt=item.title;img.loading='lazy';visual.append(img); }
      visual.append(node('span','stock-quantity',data.orderingEnabled?'K dispozici: '+item.stockAvailable+' sad':'Dostupnost potvrdíme'));
      const copy=node('div','stock-card__copy');copy.append(node('span','eyebrow',item.sku||item.id),node('h3','',item.title));
      const specs=node('dl','stock-specs');for(const s of Array.isArray(item.specs)?item.specs:[]) if(s?.label&&s?.value) specs.append(node('dt','',s.label),node('dd','',s.value));copy.append(specs);
      if(item.description)copy.append(node('p','stock-card__note',item.description));
      const footer=node('div','stock-card__footer'),price=node('div','stock-price');price.append(node('strong','',C.money(item.priceCents)),node('small','','Konečná cena za sadu · '+(item.wheelsPerSet||4)+' kola'));
      footer.append(price,cta(data.orderingEnabled?'objednavka.html?product='+encodeURIComponent(item.id):'objednavka.html?source=stock&reference='+encodeURIComponent(item.sku||item.id),data.orderingEnabled?'Objednat sadu →':'Poptat sadu →'));copy.append(footer);card.append(visual,copy);grid.append(card);
    }
    container.replaceChildren(grid);
  }
  const container=document.getElementById('stockInventory');
  window.NFWStockView=Object.freeze({render});
  if(container){ empty(container); C?.getCatalog().then(data=>render(container,data)).catch(()=>empty(container,true)); }
})();
