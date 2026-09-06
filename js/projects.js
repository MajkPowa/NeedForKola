/* Real customer projects are added to editorial-data.js. No demo commissions. */
(function () {
  'use strict';
  const grid = document.querySelector('[data-projects-grid]');
  if (!grid) return;
  const validImage = image => image && typeof image.src === 'string' && /^assets\/projects\/[a-z\d_/-]+\.(?:jpe?g|png|webp|avif)$/i.test(image.src) && !image.src.includes('..') && typeof image.alt === 'string' && image.alt.trim();
  const source = Array.isArray(window.NFWEditorial?.projects) ? window.NFWEditorial.projects : [];
  const projects = source.filter(project => project && typeof project.title === 'string' && project.title.trim() && typeof project.vehicle === 'string' && project.vehicle.trim() && Array.isArray(project.images)).map(project => ({...project, images:project.images.filter(validImage)})).filter(project => project.images.length);
  const empty = document.querySelector('[data-projects-empty]');
  if (!projects.length) { grid.hidden = true; return; }
  if (empty) empty.hidden = true;
  grid.hidden = false;
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const dialog = node('dialog', 'project-lightbox');
  dialog.setAttribute('aria-label', 'Fotografie realizace');
  const close = node('button', 'project-lightbox__close', '×');
  close.type = 'button'; close.setAttribute('aria-label', 'Zavřít fotografie');
  const photo = node('img', 'project-lightbox__image');
  const photoStatus = node('p', 'project-lightbox__status');
  photoStatus.setAttribute('role', 'status');
  photo.addEventListener('load', () => { photoStatus.hidden = true; photo.hidden = false; });
  photo.addEventListener('error', () => { photo.hidden = true; photoStatus.hidden = false; photoStatus.textContent = 'Fotografie není momentálně dostupná. Můžeš přejít na další snímek.'; });
  const caption = node('p', 'project-lightbox__caption');
  caption.setAttribute('aria-live', 'polite');
  const controls = node('div', 'project-lightbox__controls');
  const prev = node('button', 'round-control', '←'), next = node('button', 'round-control', '→');
  prev.type = next.type = 'button';
  prev.setAttribute('aria-label', 'Předchozí fotografie'); next.setAttribute('aria-label', 'Další fotografie');
  controls.append(prev, caption, next); dialog.append(close, photo, photoStatus, controls); document.body.append(dialog);
  let selected, position = 0;
  const show = offset => {
    position = (position + offset + selected.images.length) % selected.images.length;
    const image = selected.images[position];
    photoStatus.hidden = false; photoStatus.textContent = 'Načítám fotografii…'; photo.hidden = false;
    photo.src = image.src; photo.alt = image.alt;
    if (photo.complete && photo.naturalWidth > 0) photoStatus.hidden = true;
    caption.textContent = `${selected.vehicle} · ${position + 1} / ${selected.images.length} — ${image.alt}`;
    prev.disabled = next.disabled = selected.images.length < 2;
  };
  close.addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => show(-1)); next.addEventListener('click', () => show(1));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); show(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  projects.forEach(project => {
    const card = node('article', 'project-card');
    const button = node('button', 'project-card__photo'); button.type = 'button';
    button.setAttribute('aria-label', `Prohlédnout realizaci: ${project.vehicle} — ${project.title}`);
    const image = node('img'); image.src = project.images[0].src; image.alt = project.images[0].alt; image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; button.append(node('span', 'project-card__unavailable', 'Fotografie není momentálně dostupná')); }, {once:true});
    const count = node('span', 'project-card__count', `${project.images.length} foto ↗`);
    button.append(image, count);
    button.addEventListener('click', () => { selected = project; position = 0; show(0); dialog.showModal(); });
    const copy = node('div', 'project-card__copy');
    copy.append(node('span', 'eyebrow', project.vehicle), node('h3', '', project.title));
    if (project.description) copy.append(node('p', '', project.description));
    copy.append(node('small', '', [project.wheel, project.finish].filter(Boolean).join(' / ')));
    card.append(button, copy); grid.append(card);
  });
})();
