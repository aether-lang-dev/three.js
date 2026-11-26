# Spike step 1: three.js's JavaScript on sae's engine

Does three.js's own JavaScript run on sae's engine (QuickJS-ng, through
Aether's `contrib.quickjs`), unmodified, and how fast? This answers
`PORT.md`'s first step: whether world matrices can stay in JS.

## What runs

`entry.js` re-exports `src/math`, `src/core` and `src/geometries`
(and what they import: `src/extras` for the shape geometries,
`src/utils.js`, `src/constants.js`), as upstream wrote them. No renderer.
`build.sh` bundles it with **esbuild** (0.25.0) into one classic script
(an IIFE, `THREE` global, 519 KB) and appends `bench.js`.

Why a bundle, not sae's module loader: the loader is a page's, fetching
modules over HTTP under the page's rules, and `tools/saejs` (the engine
with only `print`, no page host) has none. A bundle is one file that Node
and sae's engine run byte for byte, which is what a fair comparison
needs. esbuild only rewrites the `import`/`export` lines; the bodies are
three.js's. (The page loader is for part 2's page.)

```sh
ESBUILD=/path/to/esbuild sae-port/bench/build.sh
sae-port/bench/run.sh node    > results/<box>-node.jsonl
sae-port/bench/run.sh jitless > results/<box>-node-jitless.jsonl
SAEJS=~/scm/sae/target/saejs sae-port/bench/run.sh saejs > results/<box>-sae.jsonl
python3 sae-port/bench/table.py
```

## Correctness

