// three.js's README example as a sae page: three.js's own scene graph,
// geometry and MeshNormalMaterial, unmodified, drawn through AeRenderer,
// one gfx.submit a frame, and shown by gfx.view: sae's GPU helper (sae-gfx,
// ae3d in a process of its own) draws each batch and sends the picture
// back. ./three-sae.js is sae-port/cube/build.sh's dist/three-sae.js, copied
// here by it. MIT.
//
// spec_cube.ae drives it: 60 live frames (the cube turning), then two poses
// held still, each printed with what three.js itself says the picture must
// be there (each face the eye sees: its centre's pixel and its colour), then
// a watch loop that says once when the scene is lost (the helper killed),
// and a "New scene" button that starts drawing again.
import * as THREE from "./three-sae.js";

const { text, set_text, btn } = ui;
const W = 320, H = 240;

const camera = new THREE.PerspectiveCamera(70, W / H, 0.01, 10);
camera.position.z = 1;
const scene = new THREE.Scene();
const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const material = new THREE.MeshNormalMaterial();
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const status = text("cube: no frame yet");
let renderer = new THREE.AeRenderer({ width: W, height: H });
vg.scene(`0 0 ${W} ${H}`, W, H, () => { gfx.view(renderer.handle); });

const raf = (fn: (t: number) => void) => requestAnimationFrame(fn);

// What three.js says the picture is at this pose: "x y r g b" per face the
// eye sees, ";" between (readme_cube.js's maths, at this page's size).
function expected(): string {
  scene.updateMatrixWorld();
  const modelView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(modelView);
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  const out: string[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new THREE.Vector3();
    for (let k = 0; k < 4; k++) c.add(new THREE.Vector3().fromBufferAttribute(pos, f * 4 + k));
    c.multiplyScalar(0.25);
    const eye = c.clone().applyMatrix4(modelView);
    const n = new THREE.Vector3().fromBufferAttribute(nor, f * 4).applyMatrix3(normalMatrix).normalize();
    if (n.dot(eye.clone().negate().normalize()) < 0.15) continue;
    const ndc = eye.clone().applyMatrix4(camera.projectionMatrix);
    const x = Math.floor((ndc.x + 1) / 2 * W), y = Math.floor((1 - ndc.y) / 2 * H);
    const rgb = [n.x, n.y, n.z].map((v: number) => Math.round((v * 0.5 + 0.5) * 255));
    out.push(`${x} ${y} ${rgb.join(" ")}`);
  }
  return out.join(";");
}

const pose = (t: number) => { mesh.rotation.x = t / 2000; mesh.rotation.y = t / 1000; };

// Call fn once the picture of the last batch is on the page.
function whenShown(fn: () => void) {
  const want = renderer.info.frame;
  const look = () => {
    const s = gfx.stats(renderer.handle);
    if (s.error !== "") { print(`cube not drawn: ${s.error}`); return; }
    if (s.picture_frame >= want) fn(); else raf(look);
  };
  raf(look);
}

function poses(ts: number[], then: () => void) {
  if (ts.length === 0) { then(); return; }
  const t = ts[0];
  pose(t);
  renderer.render(scene, camera);
  const want = expected();
  whenShown(() => {
    print(`cube expect ${t}: ${want}`);
    print(`cube pose ${t} shown`);
    // Held long enough for the spec to read it.
    let n = 0;
    const hold = () => { if (++n < 90) raf(hold); else poses(ts.slice(1), then); };
    raf(hold);
  });
}

// The cube turning until the scene is lost; said once.
function watch(tag: string) {
  let said = false;
  renderer.setAnimationLoop((time: number) => {
    pose(time);
    try {
      renderer.render(scene, camera);
    } catch (e) {
      if (!said) { said = true; print(`cube ${tag} lost: ${(e as Error).message}`); set_text(status, "cube: lost"); }
      renderer.setAnimationLoop(null);
    }
  });
}

let frames = 0, started = 0;
renderer.setAnimationLoop((time: number) => {
  if (started === 0) started = time;
  pose(time);
  const t0 = performance.now();
  renderer.render(scene, camera);
  const took = performance.now() - t0;
  frames++;
  if (frames === 1 || frames === 60) {
    const s = gfx.stats(renderer.handle);
    const line = `cube frame ${s.frame}: meshes ${s.meshes}, vertices ${s.vertices}, triangles ${s.triangles}, draws ${s.draws}, ${s.bytes} bytes`;
    set_text(status, line);
    print(line);
    print(`cube render() took ${took.toFixed(2)} ms; ${frames} frames in ${(time - started).toFixed(0)} ms; pictures ${s.pictures}, drawn ${s.drawn}, the last of frame ${s.picture_frame}, drawn in ${s.draw_ms} ms, ${s.frame_ms} ms ask to picture${s.error ? "; " + s.error : ""}`);
  }
  if (frames === 60) {
    renderer.setAnimationLoop(null);
    whenShown(() => {
      print(`cube live: ${gfx.stats(renderer.handle).pictures} pictures drawn`);
      poses([1200, 2600], () => { print("cube poses done"); watch("first"); });
    });
  }
});

btn("New scene", () => {
  renderer.dispose();
  renderer = new THREE.AeRenderer({ width: W, height: H });
  vg.scene(`0 0 ${W} ${H}`, W, H, () => { gfx.view(renderer.handle); });
  poses([1200], () => { print("cube again done"); watch("second"); });
});
