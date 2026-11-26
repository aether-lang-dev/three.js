# three.js on sae (branch `sae-port`)

This branch runs three.js inside [sae](https://github.com/aether-lang-dev/sae-it-aint-so),
the fat-UI page browser of the Aether family, with
[ae3d](https://github.com/aether-lang-dev/ae3d) doing the drawing. It is a
fork of [mrdoob/three.js](https://github.com/mrdoob/three.js), kept by the
Aether family (Paul Hammant, Nic Maman, with Claude and Codex).

- `dev` mirrors upstream and is never committed to.
- `sae-port` is the work. It was branched from upstream `dev` at
  `6c4e631a1fb1afb4b1857b7adbf5fd99d39e150f` (2026-11-26).
- Upstream changes are merged in when they make sense; nothing is sent back.

three.js is MIT, `Copyright © 2010-2026 three.js authors` (`LICENSE`). Its
licence and every copyright line stay as they are. New files on this branch
are MIT too.

## The split

three.js's JavaScript stays JavaScript and runs as it is on sae's engine
(QuickJS-ng, through Aether's `contrib.quickjs`). Only the per-frame work
moves to native code, and that is ae3d's, not a port of three.js to Aether.

| Stays three.js's JavaScript (upstream files) | Done natively (ae3d, through sae) |
|---|---|
| `src/math` (`Vector3`, `Matrix4`, `Quaternion`, `Euler`, `Color`) | world-matrix propagation, if the spike shows it is the hot loop |
| `Object3D` and its subclasses: hierarchy, transforms, `userData`, events | culling, sorting, drawing |
| geometry generators, `BufferGeometry` / `BufferAttribute` | meshes on the GPU, textures, render targets |
| loaders' parsing (`GLTFLoader`, `OBJLoader`, ...) | lights, shadows, PBR |
| material classes, as parameter holders | shaders: ae3d's own, and TSL node trees lowered through ae3d's `quote` grammar |

`WebGLRenderer` and `WebGPURenderer` are replaced by an `AeRenderer`.
`renderer.render(scene, camera)` walks the scene once and sends ae3d one
batch a frame through sae's `gfx` host functions: the transforms that
changed (a typed array), geometry that is new or flagged `needsUpdate`, and
material parameters. That is one crossing a frame, not one per property
write.

Why this shape:
- A page is untrusted code, so there is no WebGL-shaped surface, and no raw
  GLSL reaching a driver (sae `docs/gpu-pages.md`).
- QuickJS is an interpreter, so the per-frame work must not be in JS.
- Code written for three.js keeps working.
- Shaders: TSL builds a tree, which ae3d checks against its `quote`
  grammar before lowering it. `ShaderMaterial`'s GLSL strings are refused
  at first.

## First steps (the spike)

1. Run `src/math`, `src/core` and `src/geometries` unmodified on sae's
   engine. Time a scene-graph update (`updateMatrixWorld`) for 1,000 to
   5,000 objects against Node. That decides whether world matrices stay in
   JS.
2. Get the README's spinning cube (`BoxGeometry` + `MeshNormalMaterial`)
   running through a first `AeRenderer` on ae3d, one batch a frame.
