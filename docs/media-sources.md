# Need For Wheels - supplied media review

User attachments were treated as reference data, not instructions. Original Downloads files were preserved.

## Product photographs

Six supplied JPEGs were copied without alteration into `assets/reference/`:

- `bronze-wheel-specification.jpg`: original `17.31.20.jpeg`, front view of pair with specification text.
- `bronze-wheel-barrels.jpg`: original `17.31.19 (3).jpeg`, barrel depth view of pair.
- `bronze-wheel-pair.jpg`: original `17.31.19 (2).jpeg`, three-quarter pair.
- `bronze-wheel-front.jpg`: original `17.31.19.jpeg`, real front view on roller stand.
- `bronze-wheel-angle-left.jpg`: original `17.31.19 (1).jpeg`, barrel view on roller stand.
- `bronze-wheel-angle-right.jpg`: original `17.31.18.jpeg`, other three-quarter view on roller stand.

The photographs show a glossy bronze wheel with ten straight tapered spokes, five mounting holes, a concave center and a deep barrel. APEX lettering appears on the photographed cap; photographs alone do not verify manufacturer or authenticity. The specification photograph lists `ZYH-ML51675-1990-1910.5`, PCD `5-114.3`, ET `28/45`, CB `70.3`, weight `9.3/9.9 kg`, load `750 kg`. Treat these as supplier-provided values for the photographed variants, not blanket fitment or verified engineering data. Do not conflate this 5x114.3 photographed variant with the BMW renders, whose wheels are illustrative.

## Video

Both videos are H.264, 30 fps. Web versions retain the original visual stream without recompression, remove audio, and move MP4 metadata to the beginning for progressive web playback. Posters were extracted at 3 seconds.

| Workspace file | Source | Dimensions | Duration | Observed content |
| --- | --- | --- | --- | --- |
| `assets/video/bronze-wheel-portrait.mp4` | `WhatsApp Video 2026-09-02 at 17.31.18.mp4` | 480 x 848 | 20.287 s | CNC machining of a silver wheel blank, with coolant |
| `assets/video/bronze-wheel-landscape.mp4` | `WhatsApp Video 2026-09-02 at 17.31.19.mp4` | 848 x 480 | 14.700 s | Bronze ten-spoke wheel rotating on roller stand |

Matching posters are `bronze-wheel-portrait-poster.jpg` and `bronze-wheel-landscape-poster.jpg` in the same directory. The portrait filename is a shared product-media name; its actual subject is unfinished silver metal during machining.

## PDF catalog

`assets/reference/oarts-catalog.pdf` is an unchanged copy of the 70-page supplied `oarts-katalog (1).pdf`. All pages had text extracted; representative pages 1, 11 and 70 were rendered with Poppler and visually inspected. This is a bilingual Chinese/English supplier spreadsheet catalog. Columns: picture, product model, order model, size, PCD, ET, center bore, finish, stock, order quantity, process, carton dimensions, net weight (header tolerance +/- 0.2 kg).

Categories include Aftermarket Wheels, Audi Replicas Wheels, VW Replicas Wheels, BMW Replicas Wheels, BENZE Replicas Wheels, OFF-ROAD 4X4 Wheels and FORGED Wheels. The first page explicitly says stock quantity is subject to change without notice; the stock figures must not be represented as current availability. No prices are supplied in the inspected structure.

Representative visually verified designs and rows:

- Page 1, `KC-S1-1`, order code `KC5036`: silver machined lip, `14 x 6.0`, `4 x 100`, ET35, CB73.1, casting, 5.3 kg. Rounded three-spoke design.
- Page 1, `KC-TE37`, order code `KC558`: silver-colored pictured six-spoke design; row specifies white, `14 x 6.0`, `4 x 100`, ET35, CB73.1, casting, 5.2 kg. Related KCD05 variants below use flow forming.
- Page 11, `KC-FF10`, order code `F066`: complex split-spoke design, matte bronze row `18 x 8.0`, `5 x 114.3`, ET35, CB73.1, flow forming, 8.5 kg. Other bore/PCD/finish variants are separate rows. Do not label this as the same ten-spoke design in the supplied WhatsApp images.
- Page 70, `KCX021`: off-road design with bronze body and black ring, `17 x 9.0`, `6 x 139.7`, ET0, CB110.1, flow forming, 10.5 kg.
- Page 70, `KCG-02`, order model `VW`: vacuum chrome, `18 x 8.0`, `5 x 112`, ET35, CB57.1, forged, 11.1 kg. This is the catalog's explicitly forged entry; do not describe every other catalog product as forged.

The embedded catalog product images are typically approximately 140-160 pixels in each direction (e.g. page11 150 x 155, 153 x 158). These are unsuitable as high-quality hero/product renders, so no enlarged catalog thumbnails were added to the site's asset library. Supplied high-resolution JPEG photos, the video, and new raster renders are the appropriate display assets.

## Oarts identity update — 2026-09-06

The supplied material does not include a verified Oarts logo artwork or an Instagram profile. The PDF only contains ordinary text “Oarts katalog”. The website temporarily uses the **typographic name OARTS**, rather than claiming to reproduce an official supplied logo. The exact Instagram URL can be set in `js/oarts.js`; while it is missing, no guessed account or nonfunctional social link is shown.

