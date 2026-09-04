# Automobile brand identifiers

The brand search uses 53 locally stored raster PNG logos, one for every brand ID in `NFWVehicles.brands`. They identify the selected vehicle manufacturer. They do not indicate a partnership, endorsement, or authorised dealership relationship.

## Sources and rights

- Source collection: [filippofilip95/car-logos-dataset](https://github.com/filippofilip95/car-logos-dataset).
- Pinned source revision: [`bb2d661f28ce617dba8a51bdfc2069a3381a23b0`](https://github.com/filippofilip95/car-logos-dataset/tree/bb2d661f28ce617dba8a51bdfc2069a3381a23b0).
- The source collection credits [Carlogos.org](https://www.carlogos.org/) for its main image collection. CUPRA is supplied in the repository's own `local-logos` directory.
- Exact repository image URLs and upstream image URLs for every logo are recorded in [`assets/brands/sources.json`](../assets/brands/sources.json).
- The collection's README describes its project as MIT licensed, but that pinned revision contains no `LICENSE` file. We do **not** represent the manufacturer's logo artwork as MIT licensed. The README explicitly states that logo images belong to their respective owners and are subject to their own licensing terms. Manufacturer trademark and artwork rights remain with those owners.

These are recognizable brand identifiers from the source collection, which includes historical mark designs. They are not a claim that every image is the manufacturer's latest 2026 visual identity. The search retains each brand's written name alongside the logo for reliable identification.

Two catalogue entries combine related names: `land-rover-range-rover` uses the actual Land Rover emblem, and `ssangyong-kgm` uses the actual SsangYong emblem. The adjacent labels retain the complete combined catalogue names. `ds-automobiles` maps to the source collection's `ds` entry.

## Asset processing

Run `python tools/build-brand-logos.py` with Pillow installed to rebuild the assets from the pinned source. The build removes empty canvas margins, scales with Lanczos sampling, preserves the mark's colours and aspect ratio, and centres it on a transparent 160 × 112 pixel canvas. No logo has been redrawn, invented, recoloured, or replaced by a monogram. Several source images retain their own white canvas behind the artwork; render all logos on a light badge background for consistent contrast.

`js/brand-logos.js` exposes the frozen `window.NFWBrandLogos` map with `src`, `name`, and `source` for all 53 IDs. All browser image URLs are relative local paths. No external logo service, runtime CDN, or hotlink is required. `assets/brands/contact-sheet.jpg` is a build-time visual check, not a UI asset.

## Verification

- 53 unique PNGs; exact coverage of the catalogue brand IDs.
- Every image decodes at 160 × 112 pixels and contains visible artwork.
- Total PNG size: approximately 571 KiB.
- Full contact sheet visually inspected for recognisable, uncut marks.
