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
    projects: []
  };
})();
