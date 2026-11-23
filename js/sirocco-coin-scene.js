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
  coinLogo: '#f2c94c',   // safran, the logo colour
  stepTop: '#24140e',
  terra: '#c2552d',
  terraLight: '#ff8a52',
  sand: '#ffe6c2',
};


// Colour themes. "noir" is the original dark film; the others are monochrome "clay" scenes
// where the steps share the background colour and light alone shapes them.
const LIGHT = (bg, sky, ground, extra = {}) => ({
  bg, step: bg, stepRough: 0.62, stepMetal: 0.0, stepEnv: 0.25, toneMapping: 'none', exposure: 1,
  hemi: [sky, ground, 1.45], key: ['#fff4e6', 1.35], rim: ['#ffffff', 0.35], fill: ['#fff1e2', 0.55], glow: ['#ffd27a', 0.0],
  coinEnv: 1.0, bloom: [0.18, 0.4, 0.97], halo: 0.0, fog: [7.5, 15], ...extra,
});
// "Glossy" themes: exactly the noir rig (glossy metal steps, coloured key/rim, bloom, halo, fog),
// recoloured from one background hue. k scales every light for brighter backgrounds.
const hsl = (h, s, l) => '#' + new THREE.Color().setHSL(h, s, l).getHexString();
const GLOSS = (bg, { k = 1, stepL, stepS = 0.45, keyL = 0.66, halo = 0.16, bloom = 0.35, hue } = {}) => {
  const c = new THREE.Color(bg), o = {}; c.getHSL(o);
  if (hue !== undefined) o.h = hue; // warmer steps/lights than a pale background's own hue
  return {
    gloss: true, bg, step: hsl(o.h, stepS, stepL), stepRough: 0.3, stepMetal: 0.55, stepEnv: 0.12 * k,
    toneMapping: 'aces', exposure: 1.05,
    hemi: [hsl(o.h, 0.5, 0.27), hsl(o.h, 0.4, 0.02), 0.2 * k], key: [hsl(o.h, 1, keyL), 1.3 * k], rim: [hsl(o.h, 0.62, 0.47), 1.6 * k],
    fill: ['#ffe6c2', 0.35 * k], glow: [hsl(o.h, 1, 0.62), 1.2 * k], coinEnv: 0.7,
    bloom: [bloom, 0.5, 0.92], halo, haloColor: [hsl(o.h, 1, 0.66), hsl(o.h, 0.62, 0.47)], fog: [6.2, 12.5],
  };
};
export const THEMES = {
  noir: {
    bg: '#0b0807', step: '#24140e', stepRough: 0.3, stepMetal: 0.55, stepEnv: 0.12, toneMapping: 'aces', exposure: 1.05,
    hemi: ['#6a3322', '#050302', 0.2], key: ['#ff8a52', 1.3], rim: ['#c2552d', 1.6], fill: ['#ffe6c2', 0.35], glow: ['#ff7a3d', 1.2],
    coinEnv: 0.7, bloom: [0.35, 0.5, 0.92], halo: 0.16, fog: [6.2, 12.5],
  },
  terracotta: LIGHT('#C2552D', '#ffd9c4', '#6b2410', { hemi: ['#ffd9c4', '#6b2410', 1.45], key: ['#ffe9d6', 1.45], rim: ['#ffc2a0', 0.5] }),
  argile: LIGHT('#D9845F', '#ffe6d6', '#7a3a20'),
  peche: LIGHT('#EBB79C', '#fff0e6', '#9a5a3c'),
  dune: LIGHT('#F1E6D4', '#ffffff', '#a8927a', { hemi: ['#ffffff', '#a8927a', 1.38], key: ['#fff4e6', 1.25] }),
  sable: LIGHT('#FBF6EE', '#ffffff', '#b8a68e', { hemi: ['#ffffff', '#b8a68e', 1.35], key: ['#fff4e6', 1.2] }),
  'terracotta-gloss': GLOSS('#C2552D', { k: 1.25, stepL: 0.17, stepS: 0.62, halo: 0.1, bloom: 0.3 }),
  'argile-gloss': GLOSS('#D9845F', { k: 1.4, stepL: 0.24, stepS: 0.56, halo: 0.1, bloom: 0.3 }),
  'peche-gloss': GLOSS('#EBB79C', { k: 1.55, stepL: 0.33, stepS: 0.5, halo: 0.08, bloom: 0.28 }),
  'dune-gloss': GLOSS('#F1E6D4', { hue: 0.065, k: 1.65, stepL: 0.4, stepS: 0.3, keyL: 0.72, halo: 0.06, bloom: 0.26 }),
  'sable-gloss': GLOSS('#FBF6EE', { hue: 0.07, k: 1.75, stepL: 0.47, stepS: 0.26, keyL: 0.74, halo: 0.06, bloom: 0.25 }),
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
// Linear colour that three's ACESFilmicToneMapping turns into `target` (so the page colour matches exactly).
export function inverseACES(target, exposure) {
  const IN = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777);
  const OUT = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602);
  const y = new THREE.Vector3(target.r, target.g, target.b).applyMatrix3(OUT.clone().invert());
  const v = y.toArray().map(t => {
    t = Math.min(Math.max(t, 0), 1.01);
    const A = 1 - 0.983729 * t, B = 0.0245786 - 0.432951 * t, C = -(0.000090537 + 0.238081 * t);
    return Math.abs(A) < 1e-6 ? -C / B : (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  });
  const x = new THREE.Vector3(...v).applyMatrix3(IN.clone().invert()).multiplyScalar(0.6 / exposure);
  return new THREE.Color(Math.max(0, x.x), Math.max(0, x.y), Math.max(0, x.z));
}


