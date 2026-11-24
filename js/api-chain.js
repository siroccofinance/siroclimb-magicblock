// Siroclimb on chain: the front's contract (see js/api.js) served by the
// siroclimb program on Solana devnet and a MagicBlock Ephemeral Rollup.
//
//   prices     MagicBlock's Pyth Lazer feed accounts read from the rollup every
//              250 ms.
//   wallet     Phantom / Solflare / Backpack, or a built-in devnet burner. One
//              approval creates the profile, tops up test USDC, authorises a
//              MagicBlock session key and lets it stake: every later action
//              (start, cash out, packs, settle) is signed by that key.
//   climbs     stake + delegate on Solana, begin / ticks (crank) / cash out on
//              the rollup, commit + undelegate, settle on Solana. Solo only.
import { Connection } from '@solana/web3.js';
import {
  BASE_RPC, BOOST, ER_EXPLORER, ER_RPC, EXPLORER, LADDER, MARKETS, MAX_PRICE_AGE, ONE_USDC, PACKS, PROGRAM_ID,
  RUN, RUN_SECONDS, STEP_SECONDS, PACK, VAULT, marketIndex,
} from './chain/config.js';
import { Climber, SESSION_TOP_UP } from './chain/climber.js';
import { decodePrice, decodeProfile, decodeReserve, decodeRun, discriminator } from './chain/codec.js';
import { createAtaIdempotent, ix } from './chain/ix.js';
import { reservePda, runPda } from './chain/pdas.js';
import { send, sleep } from './chain/tx.js';
import { friendlyError } from './chain/errors.js';
import { handleFor } from './chain/handles.js';
import { inSession, nextOpen } from './chain/hours.js';
import { recentPrices } from './chain/history.js';
import { borrowCost, borrowedAt, reserveView, valueOf } from './chain/reserve.js';
import { dropSession, injectedWallets, loadSession, openWallet, saveSession } from './chain/wallet.js';

