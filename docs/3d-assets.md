# Need For Wheels: 3D assets and integration

## Renderer

`js/showroom.js` is a browser ES module, implemented with a local, pinned Three.js **r180 / 0.180.0**. It does not depend on a CDN or SVG wheel illustrations. Serve the project over HTTP(S); glTF loading and ES modules do not work from a `file:` URL.

Add this import map before the module script:

```html
<script type="importmap">
{"imports":{"three":"./assets/vendor/three/three.module.js","three/addons/":"./assets/vendor/three/addons/"}}
</script>
<script type="module" src="js/showroom.js"></script>
```

The module exposes `window.NFWShowroom` and emits `nfw:showroom-ready`. Its functions can also be imported as ES module exports.

```js
const studio = await NFWShowroom.mount(element, {
  mode: 'wheel', // 'car' is specifically Ferrari 458 Italia
  design: 'apex10', color: '#967044', finish: 'satin',
  width: 10, diameter: 20, autoRotate: true,
  bodyColor: '#303f4b', lip: 'same', cap: 'black',
  onReady: controller => {}, onError: error => {},
});
await studio.update({ design: 'mono5', color: '#34373b' });
studio.reset();
const dataURL = studio.capture('image/webp', .92);
studio.dispose();
```

Give the container an explicit height or aspect ratio. `mount` disposes any previous instance on the same element. `update` preserves the camera unless changing between wheel/car mode. ResizeObserver, visibility pausing, keyboard orbit/zoom, pointer orbit/zoom, reduced motion and context cleanup are included. The renderer reports failures with a visible Czech status and `onError`.

`renderThumbnail(options)` produces a WebP data URL of actual rendered geometry. Calls are serialized and share one temporary renderer, released 2.5 seconds after the last render. `disposeThumbnails()` releases it immediately. The function can be used to generate and save static catalogue thumbnails at build time.

## Wheel geometry

Original procedural geometry written for this project: turned barrel profile, bead seats, rolled outer lip, chamfered concave spokes, drilled bolt seats, hub/cap with raster canvas label, valve stem and optional multipiece fasteners. `apex10` uses ten slim spokes guided by the supplied bronze wheel photographs. It is a visual interpretation, **not** the manufacturer's CAD or a certified dimensional model.

Other supported design IDs: `mono5`, `deep7`, `yfork10`, `twist9`, `mesh30`, `split6`, `turbine8`, `blade12`, `star5`, `concave9`, `dish3pc`, `mesh3pc`. These are differentiated procedural concepts. PBR finish options: `gloss`, `satin`, `matte`, `brushed`, `chrome`. Width/diameter controls change barrel proportions in standalone mode.

Studio rendering uses a locally generated RoomEnvironment/PMREM, ACES tone mapping, antialiasing, physically based metal/clearcoat, dynamic self-shadowing and soft contact grounding on a dark charcoal floor. It is interactive realtime rendering, not offline ray tracing. Pointer orbit, scroll/pinch zoom, arrow-key orbit/zoom and double-click reset are supported; mobile aspect changes adapt framing while preserving the view direction.

## Ferrari 458 Italia

- File: `assets/models/ferrari-458-italia.glb` (original bytes, 1,681,572 bytes).
- Source: [Three.js r180 Ferrari GLB](https://github.com/mrdoob/three.js/blob/r180/examples/models/gltf/ferrari.glb).
- Author attribution: **vicent091036**, as given by the [official car example](https://github.com/mrdoob/three.js/blob/r180/examples/webgl_materials_car.html).
- Original author listing: [Ferrari 458 Italia on Sketchfab](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6).
- Original introduction: [Three.js commit ab20118](https://github.com/mrdoob/three.js/commit/ab20118c1251c1d9fd739c2e90cb9ea08a61ff51).
- Related `ferrari-ao.png` is downloaded unchanged from the same pinned Three.js example directory (currently unused; procedural contact shadow is used).

The supplied asset is used **only under its Ferrari 458 Italia identity**. It must not be presented as a BMW, another Ferrari, or another vehicle selected in the catalogue. Keep an author/source credit beside or below the showroom.

Runtime changes: paint/glass materials and procedural NFW replacement alloy wheels. The original tyres and brakes remain. Wheel positions are taken from the actual model's four wheel nodes. Mounted alloys use fixed visually matched proportions corresponding to the demonstration assembly (20-inch option, 9 front / 10 rear in procedural settings). Changes in selected order dimensions do not certify tyre clearance, offsets, hub bore, bolt pattern, chassis fitment or physical interchangeability; the car view is an appearance demonstration.

**Model-specific license remains unverified.** The original Sketchfab listing and API returned unavailable/404 during verification on 2026-09-04. The GLB contains no embedded copyright/license field and its introduction commit contains no license statement. The Three.js software MIT license must not be represented as proof of the third-party model's license. The source and author are preserved here for local review; obtain the model's actual permission/license or replace it with a verified licensed vehicle asset before commercial publication.

## Third-party software notices

- Three.js r180 and bundled addons: MIT, [upstream license](https://github.com/mrdoob/three.js/blob/r180/LICENSE), preserved in `assets/vendor/three/LICENSE`.
- Google Draco decoding binaries bundled with Three.js r180: Apache-2.0, [upstream Draco license](https://github.com/google/draco/blob/1.5.7/LICENSE), preserved in `assets/vendor/draco/LICENSE`; upstream decoder readme preserved beside it.
- Source for all vendored Three.js files and decoder distribution: `https://raw.githubusercontent.com/mrdoob/three.js/r180/`.

## Verification

Headless Chrome with software WebGL2 successfully rendered both modes, loaded local Draco/WASM and the 1.6 MB GLB, and replaced all four rim assemblies. Final `apex10` wheel render: 38,800 triangles; Ferrari scene with replacements: 470,576 triangles. Syntax check passed. All 13 designs rendered to valid WebP images; wheel → car → wheel switching and body/material updates completed without page errors. An intentionally aborted GLB request produced the visible Czech error and left zero renderer canvases, verifying cleanup. Mobile sizing, arrow-key orbit and double-click reset were exercised. Visual screenshots are retained in `docs/qa/`.

`assets/renders/<design-id>.webp` contains 13 baked 400 × 400 catalogue thumbnails (roughly 18–25 KB each), generated from the final geometry through the shared renderer with Bronze `#9a6d3a`, gloss finish. These thumbnails show that reference finish; interactive colour changes occur in the 3D showroom.
