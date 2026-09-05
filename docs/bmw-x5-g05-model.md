# BMW X5 G05 2018 — skutečný 3D model

Model `assets/models/bmw-x5-g05.glb` vychází z oficiálního projektu [BMW Car IT GmbH: digital-car-3d](https://github.com/bmwcarit/digital-car-3d). [Dokumentace modelu](https://github.com/bmwcarit/digital-car-3d/blob/6261f53b5ac63c6686039d106fbbbfb693339d72/G05/README.md) výslovně identifikuje BMW X5 2018, generaci G05 před faceliftem. Nelze jej vydávat za E70, F15 ani facelift G05 z roku 2023.

## Licence a uvedení zdroje

BMW Car IT GmbH a přispěvatelé publikují projekt pod [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). [Licenční text ve zdroji](https://github.com/bmwcarit/digital-car-3d/blob/6261f53b5ac63c6686039d106fbbbfb693339d72/LICENSE.txt) je přiložen také jako `assets/models/bmw-x5-g05.LICENSE.txt`. Licence dovoluje kopírování, úpravy a distribuci, včetně komerčního použití, při uvedení autorství, zdroje, licence a provedených změn. Nepřidává oprávnění k ochranným známkám a nesmí být používána jako tvrzení o partnerství či schválení webu BMW.

Doporučená citace v rozhraní: **BMW X5 G05: BMW Car IT GmbH a přispěvatelé · CC BY 4.0 · upraveno pro Need For Wheels.** Odkazy na zdroj a licenci jsou v `data/bmw-x5-g05-model.json`.

Zdrojový commit: `6261f53b5ac63c6686039d106fbbbfb693339d72`. Skutečné soubory Git LFS byly dne 2026-09-05 staženy bez přihlášení z veřejného `media.githubusercontent.com/media/bmwcarit/digital-car-3d/master/`. Nejde o data extrahovaná ze hry ani o odvození z fotografie.

## Převod a rozhraní modelu

- Původní glTF díly byly sestaveny podle hierarchie, transformací a materiálů `G05/G05_main.rca`. Tři zrcadlené instance původního shaderu (kapota, vnější chrom, zadní sedadla) jsou zachovány jako skutečné uzly.
- Centimetry zdroje jsou převedeny na metry. Y míří vzhůru, příď do −X, geometrický střed X/Z je v nule a pneumatiky stojí na Y=0. Rozměry exportu jsou přibližně 4,934 × 2,242 × 1,736 m, šířka zahrnuje zrcátka.
- Karoserie, interiér, pneumatiky a brzdy zůstávají prostorovou geometrií. Materiály Ramses jsou adaptované na standardní glTF PBR, lak používá clearcoat, okna transmission a pneumatiky původní normálovou texturu.
- Původní disky, jejich šrouby, středové spojovací části a emblémy kol byly odstraněny. Čtyři samostatné prázdné uzly `WheelMount_F_L`, `WheelMount_F_R`, `WheelMount_B_L`, `WheelMount_B_R` mají světové měřítko 1, počátek v čelní rovině ráfku a místní osu +Z směrem ven.
- Poloměr disku v modelu je 0,2676 m, pneumatika přibližně 0,3752 m. Metadata uvádějí vizuální 21″ konfiguraci a přibližnou šířku 9,5″; tyto údaje nejsou homologovanou specifikací kompatibility.
- Materiály laku mají název `M_E_common_Paint`. Metadata anchorů, zdrojů a SHA-256 jsou v `data/bmw-x5-g05-model.json`.

Export používá `KHR_draco_mesh_compression`, má přibližně 5,47 MB a 427 717 vykreslovaných trojúhelníků vozu před přidáním zákaznických disků. Geometrie nebyla zjednodušena decimací. Proběhlo sjednocení duplicit, odstranění nepoužitých dat a Draco komprese se 16 bity pozic, 12 bity normál a 14 bity UV.

## Ověření

Optimalizovaný GLB byl načten skutečným Three.js GLTFLoaderem s Draco dekodérem. Přední a zadní pohled s `createWheel` konfigurací Apex10 byly vizuálně zkontrolovány; čtyři ráfky jsou prostorově zasazeny do původních pneumatik. Provozní render není bitmapou ani fotomontáží.

Khronos glTF Validator vrátil 0 chyb a 0 varování. Informativní hlášení zahrnují prázdné uzly a omezenou podporu kontroly Draco dat; samotná komprimovaná geometrie proto byla ověřena také skutečným Draco dekódováním při renderu. Report je v `tools/.cache-wheel-fit/3d-candidates/bmw-validation.json`.

Reprodukční a kontrolní soubory zůstávají v ignorované složce `tools/.cache-wheel-fit/3d-candidates/`: `assemble-bmw.py`, `optimize-bmw.mjs`, `bmw-review.html`, `bmw-review.cjs`, `bmw-front.png`, `bmw-rear.png`, originální zdroje a `bmw-official/assembly-report.json`. Produkční web potřebuje pouze optimalizovaný GLB, descriptor a licenční text.
