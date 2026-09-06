# Ověření Need For Wheels

Aktualizováno 6. 9. 2026. Ověření probíhá v Chrome přes lokální HTTP server; desktop 1440 × 1000, mobil 390 × 844 a kontrola fotografických náhledů také při šířce 768 px. WebGL testy používají softwarový renderer SwiftShader; výsledky nejsou měřením FPS na běžném zařízení.

## Přenos vyhledaného vozu do konfigurátoru

`node tools/check-catalog-handoff.cjs` ověřuje skutečné kliknutí na „Otevřít konfigurátor“ po zadání modelu, předvolbu značky/modelu/roku, obnovení katalogových filtrů z URL a mobilní rozložení. Jednoznačné provedení se přenáší; nevybraný rok ani nejednoznačná generace/karoserie se nedoplňují odhadem. Test zahrnuje přesný název Corolla vedle Corolla Cross, nulové a vícečetné výsledky, reset a kliknutí před dokončením debounce vyhledávání. Změna modelu uvnitř ukázkového showroomu přepne náhled na skutečně vybraný vůz. Výsledek: PASS, bez JavaScriptových chyb.

Nezávislá kontrola potvrdila přenos pro všech 22 obecných a designových CTA a zachování 5 explicitních odkazů na ukázkové vozy/výrobní příklad. `check-catalog-browser.cjs` po této změně také prošel.

## Rozsah dat a skutečného 360° zobrazení

| Oblast | Ověřený rozsah |
|---|---|
| Katalog | 53 značek, 401 modelových rodin, 2 736 variant generací, faceliftů a karoserií |
| Modelové fotografie | 401 rodin má vlastní fotografii a atribuci; dalších 27 mapování variant má přísné podmínky roku a karoserie |
| Výměna disků ve fotografii | 430 obrazových podkladů, 860 kalibrovaných pozic kol; jde o statické náhledy |
| Skutečné prostorové vozy | 2 GLB: BMW X5 G05 před faceliftem a Tesla Model 3 2018 |
| Výměnná kola ve 3D | 4 nezávislé kotvy na každém autě, celkem 8; původní disky odstraněny, pneumatiky a brzdy zachovány |
| Designy disků | 13 prostorových designů; změna designu, barvy, povrchu, límce a krytky |

BMW model se nabízí pouze pro G05 SUV 2018–2023 před faceliftem; v přechodovém roce musí uživatel vybrat správnou generaci. Tesla je omezena na doložený rok 2018 a původní provedení sedanu. Jiná generace, karoserie nebo rok nedostane zástupný 3D model. Úplný katalog tedy neznamená úplné pokrytí 3D geometrií. Podrobnosti, licence, rozměry a rozhraní popisuje [dokumentace 3D assetů](3d-assets.md).

## Ověřené chování

- BMW i Tesla se načtou jako skutečná geometrie. Změna pohledu zepředu dozadu mění vykreslenou karoserii; orbitální ovládání nemá vodorovný limit a test projde celou otáčku. Čtyři namontované disky zůstávají součástí vozu.
- U obou modelů jsou ověřeny změny designu a barvy disků přímo ve vykreslených pixelech, nezávislá změna laku, pohled na detail kola, fullscreen, mobilní zobrazení a respektování omezeného pohybu.
- BMW X5 E70 z roku 2008 používá správný fotografický podklad, G05 z roku 2020 skutečný 3D model. Neurčená generace v roce 2023 nevydává modelovou fotografii za přesný podklad. Samostatně označený ukázkový vůz zachovává vůz vybraný do poptávky.
- Všech 13 produktových miniatur a obrázky na homepage se načtou. Na stránkách nejsou SVG kresby aut ani kol. Spuštění prostorového kola nahradí produktovou fotografii.
- Pět kroků konfigurace, shodné/rozdílné šířky, doplňky, souhrn a sestavení mailto zprávy fungují. Test žádnou zprávu neodesílá.
- Konfigurace včetně modelových poznámek přežije obnovení URL. Osobní kontakt se do URL neukládá; duplicitní doplňky se nezapočítají dvakrát. Neplatné hodnoty, neznámé identity a HTML řetězce se odmítnou nebo omezí.
- Mobilní menu, výběr vozu a formulář nemají horizontální přesah. Stránka zakázky obsahuje obě dodaná videa.
- Fotografické náhledy zachovávají atribuce a čitelné popisy i na mobilu. Opožděná odpověď nesmí přepsat novější výběr; chybějící fotografie přejde na náhled vybraného kola a opakování požadavku po chybě 503 obnoví fotografie.

## Reprodukce a výsledky

