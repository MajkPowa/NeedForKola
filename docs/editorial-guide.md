# Jak přidávat články a realizace

Obsah se upravuje v jediném souboru: [js/editorial-data.js na GitHubu](https://github.com/MajkPowa/NeedForKola/blob/main/js/editorial-data.js). Blog i úvodní stránka si z něj vezmou nové články automaticky. Galerie používá pole `projects` v témže souboru.

Úpravy může uložit účet s právem zápisu do repozitáře **MajkPowa/NeedForKola**. Web nemá vlastní administraci ani přihlašování. Změna se zveřejní po uložení do větve `main` a dokončení nasazení GitHub Pages.

## Upravit existující článek

1. Otevři [editor souboru](https://github.com/MajkPowa/NeedForKola/edit/main/js/editorial-data.js) a přihlas se na GitHub.
2. Najdi článek podle `title`. Uprav text mezi uvozovkami. Nemaž okolní čárky, závorky ani názvy polí.
3. Prohlédni změny a klikni na **Commit changes…**. Napiš krátký popis, například „Upraven článek o povrchu kol“.
4. Ulož do `main`, pokud to oprávnění dovoluje. Pokud GitHub nabídne novou větev a pull request, změna se zveřejní až po jeho sloučení do `main`.
5. Dokončení nasazení uvidíš v [Actions](https://github.com/MajkPowa/NeedForKola/actions). Potom otevři [blog](https://majkpowa.github.io/NeedForKola/blog.html) a upravený článek. Případně obnov stránku přes Ctrl+F5.

`slug` je trvalá adresa článku. U vydaného článku jej nech stejný, aby dříve sdílené odkazy dál fungovaly. Podrobný postup editoru popisuje [dokumentace GitHubu](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files).

## Přidat nový článek

V souboru najdi `articles: [`. Za poslední článek přidej čárku a potom nový objekt podle tohoto vzoru. Ukázkové texty před zveřejněním nahraď vlastním obsahem.

```js
{
  slug: 'moje-nove-tema',
  title: 'Nadpis nového článku',
  excerpt: 'Krátký úvod pro kartu článku a jeho úvodní stránku.',
  category: 'Design & povrch',
  publishedAt: '2026-09-06',
  readMinutes: 3,
  cover: {
    src: 'assets/blog/moje-nove-tema.webp',
    alt: 'Konkrétní popis toho, co je na fotografii',
    caption: 'Popisek, případně autor fotografie.'
  },
  body: [
    { type: 'paragraph', text: 'První odstavec článku.' },
    { type: 'heading', text: 'Mezititulek' },
    { type: 'paragraph', text: 'Další odstavec článku.' },
    { type: 'list', items: ['První bod', 'Druhý bod'] },
    { type: 'callout', text: 'Jedna užitečná myšlenka ve zvýrazněném bloku.' }
  ],
  sources: [
    {
      label: 'Název skutečného zdroje',
      url: 'https://enkei.com/engineering/'
    }
  ]
}
```

- **slug:** unikátní malá písmena bez diakritiky, číslice a pomlčky; nejvýše 90 znaků. Například `jak-pecovat-o-kola`. Odkaz bude `clanek.html?slug=jak-pecovat-o-kola`.
- **title / excerpt:** nadpis a krátké shrnutí. Běžný text, žádné HTML.
- **category:** téma; tlačítko filtru se vytvoří samo. Použitím stejného názvu zachováš společnou kategorii.
- **publishedAt:** skutečné datum vydání ve formátu `YYYY-MM-DD`. Články se řadí od nejnovějších; budoucí datum samo neodkládá publikaci. Koncept nech mimo veřejný soubor, dokud jej nechceš vydat.
- **readMinutes:** celé kladné číslo. Odhadni čas podle délky článku.
- **body:** podporuje jen `paragraph`, `heading`, `list` a `callout`. HTML se neprovádí. Mezititulky vytvoří obsah článku automaticky.
- **sources:** skutečné podklady k technickým tvrzením. Povoleny jsou odkazy `https://`; pokud článek zdroje nepotřebuje, použij `sources: []`.

Text můžeš psát i s českou diakritikou. Uvnitř textu uzavřeného jednoduchými uvozovkami zapisuj případný apostrof jako `\'`, nebo použij české uvozovky „takto“. Každý odstavec patří do samostatné položky. Syntaxi zachovej jako u existujících článků; chybějící čárka či uvozovka může zabránit načtení celého souboru.

## Nahrát fotografie

Připrav si na počítači složku `blog` s fotografiemi. Otevři [složku assets na GitHubu](https://github.com/MajkPowa/NeedForKola/tree/main/assets), zvol **Add file → Upload files** a přetáhni do okna celou složku `blog`. Zkontroluj, že výsledná cesta je například `assets/blog/moje-nove-tema.webp`, a ulož změnu. Do článku potom vlož přesně tuto cestu. Další obrázky můžeš přidávat přímo do již existující složky. GitHub podporuje [nahrání souborů i složek přetažením](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

Pro blog jsou povolené lokální cesty v `assets/blog/`, `assets/images/`, `assets/reference/` a `assets/renders/`. Použij JPG, JPEG, PNG, WebP nebo AVIF; názvy bez mezer a diakritiky. V cestě nesmí být `..`, adresa cizího serveru ani `C:\…`. Na GitHub Pages záleží na velkých a malých písmenech.

Pro úvodní fotografii se hodí přibližně 1 600 px na šířku. Karta ji ořízne do širokého formátu, proto nech důležitý detail blízko středu. Komprimuj ji tak, aby se rychle načítala. Nahrávej vlastní fotografie nebo podklady, které smíš zveřejnit, a přidej požadované autorství.

## Přidat skutečnou realizaci

Pole `projects` je zatím prázdné. Dokud nepřidáš vlastní realizace, web poctivě uvádí, že jejich fotografie připravujeme; produktový detail nevydává za zákaznickou zakázku.

Připrav skutečné zákaznické fotografie, ke kterým máš právo zveřejnění. Nahraj je stejným postupem jako výše, tentokrát do **assets/projects/**. Do `projects: []` vlož položku:

```js
projects: [
  {
    title: 'Název skutečné realizace',
    vehicle: 'Přesný model, generace a rok vozu',
    wheel: 'Skutečně dodaný design a rozměr',
    finish: 'Skutečný povrch a barva',
    description: 'Krátký pravdivý popis této konkrétní zakázky.',
    images: [
      { src: 'assets/projects/zakazka-01.jpg', alt: 'Vůz na dodaných kolech z levého boku' },
      { src: 'assets/projects/zakazka-01-detail.jpg', alt: 'Detail skutečně dodaného disku' }
    ]
  }
]
```

První obrázek je úvodní fotografie karty; další se otevřou v galerii. Cesty musí začínat `assets/projects/` a končit `.jpg`, `.jpeg`, `.png`, `.webp` nebo `.avif`. Cizí webové adresy se nenačítají. Nenahrazuj chybějící realizaci ilustračním renderem ani smyšlenými údaji zákazníka. Více realizací odděl čárkou stejně jako články.

## Co web dělá automaticky

Blog načte nové položky, seřadí je, vytvoří filtry podle tématu a přidá je do upoutávek na úvodní stránce. Článek má vlastní odkaz, tlačítko pro jeho zkopírování, odkazy na zdroje a další čtení. Neznámý, neplatný nebo duplicitní parametr `slug` zobrazí stránku „Tenhle článek tady není“.

Obsah i metadata jednotlivého článku doplňuje JavaScript v prohlížeči. Některé sociální sítě jejich skripty nespouštějí, takže při sdílení mohou zobrazit obecný náhled blogu místo konkrétního nadpisu. Tento statický web negeneruje samostatné HTML pro každý článek ani neslibuje redakční CMS či automatické plánované publikování.

Součásti implementace: `blog.html`, `clanek.html`, `js/editorial-data.js`, `js/blog.js`, `css/editorial.css`; galerie používá také `js/projects.js`. Pro vložení upoutávek stačí kontejner `[data-blog-teasers]` a oba blogové skripty. Veřejné rozhraní `NFWBlog.renderTeasers(element, { limit: 2 })` vykresluje stejné karty bezpečně přes textové DOM uzly.

## Instagram a logo

Přesný profil Oarts zatím není doložený. V [js/oarts.js](https://github.com/MajkPowa/NeedForKola/edit/main/js/oarts.js) je proto `instagramUrl` prázdný. Po doplnění skutečné adresy ve tvaru `https://www.instagram.com/vas_profil/` se v patičkách automaticky zobrazí Instagram s ikonou. Nevkládej adresu jiného účtu ani odkaz na vyhledávání. Odkaz otevře nové okno.

Logo nyní vychází z dodané fotografie černé krytky: malé patkové „oarts“ se stříbrným povrchem a čtyřcípou hvězdou pod písmenem a. Soubor `assets/brand/oarts-logo.png` používají hlavičky, patičky i prostorové krytky. Je to digitální rekonstrukce fotografie; pokud později dostanete původní grafický soubor značky, může tento podklad nahradit. Původ a prompty úprav jsou zaznamenány v [media-sources.md](media-sources.md).
