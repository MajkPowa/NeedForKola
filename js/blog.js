/* Typed, text-only editorial renderer. No article field is interpreted as HTML. */
(function () {
  'use strict';
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const validSlug = value => typeof value === 'string' && value.length <= 90 && slugPattern.test(value);
  const text = value => typeof value === 'string' ? value : '';
  const imagePath = value => typeof value === 'string' && /^assets\/(?:blog|images|reference|renders)\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|jpe?g|png|avif)$/i.test(value) ? value : null;
  const externalURL = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  };
  const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = text(content);
    return node;
  };
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const seen = new Set();
  const articles = (Array.isArray(window.NFWEditorial?.articles) ? window.NFWEditorial.articles : []).filter(article => {
    if (!article || !validSlug(article.slug) || seen.has(article.slug) || !text(article.title) || !validDate(article.publishedAt) || !Array.isArray(article.body)) return false;
    seen.add(article.slug); return true;
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const articleURL = article => validSlug(article?.slug) ? 'clanek.html?slug=' + encodeURIComponent(article.slug) : 'blog.html';
  const dateLabel = value => new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
  const meta = article => {
    const row = element('div', 'editorial-meta');
    const date = element('time', '', dateLabel(article.publishedAt)); date.dateTime = article.publishedAt;
    row.append(date);
    if (Number.isInteger(article.readMinutes) && article.readMinutes > 0 && article.readMinutes < 120) row.append(element('span', '', article.readMinutes + ' min čtení'));
    return row;
  };
  function cover(article, className, eager = false) {
    const src = imagePath(article.cover?.src);
    if (!src) return null;
    const image = element('img', className);
    image.src = src; image.alt = text(article.cover.alt); image.loading = eager ? 'eager' : 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    return image;
  }
  function createCard(article) {
    const card = element('article', 'editorial-card');
    const link = element('a', 'editorial-card__link'); link.href = articleURL(article);
    const visual = element('div', 'editorial-card__visual');
    const image = cover(article, 'editorial-card__image'); if (image) visual.append(image);
    visual.append(element('span', 'editorial-category', text(article.category) || 'Z deníku'));
    const body = element('div', 'editorial-card__body');
    body.append(meta(article), element('h3', '', article.title), element('p', '', article.excerpt));
    const read = element('span', 'editorial-card__read', 'Přečíst článek'); const arrow = element('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); read.append(arrow); body.append(read);
    link.append(visual, body); card.append(link); return card;
  }
  function renderTeasers(container, options = {}) {
    if (!container || typeof container.replaceChildren !== 'function') return;
    const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(12, options.limit)) : 2;
    const chosen = articles.filter(article => article.slug !== options.exclude).slice(0, limit);
    container.classList.add('editorial-grid');
    container.replaceChildren(...chosen.map(createCard));
    if (!chosen.length) container.append(element('p', 'editorial-empty', 'Nové články právě připravujeme.'));
  }
  function renderIndex() {
    const grid = document.querySelector('[data-blog-grid]'); if (!grid) return;
    const filters = document.querySelector('[data-blog-filters]'), search = document.querySelector('[data-blog-search]'), count = document.querySelector('[data-blog-count]');
    let category = '';
    const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs');
    const update = () => {
      const query = normalize(search?.value).trim();
      const chosen = articles.filter(article => (!category || article.category === category) && normalize([article.title, article.excerpt, article.category].join(' ')).includes(query));
      grid.replaceChildren(...chosen.map(createCard));
      if (!chosen.length) grid.append(element('p', 'editorial-empty', 'Tady zatím žádný článek není. Zkus jiné téma nebo kratší hledání.'));
      if (count) count.textContent = chosen.length === 1 ? '1 článek' : chosen.length + (chosen.length > 1 && chosen.length < 5 ? ' články' : ' článků');
      filters?.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
    };
    if (filters) {
      filters.replaceChildren();
      for (const value of ['', ...new Set(articles.map(article => text(article.category)).filter(Boolean))]) {
        const button = element('button', 'editorial-filter', value || 'Všechna témata');
        button.type = 'button'; button.dataset.category = value;
        button.addEventListener('click', () => { category = value; update(); }); filters.append(button);
      }
    }
    search?.addEventListener('input', update); update();
  }
  function notFound(root) {
    document.title = 'Článek nebyl nalezen · Need For Wheels';
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,follow');
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://majkpowa.github.io/NeedForKola/blog.html');
    const box = element('section', 'editorial-not-found');
    box.append(element('span', 'eyebrow', 'Zpátky na správnou cestu'), element('h1', '', 'Tenhle článek tady není.'), element('p', '', 'Odkaz může být neúplný nebo se článek přesunul. Další čtení najdeš v našem deníku.'));
    const link = element('a', 'btn btn--primary'); link.href = 'blog.html'; link.append(element('span', '', 'Přejít na blog →')); box.append(link); root.replaceChildren(box);
  }
  function renderArticle() {
    const root = document.querySelector('[data-blog-article]'); if (!root) return;
    const params = new URLSearchParams(location.search), slug = params.get('slug');
    const article = params.getAll('slug').length === 1 && validSlug(slug) ? articles.find(item => item.slug === slug) : null;
    if (!article) { notFound(root); return; }
    document.title = article.title + ' · Need For Wheels';
    document.querySelector('meta[name="description"]')?.setAttribute('content', text(article.excerpt));
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index,follow');
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', new URL(articleURL(article), 'https://majkpowa.github.io/NeedForKola/').href);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', article.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', text(article.excerpt));
    const header = element('header', 'editorial-article__header');
    const back = element('a', 'editorial-back', '← Zpátky na blog'); back.href = 'blog.html';
    header.append(back, element('span', 'eyebrow', text(article.category)), element('h1', '', article.title), element('p', 'editorial-article__lead', article.excerpt), meta(article));
    const byline = element('span', 'editorial-byline', 'Need For Wheels · redakce'); header.append(byline);
    const figure = element('figure', 'editorial-article__cover'), image = cover(article, '', true);
    if (image) { figure.append(image); if (text(article.cover.caption)) figure.append(element('figcaption', '', article.cover.caption)); }
    const layout = element('div', 'editorial-article__layout'), content = element('div', 'editorial-article__content');
    const aside = element('aside', 'editorial-article__aside');
    const toc = element('nav', 'editorial-toc'); toc.setAttribute('aria-label', 'Obsah článku'); toc.append(element('span', 'eyebrow', 'V článku'));
    article.body.forEach((block, index) => {
      if (!block || typeof block !== 'object') return;
      if (block.type === 'heading' && text(block.text)) {
        const heading = element('h2', '', block.text); heading.id = 'cast-' + (index + 1); content.append(heading);
        const link = element('a', '', block.text); link.href = '#' + heading.id; toc.append(link);
      } else if (block.type === 'paragraph' && text(block.text)) content.append(element('p', '', block.text));
      else if (block.type === 'callout' && text(block.text)) content.append(element('aside', 'editorial-callout', block.text));
      else if (block.type === 'list' && Array.isArray(block.items)) {
        const list = element('ul'); block.items.filter(item => typeof item === 'string').forEach(item => list.append(element('li', '', item))); content.append(list);
      }
    });
    const sources = (Array.isArray(article.sources) ? article.sources : []).filter(source => source && text(source.label) && externalURL(source.url));
    if (sources.length) {
      const section = element('section', 'editorial-sources'); section.append(element('h2', '', 'Zdroje a další čtení'), element('p', '', 'Technické informace vycházejí z podkladů výrobců. Odkazy ověřeny při vydání článku.'));
      const list = element('ul'); sources.forEach(source => { const item = element('li'), link = element('a', '', source.label + ' ↗'); link.href = externalURL(source.url); link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); list.append(item); }); section.append(list); content.append(section);
    }
    const share = element('button', 'editorial-share', 'Zkopírovat odkaz ↗'); share.type = 'button';
    const status = element('p', 'editorial-share-status'); status.setAttribute('role', 'status');
    share.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(new URL(articleURL(article), location.href).href); status.textContent = 'Odkaz je zkopírovaný.'; }
      catch { status.textContent = 'Odkaz najdeš v adresním řádku prohlížeče. Odtud ho můžeš zkopírovat.'; }
    });
    aside.append(toc, share, status); layout.append(aside, content); root.replaceChildren(header); if (image) root.append(figure); root.append(layout);
    const related = document.querySelector('[data-blog-related]'); if (related) renderTeasers(related, { limit: 2, exclude: slug });
    document.querySelector('[data-related-section]')?.removeAttribute('hidden');
  }
  window.NFWBlog = Object.freeze({ articleURL, createCard, renderTeasers, articles: Object.freeze(articles) });
  renderIndex(); renderArticle();
  document.querySelectorAll('[data-blog-teasers]').forEach(container => renderTeasers(container, { limit: Number(container.dataset.blogLimit) || 2 }));
  if (document.body.classList.contains('editorial-page')) {
    const nav = document.querySelector('.nav'), burger = document.querySelector('.burger');
    const close = () => { nav?.classList.remove('open'); burger?.setAttribute('aria-expanded', 'false'); };
    burger?.addEventListener('click', () => { const open = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', String(open)); });
    document.querySelectorAll('.nav__links a').forEach(link => link.addEventListener('click', close));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    document.querySelectorAll('[data-year]').forEach(node => { node.textContent = String(new Date().getFullYear()); });
  }
  window.dispatchEvent(new Event('nfw:editorial-ready'));
})();
