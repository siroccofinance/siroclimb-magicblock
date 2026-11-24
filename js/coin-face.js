// The coin's face, minted from the vector Sirocco mark: colour, roughness and normal maps drawn once
// on a canvas (Path2D straight from the brand SVG path), so the relief is as sharp as the logo itself at
// any size, from the climbing coin to the big result coin and the share card.
//   field : satin gold, fine lathe rings, a little darker around the relief (contact shade)
//   relief: the S, raised with a rounded bevel, polished and a shade lighter
//   bead  : a thin raised ring just inside the rim
import * as THREE from 'three';
import { SIROCCO_LOGO_PATH } from './logo-path.js';

const VB = { x: 14, y: 14, w: 250, h: 309 };   // the mark's viewBox
const LOGO_H = 0.6;                             // logo height, in face diameters
const cache = new Map();

function logoCanvas(N, blur = 0, grow = 0) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  const s = (LOGO_H * N) / VB.h;
  if (blur) g.filter = `blur(${blur}px)`;
  g.setTransform(s, 0, 0, s, N / 2 - (VB.x + VB.w / 2) * s, N / 2 - (VB.y + VB.h / 2) * s);
  g.fillStyle = '#fff';
  const p = new Path2D(SIROCCO_LOGO_PATH);
  g.fill(p);
  if (grow) { g.lineWidth = grow / s; g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.stroke(p); }
  return g.getImageData(0, 0, N, N).data;
}

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** @returns {{ map: THREE.Texture, roughnessMap: THREE.Texture, normalMap: THREE.Texture }} */
export function coinFaceMaps(N = 2048, anisotropy = 8) {
  const key = N + ':' + anisotropy;
  if (cache.has(key)) return cache.get(key);
  const k = N / 1024;
  const bevel = logoCanvas(N, 5 * k);            // soft edge → rounded bevel of the relief
  const crisp = logoCanvas(N);                    // exact silhouette → colour / roughness edges
  const shade = logoCanvas(N, 22 * k, 6 * k);     // wide halo → contact shade on the field
  const H = new Float32Array(N * N);
  const col = new Uint8ClampedArray(N * N * 4), rough = new Uint8ClampedArray(N * N * 4), nrm = new Uint8ClampedArray(N * N * 4);
  const R = N / 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, dx = x + 0.5 - R, dy = y + 0.5 - R, r = Math.sqrt(dx * dx + dy * dy) / R;
      const relief = smooth(0.08, 0.92, bevel[i * 4] / 255);
      const bead = Math.exp(-Math.pow((r - 0.925) / 0.012, 2));
      const rings = 0.012 * Math.sin(r * 520);            // lathe grooves on the field
      H[i] = relief * 1.0 + bead * 0.55 + rings * (1 - relief);
      const m = crisp[i * 4] / 255, sh = shade[i * 4] / 255 * (1 - m);
      // colour (sRGB): field warm gold, darker in the contact shade; relief lighter, a soft top-down gradient
      const grad = 1 - (y / N - 0.5) * 0.12;
      const f = [200, 144, 64].map(v => v * (1 - 0.2 * sh) * grad);
      const l = [250, 204, 92].map(v => v * grad);
      const bb = bead * 0.5;
      for (let c = 0; c < 3; c++) col[i * 4 + c] = f[c] * (1 - m) + l[c] * m + bb * 30;
      col[i * 4 + 3] = 255;
      // roughness (green channel): satin field, polished relief and bead
      const ro = 0.48 * (1 - m) + 0.13 * m - bead * 0.2 + 0.03 * Math.sin(r * 520);
      rough[i * 4] = rough[i * 4 + 2] = 0; rough[i * 4 + 1] = Math.max(0.05, ro) * 255; rough[i * 4 + 3] = 255;
    }
  }
  // normals from the height field (canvas y runs down, UV v runs up)
  const S = 3.2 * k;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const hx = H[y * N + Math.min(N - 1, x + 1)] - H[y * N + Math.max(0, x - 1)];
      const hy = H[Math.min(N - 1, y + 1) * N + x] - H[Math.max(0, y - 1) * N + x];
      let nx = -hx * S, ny = hy * S, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      nrm[i * 4] = (nx * 0.5 + 0.5) * 255; nrm[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; nrm[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; nrm[i * 4 + 3] = 255;
    }
  }
  const tex = (data, srgb) => {
    const c = document.createElement('canvas'); c.width = c.height = N;
    c.getContext('2d').putImageData(new ImageData(data, N, N), 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  const maps = { map: tex(col, true), roughnessMap: tex(rough, false), normalMap: tex(nrm, false) };
  cache.set(key, maps);
  return maps;
}
