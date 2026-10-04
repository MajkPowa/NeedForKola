# Interní provoz GDPR a práv zákazníků

Stav návrhu 4. 10. 2026. Provozní příloha; nezveřejňovat jako spotřebitelské podmínky. Tabulka je pracovní záznam o činnostech zpracování, nikoli důkaz jejich skutečného zavedení. Nepatří sem skutečné osobní údaje zákazníků ani přístupová hesla.

## Záznam o činnostech zpracování

Správce: Need For Wheels by Oarts s.r.o., IČO 30074088, Příčná 1892/4, Nové Město, 110 00 Praha 1. Kontaktní telefon +420 723 958 421. Provozní e-mail info@oarts.cz musí být aktivován a ověřen. Osobu odpovědnou za vyřizování žádostí a incidentů jmenovat interně.

| Činnost | Údaje / osoby | Účel a právní základ | Příjemci / přístupy | Uchování a výmaz |
|---|---|---|---|---|
| Poptávka | Jméno, kontakt, text a specifikace zájemce; VIN jen při doložené potřebě | Předkontraktační kroky, čl. 6/1/b; kontakty B2B čl. 6/1/f | Pověřený prodej; Cloudflare jako technický zpracovatel | Řešení + nejvýše 12 měsíců od poslední věcné komunikace, pokud nevznikne smlouva nebo spor; rutinní kontrola a výmaz |
| Objednávka | Zákazník, fakturace, dodání, položky, ceny, platba, uložená verze podmínek | Smlouva čl. 6/1/b; účetnictví čl. 6/1/c | Obsluha objednávek/skladu, skutečný dopravce, banka/brána, účetní, Cloudflare | Aktivní plnění a práva; účetní a daňové doklady dle konkrétní zákonné lhůty, obvykle 5/10 let; nearchivovat celé CRM bez rozlišení |
| Reklamace a odstoupení | Identifikace smlouvy, popis vady, korespondence, nároky | Čl. 6/1/b,c; ochrana konkrétních nároků f | Reklamační obsluha, přiměřeně servis/právník | Do vyřízení + potřebná promlčecí doba; u sporu zajištěné omezení výmazu pro relevantní data |
| Správci a audit | Identita administrátora, hash hesla, relace, historie změn | Oprávněný zájem na řízení oprávnění a bezpečnosti f | Výslovně oprávnění správci, Cloudflare | Relace max. 8 hodin; audit omezit na doloženou potřebnou dobu; zrušit přístup při ukončení oprávnění |
| Bezpečnost služby | Technické IP či pseudonymizovaný limit, čas a typ události | Dostupnost a ochrana služby f | Technický správce, hostitel | Minimalizace logů, samostatná lhůta dle skutečné konfigurace; nelogovat těla formulářů, cookies, tokeny, bankovní údaje |
| Zákaznické fotografie | Snímky vozu, případně RZ a osoby | Konzultace b; reklama až s odpovídajícím oprávněním/souhlasem a licencí | Prodej; veřejná galerie pouze schválené podklady | Pro konzultaci s poptávkou; pro publikaci doložit rozsah a dobu oprávnění, umět odstranit |

## Dodavatelé a přeshraniční přenosy

