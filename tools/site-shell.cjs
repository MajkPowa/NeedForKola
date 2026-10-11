'use strict';

// One public shell is used by source pages, generators, and the deployment build.
const path = require('node:path');
const VERSION = '20261011-apple-v1';
const PAGES = Object.freeze({
  'index.html': 'home', 'hotova-kola.html': 'ready', 'cenik.html': 'pricing',
  'elektroauta.html': 'electric', 'konfigurator.html': 'configurator',
  '3d-kolo.html': 'studio', 'blog.html': 'blog', 'clanek.html': 'article',
  'o-nas.html': 'about', 'proces.html': 'process', 'objednavka.html': 'enquiry',
  'nabidka.html': 'offer', 'kontakt.html': 'contact',
  'obchodni-podminky.html': 'legal', 'reklamace.html': 'legal',
  'odstoupeni.html': 'legal', 'ochrana-osobnich-udaju.html': 'legal',
  'cookies.html': 'legal', 'pravni.html': 'legal'
});
const PRIMARY = Object.freeze([
  ['Úvod', 'index.html'], ['Auta', 'index.html#vehicleCatalogue'],
  ['Designy', 'index.html#designy'], ['Hotová kola', 'hotova-kola.html'],
  ['Realizace', 'index.html#realizace'], ['3D studio', '3d-kolo.html']
]);
const SECONDARY = Object.freeze([
  ['Elektroauta', 'elektroauta.html'], ['Ceník', 'cenik.html'],
  ['Proces', 'proces.html'], ['O nás', 'o-nas.html'],
  ['Blog', 'blog.html'], ['Kontakt', 'kontakt.html']
]);
const LEGAL = Object.freeze([
  ['Obchodní podmínky', 'obchodni-podminky.html'], ['Reklamace', 'reklamace.html'],
  ['Odstoupení od smlouvy', 'odstoupeni.html'],
  ['Ochrana osobních údajů', 'ochrana-osobnich-udaju.html'], ['Cookies', 'cookies.html']
]);
function hrefFor(href, options = {}) {
  const external = options.externalRoutes || [];
  const route = href.split(/[?#]/)[0];
  return (external instanceof Set ? external.has(route) : external.includes(route)) ? new URL(href, options.canonicalBase || 'https://oarts.cz/').href : href;
}
function link([label, href], filename, className = '', options = {}) {
  const selected = href === filename || (filename === 'clanek.html' && href === 'blog.html');
  return `<a href="${hrefFor(href, options)}"${className ? ` class="${className}"` : ''}${selected ? ' aria-current="page"' : ''}>${label}</a>`;
}
function header(filename, options = {}) {
  const moreCurrent = SECONDARY.some(([, href]) => href === filename || (filename === 'clanek.html' && href === 'blog.html'));
  return `<header class="site-header nav" data-site-shell="${VERSION}">
  <div class="site-header__inner wrap">
    <a class="site-brand" href="index.html" aria-label="OARTS · úvod"><img src="${options.logo || 'assets/brand/oarts-logo-256.webp'}" alt="OARTS" width="145" height="50" decoding="async"><span class="site-brand__caption">Kovaná kola</span></a>
    <nav class="site-nav nav__links" id="navLinks" aria-label="Hlavní navigace">
      <div class="site-nav__primary">${PRIMARY.map(item => link(item, filename, '', options)).join('')}</div>
      <details class="site-nav-more${moreCurrent ? ' is-current' : ''}"><summary>Další <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></summary><div class="site-nav-more__links">${SECONDARY.map(item => link(item, filename, '', options)).join('')}</div></details>
      <div class="site-mobile-nav">${[...PRIMARY, ...SECONDARY].map(item => link(item, filename, '', options)).join('')}</div>
    </nav>
    <div class="site-header__actions">${link(['Konfigurátor', 'konfigurator.html'], filename, 'site-nav-cta btn btn--primary btn--sm', options)}<button class="burger site-menu-toggle" type="button" aria-label="Otevřít menu" aria-expanded="false" aria-controls="navLinks"><span></span><span></span><span></span></button></div>
  </div>
</header>`;
}
function footer(filename, options = {}) {
  const compact = ['konfigurator.html', '3d-kolo.html'].includes(filename);
  return `<footer class="site-footer footer${compact ? ' site-footer--compact site-footercompact' : ''}" data-site-shell="${VERSION}">
  <div class="wrap">
    <div class="site-footer__grid">
      <div class="site-footer__brand"><a class="site-brand" href="index.html" aria-label="OARTS · úvod"><img src="${options.logo || 'assets/brand/oarts-logo-256.webp'}" alt="OARTS" width="145" height="50" loading="lazy" decoding="async"><span class="site-brand__caption">Kovaná kola</span></a><p>Kola s vlastním podpisem.</p><a class="site-footer__phone" data-phone-action href="tel:+420723958421">+420 723 958 421</a></div>
      <nav class="site-footer__group" aria-label="Kola a projekty"><p>Kola a projekty</p>${[['Konfigurátor', 'konfigurator.html'], ...PRIMARY.slice(1)].map(item => link(item, filename, '', options)).join('')}</nav>
      <nav class="site-footer__group" aria-label="OARTS a služby"><p>OARTS a služby</p>${SECONDARY.map(item => link(item, filename, '', options)).join('')}</nav>
      <div class="site-footer__group"><p>Jsme ve spojení</p><a data-social="instagram" href="https://www.instagram.com/nfw.oarts/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a data-social="tiktok" href="https://www.tiktok.com/@nfw.oarts" target="_blank" rel="noopener noreferrer">TikTok ↗</a><p class="site-footer__address">Sklad: <span data-warehouse>Předvrší 846, Ostrava – Krásné Pole, 725 26</span><br>Návštěva po domluvě.</p></div>
    </div>
    <div class="site-footer__bottom"><p>© <span data-year>2026</span> <span data-company-name>Need For Wheels by Oarts s.r.o.</span> · IČO <span data-company-ico>30074088</span></p><nav class="site-footer__legal commerce-legal" aria-label="Právní informace">${LEGAL.map(item => link(item, filename, '', options)).join('')}</nav><p class="site-footer__registered">Sídlo: Příčná 1892/4, Nové Město, 110 00 Praha 1 · Městský soud v Praze, oddíl C, vložka 456867</p></div>
  </div>
</footer>`;
}
function transformHTML(source, inputFilename, options = {}) {
  const filename = path.basename(inputFilename);
  if (!Object.hasOwn(PAGES, filename)) return source;
  let html = source;
  // Platform typography needs no font download on the critical rendering path.
  html = html.replace(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']font["'])[^>]*>\s*/gi, '');
  if (!/<header\b[^>]*>[\s\S]*?<\/header>/i.test(html)) throw new Error(`Missing page header: ${filename}`);
  html = html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i, header(filename, options));
  if (/<footer\b[^>]*>[\s\S]*?<\/footer>/i.test(html)) {
    html = html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i, footer(filename, options));
  } else {
    const lastMain = html.toLowerCase().lastIndexOf('</main>');
    if (lastMain < 0) throw new Error(`Missing main/footer insertion point: ${filename}`);
    html = html.slice(0, lastMain + 7) + '\n' + footer(filename, options) + html.slice(lastMain + 7);
  }
  if (!/<main\b/i.test(html)) {
    // The process page originally used loose sections; give it one landmark.
    const headerEnd = html.toLowerCase().indexOf('</header>') + 9;
    const footerStart = html.toLowerCase().indexOf('<footer');
    html = html.slice(0, headerEnd) + '\n<main id="siteMain">' + html.slice(headerEnd, footerStart) + '</main>\n' + html.slice(footerStart);
  }
  html = html.replace(/<main\b([^>]*)>/i, (tag, attributes) => /\bid\s*=/.test(attributes) ? tag : `<main id="siteMain"${attributes}>`);
  const mainId = html.match(/<main\b[^>]*\bid=["']([^"']+)["']/i)?.[1] || 'siteMain';
  html = html.replace(/<a\b[^>]*class=["'][^"']*\bsite-skip\b[^"']*["'][^>]*>[\s\S]*?<\/a>\s*/gi, '');
  html = html.replace(/(<body\b[^>]*>)\s*/i, `$1\n<a class="site-skip" href="#${mainId}">Přejít k obsahu</a>\n`);
  html = html.replace(/<body\b([^>]*)>/i, (tag, attributes) => {
    const existing = attributes.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
    const classes = [...new Set([...existing.split(/\s+/).filter(Boolean).filter(name => name !== 'site-page' && !/^page-(home|ready|pricing|electric|configurator|studio|blog|article|about|process|enquiry|offer|contact|legal)$/.test(name)), 'site-page', `page-${PAGES[filename]}`])];
    const rest = attributes.replace(/\s*\bclass\s*=\s*(["'])(.*?)\1/i, '');
    return `<body${rest} class="${classes.join(' ')}">`;
  });
  html = html.replace(/<link\b[^>]*href=["']css\/apple-(?:design|pages)\.css(?:\?[^"']*)?["'][^>]*>\s*/gi, '');
  html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="css/apple-design.css?v=${VERSION}">\n<link rel="stylesheet" href="css/apple-pages.css?v=${VERSION}">\n</head>`);
  html = html.replace(/(<meta\b[^>]*name=["']theme-color["'][^>]*content=["'])[^"']+(["'][^>]*>)/i, '$1#f5f5f7$2');
  html = html.replace(/<script\b[^>]*src=["']js\/(?:navigation|site-motion|landing-motion)\.js(?:\?[^"']*)?["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
  html = html.replace(/<\/body>/i, `<script src="js/navigation.js?v=${VERSION}" defer></script>\n<script src="js/site-motion.js?v=${VERSION}" defer></script>\n</body>`);
  return html;
}
module.exports = {VERSION, hrefFor, PAGES, PRIMARY, SECONDARY, LEGAL, header, footer, transformHTML};
