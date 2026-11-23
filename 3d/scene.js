// Offline render harness: motion-blurred frames of the Sirocco scene, driven by render.mjs.
// URL params: w, h, framing (hero|center|mobile), grain (0..), vignette (0..1)
import { createSiroccoScene, THEMES } from '/sirocco-coin-scene.js';
import { createBoxScene } from '/sirocco-box-scene.js';
import { createRampScene, RAMP_THEMES } from '/sirocco-ramp-scene.js';
import { createEscalatorScene, ESC_THEMES } from '/sirocco-escalator-scene.js';

const Q = new URLSearchParams(location.search);
const W = +Q.get('w') || 1440, H = +Q.get('h') || 1080;
const GRAIN = +(Q.get('grain') ?? 0), VIGNETTE = +(Q.get('vignette') ?? 0.8);

const s = (Q.get('scene') === 'box' ? createBoxScene : Q.get('scene') === 'ramp' ? createRampScene : Q.get('scene') === 'escalator' ? createEscalatorScene : createSiroccoScene)({ width: W, height: H, pixelRatio: 1, framing: Q.get('framing') || 'center', theme: Q.get('theme') || 'noir', backdrop: Q.get('backdrop') || '', preserveDrawingBuffer: true });
const BG = (Q.get('scene') === 'ramp' ? RAMP_THEMES : Q.get('scene') === 'escalator' ? ESC_THEMES : THEMES)[Q.get('theme') || 'noir'].bg, [vr, vg, vb] = [1, 3, 5].map(i => parseInt(BG.slice(i, i + 2), 16));
document.body.appendChild(s.canvas); window.__s = s;

const acc = document.getElementById('acc');
acc.width = W; acc.height = H;
const ctx = acc.getContext('2d', { willReadFrequently: true });
// vignette centred on the subject so the frame edges melt into the page background
const cx = W * (0.5 + (Q.get('framing') === 'hero' ? 0.17 : 0)), cy = H * 0.48, m = Math.max(W, H);
const vign = ctx.createRadialGradient(cx, cy, m * 0.28, cx, cy, m * 0.85);
vign.addColorStop(0, `rgba(${vr},${vg},${vb},0)`); vign.addColorStop(1, `rgba(${vr},${vg},${vb},${VIGNETTE})`);

window.renderFrame = (frame, fps = 30, subs = 6, shutter = 0.5) => {
  for (let k = 0; k < subs; k++) {
    s.render(frame / fps + ((k + 0.5) / subs - 0.5) * shutter / fps);
    ctx.globalAlpha = 1 / (k + 1);
    ctx.drawImage(s.canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  if (VIGNETTE > 0) { ctx.fillStyle = vign; ctx.fillRect(0, 0, W, H); }
  if (GRAIN > 0) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * GRAIN; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
  }
  return acc.toDataURL('image/png');
};
window.ready = true;
