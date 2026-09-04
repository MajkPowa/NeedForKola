# Need For Wheels

Statický web a konfigurátor kol bez build kroku. Fotorealistické rastrové podklady nahrazují původní SVG ilustrace. Interaktivní náhled používá skutečnou 3D geometrii a lokální Three.js r180.

## Spuštění

Z kořene projektu:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Otevřít http://127.0.0.1:8765/. Kvůli ES modulům a GLB modelu je nutné HTTP; samotné dvojkliknutí na HTML nestačí. Běhové knihovny a média jsou v projektu, bez závislosti na CDN. Fonty Google mají systémové náhrady.

## Co obsahuje

- Značka **Need For Wheels** na všech třech stránkách, studiový vzhled, zaoblené karty/tlačítka a responzivní rozložení.
- Loga všech 53 automobilek v přístupném vyhledávacím dialogu katalogu i konfigurátoru; lokální PNG, zdroje v `docs/brand-logos.md`.
- Tříscénový úvodní carousel, posuvná kolekce 13 kol, návazné odkazy mezi sekcemi a CTA do konfigurátoru. Automatika se pozastaví při hoveru/fokusu, mimo obrazovku a při omezeném pohybu; má ruční ovládání i pauzu.
- 13 návrhových designů: otáčení, přiblížení, skutečný límec, konkáv, paprsky, střed a šrouby. Barvy, povrchy, krytky a šířka mění 3D geometrii či materiály.
- Statické WebP miniatury vyrenderované z téže 3D geometrie, bez mnoha současných WebGL kontextů.
- Úplný uživatelský seznam: **53 značek, 401 modelů**. Prohledávatelný katalog provedení, karoserií a ročníků do 2026, s odlišením katalogových a výrobcem doložených údajů. Každá z 401 rodin má doložené provedení.
- Lokální fotografie modelových řad v katalogu i režimu „Můj vůz“, s autorem, zdrojem a licencí. Samostatné explicitní mapování fotografií vybraných generací BMW X5 a Škody Octavia rozlišuje také fázi a karoserii.
- BMW X5 E70 (2008) a G05 (2020): dvě odlišné ilustrační rastrové vizualizace. Jde o pevné rendery, barvy ani kola se v těchto dvou obrázcích dynamicky nemění.
- Samostatný 3D showroom **Ferrari 458 Italia**, skutečný model s výměnou disků a barvy karoserie. Ukázkový vůz se nevydává za vozidlo vybrané v poptávce. Rozměry montáže jsou pouze ilustrační.
- Originální fotografie, 2 videa a kompletní PDF katalog dodané uživatelem.
- Zachované rozměry, doplňky, orientační cenový výpočet, souhrn, tisk, e-mailová poptávka a sdílení konfigurace.

## Skutečný rozsah vizualizací

**Fotografie modelové řady není přesným 3D modelem ani dokladem vybrané generace.** Režim „Můj vůz“ přednostně ukazuje výslovně přiřazený podklad pro generaci, fázi a karoserii; jinak zobrazuje označenou referenci modelové řady. Barva a kola na fotografii zůstávají pevné. Vybraný rok a provedení jsou nezávisle uložené v souhrnu. Přechodové roky stále vyžadují upřesnění provedení. Databáze obsahuje 2 736 zdrojovaných provedení včetně doplnění z materiálů výrobců. Úplnost všech historických generací, faceliftů a karoserií zatím není ověřena; neurčené karoserie a otevřená období jsou označena. Zdroj fotografie a její licence jsou oddělené od licence databáze a 3D geometrie; podrobnosti v `docs/vehicle-visuals.md`.

Katalog OARTS obsahuje také litá a flow-forming kola. Webové návrhové designy nejsou vydávány za všechny položky katalogu. FORGED 10 je vizuální interpretace dodané předlohy, nikoli výrobní CAD. Kompatibilita, nosnost, hmotnost a cena se ověřují v technickém výkresu a závazné nabídce. Výchozí rozměry představují zadání k ověření, nikoli homologovaný fitment.