const base = new Connection(BASE_RPC, 'confirmed');
const er = new Connection(ER_RPC, 'confirmed');
const DELEGATION = 'DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh';
const log = (...a) => { if (globalThis.SIROCLIMB_DEBUG) console.log('[siroclimb]', ...a); };
const fail = (e) => { const m = new Error(friendlyError(e)); m.cause = e; return m; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('siroclimb:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('siroclimb:' + k, JSON.stringify(v)); } catch {} },
};

export const rules = { ladder: LADDER, stepEvery: STEP_SECONDS, duration: RUN_SECONDS };
export { PACKS };

// ─────────────────────────────────────────────────────────────── prices
const feeds = MARKETS.map((m) => ({ m, raw: 0, price: 0, ts: 0, hist: [], subs: new Set() }));
/// Open = inside a trading session (Pyth's schedule) and the price is fresh.
const isOpen = (f) => f.ts > 0 && Date.now() / 1000 - f.ts <= MAX_PRICE_AGE && inSession(f.m.hours);
const toUsd = (asset, raw) => raw * 10 ** MARKETS[asset].exponent;
async function pollPrices() {
  try {
    const accs = await er.getMultipleAccountsInfo(MARKETS.map((m) => m.feedKey));
    const now = Date.now();
    accs.forEach((a, i) => {
      if (!a) return;
      const f = feeds[i], p = decodePrice(a.data);
      if (!(p.raw > 0)) return;
      f.raw = p.raw; f.ts = p.ts; f.price = toUsd(i, p.raw);
      f.hist.push({ price: f.price, ts: now }); if (f.hist.length > 1200) f.hist.shift();
      f.subs.forEach((cb) => cb({ price: f.price, ts: now }));
    });
    priceTick(now);
  } catch (e) { log('prices', e.message); }
}
setInterval(pollPrices, 250);
pollPrices();

// The chart starts full: the last 90 s of every market, read back from its
// price account's update transactions on the rollup (no key, same source).
async function seedHistory() {
  await Promise.all(MARKETS.map(async (m, i) => {
    try {
      const past = await recentPrices(er, i, { seconds: 90, points: 90 });
      const f = feeds[i], first = f.hist.length ? f.hist[0].ts : Infinity;
      f.hist = [...past.filter((p) => p.ts < first), ...f.hist];
    } catch (e) { log('history', m.id, e.message); }
  }));
}
seedHistory();

export const listAssets = () => MARKETS.map(({ id, name, ticker, kind, hours }) => ({ id, name, ticker, kind, hours }));
export const marketOpen = (id) => isOpen(feeds[marketIndex(id)]);
/// When a closed market's next session starts (ms), or null if unknown.
export const marketOpensAt = (id) => nextOpen(MARKETS[marketIndex(id)].hours);
export function subscribePrice(id, cb) {
  const f = feeds[marketIndex(id)];
  f.subs.add(cb);
  if (f.hist.length) cb(f.hist[f.hist.length - 1]);
  return () => f.subs.delete(cb);
}
export function history(id, seconds = 60) {
  const f = feeds[marketIndex(id)], from = Date.now() - seconds * 1000;
  return f.hist.filter((h) => h.ts >= from);
}

// The climb's move rule, as the program computes it (game.rs `moved`).
function moved(value, lev, side, boost, last, price) {
  if (!last || !price || !value) return value;
  const r = (price - last) / last, v = value + value * lev * boost * (side === 1 ? -r : r);
  return v <= 0 ? 0 : v;
}
const stepAt = (t, top) => Math.min(top, Math.max(0, Math.min(LADDER.length - 1, Math.floor(t / STEP_SECONDS))));
const STATUS = { [RUN.LIVE]: 'live', [RUN.CASHED]: 'cashed', [RUN.BUSTED]: 'busted', [RUN.EXPIRED]: 'expired' };

// ─────────────────────────────────────────────────────── wallet + session
let wallet = null, climber = null, profile = null, bal = 0, sol = 0, ready = null;
const balSubs = new Set();
const setBal = (v) => { bal = Math.round(v * 100) / 100; balSubs.forEach((cb) => cb(bal)); };
export const balance = () => bal;
export const solBalance = () => sol;
export function onBalance(cb) { balSubs.add(cb); return () => balSubs.delete(cb); }
export const account = () => (wallet ? wallet.publicKey.toBase58() : null);
export const walletKind = () => (wallet ? wallet.kind : null);
export const wallets = () => [...injectedWallets().map(({ id, name }) => ({ id, name })), { id: 'burner', name: 'Burner wallet (devnet)' }];
/// The game session: when the session key expires and the SOL it has left for fees.
export async function sessionInfo() {
  if (!climber || !climber.session) return null;
  const lamports = await base.getBalance(climber.session.keypair.publicKey).catch(() => 0);
  return { key: climber.session.keypair.publicKey.toBase58(), validUntil: climber.session.validUntil * 1000, sol: lamports / 1e9 };
}
export const user = () => ({ name: profile ? profile.name : wallet ? handleFor(wallet.publicKey.toBase58()) : 'You', address: account() });

async function refreshBalance() {
  if (!climber) return;
  try {
    const [u, s] = await Promise.all([climber.usdc(), base.getBalance(wallet.publicKey)]);
    sol = s / 1e9; if (Math.abs(u - bal) > 0.001) setBal(u);
  } catch (e) { log('balance', e.message); }
}
setInterval(refreshBalance, 6000);

/// Devnet SOL for a wallet that has none: the site's faucet, then the public airdrop.
async function fundSol(min) {
  const have = await base.getBalance(wallet.publicKey);
  if (have >= min) return;
  try {
    const r = await fetch('api/faucet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account() }) });
    if (r.ok) { for (let i = 0; i < 30; i++) { await sleep(700); if ((await base.getBalance(wallet.publicKey)) >= min) return; } }
  } catch {}
  try { await base.requestAirdrop(wallet.publicKey, 1e9); for (let i = 0; i < 30; i++) { await sleep(700); if ((await base.getBalance(wallet.publicKey)) >= min) return; } } catch {}
  throw new Error(`This wallet needs a little devnet SOL (${(min / 1e9).toFixed(2)}). Get some at faucet.solana.com, then try again`);
}

/// How much SOL the session key gets: each climb's delegation costs about
/// 0.003 SOL of rollup fees (FINDINGS #4), so a wallet that can afford it
/// funds up to 0.2 SOL (about 60 climbs) and is not asked again for hours;
/// a fresh wallet still starts with the 0.05 SOL minimum (about 15 climbs).
async function fuelAmount() {
  const have = await base.getBalance(wallet.publicKey);
  return Math.max(SESSION_TOP_UP, Math.min(200_000_000, Math.floor((have - 30_000_000) / 2)));
}

/// Profile, test USDC and a live session key: the one wallet approval.
async function ensureReady() {
  if (climber.hasSession && profile) return;
  if (ready) return ready;
  ready = (async () => {
    profile = await climber.profile();
    if (climber.hasSession && profile) return;
    await fundSol(SESSION_TOP_UP + 15_000_000);
    await climber.onboard({ name: profile ? profile.name : handleFor(account()), topUp: await fuelAmount() });
    saveSession(wallet.publicKey, climber.session);
    profile = await climber.profile();
    await refreshBalance();
  })().finally(() => { ready = null; });
  return ready;
}
/// The session key pays the base-layer fees of every action; top it up when low.
async function ensureFuel() {
  const s = await base.getBalance(climber.session.keypair.publicKey);
  if (s >= 6_000_000) return;
  await fundSol(SESSION_TOP_UP + 5_000_000);
  await climber.topUpSession(await fuelAmount());
}

/// Climbs the session key can still pay for (about 0.003 SOL each).
export async function climbsLeft() {
  if (!climber || !climber.session) return 0;
  return Math.floor((await base.getBalance(climber.session.keypair.publicKey)) / 3_100_000);
}

export async function connect(id) {
  try {
    const choice = id || (injectedWallets()[0] ? injectedWallets()[0].id : 'burner');
    wallet = await openWallet(choice);
    store.set('wallet', choice);
    climber = new Climber({ base, er, wallet, session: loadSession(wallet.publicKey), log });
    await ensureReady();
    resumeMyRun();
    return { address: account() };
  } catch (e) {
    if (!climber || !climber.hasSession) { wallet = null; climber = null; }
    throw fail(e);
  }
}
export function disconnect() {
  if (wallet && wallet.disconnect) try { wallet.disconnect(); } catch {}
  wallet = null; climber = null; profile = null; store.set('wallet', null); setBal(0);
}
export async function init() {
  const last = store.get('wallet', null);
  if (last === 'burner' || (last && injectedWallets().some((w) => w.id === last))) {
    try {
      wallet = await openWallet(last);
      climber = new Climber({ base, er, wallet, session: loadSession(wallet.publicKey), log });
      profile = await climber.profile();
      if (!climber.hasSession || !profile) { wallet = null; climber = null; profile = null; }
      else { await refreshBalance(); resumeMyRun(); }
    } catch { wallet = null; climber = null; }
  }
  return { user: user(), balance: bal };
}

/// Change the on-chain handle (the wallet signs: the profile belongs to it).
export async function setName(name) {
  if (!climber) throw new Error('Connect first');
  const clean = String(name).trim().slice(0, 16);
  if (!/^[\w.\-]{3,16}$/.test(clean)) throw new Error('3 to 16 letters, digits, dots, dashes or underscores');
  try {
    await send(base, [ix.setName(wallet.publicKey, clean)], [wallet], { label: 'set name' });
    profile = await climber.profile();
    boardCache.at = 0;
    return profile.name;
  } catch (e) { throw fail(e); }
}

export async function faucet() {
  if (!climber) await connect();
  try {
    await ensureReady();
    const a = climber.session.keypair;
    // The session key claims on the player's behalf: the mint lands in the player's account.
    await send(base, [createAtaIdempotent(a.publicKey, wallet.publicKey), ix.faucet(a.publicKey, wallet.publicKey)], [a], { label: 'faucet' });
    await refreshBalance();
    return bal;
  } catch (e) { throw fail(e); }
}

// ─────────────────────────────────────────────────────────────── climbs
// One entry per climb the page knows: { pub (the Run the UI holds), chain, ... }.
const runs = new Map();
const proofs = new Map();
function addProof(id, label, sig, layer) {
  if (!sig) return;
  const p = proofs.get(id) || [];
  p.push({ label, sig, layer, url: layer === 'er' ? ER_EXPLORER('tx', sig) : EXPLORER('tx', sig) });
  proofs.set(id, p);
}
/// Explorer links of every transaction of a climb (integration proof).
export const proof = (id) => proofs.get(id) || [];
export const explorer = { tx: (sig, layer) => (layer === 'er' ? ER_EXPLORER('tx', sig) : EXPLORER('tx', sig)), program: () => EXPLORER('address', PROGRAM_ID.toBase58()) };

function pubRun(id, mode, c, extra = {}) {
  const a = c.asset;
  return {
    id, mode, assetId: MARKETS[a].id, side: c.side === 1 ? 'short' : 'long', stake: c.stake / ONE_USDC,
    entryPrice: c.entryPrice ? toUsd(a, c.entryPrice) : feeds[a].price, startedAt: c.startTs ? c.startTs * 1000 : Date.now(),
    ladder: LADDER.slice(0, (c.top ?? LADDER.length - 1) + 1), stepEvery: STEP_SECONDS, duration: RUN_SECONDS, ...extra,
  };
}
function resultOf(R) {
  const c = R.chain, a = R.asset, stake = R.pub.stake;
  const value = c.value / ONE_USDC;
  const st = c.status === RUN.SETTLED ? R.endStatus || 'cashed' : STATUS[c.status] || 'cashed';
  const end = c.endTs || Math.floor(Date.now() / 1000);
  // a pack climb is played with the reserve's money: the player only ever gains;
  // a solo climb pays its borrow cost (fee + interest) to the Sirocco Reserve
  const cost = R.pub.pack || !c.startTs ? 0 : (c.cost || Math.min(c.value, borrowCost(c.stake, end - c.startTs, R.top, c.maxStep || 0))) / ONE_USDC;
  const pnl = R.pub.pack ? Math.max(0, value - stake) : value - cost - stake;
  return {
    status: st, value: R.pub.pack ? stake + pnl : value - cost, pnl, pnlPct: (value / stake - 1) * 100, maxLeverage: LADDER[c.maxStep || 0], pack: !!R.pub.pack,
    borrowCost: cost, peakBorrow: (R.pub.pack ? stake * LADDER[c.maxStep || 0] : borrowedAt(c.stake, c.maxStep || 0) / ONE_USDC),
    duration: Math.max(0, Math.min(RUN_SECONDS, end - c.startTs)), entryPrice: toUsd(a, c.entryPrice), exitPrice: toUsd(a, c.lastPrice || c.entryPrice),
  };
}
function updateOf(R, now = Date.now()) {
  const c = R.chain, a = R.asset, f = feeds[a], stake = R.pub.stake;
  const t = Math.max(0, Math.min(RUN_SECONDS, now / 1000 - c.startTs));
  const step = stepAt(t, R.top);
  let value = c.value / ONE_USDC, price = toUsd(a, c.lastPrice || c.entryPrice);
  if (c.status === RUN.LIVE && isOpen(f) && c.lastPrice) { value = moved(value, LADDER[step], c.side, BOOST[a], c.lastPrice, f.raw); price = f.price; }
  // borrowed from the Sirocco Reserve at this step, and the loan's cost so far
  const borrowed = R.pub.pack ? stake * LADDER[step] : borrowedAt(c.stake, step) / ONE_USDC;
  const cost = R.pub.pack ? 0 : borrowCost(c.stake, t, R.top, Math.max(step, c.maxStep || 0)) / ONE_USDC;
  return {
    t, price, step, leverage: LADDER[step], value, pnl: value - stake, pnlPct: (value / stake - 1) * 100,
    risk: Math.min(1, Math.max(0, 1 - value / stake)), status: STATUS[c.status] || 'live', borrowed, borrowCost: cost,
  };
}
function priceTick(now) {
  for (const R of runs.values()) {
    if (!R.chain || R.result) continue;
    const u = updateOf(R, now);
    R.subs.forEach((cb) => cb(u));
  }
}

/// Follow a climb on the rollup until it ends, then finish and settle it (autopilot).
async function watchRun(R) {
  const key = runPda(wallet.publicKey), me = climber;
  while (!R.result) {
    await sleep(220);
    try {
      const a = await er.getAccountInfo(key);
      if (a && a.owner.equals(PROGRAM_ID)) R.chain = decodeRun(a.data);
      else {
        const b = await base.getAccountInfo(key);
        if (b && b.owner.equals(PROGRAM_ID)) R.chain = decodeRun(b.data);
      }
    } catch { continue; }
    const s = R.chain.status;
    if (s === RUN.CASHED || s === RUN.BUSTED || s === RUN.EXPIRED || s === RUN.SETTLED) {
      R.endStatus = STATUS[s] || R.endStatus;
      R.result = resultOf(R);
      R.done.forEach((f) => f(R.result));
    }
  }
  settleRun(R, me);
}
async function settleRun(R, me) {
  try {
    if (R.chain.status !== RUN.SETTLED) {
      const b = await base.getAccountInfo(runPda(me.me));
      const onBase = b && b.owner.equals(PROGRAM_ID);
      if (!onBase && R.chain.status !== RUN.CASHED) addProof(R.id, 'Finish on the rollup', await me.finishRun(me.me, R.asset).catch((e) => log('finish', e.message)), 'er');
      addProof(R.id, 'Settle on Solana', await me.settleRun(), 'base');
    }
  } catch (e) { log('settle', e.message); }
  await refreshBalance();
  profile = await me.profile().catch(() => profile);
}

/// After a reload: pick up a climb left in flight, finish and settle it.
async function resumeMyRun() {
  try {
    const c = await climber.run();
    if (!c || c.status === RUN.FREE || c.status === RUN.SETTLED) return;
    const id = `solo:${c.nonce}`;
    if (runs.has(id)) return;
    const R = { id, asset: c.asset, top: c.top, chain: c, subs: new Set(), done: [], result: null };
    R.pub = pubRun(id, 'solo', c);
    runs.set(id, R);
    if (c.status === RUN.STAKED && c.layer === 'er') await climber.finishRun(climber.me, c.asset).catch(() => {});
    watchRun(R);
  } catch (e) { log('resume', e.message); }
}

export async function startRun({ mode = 'solo', assetId, side = 'long', stake, pack = false }) {
  if (!climber) await connect();
  const asset = marketIndex(assetId);
  if (!isOpen(feeds[asset])) throw new Error(`${MARKETS[asset].ticker} is closed right now, pick an open market`);
  if (!pack && !(stake > 0 && stake <= bal)) throw new Error('Not enough test tokens');
  try {
    await ensureReady();
    await ensureFuel();
    const cur = await climber.run();
    if (cur && cur.status !== RUN.FREE && cur.status !== RUN.SETTLED) {
      // the last climb is still on its way back: finish it first
      if (cur.layer === 'er') await climber.finishRun(climber.me, cur.asset).catch(() => {});
      await climber.settleRun().catch(() => {});
    }
    const res = await climber.startRun({ asset, side, stake: pack ? 0 : stake, usePack: !!pack });
    const c = res.run, id = `solo:${c.nonce}`;
    const R = { id, mode: 'solo', asset, top: c.top, chain: c, subs: new Set(), done: [], result: null, ms: res.ms };
    R.pub = pubRun(id, 'solo', c, pack ? { pack: PACKS[c.packTier] } : {});
    runs.set(id, R);
    addProof(id, 'Stake + delegate on Solana', res.sigs.base, 'base');
    addProof(id, 'Begin on the rollup (crank scheduled)', res.sigs.begin, 'er');
    if (!pack) setBal(bal - stake);
    if (pack && profile) profile.packState = PACK.NONE;
    watchRun(R);
    return R.pub;
  } catch (e) { throw fail(e); }
}
export function onRun(id, cb) { const R = runs.get(id); R.subs.add(cb); return () => R.subs.delete(cb); }
export function runResult(id) { const R = runs.get(id); return (R && R.result) || null; }
export function whenEnded(id) { const R = runs.get(id); return R.result ? Promise.resolve(R.result) : new Promise((res) => R.done.push(res)); }
export function runInfo(id) { const R = runs.get(id); return R ? R.pub : null; }
export async function cashOut(id) {
  const R = runs.get(id);
  if (R.result) return R.result;
  try {
    addProof(id, 'Cash out on the rollup (commit + undelegate)', await climber.cashOut(R.asset), 'er');
  } catch (e) {
    if (!R.result) throw fail(e);
  }
  return whenEnded(id);
}

// ─────────────────────────────────────────────── Sirocco Reserve (lending pool)
/// The reserve as the UI shows it, plus the connected wallet's position.
export async function reserveInfo() {
  const [a, vb] = await Promise.all([base.getAccountInfo(reservePda()), base.getTokenAccountBalance(VAULT)]);
  if (!a) return null;
  const rs = { ...decodeReserve(a.data), vault: Number(vb.value.amount) };
  const v = reserveView(rs, rs.vault);
  let me = null;
  if (climber) {
    const l = await climber.lender().catch(() => null);
    if (l) me = { shares: l.shares / ONE_USDC, value: valueOf(l.shares, Math.max(0, rs.vault - rs.staked), rs.shares) / ONE_USDC, deposited: l.deposited / ONE_USDC, withdrawn: l.withdrawn / ONE_USDC, rawShares: l.shares };
  }
  return { ...v, me };
}
/// Lend `amount` tUSDC to the reserve.
export async function deposit(amount) {
  if (!climber) await connect();
  if (!(amount >= 1 && amount <= bal)) throw new Error('Not enough test tokens');
  try { await ensureReady(); const sig = await climber.deposit(amount); await refreshBalance(); return sig; } catch (e) { throw fail(e); }
}
/// Withdraw about `amount` tUSDC (as shares at the share price); `all` redeems every share.
export async function withdraw(amount, all = false) {
  if (!climber) await connect();
  try {
    await ensureReady();
    const [rs, l] = await Promise.all([climber.reserve(), climber.lender()]);
    if (!l || !l.shares) throw new Error('Nothing lent to the reserve yet');
    const assets = Math.max(0, rs.vault - rs.staked);
    const shares = all ? l.shares : Math.min(l.shares, Math.floor((Math.round(amount * ONE_USDC) * rs.shares) / assets));
    if (!(shares > 0)) throw new Error('Pick an amount to withdraw');
    const sig = await climber.withdrawShares(shares);
    await refreshBalance();
    return sig;
  } catch (e) { throw fail(e); }
}

// ───────────────────────────────────────────────────────── leaderboards
let boardCache = { at: 0, list: [] };
async function profiles() {
  if (Date.now() - boardCache.at < 10000) return boardCache.list;
  const accs = await base.getProgramAccounts(PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: bs58(discriminator('Profile')) } }] });
  boardCache = { at: Date.now(), list: accs.map((a) => decodeProfile(a.account.data)) };
  return boardCache.list;
}
export async function leaderboard(scope = 'today') {
  try {
    const today = Math.floor(Date.now() / 86400000);
    const me = account();
    return (await profiles())
      .filter((p) => p.runs > 0 && (scope === 'all' || p.day === today))
      .map((p) => ({ name: p.name, pnlPct: (scope === 'all' ? p.bestBps : p.dayBestBps) / 100, you: p.authority.toBase58() === me, runs: p.runs, wins: p.wins }))
      .sort((a, b) => b.pnlPct - a.pnlPct)
      .slice(0, 12);
  } catch (e) { log('board', e.message); return []; }
}
function bs58(bytes) {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ''; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
  return s;
}

