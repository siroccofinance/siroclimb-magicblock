// Share cards: a climb's result, read from Solana, signed into a short token, drawn as a 1200 x 630 PNG.
//   token  = base64url(packed card + the first 6 bytes of its HMAC-SHA256(SHARE_SECRET)): about 30 characters
//   packed = market, side, status, top step and seconds in two bytes; stake, P&L (cents) and return (bps) as
//            varints; the player's name. Tokens of the first format (base64url JSON "." 16-byte HMAC) still verify.
// Only /api/share mints tokens, and only from a run account settled on chain and the matching record of the
// player's profile, so a card cannot claim a result nobody played. /s/<token> and /api/card verify the signature.
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PublicKey } from '@solana/web3.js';
import { LADDER, MARKETS, ONE_USDC, PROGRAM_ID, RUN } from '../js/chain/config.js';
import { decodeProfile, decodeRun } from '../js/chain/codec.js';
import { profilePda, runPda } from '../js/chain/pdas.js';
import { SIROCCO_LOGO_PATH } from '../js/logo-path.js';
import { baseConnection } from './_lib.js';

export const SITE = 'https://siroclimb.sirocco.finance';
/// Links point back to the host that served the request (the site, a preview, or the local dev server).
export function originOf(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return SITE;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? 'http' : 'https'}://${host}`;
}
const STATUS = { [RUN.CASHED]: 'cashed', [RUN.BUSTED]: 'busted', [RUN.EXPIRED]: 'expired' };

const b64u = (b) => Buffer.from(b).toString('base64url');
function secret() {
  const s = process.env.SHARE_SECRET;
  if (!s) throw Object.assign(new Error('share cards not configured'), { code: 503 });
  return s;
}
const mac = (body) => b64u(crypto.createHmac('sha256', secret()).update(body).digest().subarray(0, 16));

const MAC6 = (buf) => crypto.createHmac('sha256', secret()).update(buf).digest().subarray(0, 6);
const zz = (v) => (v < 0 ? -2 * v - 1 : 2 * v), unzz = (u) => (u % 2 ? -(u + 1) / 2 : u / 2);
function varint(out, u) { u = Math.max(0, Math.round(u)); do { let b = u % 128; u = Math.floor(u / 128); out.push(u ? b | 128 : b); } while (u); }
function readVarint(buf, at) { let u = 0, mul = 1, b; do { if (at.i >= buf.length || mul > 2 ** 42) throw new Error('bad'); b = buf[at.i++]; u += (b & 127) * mul; mul *= 128; } while (b & 128); return u; }

