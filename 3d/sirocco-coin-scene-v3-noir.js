// Sirocco hero scene: a gold Sirocco coin climbing spring-loaded terracotta steps.
// Fully procedural (no bitmaps): renders crisp at any resolution / device pixel ratio.
// Deterministic: render(t) always draws the same frame for the same t; loops every LOOP_SECONDS.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIROCCO_LOGO_PATH } from './logo-path.js';

export const SIROCCO_COLORS = {
  bg: '#0b0807',        // page background behind the hero: match it in CSS
  coin: '#e6b25c',      // miel gold
  coinLogo: '#f2c46e',
  stepTop: '#24140e',
  terra: '#c2552d',
  terraLight: '#ff8a52',
  sand: '#ffe6c2',
};

const PC = 2.0;                       // seconds per step climbed
export const LOOP_SECONDS = 2 * PC;   // seamless loop length
const D = 1.0, HS = 0.62, WZ = 1.7;   // step depth, rise, width
const R = 0.30, T = 0.09;             // coin radius, thickness
const ROLL_END = 0.56;                // part of a cycle spent rolling before the launch
const COMPRESS = 0.15, PUNCH = 0.26, PUNCH_T = 0.07, PRELOAD = 0.45;

// framing: where the coin sits in the frame
//   hero   : landscape, coin on the right ~2/3, left side free for the headline
//   center : landscape, coin centred
//   mobile : portrait, coin centred, wider lens
export const FRAMINGS = {
  hero:   { fov: 27, shiftX: 0.17, shiftY: 0.0 },
  center: { fov: 27, shiftX: 0.0,  shiftY: 0.0 },
  mobile: { fov: 33, shiftX: 0.06, shiftY: -0.1 },
};
const CAM_OFFSET = new THREE.Vector3(-2.65, 1.95, 4.6);

const ease = v => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const smooth = v => v * v * (3 - 2 * v);
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);

