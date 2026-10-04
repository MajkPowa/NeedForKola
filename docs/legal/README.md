# Právní podklady pro oarts.cz

Ověřeno a připraveno 4. 10. 2026. Tento adresář obsahuje texty a provozní podklady pro Need For Wheels by Oarts s.r.o. Právní dokumenty nejsou potvrzením souladu celého podnikání ani náhradou kontroly konkrétního obchodního procesu právníkem. Znění musí odpovídat skutečně zapnutým funkcím webu a sjednaným dodavatelům.

## Identita provozovatele

- Název: **Need For Wheels by Oarts s.r.o.**
- IČO: **30074088**.
- Sídlo: **Příčná 1892/4, Nové Město, 110 00 Praha 1**.
- Zápis: **oddíl C, vložka 456867, Městský soud v Praze**.
- Vznik: 24. 9. 2026.
- Doména: **oarts.cz**.
- Telefon dodaný provozovatelem: **+420 723 958 421**.
- E-mail používaný v projektu: **info@oarts.cz**. Před příjmem objednávek musí skutečně přijímat zprávy a někdo jej musí obsluhovat.
- Sklad dodaný provozovatelem: **Předvrší 846, Ostrava – Krásné Pole, 725 26**. Nezaměňovat za sídlo. Termín návštěvy se domlouvá předem. Samotné sdělení skladové adresy nepotvrzuje trvalou otevírací dobu ani automaticky příjem vratek.
- Instagram a TikTok: **@nfw.oarts**.

Název, sídlo, vznik a spis byly 4. 10. 2026 načteny přímo z [ARES Ministerstva financí](https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/30074088) a [pohledu veřejného rejstříku v ARES](https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/30074088). Výpis vrací DIČ prázdné a stav zdroje DPH `NEEXISTUJICI`. To není podklad pro vymyšlení DIČ ani pro neomezeně platné tvrzení „neplátce DPH“. Daňový režim pro ceny a doklady musí před ostrým prodejem potvrdit provozovatel/účetní.

## Co lze zapnout bez obchodních údajů, které dosud chybí

Poptávku s kontaktem a referencí kola, ukládání do neveřejného CRM, odpověď konzultanta, správu konceptů produktů a skladu. Zobrazení fotografie ani vložení konceptu do ERP není potvrzením ceny, zásoby, nosnosti, kompatibility či homologace.

Dokumenty `obchodni-podminky.md`, `reklamacni-rad.md` a `odstoupeni-a-formulare.md` počítají s nezávaznou poptávkou a následnou konkrétní nabídkou. Závaznou objednávku dovolují pouze tam, kde zákazník předem dostane úplné údaje; netvrdí, že každý záznam galerie lze právě teď koupit.

## Podmínky aktivace závazných objednávek

1. Ověřená doručitelnost prodejního e-mailu a oprávněný správce objednávek. Potvrzení objednávky a smluvních podmínek musí zákazník obdržet na trvalém nosiči, například v e-mailu; samotná měnitelná webová stránka nestačí.
2. Každý prodávaný SKU: skutečný výrobce, identifikace výrobku a odpovědného hospodářského subjektu v EU, rozměry, povrch, počet disků v sadě, stav, příslušenství, doložená vhodnost/schválení, potřebné české bezpečnostní informace a návod. Fotografie krytky není důkazem výrobce.
3. Cena v CZK, potvrzený režim DPH, množství dostupných sad, způsob rezervace a serverové ověření ceny i zásoby. Nedovolit objednat zboží s neznámou nebo nulovou cenou.
4. Konkrétní způsob platby a splatnost; při převodu skutečný firemní účet, při kartách smlouva s bránou a ověřování plateb na serveru. Neukládat údaje platebních karet do vlastního CRM.
5. Země doručení, skutečně dostupné způsoby a ceny dopravy, dodací termíny. Před uzavřením smlouvy sdělit přímé náklady vrácení; u zboží, které nelze běžně vrátit poštou, uvést odpovídající odhad, nikoli neurčité „dle dopravce“.
6. Potvrzené místo příjmu vráceného/reklamovaného zboží a proces převzetí. Nesmí se čekáním na logistické pokyny krátit spotřebiteli zákonná práva.
7. U individuální výroby konkrétní výrobní specifikace, termín a případná záloha. Výjimku z odstoupení neposuzovat plošně podle slova „custom“ či výběru z běžného vzorníku. Evidence předchozího poučení zákazníka a případné skutečné individualizace.
8. Uložení neměnné verze podmínek a cen/specifikace ke každé objednávce; před odesláním možnost kontroly a oprav; závěrečné tlačítko jasně vyjadřující povinnost zaplatit.
9. Dodavatelé hostingu, pošty, účetnictví a plateb musí odpovídat informacím o soukromí a potřebným zpracovatelským smlouvám. Ověřit zálohování/obnovu a postup výmazu. Administrace není veřejná databáze.

Tyto body nejsou dodatečná schvalovací procedura. Jsou to konkrétní data a funkce, bez kterých nelze pravdivě sestavit závaznou nabídku, cenu a informační povinnosti.

## Audit původního frontendu

Statická kontrola 4. 10. 2026 před úpravami této zakázky:

