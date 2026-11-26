// Siroclimb game front. Screens: lobby → game → result. All data goes through ./api.js (on chain, or the simulation with ?mock).
// The 3D scene is the hero's: in the lobby the belt loops; on start it brakes, the coin's box climbs one level
// per leverage step; cash out tosses the coin (camera follows), a bust drops it.
import * as api from './api.js';
import { createEscalatorScene } from './sirocco-escalator-scene.js?v=12';
import { CARD, drawCard, loadLogo, toBlob } from './share-card.js?v=1';

const $ = s => document.querySelector(s);
const body = document.body;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAIRS = !new URLSearchParams(location.search).has('classic');   // stairs game (default) or the first version
document.documentElement.classList.toggle('stairs', STAIRS);
const mobile = () => innerWidth < 768;
const store = {
  get(k, d) { try { const v = localStorage.getItem('siroclimb:ui:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('siroclimb:ui:' + k, JSON.stringify(v)); } catch {} },
};

// ── formatting
const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MINUS = '−';
const money = v => nf.format(v);
const sgn = v => (v < -0.0049 ? MINUS : '+');
const signed = v => sgn(v) + nf.format(Math.abs(v));
const pct = v => sgn(v) + Math.abs(v).toFixed(2) + '%';
const small = v => (v > 0 && v < 0.01 ? v.toFixed(4) : v.toFixed(3));   // borrow costs are cents
const price = p => (p >= 1000 ? nf.format(p) : p >= 10 ? p.toFixed(3) : p.toFixed(4));   // three decimals: the microprice's small moves show
const price2 = p => (p >= 1000 ? nf.format(p) : p >= 10 ? p.toFixed(2) : p.toFixed(4));  // the lobby cards: two, so the row fits
const tokens = v => (v >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toPrecision(4));
const levTxt = x => (x % 1 ? x.toFixed(1) : String(x)) + 'x';
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const shortAddr = a => a.slice(0, 4) + '…' + a.slice(-4);

// ── state
const assets = api.listAssets();
const byId = Object.fromEntries(assets.map(a => [a.id, a]));
const C = { asset: store.get('asset', assets[0].id), side: store.get('side', 'long'), stake: store.get('stake', 25) };
if (!byId[C.asset]) C.asset = assets[0].id;
let screen = body.dataset.screen || 'intro', busy = false;
let run = null, upd = null, shownStep = 0, ended = null, boostNow = null;
const D = { value: 0, pnl: 0, pct: 0, danger: 0 };           // displayed values, eased toward the feed every frame

function setScreen(s) { screen = s; body.dataset.screen = s; }

// ── toast
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2400); }

// ── sound: a few synthesized notes, nothing to load
const sound = (() => {
  let ctx = null, on = store.get('sound', true);
  const btn = $('#sound'); btn.setAttribute('aria-pressed', on);
  btn.onclick = () => { on = !on; store.set('sound', on); btn.setAttribute('aria-pressed', on); if (on) note(660, 0.12, 'sine', 0.05); };
  function note(f, d, type = 'sine', g = 0.06, slide = 1, at = 0) {
    if (!on) return;
    try { ctx ||= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); } catch { return; }
    const t0 = ctx.currentTime + at, o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t0 + d);
    a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g, t0 + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(a).connect(ctx.destination); o.start(t0); o.stop(t0 + d + 0.03);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14];
  return {
    unlock() { note(1, 0.01, 'sine', 0.0002); },
    start() { note(392, 0.18, 'triangle', 0.05); note(587, 0.22, 'triangle', 0.04, 1, 0.07); },
    step(n) { const f = 392 * 2 ** (SCALE[Math.min(n, 6)] / 12); note(f, 0.32, 'triangle', 0.07); note(f * 2, 0.22, 'sine', 0.025, 1, 0.02); },
    cash() { [0, 4, 7, 12].forEach((s, i) => note(523 * 2 ** (s / 12), 0.5, 'triangle', 0.06, 1, i * 0.07)); },
    bust() { note(220, 0.7, 'triangle', 0.08, 0.35); note(110, 0.5, 'sine', 0.08, 0.5, 0.08); },
    tick() { note(1200, 0.04, 'sine', 0.02); },
    up(l) { const f = 440 * 2 ** (Math.max(-12, Math.min(12, l)) / 24); note(f, 0.16, 'triangle', 0.045); },
    down(l) { const f = 440 * 2 ** (Math.max(-12, Math.min(12, l)) / 24); note(f, 0.18, 'sine', 0.05, 0.8); },
    drop() { note(330, 0.45, 'triangle', 0.07, 0.5); },
  };
})();
const haptic = p => { try { navigator.vibrate?.(p); } catch {} };

// ── scene
const stage = $('#stage');
let repose = () => {}, wantCard = false, card = null;
let TK = null, sc = null, idleT = 0, last = performance.now(), G = null, live = false;
const film = $('#film');
const cover = () => ({ aspect: 16 / 9, x: mobile() ? 0.64 : 0.6, y: 0.3 });
const dpr = () => Math.min(devicePixelRatio || 1, 1.5);
function initScene() {
  try { sc = createEscalatorScene({ width: innerWidth, height: innerHeight, pixelRatio: dpr(), framing: 'site', theme: 'terracotta-gloss' }); }
  catch { sc = null; return; }
  if (mobile()) sc.key.shadow.mapSize.set(2048, 2048);
  if (innerHeight > innerWidth) { sc.L.FOLLOW_T = 0.45; sc.L.DOLLY = 0.28; }   // portrait: lock on sooner, stay further back
  stage.appendChild(sc.canvas);
  sc.setSize(innerWidth, innerHeight, dpr(), cover());
  if (screen !== 'intro') park(0.15);
  // two drawn frames, then the live scene fades in
  let n = 0;
  const reveal = () => {
    if (++n < 3) return requestAnimationFrame(reveal);
    sc.canvas.classList.add('is-live'); live = true; $('#wash').classList.remove('is-on');
  };
  requestAnimationFrame(reveal);
}
// the coin stops on the box under it and waits there; `hop` = seconds after the stop for the ready hop (null: none)
function park(hop = null, braked = true) {
  if (!sc) return;
  const tt = idleT % sc.LOOP;
  G = { plan: sc.planLaunch(tt * sc.SPEED, tt), steps: [], danger: 0, dangerTo: 0, end: null,
    t0: performance.now() - (braked ? sc.L.TS * 1000 : 0), hop: hop == null ? null : sc.L.TS + hop };
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  idleT += dt;
  if (sc) {
    if (TK) {
      TK.danger += (TK.dangerTo - TK.danger) * (1 - Math.exp(-dt * 4));
      sc.trackStep(TK, dt, lvl.level); repose = () => sc.trackPose(TK, now / 1000, TK.danger); repose(); bubbleFrame();
      if (screen === 'ending' && TK.end && TK.end.ready) setScreen('result');
    }
    else if (G) { G.danger += ((G.dangerTo || 0) - G.danger) * (1 - Math.exp(-dt * 4)); repose = () => sc.gamePose(G, (now - G.t0) / 1000, now / 1000); repose(); }
    else sc.setTime(idleT % sc.LOOP);
    sc.draw();
    if (wantCard && (screen === 'result' || (screen === 'ending' && ended && ended.status === 'busted')))   // a fall is shot as it starts, coin still in frame
      { wantCard = false; makeCard(grabScene()); }
  }
  if (screen === 'game' || screen === 'ending') hudFrame(dt);
  if (screen === 'game') drawSpark();
  requestAnimationFrame(frame);
}

