# OARTS · Need For Kola

Statický web pro custom kovaná kola ve stylu Need For Speed. Bez build kroku, bez závislostí, bez obrázků: auta i kola jsou generovaná jako SVG přímo v prohlížeči.

Živě: https://majkpowa.github.io/NeedForKola/

## Spuštění lokálně

Stačí otevřít `index.html` v prohlížeči. Lokální server je potřeba jen proto, aby tlačítko „Kopírovat odkaz na konfiguraci“ vracelo webovou adresu místo cesty k souboru (z `file://` se místo toho použije veřejná adresa z `O.SITE_URL`):

```bash
python -m http.server 8080
```

nebo

```bash
npx serve .
```

## Nasazení (GitHub Pages)

Web se publikuje z větve `main`, složka `/` (kořen). Každý push na `main` spustí nový build, do minuty je změna živě. Soubor `.nojekyll` musí zůstat v kořeni, aby Pages neprocházely soubory Jekyllem.

```bash
git push origin main
```

Pokud se změní adresa webu (vlastní doména), uprav `O.SITE_URL` v `js/main.js` a odkazy `rel="canonical"` v hlavičkách všech tří HTML stránek.

## Struktura

| Soubor | Co dělá |
| --- | --- |
| `index.html` | Domovská stránka: hero, auta, designy, průběh zakázky, OARTS štítek, kontakt |
| `konfigurator.html` | Konfigurátor v 5 krocích (auto, design, rozměry, vzhled, souhrn) |
| `proces.html` | Detailní průběh zakázky v 7 fázích |
| `css/style.css` | Celý vzhled webu i konfigurátoru |
| `js/wheels.js` | Katalog designů, barev, povrchů a procedurální SVG renderer kol |
| `js/cars.js` | Katalog tříd vozů (silueta, pozice kol, fitment) a renderer bočního pohledu |
| `js/main.js` | Navigace, animace, hero kolo, galerie, generátor OARTS štítku, kontaktní formulář |
| `js/configurator.js` | Stav konfigurátoru, validace hodnot z URL, cena, váha, souhrn, poptávka e-mailem, sdílení odkazu |

## Co upravit před spuštěním naostro

- **Kontakt**: e-mail a telefon jsou v `js/main.js` (`O.EMAIL`, `O.PHONE`). Poptávky se odesílají přes `mailto:`, takže není potřeba backend.
- **Ceny**: základ, příplatky za průměr a šířku jsou ve funkci `price()` v `js/configurator.js`. Příplatky designů, povrchů, límců a krytek jsou v katalogu v `js/wheels.js`. Doplňky za sadu v poli `EXTRAS` v `js/configurator.js`.
- **Fotky a videa**: na stránce `proces.html` jsou šrafovaná pole „Místo pro…“ připravená na reálné záběry z výroby.
- **Designy**: přidání vzoru = nový záznam v `DESIGNS` v `js/wheels.js` (styl paprsku, počet paprsků, příplatek).
- **Auta**: přidání třídy = nový záznam v `CARS` v `js/cars.js` (SVG cesty karoserie, pozice kol, výchozí fitment).

## Sdílení konfigurace

Konfigurátor ukládá celý stav do `#hash` v URL. Odkaz zkopírovaný tlačítkem „Kopírovat odkaz na konfiguraci“ otevře přesně stejnou sestavu. Všechny hodnoty z URL se při načtení validují proti katalogu a limitům, takže do stránky nikdy nepronikne cizí obsah. Z domovské stránky lze předvolit auto (`konfigurator.html?car=gt`) nebo design (`konfigurator.html?design=deep7`).
