// Siroclimb in-browser simulation (`?mock`): the same contract as js/api.js, no chain,
// so the front can be built and demoed offline. The real thing is js/api-chain.js.
//
// Units: amounts in test USDC (tUSDC), prices in USD, times in ms since epoch unless noted.
//
//   init()                                   → Promise<{ user: { name }, balance }>
//   connect() / account() / disconnect()     → wallet + session key: { address } | address | null
//   listAssets()                             → Asset[]            { id, name, ticker, kind: 'stock' | 'metal' }
//   subscribePrice(assetId, cb)              → unsubscribe()      cb({ price, ts })
//   history(assetId, seconds)                → [{ price, ts }]    recent ticks, oldest first
//   rules                                    → { ladder: number[], stepEvery: s, duration: s }
//   startRun({ mode, assetId, side, stake }) → Promise<Run>       mode 'solo', side 'long' | 'short'
//   onRun(runId, cb)                         → unsubscribe()      cb(RunUpdate) on every price tick
//   cashOut(runId)                           → Promise<RunResult>
//   leaderboard(scope)                       → Promise<Standing[]> scope 'today' | 'all'
//   balance()                                → number
//   onBalance(cb)                            → unsubscribe()
//   faucet()                                 → Promise<number>    tops the test balance back up
//   openPack()                               → Promise<{ tier, maxLeverage, proof }>   leverage packs (VRF), UI off for now
//   shareCard(png, result)                   → Promise<string|null> optional: host the share picture and return a public page
//                                              whose og:image / twitter:card is that picture, so the posted link shows it by itself.
//                                              null = not hosted (the front then attaches the picture itself: share sheet or clipboard)
//
// Run        { id, mode, assetId, side, stake, entryPrice, startedAt, ladder, stepEvery, duration }
// RunUpdate  { t (s since start), price, step, leverage, value, pnl, pnlPct, risk (0..1 of the stake lost), status }
// RunResult  { status: 'cashed' | 'busted' | 'expired', value, pnl, pnlPct, maxLeverage, duration (s), entryPrice, exitPrice }

// ─────────────────────────────── MOCK ───────────────────────────────

const Q = new URLSearchParams(location.search);
const WILD = Q.get('demo') === 'wild';          // ?demo=wild: much bigger moves, to see the fall
const DEMO_VOL = 4;                              // the demo feed moves faster than the real market, so a minute of play has stakes
const TICK_MS = 200;

const ASSETS = [
  { id: 'TSLAx', name: 'Tesla', ticker: 'TSLAx', kind: 'stock', p0: 385.17, vol: 0.0011 },
  { id: 'NVDAx', name: 'NVIDIA', ticker: 'NVDAx', kind: 'stock', p0: 164.70, vol: 0.0010 },
  { id: 'AAPLx', name: 'Apple', ticker: 'AAPLx', kind: 'stock', p0: 349.03, vol: 0.0007 },
  { id: 'XAU', name: 'Gold', ticker: 'XAUt', kind: 'metal', p0: 3633.4, vol: 0.0006 },
  { id: 'MSTRx', name: 'MicroStrategy', ticker: 'MSTRx', kind: 'stock', p0: 82.1, vol: 0.0012 },
];

export const rules = { ladder: [1, 1.5, 2, 2.5, 3, 3.5, 4], stepEvery: 6, duration: 60 };

// ── prices: one random walk per asset (per-second volatility), shared clock
const feeds = new Map();
for (const a of ASSETS) feeds.set(a.id, { price: a.p0 * (1 + (Math.random() - 0.5) * 0.004), hist: [], subs: new Set(), vol: a.vol * DEMO_VOL * (WILD ? 3 : 1), drift: 0 });
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function tick() {
  const ts = Date.now(), dt = TICK_MS / 1000;
  for (const f of feeds.values()) {
    f.drift = f.drift * 0.98 + gauss() * 0.02;                 // a little momentum, so moves read as trends
    f.price *= Math.exp(f.vol * Math.sqrt(dt) * (gauss() + f.drift * 1.5));
    f.hist.push({ price: f.price, ts }); if (f.hist.length > 900) f.hist.shift();
    f.subs.forEach(cb => cb({ price: f.price, ts }));
  }
  runTick(ts);
}
for (let i = 0; i < 300; i++) { const ts = Date.now() - (300 - i) * TICK_MS; for (const f of feeds.values()) { f.price *= Math.exp(f.vol * Math.sqrt(TICK_MS / 1000) * gauss()); f.hist.push({ price: f.price, ts }); } }
setInterval(tick, TICK_MS);

export const listAssets = () => ASSETS.map(({ id, name, ticker, kind }) => ({ id, name, ticker, kind }));
export function subscribePrice(id, cb) { const f = feeds.get(id); f.subs.add(cb); cb(f.hist[f.hist.length - 1]); return () => f.subs.delete(cb); }
export function history(id, seconds = 60) { const f = feeds.get(id), from = Date.now() - seconds * 1000; return f.hist.filter(h => h.ts >= from); }

