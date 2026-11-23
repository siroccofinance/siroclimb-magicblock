// Vector export: projects the 3D scene through the real camera and redraws it as SVG.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { createSiroccoScene } from '/sirocco-coin-scene.js';
import { SIROCCO_LOGO_PATH } from '/logo-path.js';

const f = n => n.toFixed(1);

window.exportSVG = (t, W, H, framing) => {
  const s = createSiroccoScene({ width: W, height: H, framing, bloom: false, shadows: false });
  s.setTime(t);
  s.scene.updateMatrixWorld(true);
  s.camera.updateMatrixWorld(true);
  const cam = s.camera, g = s.geometry;
  const P = v => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; };
  const pts = arr => arr.map(v => P(v).map(f).join(',')).join(' ');
  const defs = [], body = [];
  let gid = 0;
  const lin = (a, b, stops) => {
    const id = 'g' + gid++;
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}">${stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${op}"/>`).join('')}</linearGradient>`);
    return `url(#${id})`;
  };

  // ---- background, glow
  const coinScreen = P(s.coin.position);
  body.push(`<rect width="${W}" height="${H}" fill="#0b0807"/>`);
  body.push(`<circle cx="${f(coinScreen[0] + W * 0.06)}" cy="${f(coinScreen[1] - H * 0.04)}" r="${f(H * 0.55)}" fill="url(#ambient)"/>`);
  defs.push(`<radialGradient id="ambient"><stop offset="0" stop-color="#c2552d" stop-opacity="0.22"/><stop offset="0.5" stop-color="#7a2f17" stop-opacity="0.08"/><stop offset="1" stop-color="#0b0807" stop-opacity="0"/></radialGradient>`);

  // ---- steps: box faces, painter-sorted, back-faces culled
  const faces = [];
  const camPos = cam.position;
  const coinStep = Math.round(s.coin.position.x / g.D - 0.5);
  for (const m of s.steps) {
    const i = m.userData.i;
    if (i < coinStep - 6 || i > coinStep + 6) continue;
    const top = m.position.y + 15, x0 = i * g.D, x1 = x0 + g.D, z0 = -g.WZ / 2, z1 = g.WZ / 2, bot = top - 8;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const rel = i - coinStep; // brighter higher up the stairs
    const glow = Math.max(0, Math.min(1, 0.45 + rel * 0.18));
    const quads = [
      { kind: 'top', n: V(0, 1, 0), v: [V(x0, top, z1), V(x1, top, z1), V(x1, top, z0), V(x0, top, z0)] },
      { kind: 'riser', n: V(-1, 0, 0), v: [V(x0, top, z0), V(x0, top, z1), V(x0, bot, z1), V(x0, bot, z0)] },
      { kind: 'side', n: V(0, 0, 1), v: [V(x0, top, z1), V(x1, top, z1), V(x1, bot, z1), V(x0, bot, z1)] },
    ];
    for (const q of quads) {
      const c = q.v.reduce((a, b) => a.add(b), V(0, 0, 0)).multiplyScalar(0.25);
      if (q.n.dot(camPos.clone().sub(c)) <= 0) continue;
      faces.push({ ...q, d: c.distanceTo(camPos), glow, i });
    }
  }
  faces.sort((a, b) => b.d - a.d);
  for (const q of faces) {
    const sp = q.v.map(P);
    let fill;
    if (q.kind === 'top') {
      // front-left corner dark -> back-right corner lit, like the terracotta key light
      const hot = `hsl(18, ${f(62 + q.glow * 20)}%, ${f(28 + q.glow * 45)}%)`;
      fill = lin(sp[0], sp[2], [[0, '#2a130c'], [0.55, '#8a3a1e'], [1, hot]]);
      body.push(`<polygon points="${pts(q.v)}" fill="${fill}"/>`);
      if (q.glow > 0.55) body.push(`<polygon points="${pts(q.v)}" fill="${lin(sp[0], sp[2], [[0.5, '#ff9a62', 0], [1, '#ffd2a8', q.glow * 0.55]])}" filter="url(#bloom)"/>`);
      body.push(`<polyline points="${pts([q.v[3], q.v[0], q.v[1]])}" fill="none" stroke="#c2552d" stroke-opacity="${f(0.15 + q.glow * 0.3)}" stroke-width="1.2"/>`);
    } else if (q.kind === 'riser') {
      fill = lin(sp[0], sp[3], [[0, '#1c100b'], [0.35, '#0d0806'], [1, '#0b0807']]);
      body.push(`<polygon points="${pts(q.v)}" fill="${fill}"/>`);
    } else {
      fill = lin(sp[0], sp[3], [[0, '#140b08'], [0.4, '#0b0706'], [1, '#0b0807']]);
      body.push(`<polygon points="${pts(q.v)}" fill="${fill}"/>`);
    }
  }
  defs.push(`<filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(H * 0.018)}"/></filter>`);

  // ---- coin
  const M = s.coin.matrixWorld;
  const ring = (r, z, n = 128) => Array.from({ length: n }, (_, k) => new THREE.Vector3(r * Math.cos(2 * Math.PI * k / n), r * Math.sin(2 * Math.PI * k / n), z).applyMatrix4(M));
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(M);
  const front = normal.dot(camPos.clone().sub(s.coin.position)) > 0 ? 1 : -1;
  const rimF = ring(g.R, front * g.T / 2), rimB = ring(g.R, -front * g.T / 2);
  // halo + contact shadow
  body.push(`<circle cx="${f(coinScreen[0])}" cy="${f(coinScreen[1])}" r="${f(H * 0.16)}" fill="url(#halo)"/>`);
  defs.push(`<radialGradient id="halo"><stop offset="0" stop-color="#ff8c50" stop-opacity="0.35"/><stop offset="0.4" stop-color="#c2552d" stop-opacity="0.12"/><stop offset="1" stop-color="#c2552d" stop-opacity="0"/></radialGradient>`);
  const ground = P(new THREE.Vector3(s.coin.position.x, s.coin.position.y - g.R, 0));
  body.push(`<ellipse cx="${f(ground[0])}" cy="${f(ground[1])}" rx="${f(H * 0.05)}" ry="${f(H * 0.012)}" fill="#000" opacity="0.6" filter="url(#soft)"/>`);
  defs.push(`<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(H * 0.006)}"/></filter>`);
  // edge band: convex hull of both rims
  const hull = convexHull([...rimF, ...rimB].map(P));
  const fr = rimF.map(P), bb = bbox(hull);
  body.push(`<polygon points="${hull.map(p => p.map(f).join(',')).join(' ')}" fill="${lin([bb[0], bb[1]], [bb[2], bb[3]], [[0, '#d9a24c'], [0.5, '#8f5b1f'], [1, '#5e3a12']])}"/>`);
  const fb = bbox(fr);
  body.push(`<polygon points="${fr.map(p => p.map(f).join(',')).join(' ')}" fill="${lin([fb[0], fb[1]], [fb[2], fb[3]], [[0, '#fbe0a0'], [0.45, '#e6b25c'], [1, '#a8742c']])}"/>`);
  const inner = ring(0.246, front * (g.T / 2 - 0.007)).map(P);
  body.push(`<polygon points="${inner.map(p => p.map(f).join(',')).join(' ')}" fill="${lin([fb[2], fb[3]], [fb[0], fb[1]], [[0, '#f0c676'], [0.6, '#c9913f'], [1, '#9c6a27']])}" stroke="#fff3cf" stroke-opacity="0.35" stroke-width="1"/>`);
  // embossed S
  const shapes = new SVGLoader().parse(`<svg viewBox="14 14 250 309"><path d="${SIROCCO_LOGO_PATH}"/></svg>`).paths.flatMap(p => SVGLoader.createShapes(p));
  const [cx, cy] = g.logoCenter, sc = g.logoScale, z = front * (g.faceZ + 0.018);
  const toScreen = p => P(new THREE.Vector3((p.x - cx) * sc * front, -(p.y - cy) * sc, z).applyMatrix4(M));
  const d = shapes.map(sh => [sh.getPoints(96), ...sh.holes.map(h => h.getPoints(96))]
    .map(loop => 'M' + loop.map(toScreen).map(p => p.map(f).join(',')).join('L') + 'Z').join('')).join('');
  body.push(`<path d="${d}" fill-rule="evenodd" fill="${lin([fb[0], fb[1]], [fb[2], fb[3]], [[0, '#fff0c4'], [0.5, '#f2c46e'], [1, '#c78a36']])}" stroke="#7a4c17" stroke-opacity="0.35" stroke-width="1.4"/>`);
  // rim highlight
  body.push(`<polyline points="${fr.slice(70, 118).map(p => p.map(f).join(',')).join(' ')}" fill="none" stroke="#fff6dc" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round"/>`);

  // ---- vignette
  defs.push(`<radialGradient id="vign" cx="${f(coinScreen[0] / W)}" cy="0.48" r="0.85" gradientTransform="translate(${f(coinScreen[0] / W)} 0.48) scale(${f(Math.max(W, H) / W)} ${f(Math.max(W, H) / H)}) translate(${f(-coinScreen[0] / W)} -0.48)"><stop offset="0.33" stop-color="#0b0807" stop-opacity="0"/><stop offset="1" stop-color="#0b0807" stop-opacity="0.85"/></radialGradient>`);
  body.push(`<rect width="${W}" height="${H}" fill="url(#vign)"/>`);

  s.dispose();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>Sirocco hero</title><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
};

function bbox(ps) {
  const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function convexHull(ps) {
  ps = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of ps) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of ps.reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
window.ready = true;