// ──────────────────────────────────────────── leverage packs (MagicBlock VRF)
/// The pack waiting in the profile, if any: { tier, maxLeverage }.
export function pack() {
  if (!profile || profile.packState !== PACK.READY) return null;
  const p = PACKS[profile.packTier];
  return { tier: p.tier, maxLeverage: p.maxLeverage };
}
export const nextPackAt = () => (profile && profile.packTs ? (profile.packTs + 600) * 1000 : 0);
export async function openPack() {
  if (!climber) await connect();
  try {
    await ensureReady();
    await ensureFuel();
    const sig = await climber.openPack();
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const p = await climber.profile();
      if (p.packState === PACK.READY) {
        profile = p;
        const t = PACKS[p.packTier];
        return { tier: t.tier, maxLeverage: t.maxLeverage, proof: sig, url: EXPLORER('tx', sig) };
      }
    }
    throw new Error('The VRF draw is taking long, check again in a minute');
  } catch (e) { throw fail(e); }
}

/// A link to the climb that just ended whose preview is its result card: the server reads the settled run
/// from Solana and signs it (POST /api/share). Waits for the settlement; null when that does not come.
export async function shareCard() {
  if (!wallet) return null;
  const player = wallet.publicKey.toBase58();
  for (let i = 0; i < 40; i++) {                       // the settlement lands a few seconds after the result
    await sleep(i ? 1500 : 800);
    try {
      const r = await fetch('/api/share', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ player }) });
      if (r.status === 200) return (await r.json()).url;
      if (r.status !== 202) return null;
    } catch { return null; }
  }
  return null;
}

// test hook (not part of the contract)
export const _debug = { bust() {}, runs, climber: () => climber };
