/* Finite, interruptible feedback. Essential content never depends on motion. */
(function () {
  'use strict';
  if (document.documentElement.dataset.siteMotion) return;
  document.documentElement.dataset.siteMotion = 'ready';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  const seen = new WeakSet();
  const pending = new Set();
  const selector = '.section__head, .ready-section-head, .ev-section-head, .editorial-card, .project-card, .ready-product, .ready-teaser-card, .ev-model-card, .step';
  let engaged = false;
  const animate = (element, frames, options) => {
    if (reduced.matches || document.hidden || !element.animate) return;
    const old = active.get(element);
    old?.cancel();
    const animation = element.animate(frames, options);
    active.set(element, animation);
    animation.finished.catch(() => {}).finally(() => { if (options.fill !== 'forwards' && active.get(element) === animation) active.delete(element); });
    return animation;
  };
  const reveal = element => {
    if (seen.has(element)) return;
    seen.add(element);
    animate(element, [{opacity:.78,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}], {duration:420,easing:'cubic-bezier(.2,.75,.25,1)'});
  };
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) { pending.delete(entry.target); return; }
      observer.unobserve(entry.target);
      if (engaged) reveal(entry.target); else pending.add(entry.target);
    });
  }, {threshold:.08}) : null;
  const registered = new WeakSet();
  function register(container) {
    if (!observer) return;
    container.querySelectorAll(selector).forEach(element => {
      if (registered.has(element)) return;
      registered.add(element);
      observer.observe(element);
    });
  }
  register(document);
  const header = document.querySelector('.site-header');
  const menu = header?.querySelector('#navLinks');
  if (header && menu && 'MutationObserver' in window) {
    new MutationObserver(() => {
      if (header.classList.contains('open')) {
        animate(menu,[{opacity:.65,transform:'translateY(-8px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.2,.75,.25,1)'});
      } else active.get(menu)?.cancel();
    }).observe(header,{attributes:true,attributeFilter:['class']});
  }
  header?.querySelector('.site-nav-more')?.addEventListener('toggle', event => {
    const panel = event.currentTarget.querySelector('.site-nav-more__links');
    if (event.currentTarget.open) animate(panel,[{opacity:.65,transform:'translateY(-6px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:220,easing:'cubic-bezier(.2,.75,.25,1)'});
    else active.get(panel)?.cancel();
  });
  function engage() {
    engaged = true;
    pending.forEach(element => seen.add(element));
    pending.clear();
    ['pointerdown','keydown','wheel','touchstart'].forEach(type => document.removeEventListener(type, engage));
  }
  ['pointerdown','keydown','wheel','touchstart'].forEach(type => document.addEventListener(type, engage, {passive:true}));
  if ('MutationObserver' in window) {
    const listObserver = new MutationObserver(records => {
      const roots = new Set(records.map(record => record.target.closest?.('#readyProducts, #readyWheelsTeaser, [data-blog-grid], [data-blog-teasers], [data-projects-grid]')).filter(Boolean));
      roots.forEach(register);
    });
    document.querySelectorAll('#readyProducts, #readyWheelsTeaser, [data-blog-grid], [data-blog-teasers], [data-projects-grid]').forEach(root => listObserver.observe(root, {childList:true,subtree:true}));
  }
  // Critically damped release starts at the currently displayed value. It can
  // be pressed again without finishing the previous animation or locking input.
  const presses = new WeakMap();
  const buttonSelector = '.btn, .round-control, .site-menu-toggle, .ready-hero-cta, .ev-model-card__cta';
  const currentScale = element => {
    const transform = getComputedStyle(element).transform;
    if (transform === 'none') return 1;
    try { return new DOMMatrixReadOnly(transform).a; } catch { return 1; }
  };
  function release(element) {
    if (!presses.has(element)) return;
    presses.delete(element);
    const start = currentScale(element);
    const frames = Array.from({length:25}, (_,index) => {
      const t = index / 24, spring = 1 - (1 + 8 * t) * Math.exp(-8 * t);
      return {transform:`scale(${start + (1 - start) * spring})`,offset:t};
    });
    frames[frames.length - 1].transform = 'scale(1)';
    animate(element, frames, {duration:320,easing:'linear'});
  }
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || reduced.matches) return;
    const element = event.target.closest?.(buttonSelector);
    if (!element || element.disabled) return;
    const start = currentScale(element);
    presses.set(element,event.pointerId);
    animate(element,[{transform:`scale(${start})`},{transform:'scale(.975)'}],{duration:90,easing:'ease-out',fill:'forwards'});
  }, {passive:true});
  const releasePointer = event => {
    document.querySelectorAll(buttonSelector).forEach(element => { if (presses.get(element) === event.pointerId) release(element); });
  };
  document.addEventListener('pointerup', releasePointer, {passive:true});
  document.addEventListener('pointercancel', releasePointer, {passive:true});
  function cancelMotion() { active.forEach(animation => animation.cancel()); active.clear(); }
  reduced.addEventListener('change', () => { if (reduced.matches) cancelMotion(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelMotion(); });
  window.addEventListener('pagehide', cancelMotion);
})();