Testy vyžadují Playwright, Chrome a běžící HTTP server; `NFW_BASE_URL` má výchozí hodnotu `http://127.0.0.1:8765`. Pokud modul není na běžné cestě, nastavte `PLAYWRIGHT_MODULE` na lokální instalaci Playwright. WebGL testy je vhodné spouštět postupně.

| Příkaz | Výsledek aktuálního běhu |
|---|---|
| `node tools/check-ui.cjs` | PASS, exit 0; žádné nezachycené JavaScriptové chyby |
| `node tools/check-vehicle-visuals.cjs` | PASS, exit 0; datové i browser kontroly, žádné nezachycené JavaScriptové chyby |
| `node tools/check-vehicle-studio.cjs` | Hlavní sada PASS: 2 GLB, 8 kotev, BMW i Tesla, skutečný orbit, změna disků/laku, fullscreen a mobil; spolehlivost následně ověřena samostatným během níže |
| `node tools/check-vehicle-studio.cjs --reliability-only` | PASS, exit 0; nedostupná generace, označená ukázka, přerušené načítání GLB a opakování, opožděný předchozí model |
| `node tools/check-studio-cancellation.cjs` | PASS, exit 0; okamžité uvolnění kontextu při zrušení čekajícího načítání metadat, odmítnutí nulového poloměru kotvy |
| `node tools/check-wheel-projection.cjs` | PASS, exit 0; perspektiva disku, projekční báze a ořez |
| `node tools/check-wheel-face.cjs` | PASS, exit 0; vykreslení disku |
| `node tools/check-wheel-fit.cjs` | PASS, exit 0; kalibrace disků ve fotografiích |
| `node tools/check-catalog.cjs` | PASS, exit 0; katalog a výběr variant |

Další cílené kontroly a jejich rozsah uvádí [3D dokumentace](3d-assets.md#verification). Snímky aktuálního stavu jsou v [docs/qa](qa/), například [BMW 360°](qa/bmw-x5-g05-360.png), [Tesla 360°](qa/tesla-model-3-2018-360.png) a [detail kola Tesly](qa/tesla-model-3-2018-wheel-detail.png).

Ověření se týká zobrazení a ovládání. Rozměry vizuálních modelů a zvolená objednávková specifikace nejsou potvrzením fyzické kompatibility nebo homologace kol.

## Oarts, stříbrná kolekce a redakční obsah — 2026-09-06

- Vygenerováno a vizuálně ověřeno 13 odlišných stříbrných 600px renderů a 900px hlavní render. Generátor `tools/render-silver-thumbnails.cjs` ověřil průhlednost, rozměry, neutrální odstín a zachování původního rozhraní pro 400px export.
- `node tools/check-wheel-face.cjs`: PASS po změně typografického nápisu na krytce na OARTS.
- `node tools/check-catalog-handoff.cjs`: PASS, exit 0. Skutečný klik ze hledání otevře vybraný model v konfigurátoru; zachovány ročníky, nejednoznačné generace, mobil a reset.
- `node tools/check-ui.cjs`: PASS, exit 0. Všechny obrázky, 13 náhledů, spuštění stříbrného 3D detailu, přepínání auta/kola, pět kroků, sdílení konfigurace, mobilní menu a videa. Žádné chyby JavaScriptu.
- Hero s nápisem OARTS a stříbrná kolekce byly zkontrolovány na desktopových a mobilních snímcích. Přidání textu na krytku je ilustrační úprava, nikoli potvrzení původu originálního loga.

Galerie začíná bez zákaznických fotografií. Její úvod je označen jako připravovaná galerie a používá produktový detail. Instagram se zobrazí teprve po zadání potvrzené adresy profilu v `js/oarts.js`.

Nezávislé browser QA: úvod, konfigurátor a průběh zakázky při šířkách 390, 960, 1200 a 1440 px bez chyb JavaScriptu, chybějících fotografií nebo horizontálního přesahu. Galerie byla testována s izolovanými daty mimo produkční katalog: dvě fotografie, přepínání šipkami, návrat na první snímek, Escape, zavření a návrat fokusu. HTML v textových polích zůstává textem. Odpověď 404 zobrazí hlášku a umožní přejít na další dostupný snímek. Všech 176 lokálních referencí z pěti HTML stránek existuje; navigační cíle vracejí HTTP 200.

Blog QA: PASS, exit 0, bez chyb JavaScriptu. Ověřeny oba články, témata, hledání bez diakritiky, prázdné výsledky, sdílení odkazu, obsah článku, související čtení a mobilní menu. Chybějící, neplatný, nadměrně dlouhý nebo duplicitní slug zobrazí stav nenalezeného článku. HTML v obsahu zůstává textem; javascriptové URL se nevykreslí. Navigace, skripty, styly i obrázky byly ověřeny pod podsložkou `/NeedForKola/`.
