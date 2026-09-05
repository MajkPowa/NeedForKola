# Tesla Model 3 2018 — model attribution

**Original model:** [Tesla 2018 Model 3](https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f)
**Author:** [Ameer Studio](https://sketchfab.com/uchiha.321abc)
**License:** [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)

The author's Sketchfab API record was checked on 2026-09-05. It reports a downloadable model under CC Attribution, permits commercial use, and requires author attribution. The downloaded glTF independently contains the same author, source URL, title and CC BY 4.0 license in `asset.extras`; these fields are preserved in the distributed GLB.

Source record: https://api.sketchfab.com/v3/models/5ef9b845aaf44203b6d04e2c677e444f
Redistributed source files, available without authentication: https://github.com/tomfanhm/tesla/tree/main/public/gltf/tesla

## Changes for Need For Wheels

- Converted the complete glTF scene, buffer and textures into a self-contained GLB.
- Uniformly normalized the model to a 4.695 m length, Y up, front toward negative X, geometric center in X/Z and tyre ground level at Y = 0. Length reference: [Tesla 2017–2023 Model 3 owner's manual](https://www.tesla.com/ownersmanual/2017_2023_model3/en_us/GUID-56562137-FC31-4110-A13C-9A9FC6657BF0.html).
- Removed the original rim/barrel and center-cap meshes. Preserved the original tyre sidewalls, tread and brake meshes.
- Added four independent wheel mounting nodes at the original rim faces. Their local +Z axis points outward. Dimensions and node names are documented in `data/tesla-model-3-2018-model.json`.
- Adjusted the exterior paint material and added a clearcoat.
- Welded and deduplicated geometry, then applied Draco compression. No polygon decimation was performed.

This is an artist-authored visual model representing the original 2018 exterior. It is not manufacturer CAD or certified wheel-fitment data. Its approximate proportions must not be presented as the 2024 Highland facelift.

The CC BY 4.0 attribution applies to this source model and its derivative GLB. Replacement Need For Wheels rim geometry is separate. Attribution must remain available when distributing the model.

## Validation

The converted GLB was loaded in the local Three.js renderer using the production `createWheel` geometry. Front, rear and wheel-detail views were inspected on 2026-09-05. All four replacement rims fit the source tyre openings, original spokes are removed, and tyres and brakes remain. All four wheel anchor nodes have unit world scale.

GLB size: 3,767,860 bytes.
SHA-256: `1a659f43c645ae392432241d2c7ef7d016120a55a16ee43587ad03393a091499`
