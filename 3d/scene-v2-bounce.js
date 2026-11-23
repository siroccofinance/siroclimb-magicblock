// Sirocco coin climbing stairs: deterministic scene, frame = f(t). Loops every LOOP seconds.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const Q = new URLSearchParams(location.search);
const W = +Q.get('w') || 1440, H = +Q.get('h') || 1080;

// ---- Sirocco DA
const C = {
  bg: 0x0b0807,        // warm near-black
  coin: 0xe6b25c,      // miel / safran gold
  stepTop: 0x24140e,   // terracotta-tinted step surface
  terra: 0xc2552d,
  terraLight: 0xff8a52,
  sand: 0xffe6c2,
};

// ---- timing / geometry
const PC = 2.0;          // seconds per step climbed
const LOOP = 2 * PC;     // loop length (2 steps)
const D = 1.0, HS = 0.62, WZ = 1.7; // step depth, rise, width
const R = 0.30, T = 0.09;          // coin radius, thickness
const ROLL_END = 0.56;              // fraction of a cycle spent rolling before the hop

// ---- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.Fog(C.bg, 6.2, 12.5);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(27, W / H, 0.1, 60);
const CAM_OFFSET = new THREE.Vector3(-2.65, 1.95, 4.6);

// ---- stairs (infinite enough)
const stepGeo = new RoundedBoxGeometry(D, 30, WZ, 3, 0.018);
const stepMat = new THREE.MeshStandardMaterial({ color: C.stepTop, roughness: 0.3, metalness: 0.55, envMapIntensity: 0.12 });
const steps = [];
for (let i = -10; i < 30; i++) {
  const m = new THREE.Mesh(stepGeo, stepMat);
  m.position.set(i * D + D / 2, i * HS - 15, 0);
  m.receiveShadow = true;
  m.userData.i = i;
  steps.push(m);
  scene.add(m);
}

// ---- bouncing steps: each step is a spring piston.
// Step i: the coin lands on it at i*PC (it dips, then rebounds), rolls, then the step
// compresses and fires up, launching the coin toward step i+1.
const COMPRESS = 0.15, PUNCH = 0.26, PUNCH_T = 0.07, PRELOAD = 0.45;
const launchTime = i => i * PC + ROLL_END * PC; // coin leaves step i
function stepOffset(i, t) {
  let o = 0.03 * Math.sin(2 * Math.PI * t / LOOP - Math.PI * i); // idle piston breathing (loops: i+2, t+LOOP)
  const tl = t - i * PC; // landing impact
  if (tl >= 0) o += -0.17 * Math.exp(-5 * tl) * Math.sin(12 * tl);
  const rel = launchTime(i) - PUNCH_T; // spring release
  if (t >= rel - PRELOAD && t < rel) o += -COMPRESS * smooth((t - (rel - PRELOAD)) / PRELOAD);
  else if (t >= rel && t < rel + PUNCH_T) { const v = (t - rel) / PUNCH_T; o += -COMPRESS + (COMPRESS + PUNCH) * (1 - Math.pow(1 - v, 3)); }
  else if (t >= rel + PUNCH_T) { const v = t - rel - PUNCH_T; o += PUNCH * Math.exp(-4.5 * v) * Math.cos(12 * v); }
  return o;
}

// ---- coin
const coin = new THREE.Group();
const coinMat = new THREE.MeshPhysicalMaterial({ color: C.coin, metalness: 1, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.18, envMapIntensity: 0.7 });
const logoMat = new THREE.MeshPhysicalMaterial({ color: 0xf2c46e, metalness: 1, roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.8 });
{
  const t = T / 2, hf = t - 0.007, pts = [];
  const add = (r, h) => pts.push(new THREE.Vector2(r, h));
  add(0, -hf); add(0.238, -hf); add(0.246, -t + 0.001); add(0.252, -t);
  add(0.285, -t); add(0.296, -t + 0.004); add(R, -t + 0.012);
  add(R, t - 0.012); add(0.296, t - 0.004); add(0.285, t);
  add(0.252, t); add(0.246, t - 0.001); add(0.238, hf); add(0, hf);
  const g = new THREE.LatheGeometry(pts, 128);
  g.rotateX(Math.PI / 2); // axis y -> z : faces look along ±z
  const body = new THREE.Mesh(g, coinMat);
  body.castShadow = true;
  coin.add(body);
}
let logoReady = fetch('/logo.svg').then(r => r.text()).then(txt => {
  const data = new SVGLoader().parse(txt);
  const shapes = data.paths.flatMap(p => SVGLoader.createShapes(p));
  const s = 0.33 / 309, depth = 13, bt = 3;
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: 2.2, bevelSegments: 3, curveSegments: 40 });
  g.translate(-139, -168.5, 0);
  g.scale(s, -s, -s);
  g.translate(0, 0, (depth + bt) * s);
  g.computeVertexNormals();
  const faceZ = T / 2 - 0.007;
  const front = new THREE.Mesh(g, logoMat); front.position.z = faceZ; front.castShadow = true;
  const back = new THREE.Mesh(g, logoMat); back.rotation.y = Math.PI; back.position.z = -faceZ;
  coin.add(front, back);
});
scene.add(coin);