- Cloudflare Workers / D1 pro API, CRM a sklad. Před ostrými osobními údaji zajistit, že smluvním zákazníkem nebo oprávněným správcem účtu je firma a platí [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/). Uložit verzi, datum a rozsah přijatých smluvních podmínek. DPA se nepovažuje za uzavřené jen existencí tohoto odkazu.
- Pro databázi zvolit `jurisdiction = eu`, je-li podporováno, a uložit ověření skutečné konfigurace. [D1 data location](https://developers.cloudflare.com/d1/configuration/data-location/). Netvrdit „všechna data výhradně v EU“: Worker, síťové údaje, podpora a další technické zpracování mohou mít odlišný režim.
- Předání do třetích zemí zdokumentovat podle skutečně použitelného režimu DPA (rozhodnutí o odpovídající ochraně / SCC, další podmínky). Neopírat se o paušální souhlas zákazníka v obchodních podmínkách.
- Poskytovatel e-mailu, účetní, případná platební brána a dopravci dosud nebyli provozně potvrzeni. Před aktivací doplnit jejich názvy, roli správce/zpracovatele, země zpracování, smluvní zajištění a rozsah údajů. Tyto dodavatele nevymýšlet.
- Frontend e-shopu nesmí být při produkčním komerčním prodeji provozován v rozporu s podmínkami GitHub Pages. [Oficiální limity Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) výslovně zakazují použití této služby pro online business/e-commerce primárně usnadňující obchodní transakce. Repozitář může sloužit jako zdroj kódu pro vhodný hosting.

## Implementace a každodenní provoz

1. Formulář zobrazuje informační odkaz před odesláním; povinné pole „souhlasím s GDPR“ nepoužívat pro plnění poptávky/smlouvy. Odsouhlasení obchodních podmínek je samostatná věc. Žádný předzaškrtnutý marketing.
2. Veškerá zákaznická data jsou jen v neveřejné databázi/CRM. Nesmějí do veřejného Git repozitáře, konzole, analytiky, query stringu sdíleného odkazu, exportu do veřejné složky ani logů chyb.
3. HTTPS, oddělené účty, minimální oprávnění, serverové ověření autentizace každého administrátorského endpointu, ochrana proti CSRF/replay podle typu endpointu, omezení pokusů o přihlášení a bezpečné hashe hesel. Tajné klíče jen jako serverová tajemství.
4. Zálohování: ověřit obnovu, retenční okno a přístup. Obnova zálohy musí znovu respektovat výmazy/omezení uskutečněné od pořízení zálohy. Neslibovat v soukromí přesnou lhůtu záloh bez skutečného nastavení.
5. Měsíčně projít skončené poptávky starší 12 měsíců a odstranit osobní údaje, pokud pro konkrétní záznam neexistuje další doložený účel. U smluv oddělit doklady od nepotřebné komunikace. Lhůta pro daňové doklady není plošná lhůta pro všechny kontakty.
6. Žádosti subjektů: zaevidovat datum, rozsah a identifikátor; přiměřeně ověřit identitu, vyřídit do jednoho měsíce nebo v této době oznámit zákonné prodloužení. Výpis musí pokrývat také CRM poznámky a případné přílohy; neodkrývat údaje jiných osob.
7. Incident: zaznamenat zjištění, rozsah a opatření. Je-li pravděpodobné riziko pro práva a svobody, posoudit ohlášení ÚOOÚ pokud možno do 72 hodin; při vysokém riziku také informování dotčených osob. I neohlašovaný incident zdokumentovat. Není to automatická povinnost hlásit každý technický výpadek.
8. Fotografie: evidence zdroje a licence, před publikací přezkoumat osoby/RZ. Žádné marketingové použití zákaznických fotografií odvozené pouze z přiložení k poptávce.
9. Po změně fontů, chatbota, analytiky, plateb nebo marketingu znovu zkontrolovat síť/cookies a upravit informace. Dokud nejsou analytické/marketingové technologie, nevytvářet falešnou lištu pro souhlas se sledováním, které neexistuje.

## Co ověřit před veřejnou publikací textů

- Texty soukromí a cookies předpokládají lokální fonty, žádné marketingové/analytické skripty a serverovou cookie `__Host-nfw_admin` jen v administraci s limitem 8 hodin. Porovnat s reálně nasazeným kódem.
- Retenci 12 měsíců pro nerealizované poptávky přijmout jako skutečný provozní postup a zajistit výmaz, ne pouze slib v dokumentu.
- Všechny texty obsahující `info@oarts.cz` smějí tvrdit funkční elektronické podání teprve po aktivaci a testu schránky. Při chybějícím MX použít pro veřejné instrukce fungující serverový formulář a poštovní/telefonní kontakt; neslibovat, že byl odeslán e-mail. E-mail čekající v outboxu není doručené potvrzení smlouvy.
- Formulář pro reklamaci/odstoupení musí uložit celý požadavek a bezpečně zpřístupnit obsluze, vrátit pravdivé potvrzení a referenci. Zákonná práva nesmí záviset na přihlášení nebo existenci objednávky v nové databázi.
- Skladová adresa není automaticky potvrzené místo příjmu vratek. Veřejná forma může uvádět sídlo jako zákonný písemný kontakt a domluvený způsob převzetí; provozovatel musí reálně zajistit příjem zboží, nejen přesměrovávat zákazníka.

Tato část je úkol pro provoz systému a odpovědné osoby. Samotné zveřejnění dokumentů nevytváří zpracovatelské smlouvy, neověří homologaci kol, nepřihlásí firmu k obalovým povinnostem ani nesplní účetní evidenci.
