# Jak spravovat skladová kola

Sekce je na [úvodní stránce v části Skladová kola](https://majkpowa.github.io/NeedForKola/#skladem). Obsah se upravuje v [js/stock-data.js](https://github.com/MajkPowa/NeedForKola/blob/main/js/stock-data.js). Pro úpravu otevři [GitHub editor](https://github.com/MajkPowa/NeedForKola/edit/main/js/stock-data.js), ulož potvrzené údaje a použij **Commit changes**. Veřejná změna se projeví po uložení do `main` a dokončení nasazení Pages; stav je v [Actions](https://github.com/MajkPowa/NeedForKola/actions).

Nyní nejsou dodány potvrzené skladové položky. `items: []` zůstává prázdné a `updatedAt: null`. Web uvádí, že aktuální nabídku doplňujeme, a umožňuje e-mailový dotaz. Neoznačuje sklad za vyprodaný. Stříbrné kolo v tomto stavu je výslovně ilustrační design.

## Přidat potvrzenou sadu

Do `items: []` vlož objekt s pravdivými údaji. Následující vzor není skutečná nabídka: zástupné texty a `null` nahraď ověřenými hodnotami. Cena je za **jednu celou sadu**, množství je počet **celých sad**.

```js
window.NFWStock = {
  updatedAt: '2026-09-06',
  items: [
    {
      id: 'sada-001',
      title: 'Skutečný název skladové sady',
      design: 'Skutečné označení designu',
      frontSize: 'Přesný rozměr předních kol včetně ET',
      rearSize: 'Přesný rozměr zadních kol včetně ET',
      color: 'Potvrzená barva',
      finish: 'Potvrzený povrch',
      pcd: 'Potvrzená rozteč PCD',
      centerBore: 'Potvrzený středový otvor CB v mm',
      wheelsPerSet: 4,
      quantity: null,
      price: { amount: null, currency: 'CZK', vatIncluded: null },
      image: {
        src: 'assets/stock/sada-001.webp',
        alt: 'Popis fotografie této skutečné skladové sady'
      },
      note: 'Pouze doplňující údaje, které pro tuto sadu skutečně platí.'
    }
  ]
};
```

V původním souboru už je obal `window.NFWStock = { … }`. Při přidávání pouze další položky kopíruj samotný objekt od `id` po `note`, včetně jeho složených závorek. Dvě položky odděl čárkou.

- `id` je jedinečný kód, malá písmena bez diakritiky, číslice a pomlčky. Přenáší se do e-mailové poptávky.
- `title` a kladné celé `quantity` jsou nutné pro zobrazení. `quantity: 2` znamená dvě kompletní sady, nikoli dva disky. Nulové, záporné a nepotvrzené množství se nenabízí; položku můžeš také z pole odstranit.
- `wheelsPerSet` je skutečný počet kol v jedné sadě. Nech hodnotu 4 jen tehdy, pokud sada opravdu obsahuje čtyři kola.
- Vyplň obě nápravy, i když mají stejné rozměry. Chybějící údaj se nezískává odhadem z druhé nápravy. `pcd` a `centerBore` jsou nepovinné; pokud je neznáš, pole vynech nebo nech prázdné. Vhodnost pro konkrétní auto se neodvozuje pouze z rozměru, PCD či CB.
- `price.amount` je číslo, například `25000`, nikoli text s měnou nebo mezerami. Podporované měny jsou `CZK` a `EUR`. `vatIncluded: true` zobrazí „včetně DPH“, `false` „bez DPH“, `null` žádné tvrzení o DPH. Potvrď daňový režim skutečné nabídky před jejím zveřejněním. Dokud cenu neznáš, ponech `amount: null`; zobrazí se „Cena na dotaz“.
- `updatedAt` změň na datum skutečné kontroly skladu ve formátu `YYYY-MM-DD`. Nevkládej automaticky dnešní datum bez kontroly. Bez potvrzeného data nech `null`.
- `note` je volitelný obyčejný text. Žádné pole se nevykonává jako HTML.

## Fotografie

Nahraj vlastní fotografie nebo fotografie, které smíš zveřejnit, do `assets/stock/`. Na GitHubu otevři [assets](https://github.com/MajkPowa/NeedForKola/tree/main/assets), použij **Add file → Upload files** a přetáhni složku `stock` s fotografiemi. Další snímky můžeš nahrávat přímo do již vytvořené složky.

Povoleny jsou `.jpg`, `.jpeg`, `.png`, `.webp` a `.avif`, názvy bez mezer a diakritiky. Cesta musí začínat `assets/stock/`; cizí URL ani lokální `C:\…` se nenačtou. Doporučená šířka je přibližně 1 600 px, rozumně komprimovaná. Fotografie má ukazovat uvedenou sadu. Chybějící nebo poškozený obrázek web označí textem; nenahradí jej fotografií jiné skladové položky.

## Co znamená poptávka

**Poptat sadu** otevře e-mail na `info@oarts.cz` s ID, specifikací a uvedenou cenou sady. Zájemce doplní vůz a požadovaný počet sad. Web nic sám neodesílá, nevytváří objednávku, neblokuje zásobu a nemá platební bránu. Dostupnost, cenu a vhodnost pro vůz je potřeba potvrdit v odpovědi; sklad se po poptávce automaticky neodečítá.

## Vložení sekce na stránku

```html
<link rel="stylesheet" href="css/stock.css?v=20260906-stock">

<section class="section" id="skladem" aria-labelledby="stockTitle">
  <div class="wrap">
    <div class="section__head">
      <div><span class="eyebrow">Aktuální nabídka</span><h2 id="stockTitle">Skladová kola</h2></div>
    </div>
    <div id="stockInventory"></div>
  </div>
</section>

<script src="js/stock-data.js?v=20260906-stock"></script>
<script src="js/stock.js?v=20260906-stock"></script>
```

Styly používají společné `style.css`, `premium.css` a `luxury.css`. Skripty načti v uvedeném pořadí za kontejnerem. Překreslení je dostupné jako `NFWStockView.render(element, data)`; veškerý obsah je sestaven bezpečnými textovými DOM uzly. Data jsou veřejná a statická, nemají vlastní CMS ani skladový backend.