// Each step is a spring piston: the coin lands on step i at i*PC (dip + rebound), rolls,
// then the step compresses and fires up, launching the coin toward step i+1.
function stepOffset(i, t) {
  let o = 0.03 * Math.sin((2 * Math.PI * t) / LOOP_SECONDS - Math.PI * i); // idle breathing
  const tl = t - i * PC;
  if (tl >= 0) o += -0.17 * Math.exp(-5 * tl) * Math.sin(12 * tl);
  const rel = i * PC + ROLL_END * PC - PUNCH_T;
  if (t >= rel - PRELOAD && t < rel) o += -COMPRESS * smooth((t - (rel - PRELOAD)) / PRELOAD);
  else if (t >= rel && t < rel + PUNCH_T) { const v = (t - rel) / PUNCH_T; o += -COMPRESS + (COMPRESS + PUNCH) * (1 - Math.pow(1 - v, 3)); }
  else if (t >= rel + PUNCH_T) { const v = t - rel - PUNCH_T; o += PUNCH * Math.exp(-4.5 * v) * Math.cos(12 * v); }
  return o;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function coinPose(t, out) {
  const c = Math.floor(t / PC), u = (t - c * PC) / PC;
  const x0 = c * D, y0 = c * HS;
  let x, y, roll, lean = -0.13, flip = 0;
  if (u < ROLL_END) {
    const v = u / ROLL_END, s = smooth(v);
    x = x0 + 0.27 + 0.42 * s;
    y = y0 + R + stepOffset(c, t);
    roll = -(c + s) * Math.PI;
    lean += 0.18 * Math.exp(-5 * v) * Math.sin(16 * v);
  } else {
    const v = (u - ROLL_END) / (1 - ROLL_END);
    const ys = y0 + R + PUNCH, ye = y0 + HS + R;
    x = x0 + 0.69 + (D + 0.27 - 0.69) * (1 - Math.pow(1 - v, 1.6));
    y = ys + (ye - ys) * v + 0.95 * 4 * v * (1 - v);
    roll = -(c + 1) * Math.PI;
    flip = 2 * Math.PI * ease(v);
  }
  out.quaternion.setFromAxisAngle(AZ, roll);
  out.quaternion.premultiply(qa.setFromAxisAngle(AY, 0.38));
  out.quaternion.premultiply(qa.setFromAxisAngle(AX, lean));
  const odd = ((c % 2) + 2) % 2 === 1;
  out.quaternion.premultiply(qb.setFromAxisAngle(odd ? AY : AX, odd ? flip : -flip));
  out.position.set(x, y, 0);
}

/**
 * @param {object} o
 * @param {HTMLCanvasElement} [o.canvas]
 * @param {number} o.width   CSS pixels
 * @param {number} o.height  CSS pixels
 * @param {number} [o.pixelRatio=1]
 * @param {'hero'|'center'|'mobile'} [o.framing='hero']
 * @param {boolean} [o.bloom=true]
 * @param {boolean} [o.shadows=true]
 * @param {boolean} [o.preserveDrawingBuffer=false]
 */
export function createSiroccoScene({ canvas, width, height, pixelRatio = 1, framing = 'hero', bloom = true, shadows = true, preserveDrawingBuffer = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SIROCCO_COLORS.bg);
  scene.fog = new THREE.Fog(SIROCCO_COLORS.bg, 6.2, 12.5);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 60);

  // stairs
  const stepGeo = new RoundedBoxGeometry(D, 30, WZ, 3, 0.018);
  const stepMat = new THREE.MeshStandardMaterial({ color: SIROCCO_COLORS.stepTop, roughness: 0.3, metalness: 0.55, envMapIntensity: 0.12 });
  const steps = [];
  for (let i = -10; i < 30; i++) {
    const m = new THREE.Mesh(stepGeo, stepMat);
    m.position.set(i * D + D / 2, i * HS - 15, 0);
    m.receiveShadow = true;
    m.userData.i = i;
    steps.push(m);
    scene.add(m);
  }

  // coin
  const coin = new THREE.Group();
  const coinMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coin, metalness: 1, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.18, envMapIntensity: 0.7 });
  const logoMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coinLogo, metalness: 1, roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.8 });
  {
    const t = T / 2, hf = t - 0.007, pts = [];
    const add = (r, h) => pts.push(new THREE.Vector2(r, h));
    add(0, -hf); add(0.238, -hf); add(0.246, -t + 0.001); add(0.252, -t);
    add(0.285, -t); add(0.296, -t + 0.004); add(R, -t + 0.012);
    add(R, t - 0.012); add(0.296, t - 0.004); add(0.285, t);
    add(0.252, t); add(0.246, t - 0.001); add(0.238, hf); add(0, hf);
    const g = new THREE.LatheGeometry(pts, 160);
    g.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(g, coinMat);
    body.castShadow = true;
    coin.add(body);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 250 309"><path d="${SIROCCO_LOGO_PATH}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap(p => SVGLoader.createShapes(p));
    const s = 0.33 / 309, depth = 13, bt = 3;
    const lg = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: 2.2, bevelSegments: 4, curveSegments: 48 });
    lg.translate(-139, -168.5, 0);
    lg.scale(s, -s, -s);
    lg.translate(0, 0, (depth + bt) * s);
    lg.computeVertexNormals();
    const faceZ = T / 2 - 0.007;
    const front = new THREE.Mesh(lg, logoMat); front.position.z = faceZ; front.castShadow = true;
    const back = new THREE.Mesh(lg, logoMat); back.rotation.y = Math.PI; back.position.z = -faceZ;
    coin.add(front, back);
  }
  scene.add(coin);

  // halo behind the coin (procedural gradient)
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 512;
  {
    const x = haloCanvas.getContext('2d'), g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, 'rgba(255,140,80,0.9)'); g.addColorStop(0.35, 'rgba(194,85,45,0.35)'); g.addColorStop(1, 'rgba(194,85,45,0)');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  }
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(1.9);
  scene.add(halo);

  // lights follow the camera target, so the loop is seamless
  scene.add(new THREE.HemisphereLight(0x6a3322, 0x050302, 0.2));
  const key = new THREE.DirectionalLight(SIROCCO_COLORS.terraLight, 1.3);
  key.castShadow = shadows;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 15 });
  key.shadow.bias = -0.0004; key.shadow.radius = 6;
  const rim = new THREE.DirectionalLight(SIROCCO_COLORS.terra, 1.6);
  const fill = new THREE.DirectionalLight(SIROCCO_COLORS.sand, 0.35);
  const glow = new THREE.PointLight(0xff7a3d, 1.2, 2.5, 2);
  scene.add(key, key.target, rim, rim.target, fill, fill.target, glow);

  let composer = null, bloomPass = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.92);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  const target = new THREE.Vector3(), tmp = new THREE.Vector3();
  function setTime(t) {
    for (const m of steps) m.position.y = m.userData.i * HS - 15 + stepOffset(m.userData.i, t);
    coinPose(t, coin);
    const k = t / PC;
    target.set(0.36 + D * k, R + 0.18 + HS * k, 0);
    camera.position.copy(target).add(CAM_OFFSET);
    camera.lookAt(target);
    key.position.copy(target).add(tmp.set(2.2, 5.5, -2.0)); key.target.position.copy(target);
    rim.position.copy(target).add(tmp.set(3.5, 1.6, -4.5)); rim.target.position.copy(target);
    fill.position.copy(target).add(tmp.set(-4, 1.5, 4)); fill.target.position.copy(target);
    glow.position.copy(coin.position).add(tmp.set(0.35, 0.45, -0.7));
    tmp.copy(coin.position).sub(camera.position).normalize().multiplyScalar(0.9);
    halo.position.copy(coin.position).add(tmp);
    halo.position.x += 0.05; halo.position.y += 0.12;
  }

  let frame = FRAMINGS[framing] || FRAMINGS.hero;
  function setSize(w, h, dpr = renderer.getPixelRatio(), framingName) {
    if (framingName) frame = FRAMINGS[framingName] || frame;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
    camera.aspect = w / h;
    camera.fov = frame.fov;
    // portrait: keep the horizontal field of view of a 4:5 frame, whatever the screen height
    if (frame === FRAMINGS.mobile) camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(frame.fov / 2)) * 0.8 / Math.min(1, w / h)));
    // shift the subject without changing perspective (positive shiftX = coin moves right)
    if (frame.shiftX || frame.shiftY) camera.setViewOffset(w, h, -frame.shiftX * w, frame.shiftY * h, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function render(t) {
    setTime(t);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function dispose() {
    scene.traverse(o => { o.geometry?.dispose?.(); });
    [stepMat, coinMat, logoMat, halo.material].forEach(m => m.dispose());
    haloTex.dispose(); envTex.dispose(); pmrem.dispose();
    composer?.dispose?.();
    renderer.dispose();
  }

  setSize(width, height, pixelRatio);
  // geometry constants for vector export
  const geometry = { D, HS, WZ, R, T, faceZ: T / 2 - 0.007, logoScale: 0.33 / 309, logoCenter: [139, 168.5], stepOffset };
  return { renderer, scene, camera, canvas: renderer.domElement, steps, coin, geometry, setSize, setTime, render, dispose };
}