// ───────────────────────── backdrop effects ─────────────────────────
const SHEEN_FRAG = /* glsl */`
uniform float uT; uniform vec2 uRes; uniform vec3 uTint; uniform vec3 uSpark; uniform float uAmt;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
const float TAU = 6.2831853;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float a = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * a, uv.y);
  // warm light pooling where the key light comes from (upper right, behind the stairs)
  vec2 L = vec2(0.80 * a, 1.02);
  float pool = exp(-dot(p - L, p - L) * 1.6);
  // lacquer reflections: soft static bands that breathe + one glint sweeping across per loop
  float d = dot(p, normalize(vec2(1.0, 0.62)));
  float bands = 0.0;
  for (int i = 0; i < 3; i++) { float fi = float(i);
    float c = 0.55 + fi * 0.48; float w = 0.11 - fi * 0.025;
    bands += exp(-pow((d - c) / w, 2.0)) * (0.55 + 0.45 * sin(TAU * (uT + fi * 0.31))) * (0.30 - fi * 0.06);
  }
  float c = fract(uT) * 3.0 - 0.6;
  float glint = exp(-pow((d - c) / 0.045, 2.0)) * 0.55 + exp(-pow((d - c) / 0.16, 2.0)) * 0.22;
  float refl = (bands + glint) * (0.35 + 1.1 * pool);
  // bokeh: large soft discs drifting on small circles
  float bok = 0.0;
  for (int k = 0; k < 2; k++) { float S = k == 0 ? 0.26 : 0.17;
    vec2 g = floor(p / S);
    for (int j = 0; j < 9; j++) { vec2 cell = g + vec2(float(j - (j / 3) * 3) - 1.0, float(j / 3) - 1.0);
      float h = hash(cell + float(k) * 17.0); if (h < 0.55) continue;
      vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7));
      vec2 q = (cell + o) * S + 0.018 * vec2(cos(TAU * (uT + h)), sin(TAU * (uT + h)));
      float r = mix(0.018, 0.045, hash(cell + 1.3)) * (k == 0 ? 1.0 : 0.65);
      float e = smoothstep(r, r * 0.55, length(p - q));
      bok += e * (0.06 + 0.06 * sin(TAU * (uT + h * 3.0))) * (0.5 + pool);
    }
  }
  // sparkles: tiny star glints that twinkle (1 or 2 times per loop)
  float sp = 0.0; float S2 = 0.085; vec2 g2 = floor(p / S2);
  for (int j = 0; j < 9; j++) { vec2 cell = g2 + vec2(float(j - (j / 3) * 3) - 1.0, float(j / 3) - 1.0);
    float h = hash(cell + 41.0); if (h < 0.62) continue;
    vec2 o = vec2(hash(cell + 5.3), hash(cell + 9.1));
    vec2 q = (cell + o) * S2 + 0.01 * vec2(cos(TAU * (uT + h)), sin(TAU * (uT + h)));
    vec2 v = p - q; float n = h > 0.85 ? 2.0 : 1.0;
    float tw = pow(max(0.0, sin(TAU * (uT * n + h * 5.0))), 6.0);
    float core = exp(-dot(v, v) / 0.0000055);
    float flare = exp(-abs(v.x) / 0.018) * exp(-abs(v.y) / 0.0011) + exp(-abs(v.y) / 0.018) * exp(-abs(v.x) / 0.0011);
    sp += (core * 1.6 + flare * 0.5) * tw * (0.35 + pool * 1.4);
  }
  vec3 col = uTint * (refl + pool * 0.18 + bok) + uSpark * sp;
  gl_FragColor = vec4(col * uAmt, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const LOGO_VERT = /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LOGO_FRAG = /* glsl */`
