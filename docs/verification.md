# Ověření Need For Wheels

Ověřeno 4. 9. 2026 v Chrome (desktop 1440 × 1000 a mobilní viewport 390 × 844).

- Datový registr: 53 značek, 401 modelů, unikátní ID, aliasy názvů, hranice a přechodové roky X5, žádná zástupná fotografie jiného vozu.
- 13 lokálních WebP miniatur a všechny obrázky na homepage se načtou. Na stránkách nejsou SVG kresby aut ani kol.
- Skutečný WebGL náhled disku a Ferrari, změny designu, barev, povrchů, šířky a krytek; ovládání a uvolnění kontextů.
- Výběr BMW X5 2008 a 2020 přepíná na odpovídající E70/G05. Rok 2023 vyžaduje výběr konkrétní generace.
- Výběr jiné značky/modelu zachovává identitu v poptávce a jasně zobrazí nedostupnost přesného podkladu.
- Celých pět kroků, změna rozdílných/shodných šířek, doplňky, souhrn a sestavení mailto zprávy. Při testu nebyla žádná zpráva odeslána.
- Úplný stav konfigurace včetně modelových a fitment poznámek přežije sdílení/obnovení URL. Osobní kontakt se do URL neukládá. Duplicitní doplňky se nezapočítají dvakrát.
- Neplatné vstupy, neznámé značky/modely, HTML řetězce a hodnoty mimo rozsah jsou odmítnuty nebo omezeny. Navigace změnou hashe obnoví správný stav.
- Mobilní menu, výběr modelu, dostupnost formuláře a nulový horizontální přesah.
- Stránka zakázky používá obě dodaná videa; původní prázdné bloky byly odstraněny.
- Integrační test nenašel žádné JavaScriptové chyby stránky.

Reprodukovatelné testy: `node tools/check-catalog.cjs` a `node tools/check-ui.cjs` (Playwright + Chrome + běžící HTTP server; viz README). Vizuální snímky jsou v `docs/qa/`.

Výsledek není potvrzením fyzické kompatibility kol ani přesnosti generovaných automobilových renderů. Reálný rozsah a licenční omezení vozidlového modelu popisuje README a `docs/3d-assets.md`.
