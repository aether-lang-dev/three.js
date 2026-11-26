# Spike step 2: the README's cube through AeRenderer

`src/renderers/sae/AeRenderer.js` stands in for `WebGLRenderer`. Its
`render(scene, camera)` walks the scene once and hands the host one batch a
frame (`gfx.submit`): the camera, each visible mesh's world matrix and
material, and the geometry that is new or whose attributes changed
(`version`). The layout is ae3d's (`ae3d.batch`, version 1, aether-lang-dev/ae3d#1102).
This first cut draws `Mesh` + `MeshNormalMaterial`, front or both sides,
and warns once for anything else.

- `three-sae.js` is what a page imports: the scene graph, cameras,
  geometries, `MeshNormalMaterial` and `AeRenderer`, three.js's files
  unmodified. `build.sh` bundles it with esbuild as an ES module
  (`dist/three-sae.js`, which sae's lowerer takes as a module in 30 ms) and
  as a classic script with `readme_cube.js` after it.
- `readme_cube.js` is the README's example (fov 70, `BoxGeometry(0.2)`,
  `rotation.x = t/2000`, `rotation.y = t/1000`) on a stand-in `gfx` that
  keeps each batch. For t = 1200 and 2600 ms it prints the batch and what
  three.js itself says the picture must be: each face the eye sees, its
  centre's pixel, and its colour through three.js's own normal matrix.
  Its output is byte-identical on Node and on sae's engine (`tools/saejs`).
- `check_frame.py` splits that output into batch files and holds ae3d's
  pictures of them to it.

## Verified (2026-11-26)

On cachyos (Mesa 26.3.1 llvmpipe under Xvfb, ae3d#1102's `test_batch`):

```
  ok   t=1200: face 1 at (120, 138) is (81, 60, 226), three.js says (81, 60, 226)
  ok   t=1200: face 2 at (128, 112) is (128, 233, 199), three.js says (127, 233, 199)
  ok   t=1200: face 4 at (145, 131) is (246, 101, 166), three.js says (246, 101, 166)
  ok   t=1200: 2192 pixels covered, the corners clear
  ok   t=2600: face 2 at (128, 122) is (128, 162, 250), three.js says (128, 162, 250)
  ok   t=2600: 1812 pixels covered, the corners clear
  ok   the frames differ in 1633 pixels
```

The first batch is 1,176 bytes (the cube's 24 vertices and 36 indices
with its draw); the second, the mesh kept, is 252.

```sh
ESBUILD=/path/to/esbuild sae-port/cube/build.sh
SAEJS=~/scm/sae/target/saejs; $SAEJS sae-port/cube/dist/readme_cube.js > out/dump.txt
files=$(python3 check_frame.py split out/dump.txt out)
AE3D_BATCH_FILES="$files" AE3D_BATCH_OUT=out xvfb-run -a ~/ae3d/build/test_batch
python3 check_frame.py check out/dump.txt out
```

## On sae itself

`page/index.ts` is the same README example as a sae page, importing
`./three-sae.js` (copied there by `build.sh`). sae (e23d053 and later) has
`gfx.scene` / `gfx.submit` / `gfx.stats`; it does not link ae3d yet, so each
batch is checked and counted natively but not drawn. `spec_cube.ae` runs on
sae's harness:

```sh
cd ~/scm/sae && tests/run_spec.sh ~/scm/three.js/sae-port/cube/spec_cube.ae ~/scm/three.js/sae-port/cube/page
```

On cachyos under Xvfb (2026-11-26) it passes: frame 1 arrives as 1,176 bytes
(24 vertices, 12 triangles), frame 60 as 252, the same bytes as on Node;
`render()` takes 0.1-0.2 ms, and 60 frames ran in 984 ms.
