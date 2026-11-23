// Sirocco "coin box": a stream of Sirocco coins rising out of a low octagonal box through a
// pinched-square slot. Same look as the stairs film (glossy terracotta, warm rim light, bloom).
// Deterministic: render(t) draws the same frame for the same t; loops every BOX_LOOP seconds.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIROCCO_LOGO_PATH } from './logo-path.js';
import { THEMES, inverseACES, SIROCCO_COLORS } from './sirocco-coin-scene.js';

export const BOX_LOOP = 6;           // seconds
const N = 12;                         // coins per loop  → one coin every 0.5 s
const PERIOD = BOX_LOOP / N;
const LIFE = 15 * PERIOD;              // time a coin takes from inside the box to out of frame
const R = 0.30, T = 0.09;             // coin radius / thickness (same coin as the stairs film)

// box
const BOX_R = 1.25;                   // octagon circumradius
const BOX_H = 0.5;
const SLOT = 0.43;                    // slot half-size

export const BOX_FRAMINGS = {
  hero:   { fov: 30, shiftX: 0.17, shiftY: 0 },
  center: { fov: 30, shiftX: 0, shiftY: 0 },
  mobile: { fov: 36, shiftX: 0, shiftY: -0.04 },
};

const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function octagonShape(r, round) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const p = pts[i], prev = pts[(i + 7) % 8], next = pts[(i + 1) % 8];
    const a = p.clone().add(prev.clone().sub(p).setLength(round));
    const b = p.clone().add(next.clone().sub(p).setLength(round));
    if (i === 0) s.moveTo(a.x, a.y); else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(p.x, p.y, b.x, b.y);
  }
  s.closePath();
  return s;
}
// pinched square: rounded corners on the diagonals, concave sides facing the box faces
function slotPoints(a, n = 160) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const r = a * (1 - 0.17 * Math.cos(4 * th)) / (1 - 0.17);
    pts.push(new THREE.Vector2(Math.cos(th) * r * 0.86, Math.sin(th) * r * 0.86));
  }
  return pts;
}

function buildCoin(TH) {
  const coin = new THREE.Group();
  const coinMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coin, metalness: 1, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.18, envMapIntensity: TH.coinEnv });
  const logoMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coinLogo, metalness: 1, roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: TH.coinEnv + 0.1 });
  const t = T / 2, hf = t - 0.007, pts = [];
  const add = (r, h) => pts.push(new THREE.Vector2(r, h));
  add(0, -hf); add(0.238, -hf); add(0.246, -t + 0.001); add(0.252, -t);
  add(0.285, -t); add(0.296, -t + 0.004); add(R, -t + 0.012);
  add(R, t - 0.012); add(0.296, t - 0.004); add(0.285, t);
  add(0.252, t); add(0.246, t - 0.001); add(0.238, hf); add(0, hf);
  const g = new THREE.LatheGeometry(pts, 128); g.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(g, coinMat); body.castShadow = true;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 250 309"><path d="${SIROCCO_LOGO_PATH}"/></svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap(p => SVGLoader.createShapes(p));
  const s = 0.33 / 309, depth = 13, bt = 3;
  const lg = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: 2.2, bevelSegments: 3, curveSegments: 32 });
  lg.translate(-139, -168.5, 0); lg.scale(s, -s, -s); lg.translate(0, 0, (depth + bt) * s); lg.computeVertexNormals();
  const faceZ = T / 2 - 0.007;
  const front = new THREE.Mesh(lg, logoMat); front.position.z = faceZ;
  const back = new THREE.Mesh(lg, logoMat); back.rotation.y = Math.PI; back.position.z = -faceZ;
  coin.add(body, front, back);
  return { coin, geo: [g, lg], mats: [coinMat, logoMat] };
}

