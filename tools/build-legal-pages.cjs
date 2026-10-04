"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const legal = JSON.parse(
  fs.readFileSync(path.join(root, "data/legal/pages.json"), "utf8"),
);
const routes = {
  "obchodni-podminky": "obchodni-podminky.html",
  "reklamacni-rad": "reklamace.html",
  odstoupeni: "odstoupeni.html",
  soukromi: "ochrana-osobnich-udaju.html",
  cookies: "cookies.html",
};
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const nav = legal.pages
  .map((p) => `<a href="${routes[p.id]}">${esc(p.title)}</a>`)
  .join("");
function form(kind) {
  const withdrawal = kind === "withdrawal",
    contact = kind === "contact";
  const id = contact
    ? "kontaktni-formular"
    : withdrawal
      ? "formular-odstoupeni"
      : "formular-reklamace";
  const title = contact
    ? "Napiš nám, s čím ti pomůžeme."
    : withdrawal
      ? "Oznámení o odstoupení"
      : "Uplatnění reklamace";
  return `<section class="legal-form" id="${id}"><h2>${title}</h2><p>${contact ? "Ozveme se s konkrétní odpovědí. Odesláním nevzniká objednávka." : "Po odeslání se zobrazí referenční číslo a možnost uložit kopii podání. Formulář není jediný způsob uplatnění tvých práv; můžeš nám také napsat na adresu sídla."}</p><form data-service-form="${kind}" method="post"><div class="field-pair"><label>Jméno a příjmení *<input name="name" required maxlength="100" autocomplete="name"></label><label>E-mail pro odpověď *<input name="email" type="email" required maxlength="254" autocomplete="email"></label></div><div class="field-pair"><label>Telefon<input name="phone" type="tel" maxlength="30" autocomplete="tel"></label><label>${contact ? "Vůz a rok výroby" : "Číslo objednávky (pokud je znáš)"}<input name="${contact ? "vehicle" : "orderReference"}" maxlength="120"></label></div><label>${contact ? "S čím ti pomůžeme?" : withdrawal ? "Zboží, datum objednávky/převzetí a oznámení o odstoupení" : "Zboží, popis vady a požadovaný způsob vyřízení"} *<textarea name="message" required maxlength="5000" rows="6"></textarea></label><label class="trap" aria-hidden="true">Web<input name="website" tabindex="-1" autocomplete="off"></label><p class="form-note">Údaje použijeme k vyřízení tvého požadavku. <a href="ochrana-osobnich-udaju.html">Informace o zpracování údajů</a>. K podání není potřeba souhlas s reklamními sděleními.</p><button type="submit" disabled>${contact ? "Odeslat nezávazný dotaz" : withdrawal ? "Odeslat odstoupení" : "Odeslat reklamaci"} →</button><p data-status role="status" aria-live="polite" tabindex="-1"></p></form></section>`;
}
function shell(title, description, file, body) {
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#090c10"><title>${esc(title)} · Need For Wheels</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="https://oarts.cz/${file}"><link rel="icon" href="assets/renders/silver/apex10.webp"><link rel="stylesheet" href="css/fonts.css?v=20261004"><link rel="stylesheet" href="css/legal.css?v=20261004"></head><body><a class="skip" href="#obsah">Přejít k obsahu</a><header class="legal-header"><a class="brand" href="index.html" aria-label="Need For Wheels by Oarts, úvod"><img src="assets/brand/oarts-logo.png" alt="Oarts" width="140" height="48"><span>NEED FOR WHEELS</span></a><a class="phone" href="tel:+420723958421">+420 723 958 421</a></header><main id="obsah"><a class="back" href="index.html">← Zpět na web</a>${body}</main><footer><strong>Need For Wheels by Oarts s.r.o.</strong><p>IČO 30074088 · Příčná 1892/4, Nové Město, 110 00 Praha 1<br>Městský soud v Praze, oddíl C, vložka 456867</p><nav aria-label="Právní a kontaktní informace">${nav}<a href="kontakt.html">Kontakt</a></nav><div class="socials"><a href="https://www.instagram.com/nfw.oarts/" rel="noopener noreferrer" target="_blank">Instagram ↗</a><a href="https://www.tiktok.com/@nfw.oarts" rel="noopener noreferrer" target="_blank">TikTok ↗</a></div></footer><script src="js/site-config.js?v=20261004"></script><script src="js/legal-forms.js?v=20261004" defer></script></body></html>`;
}
for (const p of legal.pages) {
  const content = p.sections
    .map(
      (s, i) =>
        `<section id="cast-${i + 1}"><h2>${esc(s.title)}</h2>${s.html}</section>`,
    )
    .join("\n");
  const toc = p.sections
    .map((s, i) => `<a href="#cast-${i + 1}">${esc(s.title)}</a>`)
    .join("");
  const extra =
    p.id === "odstoupeni"
      ? form("withdrawal")
      : p.id === "reklamacni-rad"
        ? form("complaint")
        : "";
  const body = `<div class="intro"><p class="eyebrow">Oarts / Informace pro zákazníky</p><h1>${esc(p.title)}</h1><p class="lead">${esc(p.lead)}</p><p class="version">Znění ze dne 4. 10. 2026</p><button class="print" type="button" data-print>Uložit / vytisknout dokument</button></div><div class="legal-layout"><nav class="contents" aria-label="Obsah dokumentu">${toc}${extra ? `<a href="#${p.id === "odstoupeni" ? "formular-odstoupeni" : "formular-reklamace"}">Online formulář ↓</a>` : ""}</nav><article>${content}${extra}</article></div>`;
  fs.writeFileSync(
    path.join(root, routes[p.id]),
    shell(p.title, p.lead, routes[p.id], body),
  );
}
const contact = `<div class="intro"><p class="eyebrow">Oarts / Osobně pro tvoje auto</p><h1>Pojďme vybrat tvoje kola.</h1><p class="lead">Konfigurátor nemusíš řešit sám. Zavolej nám nebo napiš — společně projdeme design, rozměry i vhodnost pro tvůj vůz.</p></div><div class="contact-grid"><section><h2>Konzultace</h2><a class="large-phone" href="tel:+420723958421">+420 723 958 421</a><p>Nemůžeš volat? Použij formulář níže.</p></section><section><h2>Sklad v Ostravě</h2><p>Předvrší 846<br>725 26 Ostrava – Krásné Pole</p><p>Návštěvu skladu a osobní odběr si prosím domluv předem.</p></section><section><h2>Provozovatel</h2><p>Need For Wheels by Oarts s.r.o.<br>IČO 30074088<br>Příčná 1892/4, Nové Město<br>110 00 Praha 1</p><p>Městský soud v Praze, oddíl C, vložka 456867. Sídlo je odlišné od skladu.</p></section></div>${form("contact")}<noscript><p>Formulář vyžaduje JavaScript. Zavolej na +420 723 958 421 nebo napiš na adresu sídla uvedenou výše.</p></noscript>`;
fs.writeFileSync(
  path.join(root, "kontakt.html"),
  shell(
    "Kontakt",
    "Osobní konzultace výběru kol, sklad v Ostravě a kontakty Need For Wheels by Oarts.",
    "kontakt.html",
    contact,
  ),
);
fs.writeFileSync(
  path.join(root, "pravni.html"),
  shell(
    "Právní informace",
    "Obchodní podmínky, reklamace, odstoupení a ochrana údajů.",
    "pravni.html",
    `<div class="intro"><h1>Informace pro zákazníky</h1><nav class="contents">${nav}</nav></div>`,
  ).replace(
    "defer></script>",
    'defer></script><script src="js/legal-redirect.js?v=20261004" defer></script>',
  ),
);
console.log(
  "Built 5 legal documents, contact page and legacy legal-link router.",
);