// ── wallet + balance
const walletBtn = $('#wallet'), walletMenu = $('#walletMenu');
// the label depends on the width: redraw it when the window crosses the phone breakpoint
addEventListener('resize', () => renderWallet());
function renderWallet() {
  const a = api.account();
  walletBtn.classList.toggle('is-on', !!a);
  walletBtn.textContent = a ? (mobile() ? a.slice(0, 4) + '…' : shortAddr(a)) : mobile() ? 'Connect' : 'Connect wallet';
}
// wallet chooser: injected wallets and the devnet burner (the simulation has a single demo wallet)
let pickWallet = null;
function chooseWallet() {
  const list = api.wallets();
  if (api.mock || list.length === 1) return Promise.resolve(list[0].id);
  return new Promise(res => {
    pickWallet = res;
    $('#walletList').innerHTML = list.map(w => `<button data-w="${w.id}">${w.name}<small>${w.id === 'burner' ? 'instant, no install' : 'browser wallet'}</small></button>`).join('');
    openSheet('walletSheet');
  });
}
$('#walletList').onclick = e => { const b = e.target.closest('button'); if (!b) return; const f = pickWallet; pickWallet = null; closeSheet(); f && f(b.dataset.w); };
async function connect(quiet) {
  if (api.account()) return true;
  const id = await chooseWallet(); if (!id) return false;
  walletBtn.classList.add('is-busy'); walletBtn.textContent = 'Setting up…';
  if (!api.mock) toast(id === 'burner' ? 'Setting up your burner wallet on devnet…' : 'Approve once in your wallet: profile, test tokens and a game session');
  try { await api.connect(id); renderWallet(); renderBalance(api.balance()); if (quiet !== true) toast('Wallet connected, game session ready'); return true; }
  catch (e) { renderWallet(); toast(e.message || 'Could not connect'); return false; }
  finally { walletBtn.classList.remove('is-busy'); renderWallet(); renderPack(); }
}
walletBtn.onclick = e => {
  e.stopPropagation();
  if (!api.account()) return connect();
  const open = walletMenu.hidden; walletMenu.hidden = !open; walletBtn.setAttribute('aria-expanded', open);
  if (open) renderWho();
};
// who you are on chain: handle, and how long the game session key lasts
async function renderWho() {
  const el = $('#walletWho'), u = api.user();
  walletMenu.querySelectorAll('[data-chain]').forEach(b => { b.hidden = api.mock; });
  el.innerHTML = `<b>${u.name}</b>`;
  const s = await api.sessionInfo();
  if (s) el.innerHTML = `<b>${u.name}</b>Game session until ${new Date(s.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br>Fuel for about ${Math.floor(s.sol / 0.0031)} climbs (${s.sol.toFixed(3)} SOL)`;
}
walletMenu.onclick = async e => {
  const act = e.target.dataset.act; walletMenu.hidden = true; walletBtn.setAttribute('aria-expanded', false);
  if (act === 'copy') { try { await navigator.clipboard.writeText(api.account()); toast('Address copied'); } catch { toast(api.account()); } }
  if (act === 'out') { api.disconnect(); renderWallet(); toast('Wallet disconnected'); }
  if (act === 'explorer') window.open(`https://explorer.solana.com/address/${api.account()}?cluster=devnet`, '_blank', 'noopener');
  if (act === 'name') {
    const next = prompt('Your handle on the leaderboard (3 to 16 characters)', api.user().name);
    if (next && next !== api.user().name) { try { toast(`Handle set to ${await api.setName(next)}`); } catch (e) { toast(e.message); } }
  }
};
addEventListener('click', () => { if (!walletMenu.hidden) { walletMenu.hidden = true; walletBtn.setAttribute('aria-expanded', false); } });

const balEl = $('#bal'), faucetBtn = $('#faucet');
function renderBalance(v, bump) {
  balEl.textContent = api.account() ? money(v) : '–';     // no wallet yet: no balance to show
  faucetBtn.hidden = v >= 1000;
  if (bump) { const b = balEl.parentElement; b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); }
  renderGo();
}
api.onBalance(v => renderBalance(v, true));
api.onNotice(m => toast(m));
faucetBtn.onclick = async () => {
  if (!(await connect(true))) return;
  try { await api.faucet(); toast('Test balance topped up to 1,000 tUSDC'); } catch (e) { toast(e.message); }
};

