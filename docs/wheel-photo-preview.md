# Configured wheels on vehicle photographs

For cars without a registered 360° mesh, **Můj vůz** combines the licensed vehicle photograph with a transparent canvas of the configured wheels. Cars with a matching mesh use the true 3D studio by default; their static reference is under **Fotografie**. The photographic preview covers 401 model-family photos, 27 explicitly matched variant photos and two BMW X5 renders. Model-family references retain their label; fitting a wheel does not turn a reference photograph into an exact generation match.

`js/showroom.js` exports `renderWheelFace()`. It renders the same bevelled Three.js wheel geometry used by the interactive studio, including all 13 designs, metal finishes, colours, caps, lips and bolts. There is no SVG, external image-generation service or machine-learning model in the browser. A separate temporary WebGL context produces independent raster snapshots; a serial queue and 30-entry LRU cache bound resource use. Idle rendering resources are released after ten seconds.

`js/wheel-fit-preview.js` loads `data/wheel-fitments.json` only when needed. Each photo has full-image dimensions, the original source hash and normalized rim ellipses (`cx`, `cy`, `rx`, `ry`, clockwise `rotation` in radians). An optional `clip` polygon of 3–32 full-image normalized `[x, y]` points restricts a wheel to its visible area where a foreground object occludes it. The original photograph and tyres are retained. New wheel faces have opaque brake backing to mask factory spokes, are projected into the photographed ellipses and receive a narrow contact shadow. Canvas and image use identical full-frame containment, including on mobile. Superseded asynchronous work cannot overwrite the current car or configuration. The comparison button shows the original immediately.

This is a visualisation of the wheel's appearance. It does not simulate wheel diameter, tyre selection, track width, offset, suspension travel or physical clearance. The selected dimensions remain in the quotation and must be confirmed for the vehicle. The photograph's paint remains unchanged.

## Depth and projection

Each wheel may provide explicit `yaw` and `pitch` in radians, including an explicit zero. Without angles, `wheelPhotoAngles()` uses a conservative tilt only when two well-separated wheels and a clear apparent-size difference provide a perspective cue. Ambiguous side-on photographs keep a frontal projection. An inferred yaw is capped at 0.65 radians; pitch is never inferred. This is an appearance estimate, not a recovered camera calibration.

Each visible wheel gets its own render from the concave geometry. `renderWheelFace()` returns `rimBasis` in raster pixels, so `paintWheelFaces()` can map the projected front plane into the original calibrated ellipse without compressing it twice. The deeper hub and spoke sides retain their visible parallax. Explicit foreground KEEP polygons remain in full-photo coordinates. The painter accepts either one legacy snapshot or a snapshot array.

Directional shadows now fall from the spokes onto the rotor and inner surfaces. Fill lighting and inner-barrel reflections are restrained to avoid a uniformly lit sticker appearance. Cache keys include tilt. This improves a static photographic composition; rotating the complete car still requires a real model as documented in [3D assets](3d-assets.md).

## Sources and adaptation credits

The photograph author, exact source and licence remain visible, together with an explicit Need For Wheels adaptation credit. CC BY-SA adaptations retain the source photograph's stated licence. Original files are never overwritten by the runtime renderer. Image source hashes also version the displayed photo URL, so replacing an image cannot reuse an old browser-cached photograph with new wheel positions.

## Offline annotation and review

The website runs entirely from committed static assets; these tools are only for adding or replacing source photographs. The offline detector used `@huggingface/transformers` 4.2.0 installed under `tools/.cache-vehicle-visuals/wheel-detector`, and Python with Pillow, NumPy, SciPy and `opencv-python-headless` 5.0.0.93 (the latter installed under `tools/.cache-wheel-fit/python`). Test scripts accept `PLAYWRIGHT_MODULE` for the local Playwright runtime and `NFW_BASE_URL` for the served site.

1. `python tools/build-wheel-photo-inventory.py` inventories and hashes all local images, records visibility and creates review sheets.
2. `node tools/detect-wheel-regions.mjs` proposes wheel regions with the Apache-2.0 Grounding DINO tiny ONNX export. Its Node dependencies and 204 MB model are held only in ignored cache directories. DirectML accelerates the offline job on this Windows workstation.
3. `python tools/fit-wheel-ellipses.py --prepare-crops` prepares the individual wheel regions, then `node tools/detect-wheel-crops.mjs` detects the rim in each enlarged crop. `python tools/fit-wheel-ellipses.py` refines the metal rim boundary using the detail proposals and image edges, with OpenCV, NumPy and SciPy. The detector can confuse tyres with rims; proposals require visual review.
4. `node tools/render-wheel-fit-qa.cjs` renders contact sheets using the actual production wheel renderer and compositing code. Reviewed corrections are retained in `tools/wheel-fit-overrides-*.json`. `python tools/fit-wheel-ellipses.py --apply-overrides` merges every correction file without repeating detection or refitting other images. Changing the automatic proposals requires another visual review before publication.

The E53 facelift reference was replaced with an exterior three-quarter photograph of the correct facelift because the previous frontal shot showed no visible rim. Background cars are excluded from the wheel target regions. Never copy one generic pair of coordinates across unrelated vehicles or silently retain annotations after changing a photo.

## Verification

The 2026-09-05 review covers all 430 source images and 860 visible rims. Manual corrections are retained for 198 photographs; three include foreground-occlusion masks. The production manifest records the completed review separately from the unapproved machine proposals.

`tools/check-wheel-face.cjs` checks alpha coverage, material/design pixel changes, cache behaviour and independence from the existing showroom. `tools/check-wheel-fit.cjs` checks placement coverage, projected pixels, comparison, responsive alignment, stale updates, failure and retry. Existing visual-catalogue and configurator regression checks cover the selection, URL state, photo failures and mobile caption bounds.
