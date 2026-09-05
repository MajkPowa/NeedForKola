# Katalog vozů Need For Wheels

Zadání: všech 53 značek a 401 modelových rodin ze seznamu uživatele, generace, facelifty a karoserie do roku 2026. Motorizace, pohony a výbavy nejsou samostatnou požadovanou dimenzí. Každá rodina má doložené provedení; přesné počty obsahuje `data/coverage-report.json`.

**Úplný seznam rodin není zárukou úplnosti všech historických variant.** Import obsahuje katalogová období, často bez kódu generace nebo označení faceliftu. Tyto údaje neodvozujeme jako ověřená fakta z pouhého roku. Některé karoserie zůstávají neurčené. UI rozlišuje katalogový záznam a doplnění z podkladů výrobce, uvádí zdroj a stav období. Databáze neposkytuje přesné 3D modely všech vozů ani ověřený fitment kol.

## Zdroje a licence

Základem je [vehicle-makes-models](https://github.com/gor3a/vehicle-makes-models), revize `b4965631140fa82404359167621274601da69a5b` z 2. července 2026. Projekt uvádí autoevolution.com jako původní zdroj a data poskytuje pod ODbL 1.0. Snímek `data/source/vehicle-makes-models.json` neobsahuje motorizace. Párování rodin je v `data/model-crosswalk.json`; pravidla a audit karoserií v `tools/vehicle_bodies.py`, `docs/body-classification.md` a `data/source/body-classification-audit.json`.

Výrobcem doložená doplnění jsou v `data/curated-vehicles.json` a `data/recent-vehicles.json`, s konkrétními odkazy, trhem a poznámkami. Zahrnují novinky do 2026, chybějící modely a podrobnější historii vybraných řad. `replacesSourceNames` odstraňuje přesně určené importované záznamy, nikoli libovolné řady podobného roku. Scout, Alltrack a další souběžná provedení se tak neztratí. Duplicitní oficiální fáze se slučují podle generace, období, karoserie a faceliftu.

Upravená databáze `data/vehicle-variants.json` a její browserová kopie `js/vehicle-data.js` jsou pod **ODbL 1.0**. Web uvádí zdroje, licenci a stažení dat. Informace: `data/LICENSE-DATA.txt`; úplný text: `data/ODbL-1.0.txt`. Licence databáze není licencí fotografií, ochranných známek ani 3D modelů.

## Datový model a výběr

`js/vehicle-data.js` se načítá před `js/vehicles.js`, který vystaví hluboce neměnný `window.NFWVehicles`.

- `brands`: `{ id, name, models: [{ id, name, variants, generations }] }[]`. `generations` je kompatibilní alias stejného pole konkrétních provedení.
- Provedení: stabilní `id`, `name`, `from`, `to`, `body`, `bodyName`, `facelift` (true/false/neznámé null), `confidence`, `source`, `sourceTitle`, `endBasis`. Doložené kódy jsou v `generationCode`.
- `getBrand`, `getModel` přijímají ID i název bez ohledu na velikost písmen a diakritiku.
- `getVariants` / `getGenerations` vrací všechna provedení rodiny.
- `getYears(brand, model, body?)` sjednocuje skutečné intervaly sestupně, nevyplňuje mezery (např. Ford Puma).
- `getBodies(brand, model, year?)` vrací pouze karoserie doložené pro daný výběr.
- `getCandidates(brand, model, year, body?)` vrací průnik roku a karoserie; `resolve(...)` jen jediný jednoznačný výsledek, jinak null.
- `through` a kompatibilní `verifiedThrough` jsou 2026: hranice katalogu, ne potvrzení konce výroby nebo úplného ověření všech údajů.

Nevytváří se kartézský součin generací, karoserií a let. Po změně značky/modelu/roku/karoserie se zneplatní nevyhovující výběr. Přechodové roky mohou vyžadovat ruční volbu. Neplatný rok, karoserie či ID v odkazu nesmí automaticky vybrat nesprávný obrázek. `body` i `generation` se přenáší do URL, souhrnu a poptávky. Kontaktní jméno, e-mail a telefon v URL nejsou.

## Období, trhy a nejistoty

Intervaly jsou inkluzivní. `endBasis: source` znamená zadaný konec; `open` konec neuvedený ve zdroji a katalogové zastropování rokem 2026; `inferred` hranici odvozenou z následujícího provedení ve stejné řadě a karoserii. Původní konec zůstává v `sourceTo`. Otevřený interval nedokládá výrobu až do roku 2026.

Import nerozlišuje spolehlivě trhy ani modelový rok od výroby. Doplnění má `market`, `startBasis`, `verifiedOn`, případně `notes`, `additionalSources` a `bodyVariants`. Seznam délek či provedení celé užitkové řady se automaticky nenásobí všemi karoseriemi, protože ne všechny kombinace musí existovat. BMW X5 G65 a nová karoserie Polestar 4 SUV jsou označeny jako oznámené; plánované dodávky nejsou vydávány za uskutečněné.

## Vizuální podklady

Pouze BMW X5 E70 a G05 před faceliftem mají konkrétní rastrové rendery `assets/cars/bmw-x5-e70.webp` a `assets/cars/bmw-x5-g05.webp`. E53, E53 facelift 2003, E70 LCI, F15, G05 LCI a G65 se s nimi nezaměňují. [BMW doložení modernizace z roku 2003](https://www.press.bmwgroup.com/usa/article/detail/T0020641EN_US/the-new-bmw-x5).

V katalogu jsou nyní vizuální podklady všech 401 modelových řad. Režim „Můj vůz“ u přesně odpovídajícího registrovaného modelu otevře skutečné 360° auto, u ostatních fotografický náhled s novými koly. Dostupné 3D vozy lze najít filtrem „Jen vozy s 360° modelem“. Ukázkové BMW studio je samostatně označené a nemění vybraný vůz v objednávce. Původ, přesné pokrytí a omezení viz `docs/3d-assets.md`.

## Obnova a kontrola

```powershell
python tools/build-model-crosswalk.py
python tools/build-curated-vehicles.py
python tools/build-vehicle-data.py
python tools/check_vehicle_bodies.py
node tools/check-catalog.cjs
node tools/check-ui.cjs
node tools/check-catalog-browser.cjs
node tools/check-vehicle-selection.cjs
```

Generátory používají připnutý lokální snímek. Nový upstream snímek vyžaduje kontrolu mapování a rozdílů. Integrační testy potřebují místní HTTP server, Chrome a Playwright (`PLAYWRIGHT_MODULE`). Ověřují přechodové roky, průniky karoserií, mezery, URL, souhrn, mobilní katalog a oddělení náhledů.
