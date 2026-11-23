// Sirocco "escalator" scene, rebuilt from the Nickel hero reference (5 s, 150 frames @30fps):
// a belt of square tiles flows from the flat landing (right) towards the left, where the tiles
// rise into an escalator of blocks; the coin stands on the landing edge and rolls in place,
// wobbling. Measured from the reference: one tile every 15 frames (0.5 s), coin wobble 75 frames.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIROCCO_LOGO_PATH } from './logo-path.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { inverseACES, SIROCCO_COLORS, THEMES as HERO_THEMES } from './sirocco-coin-scene.js';

export const ESC_LOOP = 5;                 // seconds
const STEP_T = 0.5;                         // one tile passes every 0.5 s
const WOBBLE_T = 2.5;                       // coin wobble period
const D = 1.0;                              // tile depth (along the belt)
const W = 1.0;                              // belt width
const RISE = 0.8;                           // height gained per tile once the escalator is steep
const EASE = 0.55;                          // length of the flat→steep transition (in tiles)
const SPEED = D / STEP_T;
const RC = (SPEED * ESC_LOOP) / (2 * Math.PI * 5); // coin radius: exactly 5 turns per loop (≈0.32)
const TC = 0.1;                             // coin thickness
const N_TILES = 40;

export const ESC_THEMES = {
  // hero terracotta ground, sand belt, gold coin (Sirocco charter)
  terracotta: { bg: '#8f3517', floor: '#9a3a19', floorLine: '#c96a44', floorShade: '#4a1607', tile: '#fbefe4', side: '#6e2a12', key: ['#fff3e8', 3.4], hemi: ['#ffc6a8', '#3a1206', 0.12], fill: ['#ffd9c4', 0.0], exposure: 1.0 },
  // same rig on the dark Sirocco ink, closest to the reference mood
  noir: { bg: '#16100d', floor: '#1a1310', floorLine: '#2a1e18', floorShade: '#000000', tile: '#f6ece2', side: '#2a201b', key: ['#fff3e8', 3.6], hemi: ['#7a5444', '#050302', 0.15], fill: ['#ffd9c4', 0.0], exposure: 1.0 },
};

// the landing hero's art direction, verbatim: glossy lacquered terracotta steps, warm key from behind
// that flashes the treads, rim light, coin glow + halo, bloom, fog (see sirocco-coin-scene.js THEMES)
ESC_THEMES['terracotta-gloss'] = { ...HERO_THEMES['terracotta-gloss'], gloss: true };
ESC_THEMES['noir-gloss'] = { ...HERO_THEMES.noir, gloss: true };

// height of a tile whose centre is at belt position x (x < 0 = past the landing edge)
// rises for STEPS tiles past the landing, then a flat ceiling (the last two blocks level, like the ref)
const STEPS = 3;
function heightAt(x, rise = RISE) {
  const d = Math.min(-x, STEPS * D);
  if (d <= 0) return 0;
  return (rise / D) * d;
}

