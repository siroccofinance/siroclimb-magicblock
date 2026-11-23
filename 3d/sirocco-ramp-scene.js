// Sirocco "ramp" scene: a long strip climbing diagonally, jagged like a price chart on the left
// (volatility) that smooths into a steady ramp on the right, with the gold Sirocco coin rocking
// on its edge right where the two meet. Static camera, seamless 5 s loop (2 rocking cycles).
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIROCCO_LOGO_PATH } from './logo-path.js';
import { inverseACES, SIROCCO_COLORS } from './sirocco-coin-scene.js';

export const RAMP_LOOP = 5;              // seconds
const ROCK = RAMP_LOOP / 2;               // one rocking cycle
const SLOPE = 0.6;                       // ramp angle (rad)
const WZ = 2.1;                          // strip width
const R = 0.46, T = 0.12;                  // coin radius, thickness
// jagged part (a folded zigzag, like a volatile price line), from the junction backwards:
// [down length, up length, peak above the mean line, dip below it]
const TEETH = [[0.22, 0.5, 0.28, 0.08], [0.3, 0.75, 0.6, 0.16], [0.32, 0.85, 0.75, 0.22], [0.3, 0.8, 0.62, 0.2], [0.34, 0.9, 0.8, 0.26], [0.3, 0.85, 0.66, 0.24], [0.34, 0.9, 0.78, 0.26], [0.3, 0.8, 0.7, 0.22], [0.34, 0.95, 0.82, 0.26], [0.3, 0.85, 0.68, 0.24], [0.32, 0.9, 0.8, 0.26], [0.3, 0.85, 0.7, 0.24], [0.34, 0.9, 0.78, 0.26], [0.3, 0.85, 0.7, 0.24], [0.34, 0.9, 0.78, 0.26]];
const FLAT = 14, BASE = 0.32;
const TS = Math.tan(SLOPE), m = x => x * TS; // mean line (world)

export const RAMP_THEMES = {
  // closest to the reference: near-black aubergine ground, pale strip, gold coin
  noir: { bg: '#15100e', strip: '#efe2d2', side: '#3a2820', floor: '#15100e', key: ['#fff1e0', 3.4], rim: ['#ffb184', 1.2], hemi: ['#5a3a2c', '#060403', 0.18], band: '#b8603c', bandAmt: 0.1, exposure: 1.0 },
  // site colours: hero terracotta ground, sand strip
  terracotta: { bg: '#a8441f', strip: '#ffe3cf', side: '#7a2c12', floor: '#a8441f', key: ['#fff2e4', 3.2], rim: ['#ffcfae', 1.1], hemi: ['#ffb08a', '#3a1206', 0.3], band: '#ffd2b4', bandAmt: 0.16, exposure: 1.0 },
};

export const RAMP_FRAMINGS = {
  ref:    { fov: 29, shiftX: 0.0, shiftY: 0.0 },     // 4:3 like the reference
  hero:   { fov: 26, shiftX: 0.16, shiftY: 0.02 },   // 16:9, left side free for the headline
  mobile: { fov: 36, shiftX: 0.04, shiftY: -0.12 },
};

// strip profile in the ramp frame (x along the slope, y = height above the mean line)
// world-space profile, right to left: smooth ramp, then the zigzag
function profile() {
  const top = [[FLAT, m(FLAT)], [0, 0]];
  let x = 0;
  for (const [down, up, peak, dip] of TEETH) {
    x -= down; top.push([x, m(x) + peak]);
    x -= up;   top.push([x, m(x) - dip]);
  }
  top.push([x - 4, m(x - 4) - 0.2]);
  return top;
}

function grainTexture(size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    // fine diagonal brushed grain + random speckle, like the reference's micro-textured paper/metal
    const v = 128 + 38 * Math.sin((x + y * 0.35) * 0.9 + Math.sin(y * 0.05) * 3) * 0.35 + (Math.random() - 0.5) * 70;
    d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v)); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14);
  return t;
}