`bench.js`'s first line is a JSON object of results: `Matrix4`
compose / invert / determinant / decompose / lookAt / makePerspective,
`Quaternion.slerp`, `Vector3.cross`, `Color` from an HSL string, a
three-level `Object3D` hierarchy's world matrix and world position and
`lookAt`, `BoxGeometry(1,2,3,2,2,2)`, `SphereGeometry(1,64,32)` and
`TorusKnotGeometry()` (counts, bounds, sampled positions and normals) and
a `Ray` against a `Sphere`, rounded to 1e-6. It is **byte-identical on all
seven runs** (Node with and without its JIT, sae's engine on three boxes).

## Timings

Median of 5-7 timings, ms per call. The `Matrix4.*` and `applyMatrix4`
rows are 20,000 calls each. `rotate+updateMatrixWorld` sets every
object's `rotation.y` with `traverse` first, which is what an animation
loop does.

Boxes and versions (2026-11-26):
- **mac**: Apple M6, macOS 27.3, Node v26.13.1, sae's `target/saejs` built
  with Aether 0.946.0 (quickjs-ng 0.18, contrib.quickjs).
- **cachyos**: Intel N100, CachyOS, Node v26.13.1, saejs built there with
  Aether 0.946.0.
- **ae-x64**: Ubuntu 22.04 VM (4 vCPU of a Ryzen 5 3500U), saejs built
  there with Aether 0.946.0, no Node. It ran at a load average of about 8.5
  from other work, so read its column as an upper bound.

| ms per call | mac Node | mac Node --jitless | **mac sae** | cachyos Node | cachyos Node --jitless | **cachyos sae** | **ae-x64 sae** | sae/Node, mac | sae/jitless, mac | sae/Node, cachyos |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| updateMatrixWorld flat 1000 | 0.033 | 1.869 | 2.202 | 0.070 | 2.104 | 2.366 | 12.414 | 68x | 1.2x | 34x |
| rotate+updateMatrixWorld flat 1000 | 0.098 | 1.424 | 3.012 | 0.171 | 2.700 | 3.487 | 17.342 | 31x | 2.1x | 20x |
| updateMatrixWorld nested 1000 | 0.069 | 1.842 | 2.203 | 0.067 | 2.051 | 2.430 | 14.219 | 32x | 1.2x | 36x |
| rotate+updateMatrixWorld nested 1000 | 0.166 | 2.421 | 3.002 | 0.181 | 2.712 | 3.470 | 23.646 | 18x | 1.2x | 19x |
| updateMatrixWorld flat 5000 | 0.322 | 9.440 | 12.173 | 0.623 | 10.817 | 12.053 | 68.505 | 38x | 1.3x | 19x |
| rotate+updateMatrixWorld flat 5000 | 0.815 | 12.753 | 16.871 | 1.269 | 14.312 | 18.311 | 93.169 | 21x | 1.3x | 14x |
| updateMatrixWorld nested 5000 | 0.339 | 9.505 | 12.293 | 1.174 | 10.924 | 12.362 | 76.448 | 36x | 1.3x | 11x |
| rotate+updateMatrixWorld nested 5000 | 0.862 | 11.550 | 17.280 | 2.247 | 15.150 | 18.615 | 104.811 | 20x | 1.5x | 8x |
| BoxGeometry() | 0.005 | 0.016 | 0.048 | 0.013 | 0.026 | 0.060 | 0.287 | 9x | 3.0x | 5x |
| SphereGeometry(1,64,32) | 0.326 | 1.823 | 3.976 | 0.354 | 2.183 | 4.279 | 20.207 | 12x | 2.2x | 12x |
| TorusKnotGeometry() | 0.080 | 0.666 | 1.271 | 0.098 | 0.794 | 1.381 | 4.697 | 16x | 1.9x | 14x |
| TorusKnotGeometry(1,0.4,256,32) | 1.182 | 5.304 | 17.028 | 1.751 | 10.525 | 17.993 | 98.392 | 14x | 3.2x | 10x |
| Matrix4.multiplyMatrices x20k | 0.341 | 13.742 | 25.201 | 0.515 | 26.450 | 23.687 | 164.624 | 74x | 1.8x | 46x |
| Matrix4.compose x20k | 0.252 | 9.513 | 11.026 | 0.400 | 10.422 | 10.296 | 88.683 | 44x | 1.2x | 26x |
| Matrix4.invert x20k | 0.428 | 30.825 | 33.320 | 0.760 | 33.043 | 32.771 | 172.929 | 78x | 1.1x | 43x |
| Vector3.applyMatrix4 x20k | 0.049 | 8.670 | 9.037 | 0.299 | 8.881 | 8.366 | 51.561 | 183x | 1.0x | 28x |

As ops a second on sae's engine (mac / cachyos): `multiplyMatrices` 0.79M /
0.84M, `compose` 1.8M / 1.9M, `invert` 0.60M / 0.61M, `applyMatrix4` 2.2M /
2.4M. ae-x64 is about a sixth of that.

What the ratios say:
- sae's engine is 10-70x slower than Node's JIT here (the math-only loops
  more, since V8 inlines them away), but **only 1.0-3x slower than V8 with
  its JIT off**. The gap is the JIT, not QuickJS; nothing in three.js's
  code is a QuickJS problem.
- Geometry generators are cheap enough: a 64x32 sphere in 4 ms, a default
  torus knot in 1.3 ms. They run when a page builds a mesh, not per frame.

## Verdict on world matrices

`updateMatrixWorld` costs about **2.4 µs an object** on the Mac and on the
N100 (3.5 µs with an animation pass that touches every object), and about
13-20 µs on ae-x64.

- **Up to ~1,000 objects, it stays in JS.** 2-3.5 ms of a 16.7 ms frame on
  the fast boxes. That covers the README examples and most demo scenes.
- **At 5,000 it does not fit.** 12 ms bare, 17-19 ms with the animation
  pass: the whole frame, before the batch is built or anything is drawn.
- **On a slow host** (ae-x64) even 1,000 objects is 12-24 ms.

So world-matrix propagation should be able to move native for big scenes,
as `PORT.md` anticipated. The catch is that three.js's own JS reads
`matrixWorld` (raycasting, `getWorldPosition`, `lookAt`, frustum checks,
skinning), so a native propagation needs either a write-back of the world
matrices once a frame (one crossing: a Float32Array back, copied into
each `matrixWorld.elements`, itself a JS loop of 16 stores an object) or a
lazily computed `matrixWorld`. That is a decision
for after the cube (see the spike report); the first AeRenderer keeps
three.js's `updateMatrixWorld` and sends world matrices.
