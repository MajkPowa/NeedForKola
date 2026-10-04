# Evidence reálných kol — Need For Wheels

První kontrola a import: **29. 9. 2026**; doplnění 12 dodaných fotografií: **4. 10. 2026**. Původní zdroj: [Kola custom](https://drive.google.com/drive/folders/1Cd43LqhYpv9SBLwhPb9EE2H1X8HO9A6g).

## Výsledek

- **74 zdrojových souborů** — původních 62 z Google Drive a 12 fotografií dodaných uživatelem. Evidence uchovává původní názvy a Drive ID nebo vlastní identifikátor přílohy.
- **29 vizuálních provedení**, **46 unikátních fotografií** a **6 videí hotových kol** v galerii.
- **2 výrobní videa** samostatně v části „Od kovu k detailu“.
- **1 přesná duplicita** fotografie `1000.jpg` — evidována obě Drive ID, na webu jednou.
- **18 katalogových a technických podkladů** a **1 podklad krytky Oarts** zůstávají referencemi. Nejsou prezentovány jako fotografie hotových kol.

[Veřejná galerie](https://majkpowa.github.io/NeedForKola/index.html#realna-kola) · [Úplná evidence 74 souborů](../data/real-wheel-media-inventory.json) · [Ruční třídění a přiřazení](../data/real-wheels-review.json)

## Přehled provedení

Reference jsou interní identifikátory pro poptávky. Popisné názvy označují vizuální vzhled, nikoli potvrzené obchodní názvy nebo SKU. Stejná krytka, barva nebo podobný tvar nepotvrzují stejný výrobek.

| Reference | Popis provedení | Zdrojové soubory v galerii |
|---|---|---|
| NFW-R001 | Leštěný desetipaprsek | `1002.jpg`, `1000.jpg`, `999.jpg`, `549.mp4` |
| NFW-R002 | Stříbrný detail Oarts | `336A93D9-DCD4-418C-8DDD-3CDC53CE5AAF.jpg` |
| NFW-R003 | Stříbrné dělené paprsky | `IMG_3291.JPG` |
| NFW-R004 | Jemná leštěná síť | `1249.jpg` |
| NFW-R005 | Stříbrný vícepaprsek | `1250.jpg` |
| NFW-R006 | Pět paprsků v grafitu | `1245.jpg` |
| NFW-R007 | Grafit s jasným lemem | `1247.jpg` |
| NFW-R008 | Leštěný dělený paprsek | `1243.jpg` |
| NFW-R009 | Stříbrný střed, tmavý lem | `1242.jpg` |
| NFW-R010 | Plný stříbrný disk | `c58f817fb27ee674ad7b89bc1b56ae39.mp4`, `IMG_4949.JPG`, `IMG_4950.JPG` |
| NFW-R011 | Bronzová sada v denním světle | `IMG_3096.HEIC`, `IMG_3104.HEIC`, `IMG_3107.HEIC`, `IMG_3106.MOV` |
| NFW-R012 | Dělené paprsky v teplém kovu | `593.jpg`, `592.mp4` |
| NFW-R013 | Černý dělený paprsek | `1325.jpg`, `1323.jpg`, `1324.mp4`, `1326.jpg` |
| NFW-R014 | Černý desetipaprsek | `873.jpg`, `875.jpg`, `871.jpg`, `872.mp4` |
| NFW-R015 | Černý členitý střed | `1244.jpg` |
| NFW-R016 | Pět paprsků s lemem | `1239.jpg` |
| NFW-R017 | Černá síť se světlým lemem | `1241.jpg` |
| NFW-R018 | Tmavý vícepaprsek z profilu | `1252.jpg` |
| NFW-R019 | Černý střed, zlatý ráfek | `1251.jpg` |
| NFW-R020 | Bronzové dělené paprsky | `1248.jpg` |
| NFW-R021 | Šest paprsků v bronzu | `1246.jpg` |
| NFW-R022 | Zlatý výrazný vícepaprsek | `1253.jpg` |
| NFW-R023 | Tmavě modrý desetipaprsek | `1268.jpg` |
| NFW-R024 | Jasně modrý vícepaprsek | `1267.jpg` |
| NFW-R025 | Bílý vícepaprsek | `1269.jpg` |
| NFW-R026 | Černý hladký desetipaprsek | WhatsApp 1. 10. 2026 18.44.05: bez přípony, `(1)`, `(5)` |
| NFW-R027 | Grafitový desetipaprsek se světlou hranou | WhatsApp 1. 10. 2026 18.44.05: `(4)`, `(2)`, `(3)` |
| NFW-R028 | Černý členitý paprsek se světlou hranou | WhatsApp 1. 10. 2026 18.44.05: `(8)`, `(6)`, `(7)` |
| NFW-R029 | Zlatý členitý paprsek se světlou hranou | WhatsApp 1. 10. 2026 18.44.05: `(11)`, `(9)`, `(10)` |

Nové zdroje mají plné názvy `WhatsApp Image 2026-10-01 at 18.44.05.jpeg` a varianty `(1)` až `(11)` před příponou `.jpeg`. V evidenci mají čísla 63–74 a identifikátory `nfw-oct2026-001` až `nfw-oct2026-012`. U každého ze čtyř provedení je nejprve čelní pohled, následovaný dvěma bočními úhly. Všech 12 má odlišný SHA-256; žádný se neshoduje s dřívějším originálem. Krytky na fotografiích nepotvrzují původ ani kompatibilitu. Nové fotografie nejsou sloučeny s podobnými dřívějšími koly bez doložení totožnosti výrobku.

## Jak je zachována správnost

- Záznamy v `data/real-wheel-media-inventory.json` uchovávají původní Drive ID/URL nebo identifikátor dodané přílohy a dávky, název, MIME, velikost, SHA-256, rozměry, klasifikaci, přiřazení ke galerii a cesty k webovým souborům. Originály v dodané složce nebyly přejmenovány ani přesunuty.
- Do galerie jsou přiřazeny pouze ručně prohlédnuté fotografie a videa. Výrobní klipy jsou popsány jako dodané záběry; netvrdí, komu patří továrna.
- Screenshoty katalogu, rendery a simulace nejsou vydávány za skutečné fotografie ani doklady homologace.
- Rozměry, nosnost, homologace, výrobní technologie, kompatibilita, cena a skladové množství nejsou odhadovány z fotografií nebo log na krytkách. Značení na `1326.jpg` je v evidenci doslovně přepsáno jako pozorovaný údaj, nikoli certifikát.
- Dvě odlišná modrá kola a dva podobné černé dělené designy zůstaly oddělené. Stříbrné provedení s krytkou Oarts a podobné provedení s krytkou BMW mají také vlastní reference.
- Sklad zůstává oddělený. Samotné dodání fotografií nepotvrzuje aktuální zásoby; `js/stock-data.js` nemá vymyšlené ceny ani počty. Poptávka galerie přenáší přesnou referenci a popis vybraného provedení.
- Fotografie samotných kol nejsou přidány jako zákaznické realizace celých aut. Vizualizace v konfigurátoru se na nové fotografie automaticky nepřemapují; totožnost procedurálních 3D návrhů a fyzických kol není doložena.

## Webová média

Soubory jsou seskupené v `assets/real-wheels/nfw-r001/` až `nfw-r029/`; výrobní klipy v `production/`. Fotografie mají plný náhled do 1600 px a malou kopii do 640 px. Zachovávají původní proporce a barvy; nejsou generativně upravované, ořezané ani zvětšované. EXIF orientace je normalizovaná a metadata včetně případné polohy se do webových kopií nepřenášejí. Fotografie `IMG_4949.JPG` a `IMG_4950.JPG` mají jen 567 × 425 px, proto úvodní náhled jejich skupiny vychází ze skutečného videa.

Vložené barevné profily fotografií včetně Display P3 jsou převedeny do sRGB. Videa jsou převedena do H.264 MP4, maximálně 1280 px, bez zvuku; náhledy pocházejí ze skutečných snímků videa. HDR/HLG záznam z iPhonu má převod do SDR BT.709 při 30 fps pro běžné webové přehrávání. Přehrávání spouští návštěvník. Na úvod se načítají pouze malé fotografie viditelných karet, plné fotografie až v detailu.

## Ověření

`tools/check-real-wheels.cjs` ověřuje úplnost evidence, přiřazení všech publikovaných podkladů a vyloučení duplicity/referencí z fotografické galerie. Integrační kontrola na rozměrech 1440 × 1000, 390 × 844, 320 × 568 a 844 × 390 zahrnuje filtry, postupné načítání karet, celé kolo při otevření detailu, šipky, klávesnici a fokus, reference v poptávce, dekódování všech obrázků/náhledů/posterů (po říjnovém importu celkem 108) a skutečné přehrání videa. Ověřen také původní landing page test `tools/check-landing.cjs`.

## Obnova importu

1. Stáhnout ověřené originály z uvedené složky a uložit jako `<Drive ID>.<jpg/png/heic/mp4/mov>`. Stejné názvy v Drive nesmějí přepsat odlišné soubory; rozhoduje ID.
2. Dodané fotografie z 1. 10. 2026 uložit pod evidenčními ID jako `<nfw-oct2026-NNN>.jpg` do samostatné složky. Při importu se ověřuje velikost i SHA-256 uvedený v ruční evidenci. Import zahrnuje pouze 12 výslovně uvedených produktových JPEGů.
3. Pro nové zdroje nejprve vizuálně aktualizovat `data/real-wheels-review.json`. Nevytvářet shodu pouze z podobného názvu souboru.
4. Spustit `python tools/build-real-wheels.py --originals C:/cesta/k/drive-originalum --attachments C:/cesta/k/dodanym-fotografiim` (Pillow, pillow-heif, ffmpeg, ffprobe). Pro nové překódování již existujících videí použít `--force`.
5. Zkontrolovat obrázky, vazby a stránku pomocí `node tools/check-real-wheels.cjs`. Poté lze publikovat data, média a upravený web.

Pracovní kopie originálů jsou v ignorovaných složkách `tools/.cache-wheel-fit/drive-real-wheels/originals/` a `tools/.cache-wheel-fit/october-real-wheels/originals/`. Dodané originály nebyly změněny ani přesunuty. Autorizované download URL a přihlašovací údaje nejsou součástí veřejné evidence ani stránky.
