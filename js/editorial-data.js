/* Need For Wheels — obsah blogu a galerie.
 * Návod: docs/editorial-guide.md. Pište obyčejný text, nikoli HTML.
 * Nový článek vložte do articles. Skutečné realizace patří do projects.
 */
(function () {
  'use strict';
  window.NFWEditorial = {
    articles: [
      {
        slug: 'kovana-kola-a-flow-forming',
        title: 'Kovaná kola a flow forming. V čem je rozdíl?',
        excerpt: 'Dva výrobní postupy, které se často potkávají v jednom rozhovoru. Co skutečně znamenají a na co se ptát při výběru kol.',
        category: 'Technologie',
        publishedAt: '2026-09-06',
        readMinutes: 3,
        cover: {
          src: 'assets/reference/bronze-wheel-angle-right.jpg',
          alt: 'Bronzový disk z boku s viditelným ráfkem a konkávními paprsky',
          caption: 'Detail dodaného bronzového disku. Fotografie ilustruje tvar kola; sama neurčuje výrobní postup.'
        },
        body: [
          { type: 'paragraph', text: 'Paprsky vidíš hned. Způsob, jakým kolo vzniklo, už z fotografie spolehlivě nepoznáš. Kování a flow forming popisují práci s materiálem. Pro rozumný výběr je dobré vědět, jaký polotovar výrobce použil a kterou část kola dál tvaroval.' },
          { type: 'heading', text: 'Kování začíná polotovarem' },
          { type: 'paragraph', text: 'BBS popisuje výrobu kovaného kola jako několik kroků lisování zahřátého hliníkového polotovaru. Následuje další zpracování a obrábění do výsledného tvaru. Kování mění strukturu materiálu; samo označení „forged“ ale ještě neříká, kolik bude konkrétní kolo vážit.' },
          { type: 'heading', text: 'Flow forming tvaruje ráfek' },
          { type: 'paragraph', text: 'U flow forming kol BBS se vychází z odlitého polotovaru. Rotující válce za tepla vytahují jeho ráfkovou část do požadované šířky. Enkei obdobně popisuje svůj postup MAT jako spojení jednodílného odlitku a rotačního tváření ráfku. Je proto užitečné rozlišovat čelní část s paprsky a samotný ráfek.' },
          { type: 'callout', text: 'Důležitý detail: BBS používá rotační tváření ráfku i při výrobě kovaných kol. Ptej se tedy na celý výrobní postup a původ polotovaru, ne pouze na jedno slovo v názvu.' },
          { type: 'heading', text: 'Porovnávej konkrétní kola' },
          { type: 'paragraph', text: 'Enkei při vývoji odděluje pevnost materiálu a tuhost celého kola. Tuhost ovlivňuje také průřez, rozmístění paprsků a profil ráfku. Samotné minimum kilogramů proto není úplným popisem dobrého návrhu.' },
          { type: 'paragraph', text: 'Pro vlastní rozhodnutí si dej vedle sebe stejné rozměry a stejné určení. Teprve potom má smysl porovnávat doloženou hmotnost, parametry a podklady výrobce. Univerzální věta, že každé kované kolo musí být lehčí než jakékoli flow forming kolo, ti při skutečném výběru moc nepomůže.' },
          { type: 'list', items: ['Jaký je přesný výrobní postup daného modelu?', 'Jaká hmotnost a nosnost jsou uvedeny pro vybraný rozměr?', 'Odpovídají rozměry, upevnění a prostor kolem brzd konkrétnímu autu?', 'Jaké dokumenty výrobce k tomuto provedení poskytuje?'] },
          { type: 'paragraph', text: 'Začni autem a požadovaným vzhledem. Technické provedení pak řeš nad konkrétním návrhem. Zkušenost výrobců je dobrou oporou pro otázky; označení technologie samo o sobě nenahradí specifikaci tvých kol.' }
        ],
        sources: [
          { label: 'BBS — postup výroby kovaných kol', url: 'https://www.bbs.com/en/technology/forging' },
          { label: 'BBS — flow forming odlitých polotovarů', url: 'https://www.bbs.com/en/technology/flow-forming' },
          { label: 'Enkei — materiál, tuhost a technologie MAT', url: 'https://enkei.com/engineering/' }
        ]
      },
      {
        slug: 'jak-vybrat-design-a-povrch-disku',
        title: 'Design a povrch disků: najdi svůj vlastní styl.',
        excerpt: 'Čisté paprsky, výrazný konkáv, stříbro nebo grafit. Jednoduchý postup, jak vybírat tak, aby celek dával smysl.',
        category: 'Design & povrch',
        publishedAt: '2026-09-06',
        readMinutes: 3,
        cover: {
          src: 'assets/images/wheel-hero-oarts-silver.webp',
          alt: 'Stříbrný desetipaprskový disk Oarts ve studiovém světle',
          caption: 'Ilustrační studiový render stříbrného desetipaprskového designu. Odstín a odlesky ovlivňuje osvětlení.'
        },
        body: [
          { type: 'paragraph', text: 'Nejlepší začátek není dlouhý seznam barev. Vyber si jednu představu: má kolo s autem klidně splynout, nebo být první věcí, které si všimneš? Tuhle odpověď si nech jako vodítko pro všechny další detaily.' },
          { type: 'heading', text: 'Nejdřív silueta, potom detail' },
          { type: 'paragraph', text: 'Na našem návrhu můžeš začít jednoduchými pěti paprsky, jemnějším desetipaprskem nebo hustší sítí. To je otázka vizuálního charakteru. Prohlédni si kolo samostatně i vedle linií karoserie a nech si v užším výběru jen dva designy.' },
          { type: 'paragraph', text: 'Počet paprsků ovšem není údaj o pevnosti. Enkei vysvětluje, že pro tuhost záleží také na jejich průřezu, rozmístění a tvaru ráfku. Vzhled proto vybírej očima, technické vlastnosti podle konkrétní dokumentace.' },
          { type: 'heading', text: 'Zkus barvu v několika pohledech' },
          { type: 'paragraph', text: 'Bronz, grafit, stříbrná nebo černá vytvoří se stejnou karoserií jiný celek. V konfigurátoru zkus nejprve výraznější kontrast a potom klidnější kombinaci. Přepínej přitom jen jednu věc: u stejného designu porovnej barvy, u stejné barvy povrchy. Výběr bude přehlednější.' },
          { type: 'list', items: ['Lesk zvýrazní odlesky a proměnu ploch při otáčení.', 'Satén působí jemněji, s méně ostrým odleskem.', 'Matný vzhled nechá více vyniknout samotnou siluetu.', 'Kartáčovaný vzhled přidává povrchu viditelnou směrovou strukturu.'] },
          { type: 'callout', text: 'Náhled na displeji ber jako pomůcku pro výběr. Finální odstín a povrch potvrď podle konkrétního vzorku nebo podkladů výrobce; světlo i nastavení obrazovky mění jejich vjem.' },
          { type: 'heading', text: 'Mysli také na běžnou péči' },
          { type: 'paragraph', text: 'U konkrétního povrchu si nech doporučit vhodný způsob mytí. RAYS ve svém návodu upozorňuje na abrazivní složky a silně kyselé či zásadité čističe, které mohou poškodit vzhled povrchu. Po jízdě v soli doporučuje důkladné opláchnutí vodou. Řiď se vždy pokyny výrobce svých kol a použitého přípravku.' },
          { type: 'heading', text: 'Nakonec už jen dolaď celek' },
          { type: 'paragraph', text: 'Až budeš mít jasno v designu a barvě, vrať se ke krytce a límci. Malý kontrast může stačit; nemusí soutěžit každý detail. Ulož si obě finální varianty a porovnej je ještě jednou s odstupem. Pak pošli návrh spolu s přesnou identitou auta k doladění rozměrů.' }
        ],
        sources: [
          { label: 'Enkei — jak návrh ovlivňuje tuhost kola', url: 'https://enkei.com/engineering/' },
          { label: 'RAYS — pokyny k používání a péči o kola (PDF)', url: 'https://www.rayswheels.co.jp/disclosures/en/manual_en.pdf' }
        ]
      }
    ],
    // Pouze skutečné realizace s právem zveřejnit jejich fotografie.
    projects: [
      {
        "id": "mustang-gt-50-gloss-black",
        "vehicle": "Mustang GT 5.0",
        "title": "Lesklá černá pro Mustang GT 5.0",
        "description": "Realizovaný custom projekt pro Mustang GT 5.0. Kola o průměru 20″ v lesklé černé, s rozdílnou šířkou a ET pro přední a zadní nápravu.",
        "wheel": "20×9J / 20×10,5J",
        "finish": "Lesklá černá",
        "specs": [
          {
            "label": "Přední náprava",
            "value": "20×9J · ET 28"
          },
          {
            "label": "Zadní náprava",
            "value": "20×10,5J · ET 45"
          },
          {
            "label": "Rozteč (PCD)",
            "value": "5×114,3"
          },
          {
            "label": "Středová díra (CB)",
            "value": "70,5 mm"
          },
          {
            "label": "Barva a povrch",
            "value": "Lesklá černá"
          }
        ],
        "images": [
          {
            "src": "assets/projects/mustang-gt-50-gloss-black/photo-front.webp",
            "thumb": "assets/projects/mustang-gt-50-gloss-black/photo-front-thumb.webp",
            "srcset": "assets/projects/mustang-gt-50-gloss-black/photo-front-thumb.webp 480w, assets/projects/mustang-gt-50-gloss-black/photo-front.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Čelní pohled",
            "alt": "Čelní pohled na vyrobené leskle černé kolo pro Mustang GT 5.0, s označením OARTS na ráfku.",
            "caption": "Fotografie vyrobeného leskle černého kola pro Mustang GT 5.0 s označením OARTS na ráfku."
          },
          {
            "src": "assets/projects/mustang-gt-50-gloss-black/photo-three-quarter.webp",
            "thumb": "assets/projects/mustang-gt-50-gloss-black/photo-three-quarter-thumb.webp",
            "srcset": "assets/projects/mustang-gt-50-gloss-black/photo-three-quarter-thumb.webp 480w, assets/projects/mustang-gt-50-gloss-black/photo-three-quarter.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Vyrobené kolo z úhlu",
            "alt": "Boční tříčtvrteční pohled na vyrobené leskle černé kolo pro Mustang GT 5.0.",
            "caption": "Fotografie profilu a paprsků hotového kola v lesklé černé."
          },
          {
            "src": "assets/projects/mustang-gt-50-gloss-black/supplier-technical.webp",
            "thumb": "assets/projects/mustang-gt-50-gloss-black/supplier-technical-thumb.webp",
            "srcset": "assets/projects/mustang-gt-50-gloss-black/supplier-technical-thumb.webp 480w, assets/projects/mustang-gt-50-gloss-black/supplier-technical.webp 1254w",
            "width": 1254,
            "height": 1254,
            "kind": "technical",
            "title": "Technický návrh",
            "alt": "Dodavatelský render leskle černého kola pro Mustang GT 5.0 s technickými údaji.",
            "caption": "Technický podklad dodavatele s návrhovou vizualizací."
          },
          {
            "src": "assets/projects/mustang-gt-50-gloss-black/supplier-three-quarter.webp",
            "thumb": "assets/projects/mustang-gt-50-gloss-black/supplier-three-quarter-thumb.webp",
            "srcset": "assets/projects/mustang-gt-50-gloss-black/supplier-three-quarter-thumb.webp 480w, assets/projects/mustang-gt-50-gloss-black/supplier-three-quarter.webp 942w",
            "width": 942,
            "height": 942,
            "kind": "visualization",
            "title": "Návrh z úhlu",
            "alt": "Dodavatelský tříčtvrteční render leskle černého kola pro Mustang GT 5.0.",
            "caption": "Návrhová vizualizace dodavatele před výrobou."
          },
          {
            "src": "assets/projects/mustang-gt-50-gloss-black/supplier-profile.webp",
            "thumb": "assets/projects/mustang-gt-50-gloss-black/supplier-profile-thumb.webp",
            "srcset": "assets/projects/mustang-gt-50-gloss-black/supplier-profile-thumb.webp 480w, assets/projects/mustang-gt-50-gloss-black/supplier-profile.webp 1280w",
            "width": 1280,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh profilu",
            "alt": "Dodavatelský render bočního profilu leskle černého kola pro Mustang GT 5.0.",
            "caption": "Návrhová vizualizace dodavatele s pohledem na šířku ráfku."
          }
        ],
        "videos": [
          {
            "src": "assets/projects/mustang-gt-50-gloss-black/video-turntable.mp4",
            "poster": "assets/projects/mustang-gt-50-gloss-black/video-turntable-poster.webp",
            "thumb": "assets/projects/mustang-gt-50-gloss-black/video-turntable-thumb.webp",
            "width": 848,
            "height": 480,
            "kind": "video",
            "title": "Vyrobené kolo v pohybu",
            "caption": "Video vyrobeného leskle černého kola pro Mustang GT 5.0, otáčeného na podstavci."
          }
        ]
      },
      {
        "id": "lamborghini-urus-matte-tx-gold-machined",
        "vehicle": "Lamborghini Urus",
        "title": "Matná TX zlatá s frézovaným čelem",
        "description": "Realizovaný custom projekt pro Lamborghini Urus. Kola o průměru 23″ s rozdílnou šířkou a ET pro přední a zadní nápravu. Matnou TX zlatou doplňuje frézované čelo.",
        "wheel": "23×10J / 23×11,5J",
        "finish": "Matná TX zlatá s frézovaným čelem",
        "specs": [
          {
            "label": "Přední náprava",
            "value": "23×10J · ET 20"
          },
          {
            "label": "Zadní náprava",
            "value": "23×11,5J · ET 14"
          },
          {
            "label": "Rozteč (PCD)",
            "value": "5×130"
          },
          {
            "label": "Středová díra (CB)",
            "value": "71,6 mm"
          },
          {
            "label": "Barva a povrch",
            "value": "Matná TX zlatá s frézovaným čelem"
          }
        ],
        "images": [
          {
            "src": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-three-quarter.webp",
            "thumb": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-three-quarter-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-three-quarter-thumb.webp 480w, assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-three-quarter.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Vyrobené kolo z úhlu",
            "alt": "Vyrobené kolo pro Lamborghini Urus v matné TX zlaté s frézovaným čelem, v tříčtvrtečním pohledu.",
            "caption": "Fotografie vyrobeného kola v matné TX zlaté s frézovaným čelem."
          },
          {
            "src": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-front.webp",
            "thumb": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-front-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-front-thumb.webp 480w, assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-front.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Čelní pohled",
            "alt": "Čelní pohled na vyrobené kolo pro Lamborghini Urus v matné TX zlaté s frézovaným čelem.",
            "caption": "Fotografie finálního designu a matné TX zlaté s frézovaným čelem."
          },
          {
            "src": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-reverse-angle.webp",
            "thumb": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-reverse-angle-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-reverse-angle-thumb.webp 480w, assets/projects/lamborghini-urus-matte-tx-gold-machined/photo-reverse-angle.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Opačný pohled",
            "alt": "Opačný boční úhel vyrobeného kola pro Lamborghini Urus v matné TX zlaté s frézovaným čelem, s viditelnou hloubkou ráfku.",
            "caption": "Fotografie profilu a paprsků hotového kola."
          },
          {
            "src": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-technical.webp",
            "thumb": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-technical-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-technical-thumb.webp 480w, assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-technical.webp 1254w",
            "width": 1254,
            "height": 1254,
            "kind": "technical",
            "title": "Technický návrh",
            "alt": "Dodavatelský render kola pro Lamborghini Urus v matné TX zlaté s frézovaným čelem a technickými údaji.",
            "caption": "Technický podklad dodavatele s návrhovou vizualizací."
          },
          {
            "src": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-three-quarter.webp",
            "thumb": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-three-quarter-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-three-quarter-thumb.webp 480w, assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-three-quarter.webp 1280w",
            "width": 1280,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh z úhlu",
            "alt": "Dodavatelský tříčtvrteční render kola pro Lamborghini Urus v matné TX zlaté s frézovaným čelem.",
            "caption": "Návrhová vizualizace dodavatele před výrobou."
          },
          {
            "src": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-profile.webp",
            "thumb": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-profile-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-profile-thumb.webp 480w, assets/projects/lamborghini-urus-matte-tx-gold-machined/supplier-profile.webp 1280w",
            "width": 1280,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh profilu",
            "alt": "Dodavatelský render bočního profilu kola pro Lamborghini Urus v matné TX zlaté s frézovaným čelem.",
            "caption": "Návrhová vizualizace dodavatele s pohledem na šířku ráfku."
          }
        ]
      },
      {
        "id": "rolls-royce-ghost-2017-brushed-silver",
        "vehicle": "Rolls-Royce Ghost 2017",
        "title": "Broušené stříbro se šedým okrajem",
        "description": "Realizovaný custom projekt pro Rolls-Royce Ghost 2017. Kola o průměru 24″ a šířce 10J pro obě nápravy, s rozdílným ET vpředu a vzadu. Broušený stříbrný povrch doplňuje šedý okraj.",
        "wheel": "24×10J",
        "finish": "Broušený stříbrný povrch se šedým okrajem",
        "specs": [
          {
            "label": "Přední náprava",
            "value": "24×10J · ET 25"
          },
          {
            "label": "Zadní náprava",
            "value": "24×10J · ET 33"
          },
          {
            "label": "Rozteč (PCD)",
            "value": "5×120"
          },
          {
            "label": "Středová díra (CB)",
            "value": "72,6 mm"
          },
          {
            "label": "Povrchová úprava",
            "value": "Broušený stříbrný povrch se šedým okrajem"
          }
        ],
        "images": [
          {
            "src": "assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-three-quarter.webp",
            "thumb": "assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-three-quarter-thumb.webp",
            "srcset": "assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-three-quarter-thumb.webp 480w, assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-three-quarter.webp 567w",
            "width": 567,
            "height": 425,
            "kind": "photo",
            "title": "Vyrobené kolo z úhlu",
            "alt": "Vyrobené kolo pro Rolls-Royce Ghost 2017 v kartáčované stříbrné s šedým okrajem, v bočním tříčtvrtečním pohledu.",
            "caption": "Fotografie vyrobeného kola s broušeným stříbrným povrchem a šedým okrajem."
          },
          {
            "src": "assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-front.webp",
            "thumb": "assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-front-thumb.webp",
            "srcset": "assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-front-thumb.webp 480w, assets/projects/rolls-royce-ghost-2017-brushed-silver/photo-front.webp 567w",
            "width": 567,
            "height": 425,
            "kind": "photo",
            "title": "Čelní pohled",
            "alt": "Čelní pohled na vyrobené kolo pro Rolls-Royce Ghost 2017 v kartáčované stříbrné s šedým okrajem.",
            "caption": "Fotografie finálního designu pro Rolls-Royce Ghost 2017."
          },
          {
            "src": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-technical.webp",
            "thumb": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-technical-thumb.webp",
            "srcset": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-technical-thumb.webp 480w, assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-technical.webp 1377w",
            "width": 1377,
            "height": 1142,
            "kind": "technical",
            "title": "Technický návrh",
            "alt": "Dodavatelský render kola pro Rolls-Royce Ghost 2017 v kartáčované stříbrné s šedým okrajem a technickými údaji.",
            "caption": "Technický podklad dodavatele s návrhovou vizualizací."
          },
          {
            "src": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-three-quarter.webp",
            "thumb": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-three-quarter-thumb.webp",
            "srcset": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-three-quarter-thumb.webp 480w, assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-three-quarter.webp 1544w",
            "width": 1544,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh z úhlu",
            "alt": "Dodavatelský tříčtvrteční render kola pro Rolls-Royce Ghost 2017 v kartáčované stříbrné s šedým okrajem.",
            "caption": "Návrhová vizualizace dodavatele před výrobou."
          },
          {
            "src": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-profile.webp",
            "thumb": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-profile-thumb.webp",
            "srcset": "assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-profile-thumb.webp 480w, assets/projects/rolls-royce-ghost-2017-brushed-silver/supplier-profile.webp 1544w",
            "width": 1544,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh profilu",
            "alt": "Dodavatelský render bočního profilu kola pro Rolls-Royce Ghost 2017 v kartáčované stříbrné s šedým okrajem.",
            "caption": "Návrhová vizualizace dodavatele s pohledem na šířku ráfku."
          }
        ],
        "videos": [
          {
            "src": "assets/projects/rolls-royce-ghost-2017-brushed-silver/video-turntable.mp4",
            "poster": "assets/projects/rolls-royce-ghost-2017-brushed-silver/video-turntable-poster.webp",
            "thumb": "assets/projects/rolls-royce-ghost-2017-brushed-silver/video-turntable-thumb.webp",
            "width": 848,
            "height": 480,
            "kind": "video",
            "title": "Vyrobené kolo v pohybu",
            "caption": "Video vyrobeného kola pro Rolls-Royce Ghost 2017. Broušený stříbrný povrch, šedý okraj a celý profil při otáčení na podstavci."
          }
        ]
      },
      {
        "id": "lamborghini-urus-gloss-black-machined",
        "vehicle": "Lamborghini Urus",
        "title": "Lesklá černá s frézovaným čelem",
        "description": "Realizovaný custom projekt pro Lamborghini Urus. Kola o průměru 23″ s rozdílnou šířkou a ET pro přední a zadní nápravu. Lesklou černou doplňuje frézované čelo.",
        "wheel": "23×10J / 23×11,5J",
        "finish": "Lesklá černá s frézovaným čelem",
        "specs": [
          {
            "label": "Přední náprava",
            "value": "23×10J · ET 20"
          },
          {
            "label": "Zadní náprava",
            "value": "23×11,5J · ET 14"
          },
          {
            "label": "Rozteč (PCD)",
            "value": "5×130"
          },
          {
            "label": "Středová díra (CB)",
            "value": "71,6 mm"
          },
          {
            "label": "Povrchová úprava",
            "value": "Lesklá černá s frézovaným čelem"
          }
        ],
        "images": [
          {
            "src": "assets/projects/lamborghini-urus-gloss-black-machined/photo-three-quarter.webp",
            "thumb": "assets/projects/lamborghini-urus-gloss-black-machined/photo-three-quarter-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-gloss-black-machined/photo-three-quarter-thumb.webp 480w, assets/projects/lamborghini-urus-gloss-black-machined/photo-three-quarter.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Vyrobené kolo z úhlu",
            "alt": "Vyrobené kolo pro Lamborghini Urus v lesklé černé s frézovaným čelem, v tříčtvrtečním pohledu.",
            "caption": "Fotografie vyrobeného kola v lesklé černé s frézovaným čelem."
          },
          {
            "src": "assets/projects/lamborghini-urus-gloss-black-machined/photo-front.webp",
            "thumb": "assets/projects/lamborghini-urus-gloss-black-machined/photo-front-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-gloss-black-machined/photo-front-thumb.webp 480w, assets/projects/lamborghini-urus-gloss-black-machined/photo-front.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Čelní pohled",
            "alt": "Čelní pohled na vyrobené kolo pro Lamborghini Urus v lesklé černé s frézovaným čelem.",
            "caption": "Fotografie finálního designu s lesklým černým povrchem a frézovaným čelem."
          },
          {
            "src": "assets/projects/lamborghini-urus-gloss-black-machined/photo-reverse-angle.webp",
            "thumb": "assets/projects/lamborghini-urus-gloss-black-machined/photo-reverse-angle-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-gloss-black-machined/photo-reverse-angle-thumb.webp 480w, assets/projects/lamborghini-urus-gloss-black-machined/photo-reverse-angle.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Opačný pohled",
            "alt": "Opačný úhel vyrobeného kola pro Lamborghini Urus v lesklé černé s frézovaným čelem a viditelnou hloubkou ráfku.",
            "caption": "Fotografie profilu a paprsků hotového kola."
          },
          {
            "src": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-technical.webp",
            "thumb": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-technical-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-technical-thumb.webp 480w, assets/projects/lamborghini-urus-gloss-black-machined/supplier-technical.webp 1254w",
            "width": 1254,
            "height": 1254,
            "kind": "technical",
            "title": "Technický návrh",
            "alt": "Dodavatelský render páru kol pro Lamborghini Urus v lesklé černé s frézovaným čelem a technickými údaji.",
            "caption": "Technický podklad dodavatele s návrhovou vizualizací."
          },
          {
            "src": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-three-quarter.webp",
            "thumb": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-three-quarter-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-three-quarter-thumb.webp 480w, assets/projects/lamborghini-urus-gloss-black-machined/supplier-three-quarter.webp 1280w",
            "width": 1280,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh z úhlu",
            "alt": "Dodavatelský tříčtvrteční render páru kol pro Lamborghini Urus v lesklé černé s frézovaným čelem.",
            "caption": "Návrhová vizualizace dodavatele před výrobou."
          },
          {
            "src": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-profile.webp",
            "thumb": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-profile-thumb.webp",
            "srcset": "assets/projects/lamborghini-urus-gloss-black-machined/supplier-profile-thumb.webp 480w, assets/projects/lamborghini-urus-gloss-black-machined/supplier-profile.webp 1280w",
            "width": 1280,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh profilu",
            "alt": "Dodavatelský render bočního profilu páru kol pro Lamborghini Urus v lesklé černé s frézovaným čelem.",
            "caption": "Návrhová vizualizace dodavatele s pohledem na šířku ráfku."
          }
        ],
        "videos": [
          {
            "src": "assets/projects/lamborghini-urus-gloss-black-machined/video-turntable.mp4",
            "poster": "assets/projects/lamborghini-urus-gloss-black-machined/video-turntable-poster.webp",
            "thumb": "assets/projects/lamborghini-urus-gloss-black-machined/video-turntable-thumb.webp",
            "width": 848,
            "height": 480,
            "kind": "video",
            "title": "Vyrobené kolo v pohybu",
            "caption": "Video vyrobeného kola pro Lamborghini Urus. Celý profil, lesklá černá a frézované čelo při otáčení na podstavci."
          }
        ]
      },
      {
        "id": "ferrari-812-gunmetal-machined",
        "vehicle": "Ferrari 812",
        "title": "Gunmetal s frézovaným čelem",
        "description": "Realizovaný custom projekt pro Ferrari 812. Dvacetipalcová kola s rozdílnou šířkou a ET pro přední a zadní nápravu. Tmavě šedý povrch Gunmetal doplňuje frézované čelo.",
        "wheel": "20×10J / 20×11,5J",
        "finish": "Gunmetal (tmavě šedá) s frézovaným čelem",
        "specs": [
          {
            "label": "Přední náprava",
            "value": "20×10J · ET 42"
          },
          {
            "label": "Zadní náprava",
            "value": "20×11,5J · ET 50"
          },
          {
            "label": "Rozteč (PCD)",
            "value": "5×114,3"
          },
          {
            "label": "Středová díra (CB)",
            "value": "67,1 mm"
          },
          {
            "label": "Povrchová úprava",
            "value": "Gunmetal (tmavě šedá) s frézovaným čelem"
          }
        ],
        "images": [
          {
            "src": "assets/projects/ferrari-812-gunmetal-machined/photo-three-quarter.webp",
            "thumb": "assets/projects/ferrari-812-gunmetal-machined/photo-three-quarter-thumb.webp",
            "srcset": "assets/projects/ferrari-812-gunmetal-machined/photo-three-quarter-thumb.webp 480w, assets/projects/ferrari-812-gunmetal-machined/photo-three-quarter.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Vyrobené kolo z úhlu",
            "alt": "Vyrobené kolo pro Ferrari 812 v provedení gunmetal s frézovaným čelem, v tříčtvrtečním pohledu.",
            "caption": "Fotografie vyrobeného kola v provedení Gunmetal s frézovaným čelem."
          },
          {
            "src": "assets/projects/ferrari-812-gunmetal-machined/photo-front.webp",
            "thumb": "assets/projects/ferrari-812-gunmetal-machined/photo-front-thumb.webp",
            "srcset": "assets/projects/ferrari-812-gunmetal-machined/photo-front-thumb.webp 480w, assets/projects/ferrari-812-gunmetal-machined/photo-front.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Čelní pohled",
            "alt": "Čelní pohled na vyrobené kolo pro Ferrari 812 v provedení gunmetal s frézovaným čelem.",
            "caption": "Fotografie finálního designu s tmavě šedým povrchem a frézovaným čelem."
          },
          {
            "src": "assets/projects/ferrari-812-gunmetal-machined/photo-reverse-angle.webp",
            "thumb": "assets/projects/ferrari-812-gunmetal-machined/photo-reverse-angle-thumb.webp",
            "srcset": "assets/projects/ferrari-812-gunmetal-machined/photo-reverse-angle-thumb.webp 480w, assets/projects/ferrari-812-gunmetal-machined/photo-reverse-angle.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Opačný pohled",
            "alt": "Opačný úhel vyrobeného kola pro Ferrari 812 v provedení gunmetal s frézovaným čelem a viditelnou hloubkou ráfku.",
            "caption": "Fotografie profilu a paprsků hotového kola."
          },
          {
            "src": "assets/projects/ferrari-812-gunmetal-machined/supplier-technical.webp",
            "thumb": "assets/projects/ferrari-812-gunmetal-machined/supplier-technical-thumb.webp",
            "srcset": "assets/projects/ferrari-812-gunmetal-machined/supplier-technical-thumb.webp 480w, assets/projects/ferrari-812-gunmetal-machined/supplier-technical.webp 1254w",
            "width": 1254,
            "height": 1254,
            "kind": "technical",
            "title": "Technický návrh",
            "alt": "Dodavatelský render kola pro Ferrari 812 v provedení gunmetal s frézovaným čelem a technickými údaji.",
            "caption": "Technický podklad dodavatele s návrhovou vizualizací."
          },
          {
            "src": "assets/projects/ferrari-812-gunmetal-machined/supplier-three-quarter.webp",
            "thumb": "assets/projects/ferrari-812-gunmetal-machined/supplier-three-quarter-thumb.webp",
            "srcset": "assets/projects/ferrari-812-gunmetal-machined/supplier-three-quarter-thumb.webp 480w, assets/projects/ferrari-812-gunmetal-machined/supplier-three-quarter.webp 1280w",
            "width": 1280,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh z úhlu",
            "alt": "Dodavatelský tříčtvrteční render kola pro Ferrari 812 v provedení gunmetal s frézovaným čelem.",
            "caption": "Návrhová vizualizace dodavatele před výrobou."
          },
          {
            "src": "assets/projects/ferrari-812-gunmetal-machined/supplier-profile.webp",
            "thumb": "assets/projects/ferrari-812-gunmetal-machined/supplier-profile-thumb.webp",
            "srcset": "assets/projects/ferrari-812-gunmetal-machined/supplier-profile-thumb.webp 480w, assets/projects/ferrari-812-gunmetal-machined/supplier-profile.webp 1280w",
            "width": 1280,
            "height": 1280,
            "kind": "visualization",
            "title": "Návrh profilu",
            "alt": "Dodavatelský render bočního profilu kola pro Ferrari 812 v provedení gunmetal s frézovaným čelem.",
            "caption": "Návrhová vizualizace dodavatele s pohledem na šířku ráfku."
          }
        ]
      },
      {
        "id": "ferrari-812-gloss-black",
        "vehicle": "Ferrari 812",
        "title": "Kola na míru v lesklé černé",
        "description": "Realizovaný custom projekt pro Ferrari 812. Jednadvacetipalcová kola s rozdílnou šířkou a ET pro přední a zadní nápravu, dokončená celolakovaným lesklým černým povrchem.",
        "wheel": "21×10J / 21×11,5J",
        "finish": "Celolakovaná lesklá černá",
        "specs": [
          {
            "label": "Přední náprava",
            "value": "21×10J · ET 32"
          },
          {
            "label": "Zadní náprava",
            "value": "21×11,5J · ET 45"
          },
          {
            "label": "Rozteč (PCD)",
            "value": "5×114,3"
          },
          {
            "label": "Středová díra (CB)",
            "value": "67,1 mm"
          },
          {
            "label": "Povrchová úprava",
            "value": "Celolakovaná lesklá černá"
          }
        ],
        "images": [
          {
            "src": "assets/projects/ferrari-812-gloss-black/photo-three-quarter.webp",
            "thumb": "assets/projects/ferrari-812-gloss-black/photo-three-quarter-thumb.webp",
            "srcset": "assets/projects/ferrari-812-gloss-black/photo-three-quarter-thumb.webp 480w, assets/projects/ferrari-812-gloss-black/photo-three-quarter.webp 1600w",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Vyrobené kolo z úhlu",
            "alt": "Skutečně vyrobené leskle černé kolo pro Ferrari 812, s viditelnou hloubkou ráfku.",
            "caption": "Fotografie vyrobeného kola v celolakované lesklé černé."
          },
          {
            "src": "assets/projects/ferrari-812-gloss-black/photo-front.webp",
            "thumb": "assets/projects/ferrari-812-gloss-black/photo-front-thumb.webp",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Čelní pohled",
            "alt": "Čelní fotografie vyrobeného leskle černého kola pro Ferrari 812.",
            "caption": "Fotografie finálního designu a lesklého černého povrchu."
          },
          {
            "src": "assets/projects/ferrari-812-gloss-black/photo-reverse-angle.webp",
            "thumb": "assets/projects/ferrari-812-gloss-black/photo-reverse-angle-thumb.webp",
            "width": 1600,
            "height": 1200,
            "kind": "photo",
            "title": "Opačný pohled",
            "alt": "Fotografie vyrobeného kola pro Ferrari 812 z opačného úhlu.",
            "caption": "Fotografie profilu a paprsků hotového kola."
          },
          {
            "src": "assets/projects/ferrari-812-gloss-black/supplier-technical.webp",
            "thumb": "assets/projects/ferrari-812-gloss-black/supplier-technical-thumb.webp",
            "width": 1600,
            "height": 899,
            "kind": "technical",
            "title": "Technický návrh",
            "alt": "Dodavatelský technický podklad s návrhovou vizualizací kol pro Ferrari 812.",
            "caption": "Technický podklad dodavatele s návrhovou vizualizací."
          },
          {
            "src": "assets/projects/ferrari-812-gloss-black/supplier-three-quarter.webp",
            "thumb": "assets/projects/ferrari-812-gloss-black/supplier-three-quarter-thumb.webp",
            "width": 1139,
            "height": 640,
            "kind": "visualization",
            "title": "Návrh z úhlu",
            "alt": "Návrhová vizualizace předního a zadního kola pro Ferrari 812 z úhlu.",
            "caption": "Návrhová vizualizace dodavatele před výrobou."
          },
          {
            "src": "assets/projects/ferrari-812-gloss-black/supplier-profile.webp",
            "thumb": "assets/projects/ferrari-812-gloss-black/supplier-profile-thumb.webp",
            "width": 1139,
            "height": 640,
            "kind": "visualization",
            "title": "Návrh profilu",
            "alt": "Návrhová vizualizace profilu kol pro Ferrari 812 z bočního nadhledu.",
            "caption": "Návrhová vizualizace dodavatele s pohledem na šířku ráfku."
          }
        ]
      }
    ]
  };
})();
