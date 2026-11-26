// three.js's README example as a sae page: three.js's own scene graph,
// geometry and MeshNormalMaterial, unmodified, drawn through AeRenderer,
// one gfx.submit a frame. ./three-sae.js is sae-port/cube/build.sh's
// dist/three-sae.js, copied here by it. This sae checks and counts each
// batch natively (gfx.stats) and does not draw it yet. MIT.
import * as THREE from "./three-sae.js";

const { text, set_text } = ui;
const W = 320, H = 240;

const camera = new THREE.PerspectiveCamera(70, W / H, 0.01, 10);
camera.position.z = 1;
const scene = new THREE.Scene();
const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const material = new THREE.MeshNormalMaterial();
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const renderer = new THREE.AeRenderer({ width: W, height: H });
const status = text("cube: no frame yet");
let frames = 0;
let started = 0;

renderer.setAnimationLoop((time: number) => {
  if (started === 0) started = time;
  mesh.rotation.x = time / 2000;
  mesh.rotation.y = time / 1000;
  const t0 = performance.now();
  renderer.render(scene, camera);
  const took = performance.now() - t0;
  frames++;
  if (frames === 1 || frames === 60) {
    const s = gfx.stats(renderer.handle);
    const line = `cube frame ${s.frame}: meshes ${s.meshes}, vertices ${s.vertices}, triangles ${s.triangles}, draws ${s.draws}, ${s.bytes} bytes, drawn ${s.drawn}`;
    set_text(status, line);
    print(line);
    print(`cube render() took ${took.toFixed(2)} ms; ${frames} frames in ${(time - started).toFixed(0)} ms`);
  }
  if (frames === 60) renderer.setAnimationLoop(null);
});
