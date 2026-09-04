# Licensed vehicle photographs

`data/vehicle-visuals.json` supplies a local reference photograph for each covered vehicle **model family**. It complements the separate, explicitly matched generation photographs in `data/vehicle-visual-variants.json`.

The 2026-09-05 build contains **401 photographs for all 401 requested model families across 53 brands**. All 401 source files are distinct. The local WebP set is approximately 45.5 MiB. This count describes model-family references, not exact photographs of every historical variant.

## Meaning of a model photograph

Every record here has `kind: "photo"` and `match: "model"`. A model photograph identifies that model family; it is **not** automatically the selected production year, facelift, body style, engine, or wheel configuration. The actual depicted vehicle is described in `depicted.label`. The interface must disclose model-level matching and use a separately verified variant image when one exists. Photographs retain their original wheels. These photographs are not rotatable 3D models or wheel fitment simulations.

The model-to-article crosswalk is curated in `tools/vehicle-wiki-titles.json`. Shared articles and rebadged vehicles need an explicitly identified image from `tools/vehicle-wiki-image-overrides.json`; blindly taking the lead photograph of a redirect would show the wrong badge or body. For example, the Subaru BRZ and Toyota GR86 share a Wikipedia article, while GMC Sierra and Chevrolet Silverado are documented together. Their selected photos remain different and explicitly identified. The EX40 record uses an explicitly labelled Volvo EX40 photograph instead of the XC40 article's combustion-model lead photo.

## Source and licensing

Photographs come from Wikimedia Commons. Each included image is checked through the [Commons Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo) for its source file, author, licence and image format. Only CC BY, CC BY-SA, CC0 and public-domain records are accepted; unsupported licences, noncommercial licences, logos and non-raster files are rejected. The specific licence and source remain attached to every record.

Author names are read from the image's `Artist` field, not inferred from the uploader. The build stores plain-text metadata; remote HTML is never passed through to the website. The source file page is stored in `sourceUrl`; `articleUrl` identifies the article used to establish the model identity. `sourceFile`, `sourceSha1` and the original plain-text `sourceDescription` preserve audit information.

The UI displays the photographer, a link to the exact Commons source file, and a link to the image's licence. A suitable compact credit is: **Photo: author · CC BY-SA 4.0**, with the author/source linking to the Commons file and the licence linking to its terms. Keep these credits when reusing the photographs. CC BY-SA photographs and any adaptations retain their stated share-alike licence; this does not relicense unrelated site code. Public-domain and CC0 images retain their provenance here as well. See [Commons reuse instructions](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) for the source's reuse guidance.

## Image processing and delivery

- Original frame and proportions are preserved. No artificial background removal, recolouring, AI generation or replacement of visible parts is performed.
- Orientation is normalised from EXIF, images are limited to 960 pixels wide, and a local WebP copy is encoded at quality 84.
- `processing` on each record declares this conversion. Source versions and attribution remain available through the manifest.
- All images used by the site are local under `assets/vehicles/`. The browser does not call Wikipedia, Commons, an image CDN or a search service at runtime.
- `thumb` currently points to the same optimised local image as `src`; the interface should lazy-load images below the fold.
- `assets/vehicles/qa/models-*.jpg` contain contact sheets for visual quality checks and are not website content.

## Rebuilding

Run `python tools/build-vehicle-visuals.py` with Pillow installed. The builder reads the curated title and image override files, obtains Wikipedia page-image identities and Commons metadata, validates licence and image type, downloads the approved image, and emits the manifest and contact sheets. `--models bmw/x5,skoda/octavia` rebuilds selected model records. HTTP responses and downloaded source bytes are cached in the ignored `tools/.cache-vehicle-visuals/` directory. API calls use a descriptive User-Agent, `maxlag`, small metadata batches and backoff.

The manifest's `coverage` object is the authoritative build count and includes reasons for any missing model. The builder never substitutes an unrelated generic car to fill a gap. A successful build alone does not establish matching to all historical generations: matching remains explicitly model-level unless the independent variant database supplies the exact photograph.

## Separately matched variants

`tools/build-vehicle-visual-variants.py` builds a separate selection of 27 explicitly matched photographs from its curated picks JSON: seven BMW X5 phases and twenty Škoda Octavia body/phase selections. Their identities are established from the source article's infoboxes and captioned galleries, and their Commons credits are retained in `data/vehicle-visual-variants.json`. The builder reuses the same `obtain_image` helper and metadata cache as the model photographs. Some X5 phases already have existing illustrative render assets in the site; the interface's precedence rules determine which visual is used.

These 27 references are photographs, not 27 physical 3D models, and do not imply complete visual coverage of the catalogue's 2,736 model, generation, facelift and body records. A model-level reference remains clearly labelled whenever an exact selection is unavailable.
