# Need For Wheels: 3D assets and integration

The browser renderer uses local, pinned Three.js r180 / 0.180.0 and Draco. It creates actual concave wheel geometry; it does not use SVG wheel illustrations. Serve the site over HTTP(S).

## Available vehicles

| Asset | Depicted vehicle | Licence |
|---|---|---|
| `assets/models/bmw-x5-g05.glb` (5.47 MB) | BMW X5 G05 2018, before facelift; catalogue G05 2018–2023 only | BMW Car IT GmbH and contributors, CC BY 4.0 |
| `assets/models/tesla-model-3-2018.glb` (3.77 MB) | Tesla Model 3 2018; restricted to the documented year | Ameer Studio, CC BY 4.0 |

See [BMW source, conversion and mounts](bmw-x5-g05-model.md) and [Tesla source, licence and conversion](../assets/models/tesla-model-3-2018-LICENSE.md). Author, source, licence and modifications are linked below each interactive vehicle.

`js/vehicle-models.js` keeps mesh availability separate from catalogue coverage. Its resolver requires matching brand, model, year, generation and body. It never substitutes a later facelift or another body. The configurator opens a matching mesh automatically under **Můj vůz**, with **Fotografie** as an alternative. Other cars keep their photographic preview; the separate demonstration studio is explicitly BMW X5 and preserves the selected order vehicle.

There are currently **two registered 3D assets**, not 3D coverage for all 401 model families / 2,736 variants. The catalogue's **Jen vozy s 360° modelem** filter is generated from the registry and preserves the other filters. Further generations require appropriately licensed meshes and measured wheel anchors. One photograph cannot provide this mode.

The former Ferrari 458 example asset has been retired from the public distribution. Its third-party model licence could not be verified; the Three.js software MIT licence was not treated as a model licence.

## Renderer API

Use the import map in `konfigurator.html`, then import `js/showroom.js`. The module also exposes `window.NFWShowroom` and emits `nfw:showroom-ready`.

```js
const request = new AbortController();
const studio = await NFWShowroom.mount(element, {
  mode: 'car', vehicleAsset: 'bmw-x5-g05', // or mode: 'wheel'
  design: 'apex10', color: '#967044', finish: 'gloss',
  width: 10, diameter: 21, autoRotate: true,
  bodyColor: '#303f4b', lip: 'same', cap: 'black',
  signal: request.signal,
});
await studio.update({ design: 'mono5', color: '#34373b' });
studio.setView('detail'); // perspective, front, side, rear, detail
studio.reset();
const dataURL = studio.capture('image/webp', .92);
studio.dispose();
```

Give the container an explicit height. The renderer supports pointer orbit, scroll/pinch zoom, arrow-key orbit/zoom, double-click reset, reduced motion and responsive framing. There are no azimuth limits, so the camera can orbit a full 360°. Fullscreen and view buttons are provided by the configurator.

Updates preserve the camera unless switching modes or registered models. Unchanged wheel geometry is retained for paint/rotation updates. Static scenes render on demand; rotation/damping render while the view changes. An AbortSignal releases an abandoned pending renderer immediately and cancels its downloads. A CPU decode already running finishes only to dispose its scene and workers.

## Model contract

Both assets use metres, Y up, front along −X, ground Y=0 and centred X/Z. Four empty nodes have unit world scale, origin at the outer rim face and local +Z outward. The original rims are removed; tyres, brakes and interiors remain.

Descriptors in `data/*-model.json` include asset identity, four unique wheel bindings, provenance and exact paint material names. Before loading the GLB the renderer validates identity, unique mounts and finite positive dimensions. NFW wheels attach in each anchor's local coordinate system, preserving source transforms.

Each mounted rim uses `scale = rimRadius / 1.032`, moving its outer face to the anchor origin. Mounted size follows the source tyres (BMW 21″, Tesla approximately 20″). Order diameter, width and offsets remain specifications to verify, rather than a physical fitment simulation. Design, colour, finish, lip and cap change the actual geometry/materials at all four corners. Body colour changes only registered paint materials. Source textures are retained.

## Wheels and photographic previews

The original procedural wheel geometry includes a turned barrel, bead seats, rolled lip, bevelled concave spokes, drilled bolt seats, hub/cap, valve stem and optional multipiece fasteners. `apex10` follows the supplied bronze-wheel photographs. It is a visual interpretation, not manufacturer CAD or a certified dimensional model.

All 13 design IDs are supported: apex10, mono5, deep7, yfork10, twist9, mesh30, split6, turbine8, blade12, star5, concave9, dish3pc, mesh3pc. PBR finishes: gloss, satin, matte, brushed, chrome. Width/diameter change barrel proportions in standalone mode.

The studio uses RoomEnvironment/PMREM reflections, ACES, antialiasing, metal/clearcoat, self-shadowing and a receiving floor with soft contact grounding. This is realtime rendering, not offline ray tracing.

Photographic previews remain static. Each visible rim gets an individually rendered concave wheel at a conservatively inferred angle when the photo supplies sufficient perspective evidence. Explicit angles take precedence. A projected rim-plane basis preserves the calibrated ellipse without a second flattening transform. Shadows and rear-facing surfaces add depth. All 430 photo sources / 860 calibrated rim positions and foreground masks remain intact. See [photo preview documentation](wheel-photo-preview.md).

`renderThumbnail` and `renderWheelFace` serialize work, cache results and release idle renderers. Catalogue thumbnails in `assets/renders` remain reference Bronze / Gloss images; interactive colours appear in the studio.

## Third-party software

- Three.js r180 and addons: MIT, preserved in `assets/vendor/three/LICENSE`.
- Google Draco 1.5.7 decoder: Apache-2.0, preserved in `assets/vendor/draco/LICENSE`.
- Vendor source: https://raw.githubusercontent.com/mrdoob/three.js/r180/

## Verification

Run the static server and set PLAYWRIGHT_MODULE if Playwright is not on the default module path.

- `node tools/check-vehicle-studio.cjs`: strict identity/descriptor checks, two GLBs/eight mounts, actual four-wheel geometry and material changes, full camera orbit, presets, fullscreen, mobile, load failure/retry and stale requests.
- `node tools/check-studio-cancellation.cjs`: pending WebGL cancellation and invalid descriptor rejection.
- `node tools/check-wheel-projection.cjs`: angled geometry, projection basis, ellipse/foreground clipping and direction.
- Existing `check-wheel-face.cjs`, `check-wheel-fit.cjs`, `check-vehicle-visuals.cjs`, `check-ui.cjs` and `check-catalog.cjs` cover the surrounding flows.

Representative screenshots are retained in `docs/qa/`.