- `index.html`, `konfigurator.html`, `proces.html`, `blog.html`, `clanek.html` načítaly CSS Google Fonts a fonty z `fonts.googleapis.com`/`fonts.gstatic.com`; jde o síťový přenos IP a technických údajů externímu poskytovateli. Pro nové nasazení lokalizovat fonty a odstranit obě `preconnect` adresy.
- V aplikačním JavaScriptu nebyly nalezeny zápisy do cookies, `localStorage`, `sessionStorage` ani analytické/marketingové pixely. Konfigurace se sdílela v URL. Nesmí se do sdíleného odkazu ukládat kontakt, VIN ani jiné osobní údaje.
- Fotografie, videa, 3D knihovny a datové soubory se načítaly lokálně. Odkazy na zdroje a licence nejsou samy vložením externího přehrávače.
- Formulář v `js/main.js` a poptávky otevíraly e-mailového klienta. Taková akce není serverové přijetí objednávky. Každou změnu na serverový formulář promítnout do informačního textu.
- Po nasazení znovu ověřit skutečné síťové požadavky a cookies, nikoli pouze název souboru nebo nepřítomnost analytického skriptu.

## Další právní provoz, který samotné stránky nevyřeší

- **Bezpečnost zboží:** údaje pro nabídku na dálku, dohledatelnost šarží a zákazníků, návody, dokumenty výrobce a postup stažení nebezpečného výrobku. GPSR se uplatňuje v souběhu s relevantními zvláštními předpisy; nepřidávat automaticky označení CE na automobilová kola bez ověření příslušného režimu. [ČOI — uvedení výrobku na trh](https://coi.gov.cz/pro-podnikatele/uvedeni-vyrobku-na-trh/).
- **Oprávnění firmy:** registrace s.r.o. sama nepotvrzuje všechny potřebné živnosti a dovozní povinnosti. Prověřit s účetní/právníkem skutečný rozsah podnikání.
- **Přístupnost e-shopu:** posoudit působnost zákona č. 424/2023 Sb. a případnou výjimku pro mikropodnik poskytující služby. Bez údajů o firmě netvrdit výjimku ani certifikovanou shodu. [MPO — přístupnost výrobků a služeb](https://mpo.gov.cz/cz/podnikani/pristupnost-vyrobku-a-sluzeb/).
- **Obaly a EPR:** „ERP“ obvykle znamená sklad/objednávky; „EPR“ může znamenat rozšířenou odpovědnost výrobce. U dovozu balených kol posoudit povinnosti k obalům podle reálného obratu a množství. Samotný skladový program nezajistí plnění obalových povinností. [CENIA — obaly](https://cenia.gov.cz/odpadove-a-obehove-hospodarstvi/obaly-a-odpady-z-obalu/).
- **Online odstoupení:** ČOI uvádí účinnost české novely č. 159/2026 Sb. od **1. 1. 2027**. Připravit přístupnou online funkci pro oprávněné smlouvy, identifikaci smlouvy, potvrzení úkonu a zaslání potvrzení na trvalém nosiči. E-mailový odkaz sám o sobě není důkaz splnění budoucí funkční povinnosti. [ČOI — oznámení](https://coi.gov.cz/tlacitko-usnadni-odstoupeni-od-smlouvy/).
- Nepoužívat nefunkční odkaz na evropskou platformu ODR: provoz skončil 20. 7. 2025. Zachovat české ADR při ČOI. [Evropská komise](https://consumer-redress.ec.europa.eu/site-relocation_en).

## Primární zdroje

- [Občanský zákoník, zákon č. 89/2012 Sb.](https://e-sbirka.gov.cz/sb/2012/89), zejména spotřebitelské smlouvy a prodej zboží spotřebiteli. Oficiální e-Sbírka je dynamická; v tomto běhu nebylo její úplné znění strojově dostupné. Konkrétní níže uvedené závěry byly kontrolovány v aktuálních výkladech ČOI, nikoli vydávány za úplnou analýzu všech novel.
- [Zákon o ochraně spotřebitele, č. 634/1992 Sb.](https://e-sbirka.gov.cz/sb/1992/634).
- [ČOI — internetový nákup a odstoupení](https://coi.gov.cz/faq/a-nakup-pres-internet/).
- [ČOI — skutečná individualizace a výjimky z odstoupení](https://coi.gov.cz/faq/b-v-jakych-pripadech-nemohu-od-smlouvy-odstoupit-7/).
- [ČOI — reklamace podle úpravy od 6. 1. 2023](https://coi.gov.cz/faq/6_reklamace-zbozi-od-6-1-2023/).
- [ČOI — rozdíl práv z vad a záruky za jakost](https://coi.gov.cz/reklamace/).
- [ČOI — ADR](https://coi.gov.cz/informace-o-adr/).
- [ÚOOÚ — informace pro e-shopy](https://uoou.gov.cz/profesional/qa-otazky-a-odpovedi/informace-pro-e-shopy).
- [ÚOOÚ — cookies a obdobné technologie](https://uoou.gov.cz/verejnost/qa-otazky-a-odpovedi/cookies).
- [ÚOOÚ — práva subjektu údajů](https://uoou.gov.cz/poradna/poradna-gdpr/prava-subjektu-udaju).
- [GDPR, nařízení (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj). EUR-Lex při tomto ověření vyžadoval interaktivní kontrolu; konkrétní informační povinnosti byly ověřeny pomocí oficiálních výkladů ÚOOÚ.