// ── lobby
const marketsEl = $('#markets');
const KIND = { stock: 'Stock', metal: 'Gold' };
const chip = {};
for (const a of assets) {
  const b = document.createElement('button');
  b.className = 'market'; b.dataset.v = a.id;
  b.innerHTML = `<b>${a.ticker}</b><span class="k">${KIND[a.kind] || a.kind}</span><span class="p"></span><span class="c"></span>`;
  b.onclick = () => { C.asset = a.id; store.set('asset', a.id); renderLobby(); };
  marketsEl.appendChild(b);
  chip[a.id] = { b, p: b.querySelector('.p'), c: b.querySelector('.c'), k: b.querySelector('.k'), kind: KIND[a.kind] || a.kind };
  api.subscribePrice(a.id, ({ price: p }) => {
    chip[a.id].last = p; if (screen === 'lobby') drawChip(a.id);
    if (screen === 'game' && TK && run && run.assetId === a.id) levelFrom(p);   // the stairs take every relay value
  });
}
// the 24 h change: the live price against Kraken's price a day back (api/change); hidden when unknown
const ref24 = {};
function drawChip(id) {
  const c = chip[id], p = c.last, r = ref24[id];
  if (p > 0) c.p.textContent = price2(p);
  if (!(p > 0 && r > 0)) { c.c.textContent = ''; c.c.className = 'c'; return; }
  const ch = (p / r - 1) * 100;
  c.c.innerHTML = `${sgn(ch)}${Math.abs(ch).toFixed(2)}%<small style="opacity:.6;font-size:.75em;margin-left:.2em">24h</small>`;
  c.c.className = 'c ' + (ch >= 0 ? 'is-up' : 'is-down'); c.c.title = 'Change over the last 24 hours';
}
async function loadChange() {
  try {
    const j = await (await fetch('api/change')).json();
    for (const [id, v] of Object.entries(j.ref24h || {})) ref24[id] = v.price;
    for (const id in chip) drawChip(id);
  } catch { /* the figure stays hidden */ }
}
loadChange(); setInterval(loadChange, 5 * 60e3);
function bindSeg(el, key, parse = v => v) {
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    C[key] = parse(b.dataset.v); store.set(key, C[key]); renderLobby(); sound.tick();
  }));
}
bindSeg($('#side'), 'side'); bindSeg($('#stake'), 'stake', Number);
const press = (el, v) => el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
// sliding thumb under the picked option; flashes a sheen when the pick changes
function thumb(el) {
  let t = el.querySelector('.seg__thumb');
  if (!t) { t = document.createElement('i'); t.className = 'seg__thumb'; t.setAttribute('aria-hidden', 'true'); el.prepend(t); }
  const b = el.querySelector('button[aria-pressed="true"]');
  el.classList.toggle('has-thumb', !!b); if (!b || !b.offsetWidth) return;
  if (el.dataset.v && el.dataset.v !== b.dataset.v) { el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash'); }
  el.dataset.v = b.dataset.v;
  t.style.width = b.offsetWidth + 'px'; t.style.transform = `translateX(${b.offsetLeft}px)`;
  if (!el.classList.contains('is-ready')) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-ready')));
}
const segs = ['#side', '#stake'].map(s => $(s));
const thumbs = () => segs.forEach(thumb);
if (window.ResizeObserver) { const ro = new ResizeObserver(thumbs); segs.forEach(s => s.querySelectorAll('button').forEach(b => ro.observe(b))); }
document.fonts && document.fonts.ready.then(thumbs);

function renderLobby() {
  press($('#side'), C.side); press($('#stake'), C.stake);
  body.dataset.side = C.side; thumbs();
  for (const [id, c] of Object.entries(chip)) c.b.setAttribute('aria-pressed', String(id === C.asset));
  renderClosed();
  $('#modeHint').textContent = STAIRS ? 'The coin rolls on the live price. Leverage grows every 6 seconds.' : 'Climb at your own pace. The coin steps up every 6 seconds.';
  renderGo();
}
// "opens in 3h" for a closed market, from Pyth's session schedule
function opensIn(id) {
  const at = api.marketOpensAt(id); if (!at) return '';
  const m = Math.max(1, Math.round((at - Date.now()) / 60000));
  return m < 60 ? ` (opens in ${m} min)` : m < 48 * 60 ? ` (opens in ${Math.round(m / 60)} h)` : ` (opens ${new Date(at).toLocaleDateString([], { weekday: 'long' })})`;
}
// markets outside their trading hours: stale feed, no new climbs
function renderClosed() {
  for (const [id, c] of Object.entries(chip)) {
    const open = api.marketOpen(id), waking = !open && api.marketWaking(id);
    c.b.classList.toggle('is-closed', !open && !waking); c.b.classList.toggle('is-waking', waking);
    c.k.textContent = open ? c.kind : waking ? 'Live price…' : 'Closed';
  }
}
function renderGo() {
  if (screen !== 'lobby') return;
  const go = $('#go'), meta = $('#goMeta'), bal = api.balance();
  const open = api.marketOpen(C.asset), waking = !open && api.marketWaking(C.asset);
  go.disabled = busy || !open;
  go.textContent = busy ? 'Starting…' : waking ? 'Fetching live price…' : !open ? 'Market closed' : !api.account() ? 'Connect to climb' : bal < C.stake ? 'Get test tokens' : 'Start climbing';
  meta.textContent = open ? `${C.stake} tUSDC on ${byId[C.asset].ticker} ${C.side}, up to 4x with ${money(C.stake * 3)} borrowed from the Sirocco Reserve` : waking ? `${byId[C.asset].ticker} trades 24/7: its live price is on its way to the rollup.` : `${byId[C.asset].ticker} is outside its trading hours${opensIn(C.asset)}. Pick an open market.`;
}
$('#go').onclick = async () => {
  if (busy) return;
  sound.unlock();
  if (!(await connect(true))) return;
  const bal = api.balance();
  if (!api.marketOpen(C.asset)) { toast(`${byId[C.asset].ticker} is closed right now`); return; }
  if (bal < C.stake) { try { await api.faucet(); toast('Test balance topped up'); } catch (e) { toast(e.message); } return; }
  busy = true; renderGo();
  if (!api.mock && api.walletKind() !== 'burner' && (await api.climbsLeft()) < 2) toast('Your game session needs fuel: approve one top up in your wallet');
  try { const r = await api.startRun({ mode: 'solo', assetId: C.asset, side: C.side, stake: C.stake }); enterGame(r); }
  catch (e) { toast(e.message); }
  finally { busy = false; renderGo(); }
};

// ── game
const ladderEl = $('#ladder');
let rungs = [];
function buildLadder(l) {
  ladderEl.innerHTML = l.map(x => `<li><i></i><span>${levTxt(x)}</span></li>`).join('');
  rungs = [...ladderEl.children];
  // the side gauge: every level from 1x at the bottom to the max at the top
  const n = l.length - 1;
  $('#gTicks').innerHTML = l.map((x, i) => `<li style="bottom:${(i / n * 100).toFixed(2)}%"><span>${levTxt(x)}</span></li>`).join('');
  gTicks = [...$('#gTicks').children];
}
let gTicks = [];
function gaugeFrame(tr) {
  const n = run.ladder.length - 1, k = shownStep, last = k >= n;
  const p = last ? 0 : (tr % run.stepEvery) / run.stepEvery;
  const f = Math.min(1, (k + p) / n);
  $('#gFill').style.transform = `scaleY(${f.toFixed(4)})`;
  $('#gKnob').style.bottom = (k / n * 100).toFixed(2) + '%';        // the cursor sits on the current level, the bar fills toward the next
  $('#gNow').textContent = levTxt(run.ladder[k]);
  gTicks.forEach((li, i) => { li.classList.toggle('is-done', i < k); li.classList.toggle('is-now', i === k); });
  $('#gNext').textContent = last ? 'Max leverage' : `Next ${levTxt(run.ladder[k + 1])} in ${Math.max(1, Math.ceil(run.stepEvery * (1 - p)))}s`;
}
function enterGame(r) {
  if (!r || run) return;
  run = r; upd = null; shownStep = 0; ended = null;
  Object.assign(D, { value: r.stake, pnl: 0, pct: 0, danger: 0 });
  $('#pB').textContent = '';
  if (sc && (!G || G.end)) park();                    // normally the coin is already parked from the lobby
  if (G) { G.steps = []; G.dangerTo = 0; G.end = null; G.go = (performance.now() - G.t0) / 1000; }
  if (STAIRS) startTrack(r);
  const a = byId[r.assetId];
  boostNow = api.boostOf(a.id);
  $('#hT').textContent = a.ticker; $('#hSide').textContent = r.side === 'long' ? 'Long' : 'Short'; $('#hSide').className = 'pill is-' + r.side;
  buildLadder(r.ladder); rungs[0].classList.add('is-now');
  spark.entry = r.entryPrice; spark.asset = r.assetId;
  setScreen('game');
  sound.start(); haptic(10);
  api.onRun(r.id, onUpdate);
  api.whenEnded(r.id).then(onEnd);
}
function onUpdate(u) {
  if (!run) return;
  run.entryPrice = spark.entry = runEntry();
  if (TK) lvl.entry = run.entryPrice;
  upd = u;
  if (u.step > shownStep && u.status === 'live') {
    for (let s = shownStep + 1; s <= u.step; s++) G?.steps.push((performance.now() - G.t0) / 1000);
    shownStep = u.step;
    rungs.forEach((li, i) => { li.classList.toggle('is-done', i < u.step); li.classList.toggle('is-now', i === u.step); });
    const li = rungs[u.step]; li.classList.remove('is-hit'); void li.offsetWidth; li.classList.add('is-hit');
    sound.step(u.step); haptic(14);
    const kn = $('#gKnob'); kn.classList.remove('is-hit'); void kn.offsetWidth; kn.classList.add('is-hit');
  }
  if (G) G.dangerTo = u.risk > 0.3 ? Math.min(1, (u.risk - 0.3) / 0.6) : 0;
  if (TK) TK.dangerTo = u.risk > 0.3 ? Math.min(1, (u.risk - 0.3) / 0.6) : 0;
}
function runEntry() { const i = api.runInfo(run.id); return i ? i.entryPrice : run.entryPrice; }

const ringV = $('#ringV'), RING = 2 * Math.PI * 28;
function hudFrame(dt) {
  if (!run) return;
  const u = upd, k = 1 - Math.exp(-dt * 10);
  if (u) { D.value += (u.value - D.value) * k; D.pnl += (u.pnl - D.pnl) * k; D.pct += (u.pnlPct - D.pct) * k; D.danger += (u.risk - D.danger) * k; }
  $('#pV').textContent = signed(D.pnl);
  $('.pnl').classList.toggle('is-up', D.pnl > 0.005);
  $('#pP').textContent = pct(D.pct);
  $('#pL').textContent = levTxt(run.ladder[shownStep]);
  $('#cashV').textContent = money(Math.max(0, D.value));
  const hold = u && u.holding ? `${u.holding.side === 'short' ? 'Short' : 'Holding'} <b>${tokens(u.holding.units)} ${u.holding.ticker}</b> · ` : '';
  if (u) $('#pB').innerHTML = hold + (run.pack ? `Playing <b>${money(u.borrowed)} tUSDC</b> of the Sirocco Reserve's money`
    : u.borrowed > 0 ? `Borrowed <b>${money(u.borrowed)} tUSDC</b> from the Sirocco Reserve · cost so far ${small(u.borrowCost)}` : 'Your own stake only at 1x: borrowing starts at 1.5x');
  const left = Math.max(0, 1 - D.danger);
  $('#sBar').style.transform = `scaleX(${left})`;
  $('#sTxt').textContent = D.danger < 0.02 ? 'Stake safe' : `${Math.round(left * 100)}% of stake left`;
  const sf = $('#sBar').parentElement.parentElement;
  sf.classList.toggle('is-warn', D.danger >= 0.3 && D.danger < 0.6); sf.classList.toggle('is-hot', D.danger >= 0.6);
  // clock + next step progress, from the run's own clock
  const tr = Math.min(run.duration, Math.max(0, (Date.now() - run.startedAt) / 1000));
  if (screen === 'game') {
    $('#clock').textContent = mmss(run.duration - tr);
    ringV.style.strokeDashoffset = String(RING * (tr / run.duration));
    $('.hud__clock').classList.toggle('is-late', run.duration - tr <= 10);
    const next = rungs[shownStep + 1];
    rungs.forEach((li, i) => li.style.setProperty('--p', i === shownStep + 1 ? ((tr % run.stepEvery) / run.stepEvery).toFixed(3) : 0));
    if (!next) rungs.forEach(li => li.style.setProperty('--p', 0));
    gaugeFrame(tr);
    const p = u ? u.price : run.entryPrice, ch = (p / run.entryPrice - 1) * 100;
    $('#hP').textContent = price(p); $('#hC').textContent = pct(ch) + ' since entry' + (boostNow ? ` · moves ×${boostNow}` : '');
  }
}

async function cash() {
  if (screen !== 'game' || !run || ended) return;
  $('#cash').disabled = true;
  const slow = setTimeout(() => { if (!ended) toast('Cashing out on the rollup…'); }, 3500);
  try { await api.cashOut(run.id); } catch (e) { toast(e.message); $('#cash').disabled = false; }
  finally { clearTimeout(slow); }
}
$('#cash').onclick = cash;
addEventListener('keydown', e => {
  if (e.code === 'Space' && screen === 'game' && !e.repeat && !document.querySelector('.sheet:not([hidden])')) { e.preventDefault(); cash(); }
  if (e.key === 'Escape') closeSheet();
});

function onEnd(res) {
  if (ended) return;
  ended = res;
  const bust = res.status === 'busted';
  if (G) G.end = { type: bust ? 'bust' : 'cash', at: (performance.now() - G.t0) / 1000 };
  if (TK) sc.trackEnd(TK, bust ? 'bust' : 'cash');
  setScreen('ending');
  if (bust) { sound.bust(); haptic([30, 40, 60]); } else { sound.cash(); haptic([12, 30, 12]); }
  showResult(res);
  card = null; wantCard = true; hideTip(); $('#dl').hidden = true;
  askLink(res);
  // stairs: the result waits for the scene (the box has pushed the coin, or the coin has fallen), wherever it ended
  if (TK) setTimeout(() => { if (screen === 'ending') setScreen('result'); }, 4000);
  else setTimeout(() => setScreen('result'), bust ? 1250 : 1350);
}
function showResult(res) {
  const bust = res.status === 'busted';
  $('#rE').textContent = bust ? 'The coin fell' : res.status === 'expired' ? "Time's up, cashed out" : 'Cashed out';
  $('#rV').textContent = `${signed(res.pnl)} tUSDC`;
  $('.result').classList.toggle('is-win', res.pnl > 0.005);
  const a = byId[run.assetId];
  const stats = [['Return', pct(res.pnlPct)], ['Top leverage', levTxt(res.maxLeverage)], ['Time', `${Math.max(1, Math.round(res.duration))}s`],
    [`${a.ticker} entry`, price(res.entryPrice)], ['Exit', price(res.exitPrice)]];
  if (res.position) {
    stats.push([`${res.position.side === 'short' ? 'Shorted' : 'Held'} (real tokens)`, `${tokens(res.position.units)} ${res.position.ticker}`]);
    stats.push(['Position P&L', `${signed(res.realPnl)} tUSDC`]);
    stats.push([`Game boost ×${res.boost}`, `${signed(res.boostPnl)} tUSDC`]);
  }
  if (res.peakBorrow > 0) stats.push(['Borrowed up to', `${money(res.peakBorrow)} tUSDC`]);
  if (!res.pack && res.borrowCost != null) stats.push(['Borrow cost paid', `${small(res.borrowCost)} tUSDC`]);
  // phones keep the essentials (the rest would push the text up over the coin)
  const minor = /^(Time|Exit|.* entry|Borrowed up to|Held|Shorted)/;
  $('#rS').innerHTML = stats.map(([k, v]) => `<div${minor.test(k) ? ' class="is-minor"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  showProof(run.id);
}
// every transaction of the climb, on Solana and on the rollup, linked to the explorer
let proofT = 0;
function showProof(id) {
  clearInterval(proofT);
  const el = $('#rProof'), fill = () => {
    const p = api.proof(id); el.hidden = !p.length;
    el.innerHTML = p.length ? 'Verify: ' + p.map(x => `<a href="${x.url}" target="_blank" rel="noopener">${x.label}</a>`).join('') : '';
  };
  fill(); let n = 0; proofT = setInterval(() => { fill(); if (++n > 30 || !run || run.id !== id) clearInterval(proofT); }, 1000);
}
$('#again').onclick = () => {
  hideTip();
  const wash = $('#wash'); wash.classList.add('is-on');
  setTimeout(() => {
    run = null; upd = null; ended = null; $('#cash').disabled = false;
    if (TK) { idleT = (TK.dist / sc.SPEED) % sc.LOOP; TK = null; }
    park(0.32);                                       // back on a box, the coin hops as the wash lifts
    setScreen('lobby'); renderLobby();
    requestAnimationFrame(() => wash.classList.remove('is-on'));
  }, 430);
};
// ── share: a picture of the end of the run (coin in the middle, result over it) goes with the post
// the scene is drawn once more at card size, in the same frame, so the picture is sharp on every screen
function grabScene() {
  const c = document.createElement('canvas'); c.width = CARD.w; c.height = CARD.h;
  const keep = [sc.L.DOLLY, sc.L.FOLLOW_T];
  try {
    sc.L.DOLLY = 0.55; sc.L.FOLLOW_T = 0.75;          // same framing on every device (phones keep the camera further back)
    sc.setSize(CARD.w, CARD.h, 1, { aspect: 16 / 9, x: 0.5, y: 0.5 }); repose(); sc.draw();
    c.getContext('2d').drawImage(sc.canvas, 0, 0, CARD.w, CARD.h);
  } catch { return null; }
  finally { [sc.L.DOLLY, sc.L.FOLLOW_T] = keep; sc.setSize(innerWidth, innerHeight, dpr(), cover()); repose(); sc.draw(); }
  return c;
}
async function makeCard(scene) {
  const r = ended, mine = run; if (!r || !mine) return;
  const a = byId[mine.assetId], bust = r.status === 'busted';
  const d = {
    eyebrow: bust ? 'The coin fell' : r.status === 'expired' ? "Time's up, cashed out" : 'Cashed out',
    value: signed(r.pnl), unit: 'tUSDC', win: r.pnl > 0.005,
    side: mine.side, ticker: a.ticker, logo: await loadLogo('assets/brand/sirocco-mark-safran.svg'),
    stats: [['Stake', `${money(mine.stake)} tUSDC`], ['Return', pct(r.pnlPct)], ['Top leverage', levTxt(r.maxLeverage)], ['Entry', price(r.entryPrice)], ['Exit', price(r.exitPrice)], ['Time', `${Math.max(1, Math.round(r.duration))}s`]],
  };
  const blob = await toBlob(drawCard(scene, d));
  if (ended !== r || !blob) return;
  card = { blob, src: URL.createObjectURL(blob) };
  const dl = $('#dl'); dl.href = card.src; dl.download = `siroclimb-${a.ticker}-${mine.side}.png`; dl.hidden = false;
}
// the hosted link: its preview is the result card, drawn by the server from the settled climb on Solana
let link = null;
function askLink(r) {
  link = { r, url: null, pending: api.shareCard(null, r).catch(() => null) };
  const l = link; l.pending.then(u => { l.url = u; });
}
const PLAYED_ON = 'Fully on-chain on a @magicblock Ephemeral Rollup: live prices every few hundred ms, zero fees, settled on Solana.';
function shareText() {
  const a = byId[run.assetId], r = ended, side = run.side === 'short' ? 'short' : 'long', at = `${levTxt(r.maxLeverage)} ${side} on ${a.ticker}`;
  const head = r.status === 'busted' ? `My coin fell off the stairs at ${at} 🪙 Rematch incoming.`
    : r.pnl > 0.005 ? `Climbed to ${at} and cashed out ${signed(r.pnl)} tUSDC (${pct(r.pnlPct)}) on Siroclimb 🪙\n\nCan you climb higher?`
    : `Cashed out at ${at} before the stairs gave way 🪙\n\nYour turn on Siroclimb.`;
  return { text: `${head}\n\n${PLAYED_ON}`, url: location.origin + location.pathname.replace(/(play|index)\.html$/, '') };
}
const intent = (text, url) => 'https://x.com/intent/post?' + new URLSearchParams({ text, url }).toString();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
let tipT = 0;
function showTip(copied, href) {
  const t = $('#sharetip');
  $('#tipImg').src = card ? card.src : '';
  $('#tipDl').href = card ? card.src : '#';
  $('#tipMsg').innerHTML = copied ? `Picture copied. Press <kbd>${isMac ? '⌘' : 'Ctrl'}</kbd> <kbd>V</kbd> in your post to add it.` : 'Save the picture and add it to your post.';
  $('#tipX').href = href;
  t.hidden = false; requestAnimationFrame(() => t.classList.add('is-on'));
  clearTimeout(tipT); tipT = setTimeout(hideTip, 12000);
}
// a new tab for X, this one stays on the game: window.open with 'noopener' always returns null,
// so it can't tell a blocked popup; open it plain, cut the opener by hand, and only fall back to this tab when blocked
function openTab(href) { const w = window.open(href, '_blank'); if (w) { try { w.opener = null; } catch {} } else location.href = href; }
function hideTip() { const t = $('#sharetip'); t.classList.remove('is-on'); clearTimeout(tipT); tipT = setTimeout(() => { t.hidden = true; }, 300); }
$('#tipClose').onclick = hideTip;
$('#share').onclick = async () => {
  if (!ended) return;
  sound.tick();
  const { text, url } = shareText();
  // phones: the system share sheet takes the picture itself and the text (with the result's link when it is
  // signed already) straight into the X app; called right away, while the tap still counts as a user gesture
  const file = card && new File([card.blob], 'siroclimb.png', { type: 'image/png' });
  if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    const u = link && link.r === ended && link.url ? link.url : url;
    try { await navigator.share({ files: [file], text: `${text}\n${u}` }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  // the hosted link carries the picture: open the post with it (a tab opened now, so no popup blocker,
  // pointed at X once the climb has settled and the link is signed)
  if (link && link.r === ended && (link.url || !api.mock)) {
    let u = link.url, w = null;
    if (!u) {
      w = window.open('', '_blank');
      const btn = $('#share'); btn.classList.add('is-busy');
      u = await Promise.race([link.pending, new Promise(r => setTimeout(() => r(null), 9000))]);
      btn.classList.remove('is-busy');
    }
    if (u) { const href = intent(text, u); if (w) { w.opener = null; w.location.href = href; } else openTab(href); return; }
    if (w) w.close();
  }
  const href = intent(text, url);
  // desktop: the picture goes to the clipboard, X opens with the post written, one paste adds the picture
  let copied = false;
  if (card && navigator.clipboard && window.ClipboardItem) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': card.blob })]); copied = true; } catch {} }
  window.open(href, '_blank', 'noopener');
  if (card) showTip(copied, href);
};

// ── sparkline: last 60 s, scrolls smoothly, entry line while playing
const spark = { el: $('#spark'), entry: 0, asset: assets[0].id };
function drawSpark() {
  const c = spark.el; if (screen !== 'game' || !c.offsetWidth) return;
  const w = c.offsetWidth, h = c.offsetHeight, r = Math.min(devicePixelRatio || 1, 2);
  if (c.width !== w * r) { c.width = w * r; c.height = h * r; }
  const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, w, h);
  const span = 45, pts = api.history(spark.asset, span + 1); if (pts.length < 2) return;
  const now = Date.now();
  let lo = Infinity, hi = -Infinity; for (const p of pts) { lo = Math.min(lo, p.price); hi = Math.max(hi, p.price); }
  if (spark.entry) { lo = Math.min(lo, spark.entry); hi = Math.max(hi, spark.entry); }
  const pad = (hi - lo) * 0.15 || hi * 0.0005; lo -= pad; hi += pad;
  const X = ts => w - ((now - ts) / 1000 / span) * w, Y = p => h - ((p - lo) / (hi - lo)) * h;
  x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(X(p.ts), Y(p.price)) : x.moveTo(X(p.ts), Y(p.price))));
  const lp = pts[pts.length - 1]; x.lineTo(w, Y(lp.price));
  x.lineWidth = 1.6; x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.stroke();
  x.lineTo(w, h); x.lineTo(X(pts[0].ts), h); x.closePath();
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fill();
  if (spark.entry) { x.setLineDash([3, 4]); x.strokeStyle = 'rgba(242,201,76,.95)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, Y(spark.entry)); x.lineTo(w, Y(spark.entry)); x.stroke(); x.setLineDash([]); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(w - 2.5, Y(lp.price), 2.5, 0, Math.PI * 2); x.fill();
}

// ── sheets
let openSheetEl = null, lastFocus = null;
function openSheet(id) {
  closeSheet(true);
  const el = document.getElementById(id); el.hidden = false; openSheetEl = el; lastFocus = document.activeElement;
  el.querySelector('.sheet__card').focus({ preventScroll: true });
  if (id === 'board') loadBoard(store.get('board', 'today'));
  if (id === 'reserve') loadReserve();
  if (id === 'packSheet') renderPack(true);
}
function closeSheet(now) {
  const el = openSheetEl; if (!el) return; openSheetEl = null;
  if (el.id === 'walletSheet' && pickWallet) { const f = pickWallet; pickWallet = null; f(null); }
  if (id(el) === 'rules') store.set('seenRules', true);
  if (now === true || reduce) { el.hidden = true; return; }
  el.classList.add('is-closing');
  setTimeout(() => { el.hidden = true; el.classList.remove('is-closing'); lastFocus?.focus?.({ preventScroll: true }); }, 220);
}
const id = el => el.id;
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openSheet(b.dataset.open); }));
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) closeSheet(); }));
$('#boardTabs').querySelectorAll('button').forEach(b => b.onclick = () => loadBoard(b.dataset.v));
// ── Sirocco Reserve: the pool every climb borrows from; anyone can lend to it
async function loadReserve() {
  const R = await api.reserveInfo().catch(() => null);
  if (!R) { $('#resStats').innerHTML = '<div><dt>Status</dt><dd>Opening soon</dd></div>'; return; }
  const big = v => (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : money(v));
  const rows = [['TVL', `${big(R.tvl)} tUSDC`], ['Utilization', `${(R.utilization * 100).toFixed(2)}%`], ['Borrow lines open', `${big(R.lines)} tUSDC`],
    ['Share price', R.sharePrice.toFixed(6)], ['Lender APY', `${R.apy >= 0 ? '' : '−'}${Math.abs(R.apy * 100).toFixed(2)}%`], ['Borrow APR + fee', `${R.aprBorrow}% + ${(R.feeBps / 100).toFixed(1)}%`]];
  $('#resStats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const D = R.desk;
  $('#resDesk').innerHTML = D ? `<h3>Sirocco desk</h3><p class="fine">Every climb holds real tokens: longs buy them from the desk into the climb's escrow, shorts borrow them from the lending book and sell them to the desk, at the live price ±${(D.spreadBps / 100).toFixed(2)}%.</p>`
    + `<table><thead><tr><th>Token</th><th>Desk</th><th>Lendable</th></tr></thead><tbody>${D.markets.map(m => `<tr><td>${m.ticker}</td><td>${big(m.inventory)}</td><td>${big(m.lendable)}</td></tr>`).join('')}</tbody></table>`
    + `<p class="fine">tUSDC float ${big(D.usdc)} · in open longs ${money(D.openLong)} · open shorts ${money(D.openShort)} · ${D.trades} trades, ${big(D.volume)} tUSDC traded</p>` : '';
  $('#resMe').innerHTML = R.me && R.me.shares > 0 ? `You lend <b>${money(R.me.value)} tUSDC</b> (${money(R.me.shares)} shares).`
    : api.account() ? 'You have nothing lent yet.' : 'Connect a wallet to lend.';
  resLast = R;
}
let resLast = null;
async function reserveAct(kind) {
  if (!(await connect(true))) return;
  const amt = Number($('#resAmt').value);
  const btns = [$('#resDeposit'), $('#resWithdraw')]; btns.forEach(b => b.disabled = true);
  try {
    if (kind === 'deposit') { await api.deposit(amt); toast(`${money(amt)} tUSDC lent to the Sirocco Reserve`); }
    else { const all = resLast && resLast.me && amt >= resLast.me.value; await api.withdraw(amt, all); toast(`${all ? 'Everything' : money(amt) + ' tUSDC'} withdrawn from the reserve`); }
    sound.tick();
  } catch (e) { toast(e.message); }
  finally { btns.forEach(b => b.disabled = false); loadReserve(); }
}
$('#resDeposit').onclick = () => reserveAct('deposit');
$('#resWithdraw').onclick = () => reserveAct('withdraw');
async function loadBoard(scope) {
  if (scope !== 'all') scope = 'today';
  store.set('board', scope);
  $('#boardTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === scope)));
  const list = await api.leaderboard(scope);
  $('#boardList').innerHTML = list.length ? list.slice(0, 10).map((s, i) =>
    `<li class="${s.you ? 'is-you' : ''}"><span class="n">${i + 1}</span><span>${s.you ? 'You' : s.name}</span><span class="v">${pct(s.pnlPct)}</span></li>`).join('')
    : `<li class="empty">No climb ${scope === 'all' ? 'yet' : 'today'}. Be the first.</li>`;
}

// ── resize, boot
addEventListener('resize', () => { if (sc) sc.setSize(innerWidth, innerHeight, dpr(), cover()); });
document.addEventListener('visibilitychange', () => { last = performance.now(); });

(async function boot() {
  // the live scene from the first frame (it draws the current coin), before the chain client is up;
  // the pre-rendered film only as a fallback (no WebGL, or reduced motion)
  if (!reduce) initScene();
  if (!sc) {
    $('#wash').classList.remove('is-on'); stage.classList.add('is-film'); film.preload = 'auto';
    if (!reduce) film.play().catch(() => {});
  }
  requestAnimationFrame(frame);
  await api.init();
  renderWallet(); renderBalance(api.balance()); renderLobby();
  if (screen !== 'intro') maybeRules(1200);
  setInterval(() => { if (screen === 'lobby') { renderGo(); renderClosed(); } }, 250);
  setInterval(() => { if (screen === 'lobby') renderClosed(); }, 1000);
  renderPack();
})();

// ── landing → lobby: one page, one scene. The copy steps aside, the belt brakes, the coin settles on its box
//    and hops once (one full turn), then the bar and the lobby rise over the very same shot.
function maybeRules(ms) { if (!store.get('seenRules', false)) setTimeout(() => { if (screen === 'lobby') openSheet('rules'); }, ms); }
function toLobby() {
  if (screen !== 'intro') return;
  sound.unlock(); sound.tick();
  body.classList.add('from-intro');
  if (sc && live) park(0.06, false);
  setScreen('lobby'); renderLobby();
  setTimeout(() => body.classList.remove('from-intro'), 2200);
  maybeRules(2000);
}
$('#startPlaying').addEventListener('click', e => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  history.pushState(null, '', '#play');
  toLobby();
});
// back button: from the lobby, return to the landing (the belt rolls again under a quick wash)
addEventListener('popstate', () => {
  if (location.hash === '#play') { if (screen === 'intro') toLobby(); return; }
  if (screen !== 'lobby') { history.pushState(null, '', '#play'); return; }
  closeSheet(true);
  const wash = $('#wash'); wash.classList.add('is-on');
  setTimeout(() => { G = null; setScreen('intro'); requestAnimationFrame(() => wash.classList.remove('is-on')); }, 430);
});

// ── stairs game: the path follows the price. One step = a typical half-second move of this market,
//    measured from its own recent ticks, so calm and wild markets both climb at a readable pace.
const lvl = { level: 0, q: 0.0015, entry: 0, sign: 1, last: 0 };
if (globalThis.SIROCLIMB_DEBUG) { window.__lvl = lvl; window.__tk = () => TK && { t: TK.t, v: TK.v, dist: TK.dist, y: TK.y, air: TK.air, camY: TK.camY }; }
function stepSize(assetId) {
  const h = api.history(assetId, 60); if (h.length < 10) return 0.0015;
  const t0 = h[0].ts, t1 = h[h.length - 1].ts, px = []; let j = 0;
  for (let t = t0; t <= t1; t += 500) { while (j < h.length - 1 && h[j + 1].ts <= t) j++; px.push(h[j].price); }
  const r = []; for (let i = 1; i < px.length; i++) r.push(Math.log(px[i] / px[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
  return Math.max(1e-5, sd * 1.4);
}
// Every price change is a step in its own direction (up when it goes the player's way), sized by the move in
// this market's typical tick, on a log scale: an ordinary tick is one step, twice that three, four times five,
// eight times or more seven (a tall riser, a big jump; taller walls hid the coin and the camera lagged).
// Purely visual: the climb's value, the bust and the payout come from the chain.
const MAX_STEP = 7;
const stepsFor = (size) => Math.max(1, Math.min(MAX_STEP, 1 + Math.round(2 * Math.log2(Math.max(1, size)))));
/// The typical size of one price change of this market (median of its recent non-zero moves).
function typicalMove(assetId) {
  const h = api.history(assetId, 90), r = [];
  for (let i = 1; i < h.length; i++) if (h[i].price !== h[i - 1].price) r.push(Math.abs(Math.log(h[i].price / h[i - 1].price)));
  if (r.length < 5) return 0;
  r.sort((a, b) => a - b);
  return r[Math.floor(r.length / 2)];
}
function levelFrom(price) {
  if (globalThis.SIROCLIMB_DEBUG) (window.__lvlog ||= []).push([Math.round(performance.now() / 100) / 10, price, lvl.last]);
  if (!lvl.entry || !(price > 0)) return;
  if (!lvl.last) { lvl.last = price; return; }
  if (price === lvl.last) return;
  const r = lvl.sign * Math.log(price / lvl.last);
  lvl.level += Math.sign(r) * stepsFor(Math.abs(r) / (lvl.tick || lvl.q));
  lvl.last = price;
}
function startTrack(r) {
  if (!sc || !G) return;
  lvl.level = 0; lvl.entry = r.entryPrice; lvl.last = r.entryPrice; lvl.sign = r.side === 'short' ? -1 : 1; lvl.q = stepSize(r.assetId); lvl.tick = typicalMove(r.assetId);
  TK = sc.createTrack(G.plan); TK.dangerTo = 0;
  G = null;
  TK.onStep = (n, big) => {
    bubble(n, big);
    if (big) { (n > 0 ? sound.cash : sound.drop)(); haptic(n > 0 ? [10, 20, 10] : 26); }
    else { (n > 0 ? sound.up : sound.down)(lvl.level); haptic(8); }
  };
}

// floating "+1" / "−2" over the coin on each step
const bubbles = [];
function bubble(n, big) {
  const el = document.createElement('span');
  el.className = 'bubble' + (n > 0 ? ' is-up' : ' is-down') + (big ? ' is-big' : '');
  el.textContent = (n > 0 ? '+' : '−') + Math.abs(n);
  $('.hud').appendChild(el);
  bubbles.push({ el, t: performance.now() });
}
function bubbleFrame() {
  if (!bubbles.length) return;
  const p = sc.coinNDC(), x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight, now = performance.now();
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i], k = (now - b.t) / 750;
    if (k >= 1) { b.el.remove(); bubbles.splice(i, 1); continue; }
    const e = 1 - (1 - k) ** 3;
    b.el.style.transform = `translate(${x + 34}px, ${y - 40 - e * 46}px) translate(-50%, -50%) scale(${0.8 + 0.2 * Math.min(1, k * 5)})`;
    b.el.style.opacity = String(k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45));
  }
}

// ── leverage packs: MagicBlock VRF draws the tier, the pack is a free climb on the house up to that leverage
const packBtn = $('#packBtn');
let packBusy = false;
function renderPack(inSheet) {
  packBtn.hidden = !api.account() || api.mock;
  const ready = api.pack();
  packBtn.textContent = ready ? `${ready.tier} pack ready` : 'Leverage pack';
  packBtn.classList.toggle('is-ready', !!ready);
  if (!inSheet && $('#packSheet').hidden) return;
  const won = ready ? ready.tier : null;
  $('#packBody').innerHTML = `<p>A free 10 tUSDC climb on the house. MagicBlock's verifiable randomness draws how high its ladder goes; you keep the gain.</p>
    <div class="pack__tiers">${api.PACKS.map(p => `<div class="${p.tier === won ? 'is-won' : ''} ${packBusy ? 'is-rolling' : ''}"><b>${p.tier}</b><span>up to ${levTxt(p.maxLeverage)}</span><br><span>${Math.round(p.odds * 100)}%</span></div>`).join('')}</div>
    ${packLink ? `<p class="fine">Drawn on chain: <a href="${packLink}" target="_blank" rel="noopener">VRF request on the explorer</a></p>` : ''}`;
  const go = $('#packGo');
  go.disabled = packBusy;
  go.textContent = packBusy ? 'Drawing…' : ready ? `Play the ${ready.tier} pack on ${byId[C.asset].ticker} ${C.side}` : 'Open a pack';
}
let packLink = '';
$('#packGo').onclick = async () => {
  if (packBusy) return;
  if (!(await connect(true))) return;
  const ready = api.pack();
  if (ready) {
    if (!api.marketOpen(C.asset)) { toast(`${byId[C.asset].ticker} is closed right now`); return; }
    packBusy = true; renderPack(true);
    try { const r = await api.startRun({ mode: 'solo', assetId: C.asset, side: C.side, pack: true }); closeSheet(true); enterGame(r); }
    catch (e) { toast(e.message); }
    finally { packBusy = false; renderPack(); }
    return;
  }
  packBusy = true; renderPack(true);
  try { const p = await api.openPack(); packLink = p.url || ''; sound.cash(); toast(`${p.tier} pack: your free climb goes up to ${levTxt(p.maxLeverage)}`); }
  catch (e) { toast(e.message); }
  finally { packBusy = false; renderPack(true); }
};
