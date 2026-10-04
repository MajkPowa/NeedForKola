# Správa Need For Wheels

Serverová část pro zákazníky, poptávky, požadavky na reklamaci/odstoupení, skladové sady, objednávky a individuální nabídky. Cloudflare Worker používá databázi D1 `nfw-commerce` v jurisdikci EU. Veřejné fotografie nejsou automaticky skladové položky. Po instalaci je sklad prázdný a přímý prodej je vypnutý.

## Adresy a přístup

- Cílový web: `https://oarts.cz/`.
- Administrace: `https://oarts.cz/admin`.
- Záložní adresa administrace: `https://nfw-commerce.largoverse-private.workers.dev/admin`.
- API: stejný původ jako web, prefix `/api/`; veřejná kontrola `/api/health`.
- Dokud není přesměrování domény a certifikát dokončené, použije se záložní adresa. Její existence sama nepotvrzuje dokončené DNS.

Přístupový klíč vlastníka se předává v souboru `commerce/private/owner-access.txt`, který není v Gitu ani v publikovaných souborech. Do administrace se zadává tento klíč, nikoli heslo k WEDOS. V databázi je pouze SHA-256 otisk náhodného 256bitového klíče. Přihlášení platí nejvýše osm hodin. Odhlášení relaci zneplatní a odstraní načtená zákaznická data z rozhraní.

Každý držitel klíče má úplnou správu. Pro dalšího člena týmu založte samostatný záznam administrátora s vlastním klíčem; společný klíč nesdílejte veřejným chatem. Při ztrátě přístupu deaktivujte konkrétní `admins.enabled` a odstraňte jeho relace. Není zde veřejná registrace ani výchozí heslo. Změna klíče je řízená operátorem databáze.

## Každodenní práce

1. V **Poptávkách a požadavcích** otevřete nový záznam. Obsahuje kontakt z okamžiku odeslání, referenci vybraného kola, případně celý návrh z konfigurátoru. Historický kontakt nelze změnit další veřejnou poptávkou se stejným e-mailem.
2. Změňte stav na **V řešení** a zapisujte věcnou komunikaci do interních poznámek. U poptávky poznámka aktualizuje datum posledního kontaktu. Zpráva ani změna stavu neposílají automatický e-mail.
3. V **Zákaznících** jsou kontakty a interní poznámky. E-mail z veřejného formuláře není ověřená identita. Reklamaci nebo odstoupení ověřujte podle konkrétního případu; jejich přijetí formulářem je pouze evidence požadavku, nikoli automatické rozhodnutí.
4. V **E-mailech** je trvalá fronta zamýšlených potvrzení. Stav **Čeká na odesílání** znamená, že zpráva skutečně nebyla odeslána. Odpovídejte zákazníkovi provozně ověřeným kanálem. Zaškrtnutí nebo změna stavu poptávky nemění doručení.

## Sklad

Jednotkou je **celá sada**; počet disků v sadě se zadává zvlášť. Novou sadu založte s jedinečným SKU, fotografií dané sady, popisem a ověřenými parametry. Fotografie má lokální cestu `assets/real-wheels/...` nebo `assets/stock/...`. Parametry se v editoru zapisují po řádcích `Název: hodnota`.

Cena je konečná prodejní cena **jedné celé sady** v Kč. Daňový režim potvrzuje nastavení obchodu. Dokud cenu neznáte, nechte ji prázdnou a produkt nezveřejňujte. Příznak „Parametry a cena jsou ověřené“ je skutečné potvrzení odpovědnou obsluhou. Nevyplňujte ho odhadem podle fotografie, krytky nebo katalogového obrázku.

Nová sada má nulové množství. Tlačítkem **Pohyb** přidejte fyzicky převzaté celé sady a uveďte důvod nebo příjmový doklad. Záporný pohyb slouží pro opravu či výdej mimo objednávku a nemůže odebrat rezervované množství. Každý pohyb je evidovaný. Přepsání SKU či ceny neobchází skladové rezervace.

## Objednávky po aktivaci prodeje

- Objednávka vzniká s neměnným snímkem kontaktu, položek, ceny, dopravy, platby a úplného znění příslušných právních dokumentů. Server počítá částky sám a vyžaduje potvrzení stejné verze produktu a podmínek dopravy, jakou zákazník viděl.
- Stav **Čeká na platbu** rezervuje celé sady. Současný nákup poslední sady řeší jedna databázová transakce; opakovaný pokus se stejným klíčem nevytvoří druhou objednávku.
- **Zaplaceno** zvolte až po skutečném ověření úhrady v bance. Systém nemá bankovní párování ani platební bránu.
- **Vydáno / odesláno** odečte fyzickou zásobu a současně uvolní rezervaci. Tento krok následuje po zaplacení.
- **Zrušeno** u čekající/zaplacené objednávky uvolní rezervaci. Neprovádí automatickou refundaci. Peněžní vyrovnání se řeší samostatně a eviduje poznámkou.
- Rezervace zatím nemají automatickou expiraci. Obsluha musí pravidelně projít neuhrazené objednávky, postupovat podle dohodnuté splatnosti a neplatné rezervace výslovně zrušit. Po odeslání není možné objednávku přepnout na zrušenou a tím automaticky vrátit zboží do skladu. Vratka se přijímá samostatným kontrolovaným pohybem až po skutečném převzetí a kontrole.

## Individuální nabídky