uniform float uT; uniform vec3 uCol; uniform vec3 uHi; uniform float uOp;
varying vec2 vP; const float TAU = 6.2831853;
void main(){
  // vertical gradient (lighter at the top, where the light comes from) + a glint crossing once per loop
  float grad = 0.65 + 0.55 * (vP.y + 0.5);
  float d = vP.x * 0.62 + vP.y; float c = fract(uT) * 2.6 - 1.3;
  float glint = exp(-pow((d - c) / 0.07, 2.0)) * 0.55 + exp(-pow((d - c) / 0.22, 2.0)) * 0.25;
  vec3 col = uCol * grad + uHi * glint;
  gl_FragColor = vec4(col, uOp * (grad + glint * 1.2));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function makeBackdrop(TH, bgIn, backdrop) {
  const objects = [], mats = [];
  const want = String(backdrop || '');
  const o = {}; new THREE.Color(TH.bg).getHSL(o);
  const tintCol = new THREE.Color().setHSL(o.h, 1, 0.72);
  let sheen = null, logo = null;
  if (want.includes('sheen')) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: tintCol }, uSpark: { value: new THREE.Color('#fff1d6') }, uAmt: { value: TH.sheenAmt ?? 0.55 } },
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SHEEN_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    sheen = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), m);
    sheen.position.z = -14; sheen.renderOrder = -2; sheen.frustumCulled = false;
    objects.push(sheen); mats.push(m);
  }
  if (want.includes('logo')) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 250 309"><path d="${SIROCCO_LOGO_PATH}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap(p => SVGLoader.createShapes(p));
    const g = new THREE.ShapeGeometry(shapes, 64);
    g.translate(-139, -168.5, 0); g.scale(1 / 309, -1 / 309, 1);
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color().setHSL(o.h, 0.9, 0.8) }, uHi: { value: new THREE.Color('#fff4e0') }, uOp: { value: TH.logoOp ?? 0.085 } },
      vertexShader: LOGO_VERT, fragmentShader: LOGO_FRAG, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    logo = new THREE.Mesh(g, m); logo.renderOrder = -1; logo.frustumCulled = false;
    objects.push(logo); mats.push(m);
  }
  const v = new THREE.Vector3(), sz = new THREE.Vector2();
  return {
    objects,
    update(t) { const ph = (t / LOOP_SECONDS) % 1; mats.forEach(m => { m.uniforms.uT.value = ph; }); },
    resize(camera, renderer) {
      renderer.getDrawingBufferSize(sz);
      if (sheen) sheen.material.uniforms.uRes.value.copy(sz);
      if (logo) {
        // place the S at a fixed spot of the frame (NDC), whatever the aspect / view offset
        const D = 13, P = TH.logoPos || [0.30, 0.0, 1.75];
        v.set(P[0], P[1], 0.5).applyMatrix4(camera.projectionMatrixInverse);
        v.multiplyScalar(-D / v.z);
        logo.position.copy(v);
        const hView = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom * (camera.view ? camera.view.height / camera.view.fullHeight : 1);
        logo.scale.setScalar(hView * P[2] / 2);
      }
    },
    dispose() { objects.forEach(x => x.geometry.dispose()); mats.forEach(m => m.dispose()); },
  };
}

