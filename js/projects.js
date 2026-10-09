/* Real customer projects and their clearly identified photographic/design evidence. */
(function () {
  'use strict';
  const grid = document.querySelector('[data-projects-grid]');
  if (!grid) return;
  window.NFWProjects?.dispose?.();
  const empty = document.querySelector('[data-projects-empty]');
  const text = value => typeof value === 'string' ? value.trim() : '';
  const asset = value => typeof value === 'string' && /^assets\/projects\/[a-z\d_/-]+\.(?:jpe?g|png|webp|avif)$/i.test(value) && !value.includes('..') ? value : '';
  const dimension = value => Number.isInteger(value) && value > 0 && value <= 20000 ? value : null;
  const kinds = {
    photo: { label: 'Fotografie realizace', short: 'Fotografie', rank: 0 },
    technical: { label: 'Technický podklad', short: 'Technický podklad', rank: 1 },
    visualization: { label: 'Vizualizace návrhu', short: 'Vizualizace', rank: 2 }
  };
  const srcset = value => {
    const candidates = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map(part => {
      const match = part.trim().match(/^(\S+)\s+(\d+)w$/);
      return match ? { src: match[1], width: Number(match[2]) } : null;
    }) : [];
    return candidates.filter(candidate => candidate && asset(candidate.src) && dimension(candidate.width))
      .map(candidate => asset(candidate.src) + ' ' + candidate.width + 'w').join(', ');
  };
  const normalizeImage = image => {
    if (!image || !asset(image.src) || !text(image.alt)) return null;
    return {
      src: asset(image.src), thumb: asset(image.thumb) || asset(image.src), alt: text(image.alt),
      title: text(image.title), caption: text(image.caption), srcset: srcset(image.srcset),
      width: dimension(image.width), height: dimension(image.height),
      kind: Object.hasOwn(kinds, image.kind) ? image.kind : 'photo'
    };
  };
  const node = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) element.textContent = content;
    return element;
  };
  const setImage = (element, image, thumbnail = false) => {
    element.alt = thumbnail ? '' : image.alt; element.decoding = 'async';
    if (image.width && image.height) { element.width = image.width; element.height = image.height; }
    if (!thumbnail && image.srcset) {
      element.srcset = image.srcset;
      element.sizes = '(max-width: 760px) calc(100vw - 48px), 1100px';
    }
    element.src = thumbnail ? image.thumb : image.src;
  };
  const imageCount = count => count + ' ' + (count === 1 ? 'snímek' : count < 5 ? 'snímky' : 'snímků');
  let cleanup = () => {};
  function render() {
    cleanup(); grid.replaceChildren(); grid.classList.add('custom-projects-grid');
    const source = Array.isArray(window.NFWEditorial?.projects) ? window.NFWEditorial.projects : [];
    const projects = source.filter(project => project && text(project.title) && text(project.vehicle) && Array.isArray(project.images))
      .map(project => ({ ...project, title: text(project.title), vehicle: text(project.vehicle),
        images: project.images.map(normalizeImage).filter(Boolean).sort((a, b) => kinds[a.kind].rank - kinds[b.kind].rank),
        specs: (Array.isArray(project.specs) ? project.specs : []).filter(spec => spec && text(spec.label) && text(spec.value))
          .map(spec => ({ label: text(spec.label), value: text(spec.value) }))
      })).filter(project => project.images.length);
    grid.hidden = !projects.length; if (empty) empty.hidden = Boolean(projects.length);
    if (!projects.length) { cleanup = () => {}; return; }

    const listeners = new AbortController();
    const on = (element, event, handler, options = {}) => element.addEventListener(event, handler, { ...options, signal: listeners.signal });
    const dialog = node('dialog', 'project-lightbox custom-project-lightbox');
    const header = node('div', 'project-gallery__header');
    const heading = node('h2', 'project-gallery__title'); heading.id = 'customProjectGalleryTitle';
    const vehicle = node('p', 'project-gallery__vehicle');
    const close = node('button', 'project-lightbox__close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Zavřít galerii projektu');
    const frame = node('div', 'project-gallery__frame'); frame.style.touchAction = 'pan-y pinch-zoom';
    const mediaType = node('p', 'project-gallery__type');
    const caption = node('p', 'project-lightbox__caption'); caption.setAttribute('aria-live', 'polite'); caption.setAttribute('aria-atomic', 'true');
    const controls = node('div', 'project-lightbox__controls');
    const prev = node('button', 'project-gallery__arrow', '←'), next = node('button', 'project-gallery__arrow', '→');
    prev.type = next.type = 'button'; prev.setAttribute('aria-label', 'Předchozí snímek'); next.setAttribute('aria-label', 'Další snímek');
    const thumbs = node('div', 'project-gallery__thumbnails'); thumbs.setAttribute('role', 'group'); thumbs.setAttribute('aria-label', 'Snímky projektu');
    header.append(node('span', 'project-gallery__eyebrow', 'Realizovaný custom projekt'), heading, vehicle, close);
    controls.append(prev, caption, next); dialog.append(header, frame, mediaType, controls, thumbs);
    dialog.setAttribute('aria-labelledby', heading.id); document.body.append(dialog);
    let selected = null, position = 0, opener = null, imageRequest = 0, locked = false, previousOverflow = null;
    const restoreScroll = () => {
      if (!locked) return;
      const [value, priority] = previousOverflow;
      if (value) document.body.style.setProperty('overflow', value, priority);
      else document.body.style.removeProperty('overflow');
      locked = false;
    };
    const restoreFocus = () => { restoreScroll(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
    const closeGallery = () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else { dialog.removeAttribute('open'); restoreFocus(); }
    };
    const show = index => {
      if (!selected) return;
      position = (index + selected.images.length) % selected.images.length;
      const image = selected.images[position], request = ++imageRequest;
      const photo = node('img', 'project-lightbox__image'); photo.loading = 'eager'; photo.hidden = true;
      const status = node('p', 'project-lightbox__status', 'Načítám snímek…'); status.setAttribute('role', 'status');
      const loaded = () => { if (request === imageRequest) { status.hidden = true; photo.hidden = false; } };
      photo.addEventListener('load', loaded, { once: true });
      photo.addEventListener('error', () => {
        if (request !== imageRequest) return;
        photo.hidden = true; status.hidden = false;
        status.textContent = 'Snímek není momentálně dostupný. Můžeš přejít na další pohled.';
      }, { once: true });
      frame.replaceChildren(photo, status); setImage(photo, image);
      if (photo.complete && photo.naturalWidth > 0) loaded();
      mediaType.textContent = kinds[image.kind].label; mediaType.dataset.kind = image.kind;
      caption.textContent = `${position + 1} / ${selected.images.length} · ${image.caption || image.title || image.alt}`;
      prev.disabled = next.disabled = selected.images.length < 2;
      [...thumbs.children].forEach((button, index) => button.setAttribute('aria-pressed', String(index === position)));
      const activeThumb = thumbs.children[position];
      if (activeThumb) thumbs.scrollLeft = Math.max(0, activeThumb.offsetLeft - (thumbs.clientWidth - activeThumb.clientWidth) / 2);
    };
    const openGallery = (project, trigger) => {
      selected = project; opener = trigger; position = 0;
      heading.textContent = project.title; vehicle.textContent = project.vehicle; thumbs.replaceChildren();
      const counts = { photo: 0, technical: 0, visualization: 0 };
      project.images.forEach((image, index) => {
        const button = node('button', 'project-gallery__thumbnail'); button.type = 'button';
        const label = kinds[image.kind].short + ' ' + (++counts[image.kind]);
        button.setAttribute('aria-label', 'Zobrazit: ' + (image.title || label));
        const thumb = node('img'); thumb.loading = 'lazy'; setImage(thumb, image, true);
        thumb.addEventListener('error', () => { thumb.hidden = true; }, { once: true }); button.append(thumb, node('span', '', label));
        button.addEventListener('click', () => show(index)); thumbs.append(button);
      });
      show(0);
      if (!locked) {
        previousOverflow = [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')];
        document.body.style.setProperty('overflow', 'hidden'); locked = true;
      }
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      }
      close.focus({ preventScroll: true });
    };
    on(close, 'click', closeGallery); on(prev, 'click', () => show(position - 1)); on(next, 'click', () => show(position + 1));
    on(dialog, 'close', restoreFocus); on(dialog, 'cancel', event => { event.preventDefault(); closeGallery(); });
    on(dialog, 'click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeGallery();
    });
    on(dialog, 'keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeGallery(); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(position + (event.key === 'ArrowLeft' ? -1 : 1)); }
      else if (event.key === 'Tab') {
        const buttons = [...dialog.querySelectorAll('button:not([disabled])')], first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    let swipe = null;
    const touchPointers = new Set();
    on(frame, 'pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      touchPointers.add(event.pointerId);
      swipe = event.isPrimary && touchPointers.size === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp } : null;
    });
    on(frame, 'pointercancel', event => { touchPointers.delete(event.pointerId); swipe = null; });
    on(frame, 'pointerup', event => {
      touchPointers.delete(event.pointerId); if (!swipe || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y, elapsed = event.timeStamp - swipe.time; swipe = null;
      if (elapsed < 1000 && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) show(position + (dx < 0 ? 1 : -1));
    });
    projects.forEach(project => {
      const card = node('article', 'project-card custom-project-card'), visual = node('div', 'project-card__visual');
      const button = node('button', 'project-card__photo'); button.type = 'button';
      button.setAttribute('aria-label', `Prohlédnout projekt: ${project.vehicle} — ${project.title}`);
      const cover = project.images[0], image = node('img'); image.loading = 'lazy'; setImage(image, cover);
      if (cover.width && cover.height) button.style.aspectRatio = cover.width + ' / ' + cover.height;
      on(image, 'error', () => { image.hidden = true; button.append(node('span', 'project-card__unavailable', 'Snímek není momentálně dostupný')); }, { once: true });
      button.append(image, node('span', 'project-card__count', imageCount(project.images.length) + ' ↗'));
      on(button, 'click', () => openGallery(project, button));
      visual.append(button, node('p', 'project-card__media-label', kinds[cover.kind].label));
      const copy = node('div', 'project-card__copy');
      copy.append(node('span', 'project-card__eyebrow', 'Realizovaný custom projekt'), node('p', 'project-card__vehicle', project.vehicle), node('h3', '', project.title));
      if (text(project.description)) copy.append(node('p', 'project-card__description', text(project.description)));
      if (project.specs.length) {
        const specs = node('dl', 'project-card__specs'); specs.setAttribute('aria-label', 'Parametry realizovaných kol');
        project.specs.forEach(spec => { const row = node('div', 'project-card__spec'); row.append(node('dt', '', spec.label), node('dd', '', spec.value)); specs.append(row); }); copy.append(specs);
      } else if ([text(project.wheel), text(project.finish)].some(Boolean)) {
        copy.append(node('p', 'project-card__details', [text(project.wheel), text(project.finish)].filter(Boolean).join(' / ')));
      }
      const action = node('button', 'project-card__open', 'Prohlédnout celý projekt ↗'); action.type = 'button';
      on(action, 'click', () => openGallery(project, action)); copy.append(action); card.append(visual, copy); grid.append(card);
    });
    cleanup = () => {
      imageRequest++; restoreScroll();
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      listeners.abort(); dialog.remove();
    };
  }
  window.NFWProjects = { refresh: render, dispose: () => cleanup() };
  render();
})();