function grainTexture(size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  for (let i = 0; i < size * size; i++) {
    // fine stipple, like the reference's micro-dotted print texture
    const v = 128 + (Math.random() - 0.5) * 120;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.anisotropy = 8;
  return t;
}

const FLOOR_FRAG = /* glsl */`
uniform vec3 uBase; uniform vec3 uLine; uniform vec3 uShade; varying vec2 vP;
void main(){
  // faint large floor panels
  vec2 g = abs(fract(vP / 2.4) - 0.5);
  float line = smoothstep(0.497, 0.4995, max(g.x, g.y));
  // big soft out-of-focus shadow sweeps (static), like the reference
  float a = dot(vP, normalize(vec2(1.0, -0.35)));
  float b = dot(vP, normalize(vec2(0.35, 1.0)));
  float sh = smoothstep(-1.5, 2.5, sin(a * 0.42 + 0.8 * sin(b * 0.3)) ) * 0.75;
  vec3 col = mix(uBase, uShade, sh * 0.55) + uLine * line * 0.08;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const ESC_FRAMINGS = {
  ref:  { fov: 12.5, shiftX: 0.0, shiftY: 0.0 },
  hero: { fov: 20, shiftX: 0.14, shiftY: 0.0 },
  site: { fov: 17, shiftX: 0.0, shiftY: 0.14 },   // 16:9 web hero: scene in the upper band, room for the headline bottom-left
  site2: { fov: 19, shiftX: 0.04, shiftY: 0.18 },
};

export function createEscalatorScene({ canvas, width, height, pixelRatio = 1, framing = 'ref', theme = 'terracotta', bloom = true, shadows = true, preserveDrawingBuffer = false } = {}) {
  const TH = ESC_THEMES[theme] || ESC_THEMES.terracotta;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TH.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const G = !!TH.gloss;
  const scene = new THREE.Scene();
  const bgIn = inverseACES(new THREE.Color(TH.bg), TH.exposure);
  scene.background = bgIn;
  if (G) scene.fog = new THREE.Fog(bgIn, 13.5, 22); // hero fog, rescaled to this camera distance
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  // floor
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uBase: { value: inverseACES(new THREE.Color(TH.floor), TH.exposure) }, uLine: { value: new THREE.Color(TH.floorLine) }, uShade: { value: inverseACES(new THREE.Color(TH.floorShade), TH.exposure) } },
    vertexShader: 'varying vec2 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
    fragmentShader: FLOOR_FRAG,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.7;
  floor.visible = !G;
  scene.add(floor);
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.35 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.695; catcher.receiveShadow = true; catcher.visible = !G;
  scene.add(catcher);

  // tiles: boxes whose top follows heightAt(); a tall box so its risers and sides show
  const grain = grainTexture();
  const tileMat = new THREE.MeshStandardMaterial({ color: TH.tile, roughness: 0.62, metalness: 0.0, bumpMap: grain, bumpScale: 1.6, envMapIntensity: 0.06 });
  const tileMat2 = tileMat.clone(); tileMat2.color.multiplyScalar(0.94);
  const sideMat = new THREE.MeshStandardMaterial({ color: TH.side, roughness: 0.7, metalness: 0.0, bumpMap: grain, bumpScale: 1.2, envMapIntensity: 0.15 });
  // BoxGeometry face order: +x, -x, +y (tread), -y, +z, -z
  const mats = [tileMat, tileMat, tileMat, sideMat, sideMat, sideMat], mats2 = [tileMat2, tileMat2, tileMat2, sideMat, sideMat, sideMat];
  const BOX_H = 30;
  const stepMat = G ? new THREE.MeshStandardMaterial({ color: TH.step, roughness: TH.stepRough, metalness: TH.stepMetal, envMapIntensity: TH.stepEnv }) : null;
  const tileGeo = G ? new RoundedBoxGeometry(D * 0.996, BOX_H, W, 3, 0.018) : new THREE.BoxGeometry(D * 0.996, BOX_H, W);
  tileGeo.translate(0, -BOX_H / 2, 0); // origin at the top face
  const tiles = [];
  for (let i = 0; i < N_TILES; i++) {
    const m = new THREE.Mesh(tileGeo, G ? stepMat : (i % 2 ? mats : mats2));
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m); tiles.push(m);
  }

  // coin
  const coin = new THREE.Group();
  const coinMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coin, metalness: 1, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.15, envMapIntensity: G ? TH.coinEnv : 1.0 });
  const logoMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coinLogo, metalness: 1, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: G ? TH.coinEnv + 0.1 : 1.1 });
  {
    const k = RC / 0.30, t = TC / 2, hf = t - 0.008, pts = [];
    const add = (r, h) => pts.push(new THREE.Vector2(r * k, h));
    add(0, -hf); add(0.238, -hf); add(0.246, -t + 0.001); add(0.252, -t);
    add(0.285, -t); add(0.296, -t + 0.004); add(0.30, -t + 0.012);
    add(0.30, t - 0.012); add(0.296, t - 0.004); add(0.285, t);
    add(0.252, t); add(0.246, t - 0.001); add(0.238, hf); add(0, hf);
    const g = new THREE.LatheGeometry(pts, 160); g.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(g, coinMat); body.castShadow = true; body.receiveShadow = true; coin.add(body);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 250 309"><path d="${SIROCCO_LOGO_PATH}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap(p => SVGLoader.createShapes(p));
    const s = (0.33 * k) / 309, depth = 13, bt = 3;
    const lg = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: 2.2, bevelSegments: 4, curveSegments: 48 });
    lg.translate(-139, -168.5, 0); lg.scale(s, -s, -s); lg.translate(0, 0, (depth + bt) * s); lg.computeVertexNormals();
    const faceZ = TC / 2 - 0.008;
    const front = new THREE.Mesh(lg, logoMat); front.position.z = faceZ; front.castShadow = true;
    const back = new THREE.Mesh(lg, logoMat); back.rotation.y = Math.PI; back.position.z = -faceZ;
    coin.add(front, back);
  }
  const coinPivot = new THREE.Group(); // stands on the belt, yaw wobble applied here
  coinPivot.add(coin);
  scene.add(coinPivot);

  // lights: strong key from behind-left and above (bright treads, grey risers, black front sides)
  scene.add(new THREE.HemisphereLight(...TH.hemi));
  const key = new THREE.DirectionalLight(...TH.key);
  key.position.set(-6, 9, -6); key.target.position.set(0, 0, 0);
  let glow = null, halo = null, flash = null;
  if (G) {
    // hero rig offsets (relative to the coin): key behind/above, rim grazing from behind, fill from the camera side
    const C = new THREE.Vector3(1.15, 0.3, 0);
    key.position.copy(C).add(new THREE.Vector3(2.2, 5.5, -2.0)); key.target.position.copy(C);
    const rim = new THREE.DirectionalLight(...TH.rim); rim.position.copy(C).add(new THREE.Vector3(3.5, 1.6, -4.5)); rim.target.position.copy(C);
    scene.add(rim, rim.target);
    glow = new THREE.PointLight(TH.glow[0], TH.glow[1], 2.5, 2); scene.add(glow);
    // the hero's blown white flash on a tread: a warm point light placed at the mirror of the view
    flash = new THREE.PointLight('#fff1e0', 0, 0, 2); scene.add(flash);
    const hc = document.createElement('canvas'); hc.width = hc.height = 512;
    const x = hc.getContext('2d'), gr = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    const [c0, c1] = (TH.haloColor || ['#ff8c50', '#c2552d']).map(h => new THREE.Color(h).getRGB({}, THREE.SRGBColorSpace));
    const rgba = (c, a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    gr.addColorStop(0, rgba(c0, 0.9)); gr.addColorStop(0.35, rgba(c1, 0.35)); gr.addColorStop(1, rgba(c1, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    const ht = new THREE.CanvasTexture(hc); ht.colorSpace = THREE.SRGBColorSpace;
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ht, transparent: true, opacity: TH.halo, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.setScalar(1.9 * RC / 0.3); scene.add(halo);
  }
  key.castShadow = shadows; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 40 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(...TH.fill); fill.position.set(6, 4, 3);
  if (G) { fill.position.set(1.15 - 4, 0.3 + 1.5, 4); fill.target.position.set(1.15, 0.3, 0); scene.add(fill.target); }
  scene.add(key, key.target, fill);

  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 200);
  // frontal, slightly high, rolled (Dutch angle) like the reference: belt rises to the top-right
  const cam = { p: new THREE.Vector3(-7.342, 12.076, 6.892), l: new THREE.Vector3(-0.15, 0.78, -0.3), up: new THREE.Vector3(0, 1, 0) }; // Nickel ref: no roll, 3/4 from the front-left, 48° down
  function placeCamera() { camera.position.copy(cam.p); camera.up.copy(cam.up); camera.lookAt(cam.l); }
  placeCamera();

  let composer = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bgLum = 0.2126 * bgIn.r + 0.7152 * bgIn.g + 0.0722 * bgIn.b;
    composer.addPass(G ? new UnrealBloomPass(new THREE.Vector2(256, 256), TH.bloom[0], TH.bloom[1], Math.max(TH.bloom[2], bgLum * 1.35)) : new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.45, 0.95));
    composer.addPass(new OutputPass());
  }

  const TAU = Math.PI * 2, AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const q1 = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const COIN_X = 1.15;               // clear of the first rising block (tiles rise once their centre passes x=0)
  const ZIG_A = W / 2 - 0.14;        // weave across the full belt width, rim never past the edge
  function setTime(t) {
    // belt: tile i centre moves towards -x; wraps every N_TILES tiles (exactly periodic per tile)
    const P = (typeof window !== 'undefined' && window.__escP) || {};
    const rise = P.rise ?? RISE, cs = P.cs ?? 1, cx = P.cx ?? COIN_X;
    const shift = (t * SPEED) % (2 * D);
    for (let i = 0; i < N_TILES; i++) {
      const x = (i - N_TILES / 2) * D + D / 2 - shift + 8;
      const m = tiles[i];
      m.position.set(x, heightAt(x, rise), 0);
    }
    // coin rolls in place (ground slides under it), wobbles in yaw, leans a touch
    const ph = TAU * (t / WOBBLE_T);
    const roll = -(t * SPEED) / RC;
    // zigzag across the belt, 2 weaves per loop; the coin steers into its direction of travel
    const zig = ZIG_A * Math.sin(ph), vz = ZIG_A * (TAU / WOBBLE_T) * Math.cos(ph);
    const yaw = Math.atan2(-vz, SPEED);
    const lean = 0.04 * Math.sin(ph + 1.2);
    coin.quaternion.setFromAxisAngle(AZ, roll);
    coinPivot.quaternion.setFromAxisAngle(AY, yaw).multiply(q1.setFromAxisAngle(AX, lean));
    coinPivot.scale.setScalar(cs);
    coinPivot.position.set(cx, RC * cs, zig);
    if (flash) {
      const fx = P.fx ?? -0.5, fy = P.fy ?? 0.5, fz = P.fz ?? 0.0, fd = P.fd ?? 1.5;
      v1.copy(camera.position).sub(v2.set(fx, fy, fz)).normalize(); v1.x = -v1.x; v1.z = -v1.z;
      flash.position.set(fx, fy, fz).addScaledVector(v1, fd); flash.intensity = P.fi ?? 9;
    }
    if (glow) glow.position.copy(coinPivot.position).add(v1.set(0.35, 0.45, -0.7));
    if (halo) { v1.copy(coinPivot.position).sub(camera.position).normalize().multiplyScalar(0.9); halo.position.copy(coinPivot.position).add(v1); halo.position.y += 0.12; }
  }

  let frame = ESC_FRAMINGS[framing] || ESC_FRAMINGS.ref;
  function setSize(w, h, dpr = renderer.getPixelRatio()) {
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
    camera.aspect = w / h; camera.fov = frame.fov;
    if (frame.shiftX || frame.shiftY) camera.setViewOffset(w, h, -frame.shiftX * w, frame.shiftY * h, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function render(t) { setTime(t); if (composer) composer.render(); else renderer.render(scene, camera); }
  function dispose() { scene.traverse(o => o.geometry?.dispose?.()); renderer.dispose(); pmrem.dispose(); envTex.dispose(); grain.dispose(); }
  setSize(width, height, pixelRatio);
  return { renderer, scene, camera, canvas: renderer.domElement, coin, cam, placeCamera, key, setSize, setTime, render, dispose };
}