export function createSiroccoScene({ canvas, width, height, pixelRatio = 1, framing = 'hero', theme = 'noir', backdrop = '', bloom = true, shadows = true, preserveDrawingBuffer = false } = {}) {
  const TH = typeof theme === 'string' ? THEMES[theme] || THEMES.noir : theme;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer, powerPreference: 'high-performance' });
  renderer.toneMapping = TH.toneMapping === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = TH.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const bgIn = TH.toneMapping === 'aces' ? inverseACES(new THREE.Color(TH.bg), TH.exposure) : new THREE.Color(TH.bg);
  scene.background = bgIn;
  scene.fog = new THREE.Fog(bgIn, TH.fog[0], TH.fog[1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 60);

  // stairs
  const stepGeo = new RoundedBoxGeometry(D, 30, WZ, 3, 0.018);
  const stepMat = new THREE.MeshStandardMaterial({ color: TH.step, roughness: TH.stepRough, metalness: TH.stepMetal, envMapIntensity: TH.stepEnv });
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
  const coinMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coin, metalness: 1, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.18, envMapIntensity: TH.coinEnv });
  const logoMat = new THREE.MeshPhysicalMaterial({ color: SIROCCO_COLORS.coinLogo, metalness: 1, roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: TH.coinEnv + 0.1 });
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
    const [hc0, hc1] = (TH.haloColor || ['#ff8c50', '#c2552d']).map(h => new THREE.Color(h).getRGB({}, THREE.SRGBColorSpace));
    const rgba = (c, a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    g.addColorStop(0, rgba(hc0, 0.9)); g.addColorStop(0.35, rgba(hc1, 0.35)); g.addColorStop(1, rgba(hc1, 0));
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  }
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: TH.halo, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(1.9);
  scene.add(halo);

  // lights follow the camera target, so the loop is seamless
  scene.add(new THREE.HemisphereLight(...TH.hemi));
  const key = new THREE.DirectionalLight(...TH.key);
  key.castShadow = shadows;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 15 });
  key.shadow.bias = -0.0004; key.shadow.radius = 6;
  const rim = new THREE.DirectionalLight(...TH.rim);
  const fill = new THREE.DirectionalLight(...TH.fill);
  const glow = new THREE.PointLight(TH.glow[0], TH.glow[1], 2.5, 2);
  scene.add(key, key.target, rim, rim.target, fill, fill.target, glow);

  // ── backdrop (screen-space, parented to the camera, periodic in LOOP_SECONDS → seamless loop)
  scene.add(camera);
  const bd = makeBackdrop(TH, bgIn, backdrop);
  bd.objects.forEach(o => camera.add(o));

  let composer = null, bloomPass = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bgLum = 0.2126 * bgIn.r + 0.7152 * bgIn.g + 0.0722 * bgIn.b;
    bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), TH.bloom[0], TH.bloom[1], Math.max(TH.bloom[2], bgLum * 1.35));
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
    bd.resize(camera, renderer);
  }

  function render(t) {
    setTime(t);
    bd.update(t);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function dispose() {
    scene.traverse(o => { o.geometry?.dispose?.(); });
    [stepMat, coinMat, logoMat, halo.material].forEach(m => m.dispose());
    haloTex.dispose(); envTex.dispose(); pmrem.dispose();
    bd.dispose(); composer?.dispose?.();
    renderer.dispose();
  }

  setSize(width, height, pixelRatio);
  // geometry constants for vector export
  const geometry = { D, HS, WZ, R, T, faceZ: T / 2 - 0.007, logoScale: 0.33 / 309, logoCenter: [139, 168.5], stepOffset };
  return { renderer, scene, camera, canvas: renderer.domElement, steps, coin, geometry, setSize, setTime, render, dispose };
}