export function createBoxScene({ canvas, width, height, pixelRatio = 1, framing = 'hero', theme = 'terracotta-gloss', bloom = true, shadows = true, preserveDrawingBuffer = false } = {}) {
  const TH = typeof theme === 'string' ? THEMES[theme] || THEMES['terracotta-gloss'] : theme;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer, powerPreference: 'high-performance' });
  renderer.toneMapping = TH.toneMapping === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = TH.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bgIn = TH.toneMapping === 'aces' ? inverseACES(new THREE.Color(TH.bg), TH.exposure) : new THREE.Color(TH.bg);
  scene.background = bgIn;
  scene.fog = new THREE.Fog(bgIn, 9, 17);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 1.75, 0);
  camera.position.set(-1.45, 3.3, 9.6);
  camera.lookAt(target);

  // ── box
  const boxMat = new THREE.MeshStandardMaterial({ color: TH.step, roughness: TH.stepRough, metalness: TH.stepMetal, envMapIntensity: TH.stepEnv });
  const shape = octagonShape(BOX_R, 0.09);
  const slot = slotPoints(SLOT);
  shape.holes.push(new THREE.Path(slot.slice().reverse()));
  const bev = 0.035;
  const boxGeo = new THREE.ExtrudeGeometry(shape, { depth: BOX_H - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 24 });
  boxGeo.rotateX(-Math.PI / 2); boxGeo.translate(0, bev, 0);
  const box = new THREE.Mesh(boxGeo, boxMat); box.castShadow = true; box.receiveShadow = true;
  scene.add(box);
  // inside of the slot: dark well floor
  const wellMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(TH.step).multiplyScalar(0.35), roughness: 0.6, metalness: 0.3 });
  const well = new THREE.Mesh(new THREE.CircleGeometry(SLOT * 1.3, 48), wellMat); well.rotation.x = -Math.PI / 2; well.position.y = 0.02;
  scene.add(well);

  // ── glowing rims (top outer edge, bottom outer edge, slot lip)
  const o = {}; new THREE.Color(TH.bg).getHSL(o);
  const rimCol = new THREE.Color().setHSL(o.h, 1, 0.6).multiplyScalar(1.9);
  const rimMat = new THREE.MeshBasicMaterial({ color: rimCol, toneMapped: true, fog: false });
  const tube = (pts2, y, rad) => {
    const curve = new THREE.CatmullRomCurve3(pts2.map(p => new THREE.Vector3(p.x, y, -p.y)), true, 'centripetal');
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, rad, 8, true), rimMat);
    scene.add(m); return m;
  };
  const outline = octagonShape(BOX_R + bev * 0.65, 0.09 + bev * 0.3).getSpacedPoints(400);
  const rims = [tube(outline, BOX_H - 0.012, 0.017), tube(outline, 0.014, 0.017), tube(slotPoints(SLOT - bev * 0.55, 200), BOX_H - 0.004, 0.015)];

  // ── floor (shadow only, melts into the background) + soft light pool
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: new THREE.Color(TH.step).multiplyScalar(0.25), opacity: 0.38 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const aoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 60, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(BOX_R * 2.9, BOX_R * 2.9), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, color: new THREE.Color(TH.step).multiplyScalar(0.5) }));
  ao.rotation.x = -Math.PI / 2; ao.position.y = 0.002; scene.add(ao);

  // halo behind the stream
  const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 512;
  {
    const x = haloCanvas.getContext('2d'), g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    const [hc0, hc1] = (TH.haloColor || ['#ff8c50', '#c2552d']).map(h => new THREE.Color(h).getRGB({}, THREE.SRGBColorSpace));
    const rgba = (c, a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    g.addColorStop(0, rgba(hc0, 0.9)); g.addColorStop(0.35, rgba(hc1, 0.35)); g.addColorStop(1, rgba(hc1, 0));
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  }
  const haloTex = new THREE.CanvasTexture(haloCanvas); haloTex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: TH.halo * 1.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(3.4); halo.position.set(0.1, 1.6, -1.6); scene.add(halo);

  // ── lights (the stairs rig, placed around the box)
  scene.add(new THREE.HemisphereLight(...TH.hemi));
  const key = new THREE.DirectionalLight(...TH.key);
  key.position.set(1.3, 3.4, -5.8);
  // shadows come from an (almost dark) overhead light, so they fall under the box like the reference
  const sun = new THREE.DirectionalLight('#ffffff', 0.001);
  sun.position.set(1.4, 7.5, 1.2); sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 16 });
  sun.shadow.bias = -0.0004; sun.shadow.radius = 9;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(...TH.rim); rim.position.set(3.5, 2.2, -4.5);
  const fill = new THREE.DirectionalLight(...TH.fill); fill.position.set(-4, 2, 4);
  const glow = new THREE.PointLight(TH.glow[0], TH.glow[1] * 0.5, 2.2, 2); glow.position.set(0.2, BOX_H + 1.2, -0.8);
  scene.add(key, rim, fill, glow);

  // ── coins
  const proto = buildCoin(TH);
  const coins = [];
  for (let i = 0; i < Math.ceil(LIFE / PERIOD) + 1; i++) { const c = proto.coin.clone(); scene.add(c); coins.push(c); }

  const Y0 = 0.1, Y1 = 7.3;          // start inside the box, end above the frame
  function pose(c, age, k) {
    // k: coin index modulo N → its personality (seamless loop)
    const h1 = hash(k), h2 = hash(k + 17.3), h3 = hash(k + 41.9);
    const a = age / LIFE;
    const y = Y0 + (Y1 - Y0) * (1 - Math.pow(1 - a, 1.35));
    const sway = 0.05 * Math.sin(2 * Math.PI * (a * 0.9 + h2));
    c.position.set((h1 - 0.5) * 0.12 + sway, y, (h3 - 0.5) * 0.1);
    // emerging edge-up out of the slot, then settling into a tilted, wobbling tumble
    const emerge = THREE.MathUtils.smoothstep(a, 0.0, 0.16);
    const flips = k % 3 === 1 ? 1 : 0;
    const tilt = -Math.PI / 2 + 0.55 + 0.32 * Math.sin(2 * Math.PI * (a * 1.15 + h1));
    c.rotation.set(
      THREE.MathUtils.lerp(-0.12, tilt, emerge) + flips * 2 * Math.PI * THREE.MathUtils.smoothstep(a, 0.25, 0.75),
      h2 * Math.PI * 2 + a * (1.2 + h3),
      0.35 * Math.sin(2 * Math.PI * (a * 0.8 + h3)) * emerge,
      'YXZ');
    c.visible = a >= 0 && a <= 1;
    if (y - R < 0.03) c.position.y = Math.max(y, 0.03 + R * Math.abs(Math.cos(c.rotation.x)) * 0);
  }

  function setTime(t) {
    const tt = ((t % BOX_LOOP) + BOX_LOOP) % BOX_LOOP;
    const kNow = Math.floor(tt / PERIOD);
    for (let j = 0; j < coins.length; j++) {
      const k = kNow - j;                               // coin spawned k periods ago
      const age = tt - k * PERIOD;
      pose(coins[j], age, ((k % N) + N) % N);
    }
  }

  let composer = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bgLum = 0.2126 * bgIn.r + 0.7152 * bgIn.g + 0.0722 * bgIn.b;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), TH.bloom[0], TH.bloom[1], Math.max(TH.bloom[2], bgLum * 1.35)));
    composer.addPass(new OutputPass());
  }

  let frame = BOX_FRAMINGS[framing] || BOX_FRAMINGS.hero;
  function setSize(w, h, dpr = renderer.getPixelRatio(), framingName) {
    if (framingName) frame = BOX_FRAMINGS[framingName] || frame;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
    camera.aspect = w / h;
    camera.fov = frame === BOX_FRAMINGS.mobile ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(frame.fov / 2)) * 0.8 / Math.min(1, w / h))) : frame.fov;
    if (frame.shiftX || frame.shiftY) camera.setViewOffset(w, h, -frame.shiftX * w, frame.shiftY * h, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function render(t) { setTime(t); if (composer) composer.render(); else renderer.render(scene, camera); }
  function dispose() { renderer.dispose(); envTex.dispose(); pmrem.dispose(); }
  setSize(width, height, pixelRatio);
  return { renderer, scene, camera, canvas: renderer.domElement, setSize, setTime, render, dispose, box, coins, rims };
}