const FLOOR_FRAG = /* glsl */`
uniform vec3 uBase; uniform vec3 uBand; uniform float uAmt; uniform float uT; varying vec2 vP;
const float TAU = 6.2831853;
void main(){
  // soft diagonal light folds, like the out-of-focus fabric in the reference; slow periodic drift
  float d = dot(vP, normalize(vec2(1.0, 0.55)));
  float e = dot(vP, normalize(vec2(-0.4, 1.0)));
  float f = 0.5 + 0.5 * sin(d * 0.55 + 0.6 * sin(e * 0.35) + 0.25 * sin(TAU * uT));
  f = pow(f, 3.0) * (0.6 + 0.4 * sin(e * 0.22 + 1.3));
  vec3 col = uBase + uBand * f * uAmt;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createRampScene({ canvas, width, height, pixelRatio = 1, framing = 'ref', theme = 'terracotta', bloom = true, shadows = true, preserveDrawingBuffer = false } = {}) {
  const TH = RAMP_THEMES[theme] || RAMP_THEMES.terracotta;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TH.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bgIn = inverseACES(new THREE.Color(TH.bg), TH.exposure);
  scene.background = bgIn;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  // the whole strip lives in a group tilted by SLOPE, so "flat" = steady climb
  const ramp = new THREE.Group();
  scene.add(ramp);

  const grain = grainTexture();
  const stripMat = new THREE.MeshStandardMaterial({ color: TH.strip, roughness: 0.55, metalness: 0.05, bumpMap: grain, bumpScale: 1.2, roughnessMap: grain, envMapIntensity: 0.25 });
  const sideMat = new THREE.MeshStandardMaterial({ color: TH.side, roughness: 0.7, metalness: 0.0, bumpMap: grain, bumpScale: 0.4, envMapIntensity: 0.2 });

  // build the strip as an extruded closed profile (top edge = chart line, bottom = BASE below)
  const top = profile();
  const shape = new THREE.Shape();
  shape.moveTo(top[0][0], m(top[0][0]) - BASE);
  for (const [x, y] of top) shape.lineTo(x, y);
  const xl = top[top.length - 1][0];
  shape.lineTo(xl, m(xl) - BASE - 0.4);
  shape.closePath();
  const stripGeo = new THREE.ExtrudeGeometry(shape, { depth: WZ, bevelEnabled: false, steps: 1 });
  stripGeo.translate(0, 0, -WZ / 2);
  // planar UVs so the grain keeps a constant scale on every face
  {
    const p = stripGeo.attributes.position, uv = stripGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) * 0.35, (p.getY(i) + p.getZ(i)) * 0.35);
  }
  stripGeo.computeVertexNormals();
  const strip = new THREE.Mesh(stripGeo, [sideMat, stripMat]);
  // ExtrudeGeometry groups: 0 = caps (front/back faces), 1 = sides (the top surface + risers)
  strip.castShadow = true; strip.receiveShadow = true;
  ramp.add(strip);

  // tile seams on the smooth part (thin dark grooves, like the reference's panels)
  const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(TH.strip).multiplyScalar(0.72), transparent: true, opacity: 0.55 });
  for (let x = 1.0; x < FLAT; x += 1.0) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.008, WZ), seamMat);
    s.rotation.set(-Math.PI / 2, SLOPE, 0, 'YXZ'); s.rotation.set(0, 0, 0);
    s.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), SLOPE));
    s.position.set(x, m(x) + 0.003, 0);
    ramp.add(s);
  }

  // floor far below with soft light folds
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uBase: { value: inverseACES(new THREE.Color(TH.floor), TH.exposure) }, uBand: { value: new THREE.Color(TH.band) }, uAmt: { value: TH.bandAmt }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
    fragmentShader: FLOOR_FRAG,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.2;
  scene.add(floor);
  // shadow catcher on top of the floor
  const shadowCatch = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.position.y = -3.19; shadowCatch.receiveShadow = true;
  scene.add(shadowCatch);

  // coin (same build as the hero coin)
  const coin = new THREE.Group();
  const coinMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coin, metalness: 1, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });
  const logoMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coinLogo, metalness: 1, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 1.0 });
  {
    const k = R / 0.30, t = T / 2, hf = t - 0.007, pts = [];
    const add = (r, h) => pts.push(new THREE.Vector2(r * k, h));
    add(0, -hf); add(0.238, -hf); add(0.246, -t + 0.001); add(0.252, -t);
    add(0.285, -t); add(0.296, -t + 0.004); add(0.30, -t + 0.012);
    add(0.30, t - 0.012); add(0.296, t - 0.004); add(0.285, t);
    add(0.252, t); add(0.246, t - 0.001); add(0.238, hf); add(0, hf);
    const g = new THREE.LatheGeometry(pts, 160);
    g.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(g, coinMat); body.castShadow = true; body.receiveShadow = true;
    coin.add(body);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 250 309"><path d="${SIROCCO_LOGO_PATH}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap(p => SVGLoader.createShapes(p));
    const s = (0.33 * k) / 309, depth = 13, bt = 3;
    const lg = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: 2.2, bevelSegments: 4, curveSegments: 48 });
    lg.translate(-139, -168.5, 0); lg.scale(s, -s, -s); lg.translate(0, 0, (depth + bt) * s);
    lg.computeVertexNormals();
    const faceZ = T / 2 - 0.007;
    const front = new THREE.Mesh(lg, logoMat); front.position.z = faceZ; front.castShadow = true;
    const back = new THREE.Mesh(lg, logoMat); back.rotation.y = Math.PI; back.position.z = -faceZ;
    coin.add(front, back);
  }
  // pivot: the coin stands upright on the ramp
  const coinPivot = new THREE.Group();
  scene.add(coinPivot);
  coinPivot.add(coin);

  // lights: key from behind/above (bright tops, dark risers facing the camera), soft rim, hemi
  scene.add(new THREE.HemisphereLight(...TH.hemi));
  const key = new THREE.DirectionalLight(...TH.key);
  key.position.set(-2.2, 9, 2.5); key.target.position.set(0.5, 0.2, 0);
  key.castShadow = shadows; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; key.shadow.radius = 5;
  const rim = new THREE.DirectionalLight(...TH.rim);
  rim.position.set(6, 4, -5); rim.target.position.set(0.5, 0.2, 0);
  const fill = new THREE.DirectionalLight('#ffffff', 0.25);
  fill.position.set(-2, 3, 6);
  scene.add(key, key.target, rim, rim.target, fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const LOOK = new THREE.Vector3(-0.55, -0.15, 0);
  camera.position.set(2.1, 4.7, 8.6);
  camera.lookAt(LOOK);

  let composer = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.4, 0.95));
    composer.addPass(new OutputPass());
  }

  const TAU = Math.PI * 2;
  function setTime(t) {
    const ph = TAU * (t / ROCK);
    // rolling back and forth on the spot + yaw swing + slight lean, all periodic in ROCK
    const roll = 0.42 * Math.sin(ph);
    const yaw = -0.55 + 0.5 * Math.sin(ph + 0.9);
    const lean = 0.07 * Math.sin(ph * 2 + 0.4);
    const cx = 0.78 - roll * R * 0.5;
    coinPivot.position.set(cx, m(cx) + R * Math.cos(SLOPE) * 0.98 + 0.02, 0);
    coinPivot.rotation.set(0, 0, 0);
    coin.rotation.set(0, 0, 0);
    coin.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -roll);
    coin.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean));
    coin.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    floorMat.uniforms.uT.value = (t / RAMP_LOOP) % 1;
  }

  let frame = RAMP_FRAMINGS[framing] || RAMP_FRAMINGS.ref;
  function setSize(w, h, dpr = renderer.getPixelRatio()) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
    camera.aspect = w / h;
    camera.fov = frame.fov;
    if (frame.shiftX || frame.shiftY) camera.setViewOffset(w, h, -frame.shiftX * w, frame.shiftY * h, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function render(t) { setTime(t); if (composer) composer.render(); else renderer.render(scene, camera); }
  function dispose() { scene.traverse(o => o.geometry?.dispose?.()); renderer.dispose(); pmrem.dispose(); envTex.dispose(); grain.dispose(); }
  setSize(width, height, pixelRatio);
  return { renderer, scene, camera, canvas: renderer.domElement, coin, setSize, setTime, render, dispose, LOOK };
}
