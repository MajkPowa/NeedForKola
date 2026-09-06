/* Set the confirmed Oarts profile here once the owner supplies its exact URL. */
(function () {
  'use strict';
  const instagramUrl = '';
  if (!/^https:\/\/(?:www\.)?instagram\.com\/[a-z\d_.]+\/?$/i.test(instagramUrl)) return;
  const link = () => {
    const a = document.createElement('a');
    a.className = 'oarts-social'; a.href = instagramUrl;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'Oarts na Instagramu (nové okno)');
    const icon = document.createElement('span'); icon.className = 'instagram-mark'; icon.setAttribute('aria-hidden', 'true');
    a.append(icon, document.createTextNode('Instagram'));
    return a;
  };
  document.querySelectorAll('.footer nav, [data-oarts-social]').forEach(container => container.append(link()));
})();
