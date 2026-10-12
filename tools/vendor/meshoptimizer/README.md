# Meshoptimizer encoder

`meshopt_encoder.js` is copied unchanged from the official `meshoptimizer@1.3.0` npm package (upstream tag `v1.3`). Its MIT license is included beside it. The embedded WebAssembly needs no separate runtime download.

This authoring dependency is used by `tools/wheel-glb-codec.mjs`. OARTS exports use the EXT-compatible version 0 attribute codec at level 3 and the exact index-sequence codec, with no quantization, filters, vertex reordering or simplification. Every buffer view and the complete original GLB must pass a byte-exact SHA-256 roundtrip before an export is written.

The browser decoder is separately pinned at `assets/vendor/meshoptimizer/meshopt_decoder.mjs`.

Source: https://github.com/zeux/meshoptimizer/tree/v1.3/js

npm package integrity: `sha512-2oZqMAcEEiCtXWUjIGtZ71oPx1B0ZxYGTqIKsXB1wzWFhleNsCFxQuUJzgCV706bRcwPWtMGf1odmQvAcqKkIw==`.