// ── wallet (test tokens, kept in this browser)
const store = {
  get(k, d) { try { const v = localStorage.getItem('siroclimb:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('siroclimb:' + k, JSON.stringify(v)); } catch {} },
};
let bal = store.get('balance', 1000);
const balSubs = new Set();
const setBal = v => { bal = Math.round(v * 100) / 100; store.set('balance', bal); balSubs.forEach(cb => cb(bal)); };
export const balance = () => bal;
export function onBalance(cb) { balSubs.add(cb); return () => balSubs.delete(cb); }
export async function faucet() { setBal(Math.max(bal, 1000)); return bal; }
export const account = () => store.get('address', null);
export async function connect() {               // wallet + game session (one signature, then instant actions)
  await new Promise(r => setTimeout(r, 650));
  let a = account();
  if (!a) { const B = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; a = Array.from(crypto.getRandomValues(new Uint8Array(44)), b => B[b % 58]).join(''); store.set('address', a); }
  return { address: a };
}
export function disconnect() { store.set('address', null); }
export async function init() { return { user: { name: store.get('name', 'You') }, balance: bal }; }

// ── runs
const runs = new Map();
const sideSign = s => (s === 'short' ? -1 : 1);
function makeRun({ mode, assetId, side, stake, startedAt = Date.now(), name = 'You', bot = null }) {
  const f = feeds.get(assetId);
  return { id: Math.random().toString(36).slice(2), mode, assetId, side, stake, name, bot, entryPrice: f.price, last: f.price, startedAt,
    ladder: rules.ladder, stepEvery: rules.stepEvery, duration: rules.duration, value: stake, maxLev: 1, status: 'live', subs: new Set(), endedAt: 0 };
}
function stepOf(run, t) { return Math.min(run.ladder.length - 1, Math.floor(t / run.stepEvery)); }
function advance(run, ts) {
  if (run.status !== 'live') return;
  const f = feeds.get(run.assetId), t = (ts - run.startedAt) / 1000;
  if (t < 0) { run.last = f.price; run.entryPrice = f.price; return; }
  const step = stepOf(run, t), lev = run.ladder[step];
  run.value *= 1 + lev * sideSign(run.side) * (f.price / run.last - 1);
  run.last = f.price; run.maxLev = Math.max(run.maxLev, lev);
  if (run.value <= 0) { run.value = 0; run.status = 'busted'; run.endedAt = ts; }
  else if (t >= run.duration) { run.status = 'expired'; run.endedAt = ts; }
  if (run.bot && run.status === 'live' && run.bot(t, run)) { run.status = 'cashed'; run.endedAt = ts; }
}
function update(run, ts) {
  const t = Math.max(0, (Math.min(ts, run.endedAt || ts) - run.startedAt) / 1000), step = stepOf(run, t);
  return { t, price: run.last, step, leverage: run.ladder[step], value: run.value, pnl: run.value - run.stake, pnlPct: (run.value / run.stake - 1) * 100,
    risk: Math.min(1, Math.max(0, 1 - run.value / run.stake)), status: run.status,
    borrowed: run.stake * (run.ladder[step] - 1), borrowCost: costOf(run, t) };
}
// the Sirocco Reserve in the simulation: same fee (0.1 % of the peak borrow) and APR (36.5 %)
const costOf = (run, t) => run.stake * (run.maxLev - 1) * 0.001 + run.stake * (run.maxLev - 1) * 0.365 * Math.min(t, run.duration) / 31_536_000;
function settle(run) {
  const duration = ((run.endedAt || Date.now()) - run.startedAt) / 1000, cost = Math.min(run.value, costOf(run, duration)), value = run.value - cost;
  const r = { status: run.status, value, pnl: value - run.stake, pnlPct: (run.value / run.stake - 1) * 100, maxLeverage: run.maxLev,
    duration, entryPrice: run.entryPrice, exitPrice: run.last, borrowCost: cost, peakBorrow: run.stake * (run.maxLev - 1) };
  if (run.mode === 'solo' && !run.bot) { setBal(bal + value); mockReserve.tvl += run.stake - value; record(run, r); }
  return r;
}

// ── Sirocco Reserve (simulated lending pool)
const mockReserve = { tvl: 5_000_000, shares: 5_000_000, mine: store.get('reserveShares', 0) };
export async function reserveInfo() {
  const sp = mockReserve.tvl / mockReserve.shares;
  return { tvl: mockReserve.tvl, sharePrice: sp, free: mockReserve.tvl, reserved: 0, lines: 0, utilization: 0, apy: 0, fees: 0, runs: 0, borrowedVolume: 0, aprBorrow: 36.5, feeBps: 10,
    me: mockReserve.mine ? { shares: mockReserve.mine, value: mockReserve.mine * sp, deposited: 0, withdrawn: 0 } : null };
}
export async function deposit(amount) {
  if (!(amount >= 1 && amount <= bal)) throw new Error('Not enough test tokens');
  const n = amount * mockReserve.shares / mockReserve.tvl;
  setBal(bal - amount); mockReserve.tvl += amount; mockReserve.shares += n; mockReserve.mine += n; store.set('reserveShares', mockReserve.mine);
  return 'mock';
}
export async function withdraw(amount, all = false) {
  const sp = mockReserve.tvl / mockReserve.shares, n = all ? mockReserve.mine : Math.min(mockReserve.mine, amount / sp);
  if (!(n > 0)) throw new Error('Nothing lent to the reserve yet');
  setBal(bal + n * sp); mockReserve.tvl -= n * sp; mockReserve.shares -= n; mockReserve.mine -= n; store.set('reserveShares', mockReserve.mine);
  return 'mock';
}
function runTick(ts) {
  for (const run of runs.values()) {
    const was = run.status; advance(run, ts);
    const u = update(run, ts); run.subs.forEach(cb => cb(u));
    if (was === 'live' && run.status !== 'live' && !run.bot) { run.result = settle(run); run.done?.(run.result); }
  }
}
export async function startRun({ mode = 'solo', assetId, side = 'long', stake }) {
  if (!(stake > 0) || stake > bal) throw new Error('Not enough test tokens');
  setBal(bal - stake);
  const run = makeRun({ mode, assetId, side, stake }); runs.set(run.id, run);
  return publicRun(run);
}
const publicRun = r => ({ id: r.id, mode: r.mode, assetId: r.assetId, side: r.side, stake: r.stake, entryPrice: r.entryPrice, startedAt: r.startedAt, ladder: r.ladder, stepEvery: r.stepEvery, duration: r.duration });
export function onRun(id, cb) { const run = runs.get(id); run.subs.add(cb); return () => run.subs.delete(cb); }
export function runResult(id) { const run = runs.get(id); return run.result || null; }
export function whenEnded(id) { const run = runs.get(id); return run.result ? Promise.resolve(run.result) : new Promise(res => { run.done = res; }); }
export async function cashOut(id) {
  const run = runs.get(id);
  if (run.status === 'live') { advance(run, Date.now()); if (run.status === 'live') { run.status = 'cashed'; run.endedAt = Date.now(); } run.result = settle(run); run.done?.(run.result); }
  return run.result;
}

// ── history + leaderboards (local for the mock)
function record(run, r) {
  const h = store.get('history', []);
  h.unshift({ ts: Date.now(), assetId: run.assetId, side: run.side, stake: run.stake, mode: run.mode, ...r });
  store.set('history', h.slice(0, 100));
}
const NAMES = ['dune.sol', 'mistral', 'saffron', 'harmattan', 'oasis', 'zephyr', 'atlas', 'ghibli', 'khamsin', 'leveche', 'simoom', 'tramontane', 'bora', 'chinook'];
export async function leaderboard(scope = 'today') {
  const mine = store.get('history', []).filter(h => scope === 'all' || Date.now() - h.ts < 864e5).map(h => ({ name: 'You', pnlPct: h.pnlPct, pnl: h.pnl, you: true }));
  const seed = scope === 'all' ? 7 : new Date().getDate();
  const bots = NAMES.map((n, i) => ({ name: n, pnlPct: ((Math.sin(seed * 97 + i * 13.7) * 0.5 + 0.5) ** 2) * (scope === 'all' ? 46 : 22) + 0.4 }));
  const best = mine.sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 3);
  return [...bots, ...best].sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 12);
}

export function runInfo(id) { const r = runs.get(id); return r ? publicRun(r) : null; }

// ── leverage packs (VRF on chain). Kept off in the UI for now.
export const PACKS = [
  { tier: 'Bronze', maxLeverage: 1.5, odds: 0.45 }, { tier: 'Silver', maxLeverage: 2, odds: 0.28 },
  { tier: 'Gold', maxLeverage: 3, odds: 0.18 }, { tier: 'Diamond', maxLeverage: 4, odds: 0.09 },
];
export async function openPack() {
  const r = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32; let acc = 0;
  const p = PACKS.find(p => (acc += p.odds) >= r) || PACKS[0];
  return { tier: p.tier, maxLeverage: p.maxLeverage, proof: 'mock-' + r.toString(16).slice(2, 10) };
}

// the front cannot host pictures alone: the back end can upload `png` and return a page with twitter:card = summary_large_image
export async function shareCard(png, result) { return null; }

// test hook for the front (not part of the contract): force a fall on a live run
export const _debug = { bust() { for (const r of runs.values()) if (!r.bot && r.status === 'live') r.value = -1; } };

