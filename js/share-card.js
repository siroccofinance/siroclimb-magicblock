// Share card: a 1600×900 picture of the end of a run, the Sirocco coin in the middle of the live scene,
// the result over it (cashed out value, return, top leverage, entry, exit). Posted with the tweet.
export const CARD = { w: 1600, h: 900 };

const INK = '#fff', SOFT = 'rgba(255,255,255,.82)', MUTE = 'rgba(255,255,255,.62)', GOLD = '#ffe6a6', DARK = '#2b211a';
const SIDE = { long: '#22c55e', short: '#ef4444' };
const F = (w, px) => `${w} ${px}px Inter, -apple-system, "SF Pro Display", "Segoe UI", sans-serif`;

let logo = null;
export function loadLogo(src) {
  if (logo) return logo;
  logo = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  return logo;
}

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

// scene: a canvas holding the scene drawn at CARD size; d: { eyebrow, value, unit, win, side, ticker, stats: [[k, v]], logo }
export function drawCard(scene, d) {
  const { w: W, h: H } = CARD;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#c2552d'; g.fillRect(0, 0, W, H);
  if (scene) g.drawImage(scene, 0, 0, W, H);

  // shades so the copy reads, like the site's gradients
  let s = g.createLinearGradient(0, 0, 0, 220); s.addColorStop(0, 'rgba(43,20,10,.55)'); s.addColorStop(1, 'rgba(43,20,10,0)');
  g.fillStyle = s; g.fillRect(0, 0, W, 220);
  s = g.createLinearGradient(0, H * 0.5, 0, H); s.addColorStop(0, 'rgba(43,20,10,0)'); s.addColorStop(0.55, 'rgba(43,20,10,.6)'); s.addColorStop(1, 'rgba(43,20,10,.86)');
  g.fillStyle = s; g.fillRect(0, H * 0.5, W, H * 0.5);

  const X = 72;
  g.textBaseline = 'alphabetic';
  // brand
  if (d.logo) g.drawImage(d.logo, X, 52, 52, 52);
  g.fillStyle = INK; g.font = F(600, 34); g.fillText('Siroclimb', X + (d.logo ? 68 : 0), 90);

  // direction pill + market, top right
  g.font = F(600, 24);
  const side = d.side.toUpperCase(), sw = g.measureText(side).width + 36;
  g.font = F(600, 34); const tw = g.measureText(d.ticker).width;
  const px = W - X - sw, tx = px - 18 - tw;
  g.fillStyle = INK; g.fillText(d.ticker, tx, 90);
  g.fillStyle = SIDE[d.side] || SIDE.long; rr(g, px, 58, sw, 44, 10); g.fill();
  g.fillStyle = '#fff'; g.font = F(600, 24); g.fillText(side, px + 18, 89);

  // result
  g.fillStyle = SOFT; g.font = F(600, 30); g.fillText(d.eyebrow, X, 622);
  g.fillStyle = d.win ? GOLD : INK; g.font = F(600, 128);
  g.save(); g.letterSpacing = '-5px'; g.fillText(d.value, X - 4, 748); const vw = g.measureText(d.value).width; g.restore();
  if (d.unit) { g.fillStyle = d.win ? GOLD : SOFT; g.font = F(500, 40); g.fillText(d.unit, X + vw + 14, 748); }

  // stats row
  let x = X;
  for (const [k, v] of d.stats) {
    g.font = F(500, 22); const kw = g.measureText(k).width;
    g.font = F(600, 32); const w2 = Math.max(kw, g.measureText(v).width);
    if (x + w2 > W - X) break;
    g.fillStyle = MUTE; g.font = F(500, 22); g.fillText(k, x, 808);
    g.fillStyle = INK; g.font = F(600, 32); g.fillText(v, x, 848);
    x += w2 + 56;
  }
  return c;
}

export const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
