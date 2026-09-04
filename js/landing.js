/* Landing interactions: intentional browsing, no forced scrolling or gated content. */
(function () {
  'use strict';
  const hero = document.querySelector('.hero-carousel');
  if (!hero) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const slides = [...hero.querySelectorAll('[data-hero-slide]')];
  const dots = [...hero.querySelectorAll('[data-hero-to]')];
  // Prepare the next frames before visitors advance; hidden lazy images would flash blank.
  slides.forEach(slide => { const img = slide.querySelector('img'); if (img) img.loading = 'eager'; });
  const pause = hero.querySelector('[data-hero-pause]');
  let index = 0, timer = null, visible = true, hovered = false, focused = false;
  let userPaused = reduced.matches, explicitResume = false;
  const interval = 7500;

  function schedule() {
    clearTimeout(timer); timer = null;
    const playing = !userPaused && !reduced.matches && visible && (!hovered || explicitResume) && (!focused || explicitResume) && !document.hidden;
    hero.classList.toggle('is-playing', playing);
    hero.classList.toggle('is-motion', !reduced.matches);
    pause.textContent = userPaused || reduced.matches ? '▶' : 'Ⅱ';
    pause.setAttribute('aria-label', userPaused || reduced.matches ? 'Spustit prezentaci' : 'Pozastavit prezentaci');
    pause.setAttribute('aria-pressed', String(userPaused || reduced.matches));
    // Reduced motion permits manual browsing; autoplay is always disabled.
    pause.disabled = reduced.matches;
    if (reduced.matches) pause.setAttribute('aria-label', 'Automatické přehrávání vypnuto podle nastavení omezeného pohybu');
    if (playing) timer = setTimeout(() => show(index + 1), interval);
  }
  function show(next, manual = false) {
    if (manual) explicitResume = false;
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== index; });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    hero.querySelector('.hero-current').innerHTML = String(index + 1).padStart(2, '0') + ' <i>/ 03</i>';
    if (manual) hero.querySelector('#heroStatus').textContent = slides[index].getAttribute('aria-label');
    schedule();
  }
  hero.querySelector('[data-hero-prev]').addEventListener('click', () => show(index - 1, true));
  hero.querySelector('[data-hero-next]').addEventListener('click', () => show(index + 1, true));
  dots.forEach(dot => dot.addEventListener('click', () => show(Number(dot.dataset.heroTo), true)));
  pause.addEventListener('click', () => { userPaused = !userPaused; explicitResume = !userPaused; schedule(); });
  hero.addEventListener('mouseenter', () => { hovered = true; explicitResume = false; schedule(); });
  hero.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  hero.addEventListener('focusin', e => { focused = true; if (e.target !== pause) explicitResume = false; schedule(); });
  hero.addEventListener('focusout', () => queueMicrotask(() => { focused = hero.contains(document.activeElement); schedule(); }));
  hero.addEventListener('keydown', e => {
    if (!e.target.closest('.hero-pagination')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1), true); }
  });
  let start = null;
  hero.addEventListener('pointerdown', e => { if (e.isPrimary && !e.target.closest('a,button')) start = {x:e.clientX,y:e.clientY}; });
  hero.addEventListener('pointercancel', () => { start = null; });
  hero.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y; start = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) show(index + (dx < 0 ? 1 : -1), true);
  });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { if (reduced.matches) userPaused = true; document.documentElement.classList.toggle('motion-ready', !reduced.matches); schedule(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, {threshold:.15}).observe(hero);
  if (!reduced.matches) document.documentElement.classList.add('motion-ready');
  schedule();

  const logos = document.getElementById('brandRibbonLogos');
  const brands = ['bmw','mercedes-benz','audi','volkswagen','skoda','porsche','tesla','land-rover-range-rover'];
  logos.innerHTML = brands.map(id => {
    const b = window.NFWBrandLogos?.[id];
    return b ? `<a href="index.html?catalogBrand=${id}#vehicleCatalogue" data-discover-brand="${id}" aria-label="Najít vozy ${window.NFW.escape(b.name)}"><img src="${window.NFW.escape(b.src)}" alt="" loading="lazy" width="160" height="112"></a>` : '';
  }).join('');
  logos.addEventListener('click', e => {
    const link = e.target.closest('[data-discover-brand]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const brandSelect = document.getElementById('catalogBrand');
    if (!brandSelect) return;
    e.preventDefault();
    // A direct brand choice starts a fresh search so a stale model cannot hide it.
    const reset = document.getElementById('catalogReset');
    if (reset && !reset.hidden) reset.click();
    brandSelect.value = link.dataset.discoverBrand;
    brandSelect.dispatchEvent(new Event('change', {bubbles:true}));
    const url = new URL(location.href); url.hash = 'vehicleCatalogue';
    history.replaceState(null, '', url);
    document.getElementById('vehicleCatalogue').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
  });

  const track = document.getElementById('designsGrid');
  const prev = document.querySelector('[data-design-prev]');
  const next = document.querySelector('[data-design-next]');
  const cards = [...track.querySelectorAll('.design-card')];
  function collectionState() {
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 3;
    const trackLeft = track.getBoundingClientRect().left;
    const nearest = cards.reduce((best, card, i) => Math.abs(card.getBoundingClientRect().left - trackLeft) < best.distance ? {index:i,distance:Math.abs(card.getBoundingClientRect().left - trackLeft)} : best, {index:0,distance:Infinity});
    document.getElementById('collectionPosition').textContent = String(nearest.index + 1).padStart(2,'0') + ' / ' + cards.length;
  }
  function moveCollection(direction) {
    const cardWidth = cards[0]?.getBoundingClientRect().width || track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const count = Math.max(1, Math.floor(track.clientWidth / (cardWidth + gap)));
    track.scrollBy({left:direction * count * (cardWidth + gap),behavior:reduced.matches?'instant':'smooth'});
  }
  prev.addEventListener('click', () => moveCollection(-1)); next.addEventListener('click', () => moveCollection(1));
  track.addEventListener('scroll', collectionState, {passive:true});
  track.addEventListener('keydown', e => { if (e.target === track && ['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); moveCollection(e.key==='ArrowRight'?1:-1); } });
  new ResizeObserver(collectionState).observe(track); collectionState();

  const dock = document.getElementById('discoveryDock');
  const contact = document.getElementById('kontakt');
  let scrollPending = false;
  function scrollState() {
    scrollPending = false;
    const height = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty('--reading-progress', height > 0 ? Math.min(1,scrollY/height) : 0);
    dock.hidden = hero.getBoundingClientRect().bottom > 0 || contact.getBoundingClientRect().top < innerHeight + 100;
  }
  addEventListener('scroll', () => { if (!scrollPending) { scrollPending=true; requestAnimationFrame(scrollState); } }, {passive:true});
  addEventListener('resize', scrollState); scrollState();
  addEventListener('pagehide', () => clearTimeout(timer));
  addEventListener('pageshow', e => { if (e.persisted) { schedule(); scrollState(); } });
})();