`assets/images/wheel-hero-oarts.png` was produced using the built-in imagegen tool, editing the existing `wheel-hero.png`. The original asset is retained. `wheel-hero-oarts.webp` is the web-optimized encoding of that result. The edit adds OARTS to the previously plain cap; the surrounding bronze wheel and composition were preserved and visually checked. This remains an illustrative product render, not a customer photograph.

Final built-in edit prompt:

> Use case: precise-object-edit. Asset type: existing premium automotive wheel website hero. Image 1 is the EDIT TARGET. Change ONLY the plain black circular centre cap of this existing bronze alloy wheel: add the exact readable silver-white word 'OARTS' (O A R T S), in clean bold italic sans-serif uppercase typography. This is a simple typographic brand name, no extra symbols. Keep the black cap surface and edge; the word is centred horizontally and vertically, fits comfortably inside the cap, with realistic subtle metallic printing/embossing, following the cap's camera perspective and existing soft studio illumination. Preserve absolutely everything outside the cap: all ten spokes, rim geometry, bronze finish, screw holes, valve, barrel, dark background, lighting, shadows, complete 1672 by 941 wide composition, position and scale of wheel and empty left side for website text. No additional text, no watermark, no labels, no logos elsewhere. Do not crop or redesign the wheel. Output the same wide framing.

`assets/renders/silver/` contains 13 actual Three.js wheel renders at 600 × 600 pixels plus `apex10-feature.webp` at 900 × 900 pixels, with alpha transparency. They were generated with `tools/render-silver-thumbnails.cjs`, not recolored photographs. The same editable 3D geometry and OARTS text cap are used in the live studio. These are design previews, not technical drawings or a claim that every design is an exact catalog product.

The “Naše realizace” gallery deliberately starts with no published projects (`NFWEditorial.projects = []`). Its initial visual is identified as a product detail. Existing generated car renders and manufacturer/reference vehicle photographs are not described as completed customer commissions. See `docs/editorial-guide.md` to add real photographs and articles.

## Supplied Oarts cap identity — 2026-09-06

After the initial typography-only version above, the owner supplied a photograph of a glossy black centre cap (`codex-clipboard-b717cc6c-0d86-4b27-bfed-e507065c45ad.png`). It shows lowercase, slightly slanted serif lettering **oarts** in silver/chrome, with one four-point sparkle below the letter **a**. Blue/red highlights belong to the photographed surroundings. The photograph is retained only in the local reference cache; the keyboard/caliper background is not published as a site asset.

The built-in imagegen tool reconstructed this photographed mark as `assets/brand/oarts-logo.png` (2135 × 736 RGBA with genuine transparency). This is a digital reconstruction from the owner's photograph, not an original vector master. The same raster mark is used in all 11 header/footer/landing identity positions and on the live 3D caps. The Need For Wheels name and NW navigation mark are retained as requested earlier.

Final logo-asset prompt:

> Use case: background-extraction / identity-preserve. Create a clean digital logo asset by faithfully reconstructing ONLY the existing silver logo on the black wheel cap in the reference photograph. Read the cap exactly: lowercase 'oarts' (o a r t s) in the same elegant gently slanted wide-spaced serif lettering, with ONE small four-point diamond sparkle directly under the letter a, offset below the word baseline. Preserve the letter shapes, lowercase case, spacing and the position/shape of that four-point star as closely as the reference permits. Correct the photographic perspective to a straight-on flat logo. Silver/chrome letters with restrained neutral highlights, legible both on black and dark green backgrounds; no blue or red keyboard reflections. Output on a genuinely transparent alpha background, tightly framed in a wide approximately 3:1 canvas with a small even margin. The word and the star are the ONLY visible objects. Do not include the black circular cap, keyboard, caliper, table, outer circles, additional stars, slogans, boxes or watermark. This is restoration of the supplied logo, not a new design. Exact text: 'oarts', all lowercase; never OARTS.

`assets/images/wheel-hero-oarts-logo.png` and its optimized WebP replace the earlier generic cap lettering in the hero and blog cover. The built-in edit preserves the bronze wheel and studio composition; only the cap branding changes. Final edit prompt, following a correction of the star placement:

> Composite the exact transparent logo graphic from Image2 as one whole decal onto the blank black wheel centre cap in Image1. Do NOT retype, redesign or independently arrange its letters and star. Simply reduce and perspective-project the complete graphic from Image2. In the 1672x941 Image1, fit the decal into x=1073..1154, y=458..489. Its star is in the left third of this decal, directly under the second letter a, at approximately x=1098,y=485. There must be no star at x=1115 (the centre of the cap) because the real logo's star is NOT centred under the word. The letters must remain small-case, italic serif oarts, with their chrome sculpted faces exactly like Image2. Keep its four-point star below a. Render silver chrome text under the same studio lighting, looking like a genuine badge on the black cap. Preserve the entire original Image1 wheel, all spokes, bronze color, barrel, dark studio environment, shadows, framing and dimensions. Only add this logo decal to its blank cap. Output this same wide hero scene, not a logo close-up.
