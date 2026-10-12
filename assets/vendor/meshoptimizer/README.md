# meshoptimizer decoder

`meshopt_decoder.mjs` is the unmodified decoder from the official
`meshoptimizer` npm package, pinned to version **1.3.0**.

Source: https://github.com/zeux/meshoptimizer

The decoder handles `EXT_meshopt_compression` in the local Three.js GLTFLoader
and in the offline exported-geometry checks. Wheel exports use lossless
`ATTRIBUTES` / `INDICES` encoding with the `NONE` filter; positions, normals,
UVs and index order are preserved exactly.

The upstream MIT license is included in `LICENSE.md`.
