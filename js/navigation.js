/* OARTS — one accessible, progressively enhanced navigation on every page. */
(function () {
  'use strict';
  const nav = document.querySelector('.site-header'), burger = nav?.querySelector('.site-menu-toggle');
  if (!nav || !burger || nav.dataset.navigationReady) return;
  nav.dataset.navigationReady = 'true';
  const navLinks = nav.querySelector('#navLinks');
  const more = nav.querySelector('.site-nav-more'), moreSummary = more?.querySelector('summary');
  const headerInner = nav.querySelector('.site-header__inner');
  const primary = nav.querySelector('.site-nav__primary');
  const compactViewport = window.matchMedia('(max-width: 1280px)');
  let menuState = null;
  const isMobileMenu = () => getComputedStyle(burger).display !== 'none';
  const rememberStyle = (element, properties) => properties.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
  const restoreStyle = (element, properties) => properties.forEach(([property, value, priority]) => value ? element.style.setProperty(property, value, priority) : element.style.removeProperty(property));
  const restoreAttribute = (element, name, value) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value);
  const menuTargets = () => [...nav.querySelectorAll('a[href], button:not([disabled]), summary, [tabindex="0"]')].filter(element => !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  const closeMore = ({restoreFocus = false} = {}) => {
    if (!more?.open) return;
    more.open = false;
    if (restoreFocus) moreSummary?.focus({preventScroll: true});
  };
  const closeMenu = ({restoreFocus = true} = {}) => {
    nav.classList.remove('open');
    document.documentElement.classList.remove('site-menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Otevřít menu');
    if (navLinks) navLinks.inert = isMobileMenu();
    if (!menuState) return;
    const previous = menuState;
    menuState = null;
    previous.background.forEach(([element, inert]) => { element.inert = inert; });
    restoreAttribute(nav, 'role', previous.role);
    restoreAttribute(nav, 'aria-modal', previous.modal);
    restoreAttribute(nav, 'aria-label', previous.label);
    restoreStyle(document.body, previous.bodyStyle);
    restoreStyle(document.documentElement, previous.rootStyle);
    window.scrollTo({left: previous.x, top: previous.y, behavior: 'instant'});
    if (restoreFocus && previous.focus?.isConnected) previous.focus.focus({preventScroll: true});
  };
  const openMenu = () => {
    if (!navLinks || !isMobileMenu() || menuState) return;
    closeMore();
    menuState = {
      focus: burger,
      x: window.scrollX, y: window.scrollY,
      role: nav.getAttribute('role'), modal: nav.getAttribute('aria-modal'), label: nav.getAttribute('aria-label'),
      bodyStyle: rememberStyle(document.body, ['position', 'top', 'left', 'right', 'width', 'overflow', 'padding-right']),
      rootStyle: rememberStyle(document.documentElement, ['overflow']),
      background: [...document.body.children].filter(element => element !== nav && !element.contains(nav) && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)).map(element => [element, element.inert])
    };
    const scrollbar = innerWidth - document.documentElement.clientWidth;
    menuState.background.forEach(([element]) => { element.inert = true; });
    document.documentElement.style.setProperty('overflow', 'hidden');
    Object.assign(document.body.style, {position: 'fixed', top: `${-menuState.y}px`, left: `${-menuState.x}px`, right: '0', width: '100%', overflow: 'hidden'});
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    nav.setAttribute('role', 'dialog');
    nav.setAttribute('aria-modal', 'true');
    nav.setAttribute('aria-label', 'Hlavní navigace');
    navLinks.inert = false;
    nav.classList.add('open');
    document.documentElement.classList.add('site-menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Zavřít menu');
    navLinks.querySelector('.site-mobile-nav a[href]')?.focus({preventScroll: true});
  };
  burger.addEventListener('click', () => menuState ? closeMenu() : openMenu());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (menuState) { event.preventDefault(); closeMenu(); }
      else if (more?.open) { event.preventDefault(); closeMore({restoreFocus: true}); }
      return;
    }
    if (!menuState || event.key !== 'Tab') return;
    const targets = menuTargets(), first = targets[0], last = targets.at(-1);
    if (event.shiftKey && (document.activeElement === first || !nav.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !nav.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener('pointerdown', event => {
    if (more?.open && !more.contains(event.target)) closeMore();
  });
  more?.addEventListener('toggle', () => moreSummary?.setAttribute('aria-expanded', String(more.open)));
  moreSummary?.setAttribute('aria-expanded', String(more.open));
  moreSummary?.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || isMobileMenu()) return;
    event.preventDefault();
    more.open = true;
    const links = more.querySelectorAll('a[href]');
    (event.key === 'ArrowUp' ? links[links.length - 1] : links[0])?.focus();
  });
  more?.addEventListener('keydown', event => {
    if (!more.open || event.target === moreSummary || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const links = [...more.querySelectorAll('a[href]')], current = links.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
    links[next]?.focus();
  });
  more?.addEventListener('focusout', () => queueMicrotask(() => {
    if (more.open && !more.contains(document.activeElement)) closeMore();
  }));
  const syncMenu = () => {
    if (!isMobileMenu() && menuState) closeMenu({restoreFocus: false});
    if (navLinks) navLinks.inert = Boolean(isMobileMenu() && !menuState);
    if (isMobileMenu()) closeMore();
  };
  // Browser zoom changes CSS viewport width. Above the common breakpoint also
  // check the actual content, so larger fonts never wrap a desktop item below
  // the bar. Measure in desktop mode before choosing the compact layout.
  const syncLayout = () => {
    nav.dataset.navLayout = compactViewport.matches ? 'compact' : 'desktop';
    if (!compactViewport.matches && headerInner && navLinks && primary) {
      const brand = nav.querySelector('.site-brand'), actions = nav.querySelector('.site-header__actions');
      const gap = parseFloat(getComputedStyle(headerInner).columnGap) || 0;
      const required = (brand?.getBoundingClientRect().width || 0) + navLinks.scrollWidth + (actions?.getBoundingClientRect().width || 0) + gap * 2;
      if (required > headerInner.clientWidth) nav.dataset.navLayout = 'compact';
    }
    syncMenu();
  };
  let layoutFrame = 0;
  const queueLayout = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(syncLayout);
  };
  syncLayout();
  document.documentElement.classList.add('site-nav-ready');
  window.addEventListener('resize', queueLayout, {passive: true});
  if (headerInner && 'ResizeObserver' in window) new ResizeObserver(queueLayout).observe(headerInner);
  document.fonts?.ready.then(queueLayout);
  document.fonts?.addEventListener('loadingdone', queueLayout);
  window.addEventListener('pagehide', () => {closeMenu({restoreFocus: false}); closeMore();});
  window.addEventListener('pageshow', queueLayout);
  const syncHomeSection = () => {
    if (!document.body.classList.contains('page-home')) return;
    const selected = location.hash || '';
    navLinks.querySelectorAll('a[href^="index.html"]').forEach(link => {
      const hash = new URL(link.href, location.href).hash;
      if (hash === selected) link.setAttribute('aria-current', hash ? 'location' : 'page');
      else link.removeAttribute('aria-current');
    });
  };
  window.addEventListener('hashchange', syncHomeSection);
  syncHomeSection();
  document.querySelectorAll('[data-year]').forEach(element => {element.textContent = String(new Date().getFullYear());});
  // Give form controls the full mobile viewport while the customer is typing.
  const syncEditing = () => document.body.classList.toggle('nfw-mobile-editing', Boolean(document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea, [contenteditable="true"]')));
  document.addEventListener('focusin', syncEditing);
  document.addEventListener('focusout', () => queueMicrotask(syncEditing));
  // Keep native anchor history and scrolling. Move keyboard/screen-reader focus
  // with the section, so the next Tab continues where the user has arrived.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    if (nav.contains(link)) { closeMenu({restoreFocus: false}); closeMore(); }
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
    if (!target || !target.matches('section, main, article, h1, h2, h3, [role="region"]')) return;
    const destination = target.matches('h1, h2, h3') ? target : target.querySelector('h1, h2, h3') || target;
    requestAnimationFrame(() => {
      if (event.defaultPrevented || !destination.isConnected) return;
      const hadTabIndex = destination.hasAttribute('tabindex');
      if (!hadTabIndex) destination.setAttribute('tabindex', '-1');
      destination.focus({preventScroll: true});
      if (!hadTabIndex) destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), {once: true});
    });
  });
})();