## Soubory

- `index.html`, `konfigurator.html`, `proces.html`: veřejné stránky.
- `css/premium.css`: nový design, mobilní rozložení a 3D scéna.
- `js/vehicles.js`: neměnný registr a průniky roku, provedení a karoserie.
- `js/vehicle-data.js`, `data/vehicle-variants.json`: generovaná databáze pod ODbL 1.0; zdroje a doplnění v `data/`.
- `js/landing.js`, `css/luxury.css`: úvodní carousel, posuvná kolekce, průběh čtení, navazující CTA a zaoblené povrchy.
- `js/brand-picker.js`, `js/brand-logos.js`, `css/brand-picker.css`: lokální loga a přístupný výběr značek.
- `js/catalog-browser.js`, `css/catalog.css`: vyhledávání, filtry, stránkování a konkrétní provedení na úvodní stránce.
- `js/vehicle-visuals.js`, `css/vehicle-visuals.css`: fotografie, rozlišení modelové reference a konkrétního provedení, citace a načítání podkladů.
- `data/vehicle-visuals.json`, `data/vehicle-visual-variants.json`: mapování fotografií s původem a jednotlivými licencemi; lokální média v `assets/vehicles/`.
- `tools/build-vehicle-visuals.py`, `tools/build-vehicle-visual-variants.py`: obnova fotografií z explicitních Wikimedia identit a kontrola licencí.
- `tools/build-vehicle-data.py`: reprodukovatelný import a audit pokrytí.
- `js/showroom.js`: geometrie, materiály, glTF loader, orbit ovládání a správa WebGL.
- `js/wheels.js`: návrhové designy, barevné kombinace, povrchy a příplatky.
- `js/configurator.js`: stav, validace, URL, poptávka, souhrn a 3D integrace.
- `assets/`: místní média, model, miniatury a knihovny včetně licenčních souborů.
- `docs/vehicle-catalog.md`, `docs/media-sources.md`: zdroje a omezení podkladů.
- `docs/image-prompts.md`: přesné prompty a výstupy vestavěného ImageGen.
- `docs/3d-assets.md`: 3D API, provenience a licence.

## Kontrola

```powershell
python tools/check_vehicle_bodies.py
node tools/check-catalog.cjs
node tools/check-catalog-browser.cjs
node tools/check-brand-picker.cjs
node tools/check-landing.cjs
node tools/check-vehicle-selection.cjs
node tools/check-vehicle-visuals.cjs
node --check js/configurator.js
```

Pro integrační test je potřeba Playwright a Chrome; proměnná `PLAYWRIGHT_MODULE` může ukazovat na sdílený balíček. Test používá lokální server na portu 8765 (`NFW_BASE_URL` ho může změnit). Snímky se ukládají do `docs/qa/`.

## Publikace a kontakty

GitHub Pages publikuje hlavní větev `main` z kořene projektu. Veřejná adresa je `https://majkpowa.github.io/NeedForKola/`; používá se také v canonical a jako nouzová adresa sdílení; obchodní název webu je Need For Wheels. Změna adresy vyžaduje samostatnou konfiguraci hostingu/repozitáře.

Kontakt `info@oarts.cz` a původní telefon jsou zachovány v `js/main.js`; před veřejným spuštěním ověřte jejich platnost a ceny. E-mailové formuláře pouze připraví zprávu v e-mailovém klientu, nepoužívají backend. Kontaktní jméno/e-mail/telefon se do sdílené URL neukládají; modelové a fitment poznámky ano.

**Licence modelu Ferrari:** autor a zdroj jsou zachovány, původní modelová licence nebyla ověřitelná (původní odkaz je nedostupný). Před komerční publikací je nutné licenci potvrdit nebo model nahradit licencovaným podkladem. Licence MIT knihovny Three.js sama o sobě není potvrzením licence cizího modelu. Podrobnosti v `docs/3d-assets.md`.