export function sign(card) {
  const st = Math.min(3, Math.max(0, (card.st || RUN.CASHED) - RUN.CASHED));
  const head = ((card.a & 7) << 12) | ((card.s & 1) << 11) | (st << 9) | ((card.m & 7) << 6) | Math.min(63, Math.max(0, card.d | 0));
  const out = [head >> 8, head & 255];
  varint(out, card.k / 1e4); varint(out, zz(Math.round(card.p / 1e4))); varint(out, zz(card.b | 0));
  const name = Buffer.from(String(card.n || '').slice(0, 16), 'utf8').subarray(0, 32);
  out.push(...name);
  const body = Buffer.from(out);
  return b64u(Buffer.concat([body, MAC6(body)]));
}
function verifyLegacy(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || body.length > 600) return null;
  const want = Buffer.from(mac(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}
export function verify(token) {
  token = String(token || '');
  if (token.includes('.')) return verifyLegacy(token);
  if (!/^[\w-]{12,80}$/.test(token)) return null;
  const buf = Buffer.from(token, 'base64url');
  if (buf.length < 11) return null;
  const body = buf.subarray(0, buf.length - 6), got = buf.subarray(buf.length - 6);
  if (!crypto.timingSafeEqual(MAC6(body), got)) return null;
  try {
    const head = (body[0] << 8) | body[1], at = { i: 2 };
    const k = readVarint(body, at) * 1e4, p = unzz(readVarint(body, at)) * 1e4, b = unzz(readVarint(body, at));
    const n = body.subarray(at.i).toString('utf8');
    return { v: 2, n, a: (head >> 12) & 7, s: (head >> 11) & 1, st: RUN.CASHED + ((head >> 9) & 3), m: (head >> 6) & 7, d: head & 63, k, p, b, e: 0, x: 0 };
  } catch { return null; }
}

/// The player's last settled climb, from the run account and the profile's record of it.
export async function settledClimb(player) {
  const me = new PublicKey(player);
  const conn = baseConnection();
  const [ra, pa] = await conn.getMultipleAccountsInfo([runPda(me), profilePda(me)]);
  if (!ra || !pa) throw Object.assign(new Error('no climb on chain for this wallet'), { code: 404 });
  if (!ra.owner.equals(PROGRAM_ID)) throw Object.assign(new Error('climb still on the rollup'), { code: 409 });   // delegated: in flight
  const run = decodeRun(ra.data), prof = decodeProfile(pa.data);
  if (run.status !== RUN.SETTLED) throw Object.assign(new Error('climb not settled yet'), { code: 409 });
  const rec = prof.history.find((h) => h.ts >= run.endTs && h.asset === run.asset && h.side === run.side && h.stake === run.stake && h.mode === run.mode);
  if (!rec) throw Object.assign(new Error('climb not recorded yet'), { code: 409 });
  return {
    v: 1, n: prof.name.slice(0, 16), a: run.asset, s: run.side, st: STATUS[rec.status] ? rec.status : RUN.CASHED, k: run.stake, p: rec.pnl, b: rec.pnlBps,
    m: run.maxStep, e: run.entryPrice, x: run.lastPrice || run.entryPrice, d: Math.max(0, run.endTs - run.startTs), t: rec.ts, i: run.nonce,
  };
}

// ── what the card says (shared by the page and the picture)
const nf = (v, d = 2) => Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (v) => (v < -0.0049 ? '−' : '+');
const px = (p) => (p >= 1000 ? nf(p) : p >= 10 ? p.toFixed(2) : p.toFixed(4));
const lev = (x) => (x % 1 ? x.toFixed(1) : String(x)) + 'x';
export function describe(c) {
  const m = MARKETS[c.a] || MARKETS[0], toUsd = (raw) => raw * 10 ** m.exponent;
  const pnl = c.p / ONE_USDC, status = STATUS[c.st] || 'cashed', side = c.s === 1 ? 'short' : 'long';
  return {
    ticker: m.ticker, market: m.name, side, status, pnl, win: pnl > 0.005, name: c.n,
    value: sgn(pnl) + nf(pnl), ret: sgn(c.b) + nf(c.b / 100) + '%', top: lev(LADDER[c.m] || 1), stake: nf(c.k / ONE_USDC, 0) + ' tUSDC',
    entry: px(toUsd(c.e)), exit: px(toUsd(c.x)), time: Math.max(1, Math.min(60, c.d)) + 's',
    eyebrow: status === 'busted' ? 'The coin fell' : status === 'expired' ? "Time's up, cashed out" : 'Cashed out',
  };
}
export function headline(c) {
  const d = describe(c);
  return d.status === 'busted' ? `${d.top} on ${d.ticker} ${d.side}, then the coin fell`
    : `${d.value} tUSDC at ${d.top} on ${d.ticker} ${d.side}`;
}

// ── the picture
const ASSET = (f) => new URL(`../assets/share/${f}`, import.meta.url);
let coinUri = null;
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const F = 'Inter';

export function cardSvg(c) {
  const d = describe(c);
  coinUri ||= 'data:image/png;base64,' + fs.readFileSync(ASSET('coin.png')).toString('base64');
  const sideCol = d.side === 'long' ? '#22c55e' : '#ef4444', sideW = d.side === 'long' ? 76 : 86;
  const stats = [['Return', d.ret], ['Top leverage', d.top], ['Stake', d.stake], ['Time', d.time]];
  const colW = [170, 180, 180, 80];
  let sx = 72;
  const statSvg = stats.map(([k, v], i) => { const s = `<text x="${sx}" y="452" font-size="20" font-weight="500" fill="rgba(255,255,255,.62)">${esc(k)}</text><text x="${sx}" y="490" font-size="30" font-weight="600" fill="#fff">${esc(v)}</text>`; sx += colW[i]; return s; }).join('');
  const who = d.name ? ` by ${esc(d.name)}` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630" font-family="${F}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c95b31"/><stop offset=".55" stop-color="#b14a24"/><stop offset="1" stop-color="#6e2810"/></linearGradient>
  <radialGradient id="pool" cx="0.76" cy="0.38" r="0.5"><stop offset="0" stop-color="#ffb07a" stop-opacity=".75"/><stop offset=".45" stop-color="#e2733f" stop-opacity=".28"/><stop offset="1" stop-color="#c2552d" stop-opacity="0"/></radialGradient>
  <radialGradient id="shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2b0f05" stop-opacity=".55"/><stop offset="1" stop-color="#2b0f05" stop-opacity="0"/></radialGradient>
  <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b140a" stop-opacity=".35"/><stop offset=".6" stop-color="#2b140a" stop-opacity="0"/></linearGradient>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#pool)"/><rect width="1200" height="630" fill="url(#shade)"/>
<ellipse cx="925" cy="590" rx="190" ry="26" fill="url(#shadow)"/>
<image x="700" y="70" width="440" height="471" xlink:href="${coinUri}"/>
<g transform="translate(72 50) scale(${40 / 309}) translate(-14 -14)"><path d="${SIROCCO_LOGO_PATH}" fill="#f2c94c"/></g>
<text x="122" y="83" font-size="30" font-weight="600" fill="#fff">Siroclimb</text>
<rect x="72" y="150" width="${sideW}" height="36" rx="8" fill="${sideCol}"/>
<text x="${72 + sideW / 2}" y="175" font-size="18" font-weight="600" fill="#fff" text-anchor="middle" letter-spacing="1">${d.side.toUpperCase()}</text>
<text x="${72 + sideW + 14}" y="179" font-size="30" font-weight="600" fill="#fff">${esc(d.ticker)}<tspan font-weight="500" fill="rgba(255,255,255,.7)" dx="10">${esc(d.market)}</tspan></text>
<text x="72" y="262" font-size="28" font-weight="500" fill="rgba(255,255,255,.85)">${esc(d.eyebrow)}${who}</text>
<text x="66" y="372" font-size="112" font-weight="600" fill="${d.win ? '#ffe6a6' : '#ffffff'}" letter-spacing="-4">${esc(d.value)}<tspan font-size="40" font-weight="500" dx="14" letter-spacing="0" fill="${d.win ? '#ffe6a6' : 'rgba(255,255,255,.82)'}">tUSDC</tspan></text>
${statSvg}
<rect x="72" y="532" width="560" height="1" fill="rgba(255,255,255,.18)"/>
<text x="72" y="572" font-size="20" font-weight="500" fill="rgba(255,255,255,.78)">Played on a MagicBlock Ephemeral Rollup, settled on Solana</text>
<text x="72" y="602" font-size="20" font-weight="600" fill="#f2c94c">siroclimb.sirocco.finance</text>
</svg>`;
}

let Resvg = null;
export async function cardPng(c) {
  Resvg ||= (await import('@resvg/resvg-js')).Resvg;
  const fontFiles = ['Inter-Medium.ttf', 'Inter-SemiBold.ttf'].map((f) => fileURLToPath(ASSET(f)));
  return new Resvg(cardSvg(c), { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: F }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