// ---- halo behind the coin
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,140,80,0.9)'); g.addColorStop(0.35, 'rgba(194,85,45,0.35)'); g.addColorStop(1, 'rgba(194,85,45,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
halo.scale.setScalar(1.9);
scene.add(halo);

// ---- lights (move with the camera target so the loop is seamless)
scene.add(new THREE.HemisphereLight(0x6a3322, 0x050302, 0.2));
const key = new THREE.DirectionalLight(C.terraLight, 1.3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 15 });
key.shadow.bias = -0.0004; key.shadow.radius = 6;
const rim = new THREE.DirectionalLight(C.terra, 1.6);
const fill = new THREE.DirectionalLight(C.sand, 0.35);
const glow = new THREE.PointLight(0xff7a3d, 1.2, 2.5, 2);
scene.add(key, key.target, rim, rim.target, fill, fill.target, glow);

// ---- post
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.35, 0.5, 0.92));
composer.addPass(new OutputPass());

// ---- motion
const ease = v => v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
const smooth = v => v * v * (3 - 2 * v);
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();

function pose(t) {
  const c = Math.floor(t / PC), u = (t - c * PC) / PC;
  const x0 = c * D, y0 = c * HS;
  let x, y, roll, lean = -0.13, flip = 0;
  if (u < ROLL_END) {
    const v = u / ROLL_END, s = smooth(v);
    x = x0 + 0.27 + 0.42 * s;
    y = y0 + R + stepOffset(c, t);
    roll = -(c + s) * Math.PI;
    lean += 0.18 * Math.exp(-5 * v) * Math.sin(16 * v); // landing wobble
  } else {
    const v = (u - ROLL_END) / (1 - ROLL_END);
    const ys = y0 + R + PUNCH, ye = y0 + HS + R;
    x = x0 + 0.69 + (D + 0.27 - 0.69) * (1 - Math.pow(1 - v, 1.6)); // pushed forward fast, settles
    y = ys + (ye - ys) * v + 0.95 * 4 * v * (1 - v);
    roll = -(c + 1) * Math.PI;
    flip = 2 * Math.PI * ease(v);
  }
  const q = new THREE.Quaternion().setFromAxisAngle(AZ, roll);
  q.premultiply(qa.setFromAxisAngle(AY, 0.38));
  q.premultiply(qa.setFromAxisAngle(AX, lean));
  const odd = ((c % 2) + 2) % 2 === 1;
  q.premultiply(qb.setFromAxisAngle(odd ? AY : AX, odd ? flip : -flip));
  return { pos: new THREE.Vector3(x, y, 0), q };
}

function setTime(t) {
  for (const m of steps) m.position.y = m.userData.i * HS - 15 + stepOffset(m.userData.i, t);
  const p = pose(t);
  coin.position.copy(p.pos);
  coin.quaternion.copy(p.q);
  const k = t / PC; // camera climbs linearly
  const target = new THREE.Vector3(0.36 + D * k, R + 0.18 + HS * k, 0);
  camera.position.copy(target).add(CAM_OFFSET);
  camera.lookAt(target);
  key.position.copy(target).add(new THREE.Vector3(2.2, 5.5, -2.0)); key.target.position.copy(target);
  rim.position.copy(target).add(new THREE.Vector3(3.5, 1.6, -4.5)); rim.target.position.copy(target);
  fill.position.copy(target).add(new THREE.Vector3(-4, 1.5, 4)); fill.target.position.copy(target);
  glow.position.copy(p.pos).add(new THREE.Vector3(0.35, 0.45, -0.7));
  const away = p.pos.clone().sub(camera.position).normalize().multiplyScalar(0.9);
  halo.position.copy(p.pos).add(away).add(new THREE.Vector3(0.05, 0.12, 0));
}

// ---- output canvas: motion-blur accumulation, vignette, grain
const acc = document.getElementById('acc');
acc.width = W; acc.height = H;
const ctx = acc.getContext('2d', { willReadFrequently: true });
const vign = ctx.createRadialGradient(W * 0.5, H * 0.47, H * 0.32, W * 0.5, H * 0.5, H * 0.95);
vign.addColorStop(0, 'rgba(11,8,7,0)'); vign.addColorStop(1, 'rgba(11,8,7,0.8)');

function seeded(n) { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

window.renderFrame = (frame, fps = 30, subs = 6, shutter = 0.5) => {
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < subs; k++) {
    const t = frame / fps + ((k + 0.5) / subs - 0.5) * shutter / fps;
    setTime(t);
    composer.render();
    ctx.globalAlpha = 1 / (k + 1);
    ctx.drawImage(renderer.domElement, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = vign; ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H), d = img.data, rnd = Math.random;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  return acc.toDataURL('image/png');
};

logoReady.then(() => { window.ready = true; });
