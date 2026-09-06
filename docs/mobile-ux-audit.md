# Mobilní UX: audit a ověření průvodce

Datum: 6. 9. 2026. Rozsah: hlavní navigace, vyhledání vozu, předání výběru do konfigurátoru, všech pět kroků a příprava poptávky. Kontrola proběhla v Chrome s emulovaným dotykovým ovládáním při 390 × 844, 320 × 568 a 844 × 390 px.

## Nálezy a řešení

| Původní problém | Dopad | Provedená změna |
| --- | --- | --- |
| Při 390 × 844 začínal formulář až na y = 589; spodní lišta překrývala obsah od y = 716. | Uživatel neviděl první volbu auta, přesto mohl pokračovat. | Jedna zaoblená karta, stručná instrukce, menší náhled a první pole pod ním. |
| Při 320 × 568 a 844 × 390 začínala lišta Zpět / Dále až pod obrazovkou. | Směr pokračování nebyl vidět. | Pevná lišta s tlačítky vysokými nejméně 48 px a dynamicky rezervovaným místem pod obsahem. |
| Náhled a záhlaví spotřebovaly téměř celou nízkou obrazovku. | Na šířku nebylo vidět kolo ani formulář. | Na šířku náhled a aktuální formulář vedle sebe v jedné kartě; kompaktní lišta vysoká přibližně 65 px. |
| Přepnutí kroku vracelo stránku na začátek bez přesunu fokusu. | Uživatel ztrácel kontext a musel hledat nový formulář. | Přechod na začátek karty, fokus na instrukci aktuálního kroku a oznámení pro asistivní technologie. |
| Po změně modelu zůstával fokus na původním poli, někdy za lištou. | Nebylo jasné, co doplnit dále. | Postupné vedení model → rok → karoserie / generace → Pokračovat; přesun respektuje místo mezi záhlavím a spodní lištou. |
| Po výběru posledního designu byl velký náhled přibližně 1 600 px nad obrazovkou. | Uživatel neviděl výsledek své volby. | Stálá miniatura aktuálního návrhu v liště, tlačítko pro návrat k velkému náhledu, zachování fokusu a aktivní volby. |
| Rozměry, technické informace a dokončovací volby byly otevřené současně. | Průvodce vyžadoval orientaci v mnoha odborných parametrech. | Mobilně zavřené rozbalovací podrobnosti. Jejich stav se při úpravě hodnot zachovává. |
| Kontaktní jméno začínalo při 390 × 844 přibližně na y = 2 034, zatímco odesílací tlačítko bylo vidět na y = 785. | Uživatel mohl otevřít e-mail bez kontroly kontaktu. | Přehled se čtyřmi odkazy Upravit; první CTA vede na kontakt, další připraví e-mail až po validaci jména a e-mailu. |
| Navigace Auta vedla nejprve přes dva velké ukázkové vozy. | Vyhledávání bylo zbytečně hluboko. | Přímý odkaz na katalog vozů, přesun fokusu na jeho nadpis. |
| Plovoucí CTA překrývalo vyhledávání při psaní. | Zadaný text a výsledky bylo obtížné ovládat. | Plovoucí CTA při editaci ustoupí; konfigurátor navíc skrývá spodní lištu při otevřené softwarové klávesnici. |
| Menu neřídilo fokus ani interakce v pozadí. | Klávesnicí bylo možné odejít do zakrytého obsahu. | Omezený fokus v otevřeném menu, neaktivní pozadí, Escape a navrácení fokusu na tlačítko Menu. |

## Ověřené chování

Automatický test `tools/check-mobile-flow.cjs` prošel ve všech třech velikostech. Ověřuje:

- Viditelný náhled kola při vstupu; ovládání náhledu a pokračování v obrazovce bez překrytí a bez vodorovného posouvání.
- Správnou identitu BMW řady 5 Touring z roku 2019 při změně modelu a návratu; vedení fokusu do následujících voleb bez samovolného přepnutí kroku.
- Výběr posledního designu, průměr a pokročilé rozměry, povrch a krytku; stav otevřených podrobností po překreslení.
- Souhrn, přechod ke kontaktu, povinné údaje a obsah připravené poptávky. Test zabrání otevření poštovní aplikace a nic neodesílá.
- Zpět / Pokračovat, zachování rozpracovaného kontaktu, obnovení návrhu ze sdílené URL a nepřítomnost osobních kontaktních údajů v této URL.
- Skrytí a obnovení lišty při emulované změně výšky obrazovky během editace, otevření a zavření menu a obnovení fokusu.
- Na 390 px také skutečné vyhledání Audi A1 na hlavní stránce, kliknutí do konfigurátoru a návrat tlačítkem Zpět v prohlížeči do zachovaného hledání.

Kontrolní snímky vznikají v ignorované složce `tools/.cache-wheel-fit/mobile-flow-qa/`. Byly vizuálně zkontrolovány úvodní karta, souhrn a kontakt na výšku i na šířku. Nejmenší telefon používá svislé posouvání jedné stránky; náhled a šipky jsou dostupné hned na začátku.

Po závěrečné úpravě při 320 × 568 je vidět celé kolo i první pole: náhled má rozsah y = 216–326, značka a model y = 377–427 a lišta začíná na y = 447. Mobilní test byl znovu spuštěn a prošel ve všech třech velikostech.

Uložené kontrolní náhledy: [mobil](qa/guided-config-mobile.png), [malý displej](qa/guided-config-small.png), [na šířku](qa/guided-config-landscape.png), [souhrn](qa/guided-config-summary.png) a [kontakt](qa/guided-config-contact.png).

Prošly také existující testy `check-ui.cjs`, `check-catalog-handoff.cjs`, `check-brand-picker.cjs` a `check-landing.cjs`. Při tisku se otevřou i mobilně sbalené specifikace a po návratu se obnoví jejich původní stav; toto bylo ověřeno v tiskovém režimu prohlížeče.

## Spuštění

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/Users/Brann/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tools/check-mobile-flow.cjs
```

Volitelné `NFW_BASE_URL` přepne test z místního serveru na veřejnou adresu. Test používá Chrome, snížený pohyb a softwarové vykreslování WebGL. Testování klávesnice je emulace změny viewportu; nejde o záznam ověření na fyzickém iPhonu nebo Androidu.
