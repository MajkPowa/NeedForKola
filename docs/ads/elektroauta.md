# Vstup pro elektromobily — 11. 10. 2026

Cílová stránka: `https://oarts.cz/elektroauta.html`. Stránka prodává návrh a ověření kol pro konkrétní elektromobil. Neobsahuje příslib vyššího dojezdu, univerzální homologace, kompatibility ani nepotvrzené nosnosti kola.

## Výběr vozů a podklady

Vstupní kolekce obsahuje 26 existujících čistě elektrických modelových řad od 12 značek: Škoda Enyaq / Elroq, Tesla Model 3 / Y / S / X, Volkswagen ID.3 / ID.4 / ID.5 / ID.7, BMW i4 / i5 / i7 / iX, Audi Q4 e-tron / Q6 e-tron / e-tron GT, Hyundai Ioniq 5 / 6, Kia EV3 / EV6, Volvo EX30, CUPRA Born, Polestar 2, BYD Atto 3 a MG4.

Zařazení čistě elektrického pohonu je ověřené u výrobců. Jednotlivé odkazy, datum ověření a rozsah jsou v `data/electric-vehicles.json`; stejné odkazy jsou dostupné na stránce. Zdroje ověřují modelovou řadu, nikoli fyzickou kompatibilitu kol. Smíšené modelové rodiny jako BMW řada 5, Hyundai Kona, Kia Niro, BYD Seal U, MG ZS nebo Volvo XC40 nejsou plošně označené jako BEV. Kolekce není úplným soupisem elektromobilů.

Všech 401 původních rodin, 2 736 provedení, ID, historie, zdrojů a statistik katalogu zůstalo zachováno. K datům se přidává pouze samostatné pole `electricModels`. Nejsou přidány žádné rozměry, nosnosti, montážní parametry ani nové 3D podklady.

## Připravené adresy

| Záměr | URL |
| --- | --- |
| Obecné elektromobily | `https://oarts.cz/elektroauta.html` |
| Tesla | `https://oarts.cz/elektroauta.html?brand=tesla#evModels` |
| Tesla Model Y | `https://oarts.cz/elektroauta.html?brand=tesla&model=model-y#evModels` |
| Škoda | `https://oarts.cz/elektroauta.html?brand=skoda#evModels` |
| Enyaq | `https://oarts.cz/elektroauta.html?brand=skoda&model=enyaq#evModels` |
| BMW | `https://oarts.cz/elektroauta.html?brand=bmw#evModels` |
| Volkswagen ID. | `https://oarts.cz/elektroauta.html?brand=volkswagen#evModels` |

Parametry `brand` a `model` používají skutečná ID katalogu. Stránka může nést i UTM parametry; filtry je zachovávají. Žádný nový tracker ani měření konverzí se nezavádí. Jedna canonical URL vede na `/elektroauta.html` bez filtrů.

Kliknutí na model otevírá například `konfigurator.html?brand=tesla&model=model-y&year=0&generation=&body=&view=car&ev=1&vehicleFilter=electric`. Zákazník doplní rok a provedení; výběr modelů začíná filtrem elektromobilů. Odkaz neobsahuje vymyšlenou rozteč, ET, šířku, nosnost ani konkrétní generaci. Parametr `ev=1` je zadání zákazníka pro poptávku a neznamená ověření nosnosti či schválení kola. Modelové odkazy jsou předrenderované a fungují i bez JavaScriptu.

Vstupy pro model nenalezený v přehledu a pro smíšené modelové řady naopak otevírají `konfigurator.html?vehicleFilter=all&ev=1&year=0`. Úplný katalog nabízí i tyto rodiny; zadání elektromobilu zůstává zapnuté. Generátor zachovává tyto tři vstupy zvlášť od odkazů na vybrané BEV modely.

## Český text pro přípravu kampaně

- Kola pro tvoje elektroauto
- Kola pro Tesla Model Y
- Vlastní styl pro tvůj Enyaq
- Navrhni kola v konfigurátoru
- Vyber design kol pro svůj elektromobil. Rozměry a nosnost ověříme pro konkrétní vůz.
- Tesla, Škoda, BMW a další elektromobily. Připrav nezávaznou poptávku kol OARTS.

Jde o návrhy textu pro budoucí kampaň. Reklamy nebyly založeny ani spuštěny; nebyl přidán rozpočet či odeslána zpráva.

## Regenerace a ověření

1. `python tools/build-vehicle-data.py` sestaví katalog se samostatnou BEV kolekcí.
2. `node tools/build-electric-vehicles.cjs` aktualizuje značky, modelové odkazy a počty ve statické stránce.
3. `node tools/check-electric-vehicles.cjs --data-only` ověří kolekci, neměnnost API a nezařazení smíšených řad. Volitelný `--baseline <původní vehicle-variants.json>` porovná všechny původní varianty a statistiky.
4. Browser část `node tools/check-electric-vehicles.cjs` vyžaduje lokální HTTP server a Playwright (`PLAYWRIGHT_MODULE`, případně `NFW_BASE_URL`). Test provádí skutečné kliknutí z landing do konfigurátoru, cílené URL, reset, hledání bez diakritiky, nulové výsledky, šířky 320 / 390 / 768 / 1440 a dostupnost bez JS. Neodesílá poptávku.

API `NFWVehicles.isElectricModel(brand, model)` vrací true jen pro explicitně ověřené BEV řady. False znamená, že řada není v této ověřené kolekci. `getElectricModels(brand?)` vrací neměnné pole dvojic `{brand, model}`; `model.powertrain` je `bev` nebo null a `model.electricSource` uvádí zdroj. Přesný pohon smíšených nebo dalších řad může zákazník zadat ručně.