Z poptávky lze po aktivaci připravit závaznou nabídku s přesnou specifikací, konečnou cenou, termínem a dopravou. Nabídka se po vydání nemění; místo změny ji odvolejte a vytvořte novou. Soukromý odkaz je dostupný pouze při vytvoření. Token je v fragmentu `#token=...`, ne v query URL, a v databázi je jen jeho otisk.

Odkaz předávejte pouze určenému zákazníkovi. Přijetí vyžaduje kontakt, adresu, souhlas s aktuálním zněním uvedeným v nabídce a výslovné tlačítko objednávky s povinností platby. Nabídka může vytvořit objednávku pouze jednou. Individuální nabídka sama nerezervuje skladový produkt; jde o jiný způsob prodeje.

## Co je nutné k aktivaci závazného prodeje

Produkční `TRANSACTIONAL_CONFIRMATIONS_READY` je záměrně `false`. Tuto pojistku nelze zapnout v administraci. Samotné přepnutí proměnné není zprovoznění potvrzení a nesmí být použito jako náhrada níže uvedené implementace.

1. Potvrdit skutečný daňový režim, bankovní účet, konečné ceny, skladové počty, způsob/cenu/termín dopravy, právní dokumenty a postup kontroly vhodnosti kola.
2. Zprovoznit a ověřit firemní e-mail. Vybrat skutečného poskytovatele odesílání, schválit jeho cenu a zpracování dat, nastavit SPF/DKIM a ověřit doručování.
3. Implementovat zpracování trvalé fronty `outbox` s idempotentním odesíláním, opakovanými pokusy, evidencí skutečného výsledku a dohledem nad chybami. Přijetí objednávky musí mít potvrzení na trvalém nosiči obsahující specifikaci, ceny, dopravu/platbu, kontaktní údaje a archivované právní znění platné při přijetí. Současná implementace poskytovatele ani odesílání nemá.
4. Otestovat reálné doručení, opakování požadavku, výpadek poskytovatele a obnovu z fronty. Teprve potom změnit serverovou pojistku a v administraci schválit prodej.

Poptávky, reklamace a žádosti o odstoupení lze evidovat už před aktivací prodeje. Veřejné odpovědi výslovně říkají, že e-mailové potvrzení není aktivní. Nejsou zde potvrzené platby, fakturace, účetní ERP, automatické refundace, dopravní štítky ani propojení s bankou. Správa skladu a objednávek tato napojení nenahrazuje.

## Technická obsluha

Příkazy spouštějte v `commerce/`. Lokální kontroly nemají měnit produkční zákaznická data.

```powershell
npm ci
npm run build
npm test
npx wrangler d1 migrations apply nfw-commerce --local --persist-to .wrangler/migration-check
```

`npm test` spouští Worker ve skutečném lokálním runtime Miniflare s izolovaným D1. Pokrývá autentizaci, CSRF/CORS, povolení prodeje, souběžné objednávky poslední sady, idempotenci, immutable snapshoty, změny ceny/specifikace/dopravy, nabídky, skladové přechody, uchování historie kontaktu a retenci. Testovací osoby používají doménu `.invalid` a nic se neodesílá.

Produkční migrace/deploy provádějte pouze na ověřeném účtu a existující databázi. Před změnou schématu ověřte zálohu a migrace. Použití `--remote` zapisuje do skutečné databáze. Secret `SECURITY_SECRET` musí být náhodný a předaný přes správu tajných proměnných Workeru; nikdy jej nepřidávejte do kódu nebo parametrů veřejné URL.

První administrátor vzniká příkazem `npm run bootstrap -- "Jméno obsluhy"`, který vytvoří lokální ignorované SQL a klíč. Existující soubory odmítne přepsat. Soubor SQL obsahuje jen otisk klíče; import musí obsluha provést do správné databáze. Soubory v `private/` mají omezená práva a nepatří do statického balíčku. Pro další inicializaci staré soubory nejprve bezpečně archivujte.

## Soukromí, retence a zálohy

Přístupové cookie jsou `Secure`, `HttpOnly`, `SameSite=Strict`. Veřejná API nemají credentialed CORS; povolené původy jsou výslovně vyjmenované. Data z formulářů jsou omezená a validovaná, texty v administraci se nevykonávají jako HTML. Aplikační log chyby neobsahuje formulář, e-mail, token ani SQL. Omezena jsou i automatická invocation logs; nelze tím vyloučit samostatné provozní logy poskytovatele.

Denní úloha v 02:17 UTC odstraňuje neuzavřené obchodní kontakty bez návazné objednávky po 365 dnech od poslední evidované komunikace. Odstraňuje jejich poznámky, zprávy ve frontě, související historii a osiřelý kontakt. Platná otevřená nabídka nebo navázaná objednávka smazání brání. Objednávky, reklamace a odstoupení se automaticky nemažou; provozovatel musí stanovit a provádět jejich odlišné retenční povinnosti. Nejde o neomezené oprávnění uchovávat osobní údaje.

Nastavte kontrolované zálohy/exporty databáze, přístup omezený na obsluhu a test obnovy. Zálohy se nezveřejňují a mají vlastní retenční lhůtu. Administrace zobrazuje posledních 200 záznamů CRM/objednávek, 300 pohybů/historie a nejvýše 500 produktů; dlouhodobé stránkování a řízený export je další rozšíření.

Technické podklady: [D1 transakční batch](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Workers static assets](https://developers.cloudflare.com/workers/static-assets/binding/), [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
