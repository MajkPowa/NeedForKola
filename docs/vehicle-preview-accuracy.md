# Přesnost náhledu vozu — oprava 6. 9. 2026

Podnět: u BMW řady 5, rok 2019, karoserie kombi zobrazoval konfigurátor fotografii novějšího sedanu. Příčinou byl automatický přechod z chybějící fotografie provedení na obecnou fotografii modelové řady. Stejná cesta se používala i po chybě načtení fotografie.

## Výběr podkladu

- Konfigurátor vyžaduje shodu značky, modelu, generace, karoserie a roku. Obecná fotografie modelové řady se nepoužívá jako náhrada.
- Katalog může obecné fotografie ukazovat při procházení modelových řad bez vybraného roku. Při filtrování podle roku ukazuje pouze podklad jediného jednoznačného provedení, jinak vyzve k výběru generace a karoserie.
- Chybějící podklad ponechá vybraný vůz v konfiguraci a ukáže samostatné 3D kolo s vysvětlením. Síťová chyba známého podkladu umožňuje obnovení.
- Dřívější odkazy s `view=showroom` se převádějí na náhled vybraného vozu. Nemohou otevřít ukázkové BMW místo zvoleného Audi či jiné generace.
- Sdílená URL má jediný aktuální stav v hashi; neaktuální parametry původního vstupního odkazu se odstraní. Jiné parametry, například UTM, zůstávají.

## BMW řady 5 Touring 2019

Pro variantu `bmw/rada-5/v-1b3b3ef6ba08`, kombi 2017–2020, je doplněna skutečná fotografie G31 před faceliftem. Snímek pořídil User3204 dne 14. 8. 2018. [Zdroj a licence CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:BMW_5_Series_G31_(front).jpg). Identitu potvrzuje [uvedení BMW G31 v roce 2017](https://www.press.bmwgroup.com/global/article/detail/T0267496EN/the-new-bmw-5-series-touring); [facelift byl představen v roce 2020](https://www.press.bmwgroup.com/global/article/detail/T0308529EN/the-new-bmw-5-series?showMedia=video). Přechodový rok 2020 vyžaduje volbu konkrétního provedení.

## Kola na fotografii

Nový render používá tlumenější odrazy uvnitř ráfku, tmavší brzdu a výraznější zastínění zapuštěných ploch a styku s pneumatikou. Změna se týká samostatného rendereru pro fotografické kompozice.

Kompozice vyžaduje přesnou variantovou fotografii, shodnou identitu a rozměry zdroje a zkontrolované umístění ráfků. Neověřená, drobná či krajně boční kola se nepřekrývají. Původní snímek zůstává dostupný k porovnání. Úprava a zdrojová licence jsou uvedené u výsledku.

Fotografická kompozice je pomůcka pro porovnání designu. Není to fyzická simulace ET, velikosti brzd ani skutečný prostorový model celého vozu. Úplné otáčení auta zůstává dostupné pouze pro konkrétní licencované 3D modely uvedené v `js/vehicle-models.js`.

## Ověření

- `tools/check-vehicle-visuals.cjs`: výběr provedení, odmítnutí chybné identity a obnovení po síťových chybách.
- `tools/check-exact-vehicle-preview.cjs`: skutečný průchod BMW Touring 2019, přepnutí na sedan a novější rok, starý odkaz s Audi a filtrování katalogu.
- `tools/check-catalog-handoff.cjs`: přenos hledaného vozu do konfigurátoru.
- `tools/check-ui.cjs`: ovládání konfigurátoru a mobilní rozložení.
