# Ověření Need For Wheels

Aktualizováno 5. 9. 2026. Ověření probíhá v Chrome přes lokální HTTP server; desktop 1440 × 1000, mobil 390 × 844 a kontrola fotografických náhledů také při šířce 768 px. WebGL testy používají softwarový renderer SwiftShader; výsledky nejsou měřením FPS na běžném zařízení.

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
