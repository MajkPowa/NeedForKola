/* Need For Wheels — shared accessible navigation and section handoff. */
(function () {
  'use strict';
  const nav = document.querySelector('.nav'), burger = document.querySelector('.burger');
  if (nav?.dataset.navigationReady) return;
  if (nav) nav.dataset.navigationReady = 'true';
  const navLinks = nav?.querySelector('.nav__links');
  const isMobileMenu = () => burger && getComputedStyle(burger).display !== 'none';
  let menuState = null;
  const rememberStyle = (element, properties) => properties.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
  const restoreStyle = (element, properties) => properties.forEach(([property, value, priority]) => value ? element.style.setProperty(property, value, priority) : element.style.removeProperty(property));
  const restoreAttribute = (element, name, value) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value);
  const menuTargets = () => [...nav.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  const closeMenu = ({restoreFocus = true} = {}) => {
    if (!nav || !burger) return;
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Otevřít menu');
    if (navLinks) navLinks.inert = Boolean(isMobileMenu());
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
    if (!nav || !burger || !navLinks || !isMobileMenu() || menuState) return;
    menuState = {
      // Safari does not consistently focus buttons after a touch activation.
      focus: burger,
      x: window.scrollX, y: window.scrollY,
      role: nav.getAttribute('role'), modal: nav.getAttribute('aria-modal'), label: nav.getAttribute('aria-label'),
      bodyStyle: rememberStyle(document.body, ['position', 'top', 'left', 'right', 'width', 'overflow']),
      rootStyle: rememberStyle(document.documentElement, ['overflow']),
      background: [...document.body.children].filter(element => element !== nav && !element.contains(nav) && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName)).map(element => [element, element.inert])
    };
    menuState.background.forEach(([element]) => { element.inert = true; });
    document.documentElement.style.setProperty('overflow', 'hidden');
    Object.assign(document.body.style, {position: 'fixed', top: `${-menuState.y}px`, left: `${-menuState.x}px`, right: '0', width: '100%', overflow: 'hidden'});
    nav.setAttribute('role', 'dialog');
    nav.setAttribute('aria-modal', 'true');
    nav.setAttribute('aria-label', 'Hlavní navigace');
    navLinks.inert = false;
    nav.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Zavřít menu');
    navLinks.querySelector('a[href]')?.focus({preventScroll: true});
  };
  burger?.addEventListener('click', () => menuState ? closeMenu() : openMenu());
  document.addEventListener('keydown', event => {
    if (!menuState) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
    if (event.key === 'Tab') {
      const targets = menuTargets(), first = targets[0], last = targets.at(-1);
      if (event.shiftKey && (document.activeElement === first || !nav.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !nav.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
  });
  const syncMenu = () => {
    if (!isMobileMenu() && menuState) closeMenu({restoreFocus: false});
    if (navLinks) navLinks.inert = Boolean(isMobileMenu() && !menuState);
  };
  window.addEventListener('resize', syncMenu, {passive: true});
  window.addEventListener('pagehide', () => closeMenu({restoreFocus: false}));
  syncMenu();
  // Give form controls the full mobile viewport while the customer is typing.
  const syncEditing = () => document.body.classList.toggle('nfw-mobile-editing', Boolean(document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea, [contenteditable="true"]')));
  document.addEventListener('focusin', syncEditing);
  document.addEventListener('focusout', () => queueMicrotask(syncEditing));
  // Keep native anchor history and scrolling. Move keyboard/screen-reader focus
  // with the section, so the next Tab continues where the user has arrived.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    if (nav?.contains(link)) closeMenu({restoreFocus: false});
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
