// Siroclimb on chain: the front's contract (see js/api.js) served by the
// siroclimb program on Solana devnet and a MagicBlock Ephemeral Rollup.
//
//   prices     MagicBlock's Pyth Lazer feed accounts read from the rollup every
//              250 ms.
//   wallet     Phantom / Solflare / Backpack, or a built-in devnet burner. One
//              approval creates the profile, tops up test USDC, authorises a
//              MagicBlock session key and lets it stake: every later action
//              (start, cash out, join, packs, settle) is signed by that key.
//   climbs     stake + delegate on Solana, begin / ticks (crank) / cash out on
//              the rollup, commit + undelegate, settle on Solana.
//   rounds     opened, delegated, started, finished and settled by whichever
//              browser is around (autopilot): every step is permissionless.
//              Practice bots run in this browser when a round is too empty.
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import {
  BASE_RPC, BOOST, ER_EXPLORER, ER_RPC, EXPLORER, LADDER, MARKETS, MAX_PRICE_AGE, ONE_USDC, PACKS, PRIZE_SPLIT, PROGRAM_ID,
  ROUND, ROUND_CYCLE, ROUND_ENTRY, ROUND_JOIN_SECONDS, RUN, RUN_SECONDS, STEP_SECONDS, NONE, PACK, marketIndex,
} from './chain/config.js';
import { Climber, SESSION_TOP_UP } from './chain/climber.js';
import { decodePrice, decodeProfile, decodeRound, decodeRun, discriminator } from './chain/codec.js';
import { createAtaIdempotent, ix } from './chain/ix.js';
import { profilePda, roundPda, roundSlotPda, runPda } from './chain/pdas.js';
import { send, sleep } from './chain/tx.js';
import { friendlyError } from './chain/errors.js';
import { handleFor, uniqueHandles } from './chain/handles.js';
import { inSession, nextOpen } from './chain/hours.js';
import { recentPrices } from './chain/history.js';
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

export const rules = { ladder: LADDER, stepEvery: STEP_SECONDS, duration: RUN_SECONDS, roundEntry: ROUND_ENTRY, prizeSplit: PRIZE_SPLIT };
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
  // a pack climb is played with the house's money: the player only ever gains
  const pnl = R.pub.pack ? Math.max(0, value - stake) : value - stake;
  return {
    status: st, value: R.pub.pack ? stake + pnl : value, pnl, pnlPct: (value / stake - 1) * 100, maxLeverage: LADDER[c.maxStep || 0], pack: !!R.pub.pack,
    duration: Math.max(0, Math.min(RUN_SECONDS, end - c.startTs)), entryPrice: toUsd(a, c.entryPrice), exitPrice: toUsd(a, c.lastPrice || c.entryPrice),
  };
}
function updateOf(R, now = Date.now()) {
  const c = R.chain, a = R.asset, f = feeds[a], stake = R.pub.stake;
  const t = Math.max(0, Math.min(RUN_SECONDS, now / 1000 - c.startTs));
  const step = stepAt(t, R.top);
  let value = c.value / ONE_USDC, price = toUsd(a, c.lastPrice || c.entryPrice);
  if (c.status === RUN.LIVE && isOpen(f) && c.lastPrice) { value = moved(value, LADDER[step], c.side, BOOST[a], c.lastPrice, f.raw); price = f.price; }
  return {
    t, price, step, leverage: LADDER[step], value, pnl: value - stake, pnlPct: (value / stake - 1) * 100,
    risk: Math.min(1, Math.max(0, 1 - value / stake)), status: STATUS[c.status] || 'live',
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
  if (mode === 'round') throw new Error('use joinRound for rounds');
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
    if (R.mode === 'round') {
      addProof(id, 'Cash out on the rollup', await climber.cashOutRound(R.roundId, R.asset), 'er');
    } else {
      addProof(id, 'Cash out on the rollup (commit + undelegate)', await climber.cashOut(R.asset), 'er');
    }
  } catch (e) {
    if (!R.result) throw fail(e);
  }
  return whenEnded(id);
}

// ────────────────────────────────────────────────────────────── rounds
// Round n opens at n * 80 s, takes joins for 20 s, runs 60 s. The round
// account lives in slot n % 4; the autopilot below moves it along.
const CYC = ROUND_CYCLE * 1000;
const roundIdAt = (ms) => Math.floor(ms / CYC);
const chainRounds = new Map(); // id -> decoded round + layer
let lastSettled = null;
async function readRound(id) {
  const key = roundPda(id);
  const b = await base.getAccountInfo(key);
  if (!b) return null;
  let r;
  if (b.owner.toBase58() === DELEGATION) {
    const e = await er.getAccountInfo(key);
    if (!e) return null;
    r = { ...decodeRound(e.data), layer: 'er' };
  } else r = { ...decodeRound(b.data), layer: 'base' };
  return r.id === id ? r : null;
}
/// Every slot, not just the current round's: a round left on the rollup by a
/// closed tab (or a crash) still holds its slot until someone moves it along.
async function readSlots() {
  const keys = [0, 1, 2, 3].map(roundSlotPda);
  const b = await base.getMultipleAccountsInfo(keys);
  const delegated = keys.filter((k, i) => b[i] && b[i].owner.toBase58() === DELEGATION);
  const e = delegated.length ? await er.getMultipleAccountsInfo(delegated) : [];
  const out = [];
  b.forEach((a, i) => {
    if (!a) return;
    if (a.owner.toBase58() === DELEGATION) {
      const j = delegated.findIndex((k) => k.equals(keys[i]));
      if (e[j]) out.push({ ...decodeRound(e[j].data), layer: 'er' });
    } else out.push({ ...decodeRound(a.data), layer: 'base' });
  });
  return out;
}
async function pollRounds() {
  const now = Date.now(), cur = roundIdAt(now);
  try {
    const all = await readSlots();
    chainRounds.clear();
    for (const r of all) {
      if (r.status === ROUND.FREE) continue;
      chainRounds.set(r.id, r);
      if (r.status === ROUND.SETTLED && (!lastSettled || lastSettled.id < r.id)) lastSettled = r;
    }
  } catch (e) { log('round', e.message); }
  roundTick(now);
  autopilot(now).catch((e) => log('autopilot', e.message));
}
setInterval(pollRounds, 1000);

const roundSubs = new Set();
let lastAsset = MARKETS[0].id;
function myIndex(r) { return climber && r ? r.entries.findIndex((e) => e.player.equals(climber.me)) : -1; }
/// The round the lobby shows: the current one, or the one I am still playing.
function shownRoundId(now = Date.now()) {
  const cur = roundIdAt(now), prev = chainRounds.get(cur - 1);
  if (prev && myIndex(prev) >= 0 && prev.status !== ROUND.SETTLED && now < (prev.endsAt + 8) * 1000) return cur - 1;
  return cur;
}
function publicRound(id = shownRoundId()) {
  const r = chainRounds.get(id);
  const opensAt = id * CYC, startsAt = opensAt + ROUND_JOIN_SECONDS * 1000, endsAt = startsAt + RUN_SECONDS * 1000, now = Date.now();
  // the VRF draw is pending (or about to be asked); a round nobody opened is not "drawing"
  const unopened = !r && now >= startsAt - 4000;
  const drawing = !unopened && (!r || r.status === ROUND.DRAWING || r.asset === NONE);
  if (r && r.asset !== NONE) lastAsset = MARKETS[r.asset].id;
  const mine = myIndex(r);
  const joinable = r && r.status === ROUND.OPEN && r.layer === 'base' && now < startsAt - 1500;
  return {
    id, assetId: drawing || !r ? lastAsset : MARKETS[r.asset].id, drawing, opensAt, startsAt, endsAt,
    status: now < startsAt ? 'open' : 'live', players: r ? r.players : 0, pot: r ? r.pot / ONE_USDC : 0, entry: ROUND_ENTRY,
    joined: mine >= 0, late: mine < 0 && now >= startsAt - 1500, joinable: !!joinable || (!r && now < startsAt - 4000),
    runId: mine >= 0 ? `round:${id}` : null, chainStatus: r ? r.status : null, unopened,
    marketsOpen: openMask() !== 0,
  };
}
let lastSecond = 0;
function roundTick(now) {
  const s = Math.floor(now / 1000);
  if (s === lastSecond) return;
  lastSecond = s;
  const pr = publicRound();
  if (pr.runId) ensureRoundRun(pr.id);
  roundSubs.forEach((cb) => cb(pr));
}
export const currentRound = () => publicRound();
export function onRound(cb) { roundSubs.add(cb); cb(publicRound()); return () => roundSubs.delete(cb); }

function standingsOf(r, now = Date.now()) {
  if (!r) return [];
  const f = feeds[r.asset];
  const t = r.liveTs ? Math.max(0, Math.min(RUN_SECONDS, now / 1000 - r.liveTs)) : 0;
  const step = stepAt(t, LADDER.length - 1);
  const rows = r.entries.map((e) => {
    let v = e.value / ONE_USDC;
    if (r.status === ROUND.LIVE && e.status === RUN.LIVE && isOpen(f)) v = moved(v, LADDER[step], e.side, BOOST[r.asset], r.lastPrice, f.raw);
    return { name: e.name, pnlPct: (v / (r.entry / ONE_USDC) - 1) * 100, value: v, status: STATUS[e.status] || 'live', you: !!climber && e.player.equals(climber.me), index: e.index };
  });
  rows.sort((a, b) => b.value - a.value || a.index - b.index);
  return rows.map((x, i) => ({ ...x, rank: i + 1 }));
}
export const roundStandings = () => standingsOf(chainRounds.get(shownRoundId()));

export async function joinRound({ side = 'long' }) {
  if (!climber) await connect();
  const pr = publicRound(roundIdAt(Date.now()));
  if (pr.joined) return pr;
  if (Date.now() >= pr.startsAt - 1500) throw new Error('This round has started, join the next one');
  if (bal < ROUND_ENTRY) throw new Error('Not enough test tokens');
  try {
    await ensureReady();
    await ensureFuel();
    const id = pr.id;
    let r = await readRound(id);
    if (!r) { await openRoundNow(id); }
    for (let i = 0; i < 40; i++) { r = await readRound(id); if (r && r.status === ROUND.OPEN) break; if (i % 12 === 11) await openRoundNow(id).catch(() => {}); await sleep(400); }
    if (!r || r.status !== ROUND.OPEN) throw new Error('The market draw is late, try the next round');
    const sig = await climber.joinRound(id, side);
    addProof(`round:${id}`, 'Join the round on Solana', sig, 'base');
    setBal(bal - ROUND_ENTRY);
    chainRounds.set(id, await readRound(id));
    ensureRoundRun(id);
    practice.maybeJoin(id);
    return publicRound(id);
  } catch (e) { throw fail(e); }
}

function ensureRoundRun(id) {
  const rid = `round:${id}`;
  if (runs.has(rid)) return runs.get(rid);
  const r = chainRounds.get(id); if (!r) return null;
  const i = myIndex(r); if (i < 0) return null;
  const e = r.entries[i];
  const R = { id: rid, mode: 'round', roundId: id, asset: r.asset, top: LADDER.length - 1, subs: new Set(), done: [], finals: [], result: null, final: null };
  R.chain = { status: RUN.LIVE, value: e.value, side: e.side, stake: r.entry, startTs: r.liveTs || r.startsAt, entryPrice: r.entryPrice, lastPrice: r.lastPrice, maxStep: 0, endTs: 0 };
  R.pub = pubRun(rid, 'round', { ...R.chain, asset: r.asset, top: R.top });
  runs.set(rid, R);
  watchRound(R);
  return R;
}
async function watchRound(R) {
  const id = R.roundId;
  while (!R.final) {
    await sleep(R.result ? 1000 : 250);
    let r;
    try { r = await readRound(id); } catch { continue; }
    if (!r) continue;
    chainRounds.set(id, r);
    const i = myIndex(r); if (i < 0) continue;
    const e = r.entries[i];
    const live = r.status === ROUND.LIVE || r.status === ROUND.FINISHED || r.status === ROUND.SETTLED;
    R.chain = { status: live ? e.status : RUN.LIVE, value: e.value, side: e.side, stake: r.entry, startTs: r.liveTs || r.startsAt, entryPrice: r.entryPrice, lastPrice: r.lastPrice, maxStep: e.maxStep, endTs: e.endTs };
    if (r.liveTs) { R.pub.startedAt = r.liveTs * 1000; R.pub.entryPrice = toUsd(r.asset, r.entryPrice); }
    if (!R.result && live && e.status !== RUN.LIVE && e.status !== RUN.STAKED) {
      R.result = resultOf(R); R.result.duration = Math.max(0, Math.min(RUN_SECONDS, (e.endTs || r.endsAt) - (r.liveTs || r.startsAt)));
      R.done.forEach((f) => f(R.result));
    }
    if (r.status === ROUND.SETTLED && R.result) {
      const st = standingsOf(r), me = st.find((s) => s.you);
      const k = r.winners.findIndex((w) => w === i);
      R.final = { ...R.result, rank: me ? me.rank : r.players, of: r.players, prize: k >= 0 ? r.prizes[k] / ONE_USDC : 0, final: true };
      R.finals.forEach((f) => f(R.final));
      refreshBalance();
      profile = await climber.profile().catch(() => profile);
    }
  }
}
export function whenRoundFinal(runId) {
  const R = runs.get(runId);
  return R.final ? Promise.resolve(R.final) : new Promise((res) => R.finals.push(res));
}

// Autopilot: every step of a round is permissionless, so any connected
// browser moves it along (with a little jitter so a crowd does not collide).
const inflight = new Set();
async function step(key, fn) {
  if (inflight.has(key)) return;
  inflight.add(key);
  try { await fn(); } catch (e) { log(key, friendlyError(e)); } finally { setTimeout(() => inflight.delete(key), 1500); }
}
const openMask = () => feeds.reduce((m, f, i) => (isOpen(f) ? m | (1 << i) : m), 0);
async function openRoundNow(id) {
  const mask = openMask();
  if (!mask) throw new Error('Every market is closed right now');
  return climber.openRound(id, mask);
}
const jitter = () => sleep(Math.random() * 1200);
/// What the program accepts to reuse a slot (open_round): settled, or empty and past its bell.
const slotReusable = (x, t) => x.status === ROUND.SETTLED || ((x.status === ROUND.OPEN || x.status === ROUND.DRAWING) && x.players === 0 && t > x.startsAt);
async function autopilot(now) {
  if (!climber || !climber.hasSession || sol < 0.002) return;
  const cur = roundIdAt(now), t = now / 1000;
  for (const id of new Set([...chainRounds.keys(), cur])) {
    const r = chainRounds.get(id);
    const startsAt = id * ROUND_CYCLE + ROUND_JOIN_SECONDS;
    if (!r) {
      // open the current round once its slot is free (only if someone is around to play: me)
      const holder = [...chainRounds.values()].find((x) => x.slot === id % 4 && x.id !== id && !slotReusable(x, t));
      if (id === cur && !holder && t < startsAt - 4 && wantsRound()) step(`open:${id}`, async () => { await jitter(); if (!(await readRound(id))) await openRoundNow(id); });
      continue;
    }
    if (r.status === ROUND.DRAWING && t > r.settledTs + 7 && t < startsAt - 4) step(`redraw:${id}`, () => openRoundNow(id));
    if (r.status === ROUND.OPEN && r.players > 0 && t >= startsAt) {
      if (r.layer === 'base') step(`delegate:${id}`, async () => { await jitter(); const x = await readRound(id); if (x && x.layer === 'base' && x.status === ROUND.OPEN) await climber.delegateRound(id); });
      else step(`live:${id}`, () => climber.goLive(id, r.asset));
    }
    if (r.layer === 'er' && (r.status === ROUND.FINISHED || (r.status === ROUND.LIVE && t >= r.liveTs + RUN_SECONDS + 2))) step(`finish:${id}`, () => climber.finishRound(id, r.asset));
    if (r.layer === 'base' && r.status === ROUND.FINISHED) step(`settle:${id}`, async () => { await jitter(); await climber.settleRound(id); });
    if (r.layer === 'base' && r.status === ROUND.SETTLED) {
      const all = r.players ? (2 ** r.players - 1) : 0;
      if ((r.recorded & all) !== all) step(`record:${id}`, async () => { await jitter(); await climber.recordRound(id); });
    }
  }
}
let roundInterest = 0;
/// Rounds are opened by players who look at them (the Round tab), not by every open page.
export function watchRounds(on = true) { roundInterest = on ? Date.now() : 0; }
const wantsRound = () => roundInterest && Date.now() - roundInterest < 120000;

// ────────────────────────────────────────────── practice bots (in browser)
// When a round is nearly empty, up to three practice players join from this
// browser: real keypairs with their own profile and test USDC, funded once
// from the session key, that play their seat for real on the rollup.
const practice = (() => {
  const KEY = 'siroclimb:practice';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]').map((s) => Keypair.fromSecretKey(Uint8Array.from(s))); } catch { return []; } };
  let bots = null;
  const all = () => {
    if (!bots) {
      bots = load();
      while (bots.length < 3) bots.push(Keypair.generate());
      localStorage.setItem(KEY, JSON.stringify(bots.map((k) => Array.from(k.secretKey))));
    }
    return bots;
  };
  const names = () => uniqueHandles(all().map((k) => k.publicKey.toBase58()));
  async function readyBot(kp, name) {
    const c = new Climber({ base, er, wallet: kp, log });
    const need = [];
    const lamports = await base.getBalance(kp.publicKey);
    if (lamports < 8_000_000) await send(base, [SystemProgram.transfer({ fromPubkey: climber.session.keypair.publicKey, toPubkey: kp.publicKey, lamports: 12_000_000 })], [climber.session.keypair], { label: 'fund practice player' });
    if (!(await base.getAccountInfo(profilePda(kp.publicKey)))) need.push(ix.initProfile(kp.publicKey, name));
    if ((await c.usdc()) < ROUND_ENTRY) { need.unshift(createAtaIdempotent(kp.publicKey, kp.publicKey)); need.push(ix.faucet(kp.publicKey)); }
    if (need.length) await send(base, need, [kp], { label: 'practice player' });
    return c;
  }
  // cash out at a profit target, a stop or a time; some ride to the bell
  function strategy() { const target = 1 + Math.random() * 6, stop = -3 - Math.random() * 12, until = 10 + Math.random() * 48; return { target, stop, until }; }
  async function play(c, id, st) {
    for (;;) {
      await sleep(400);
      const r = chainRounds.get(id); if (!r) continue;
      if (r.status === ROUND.SETTLED || r.status === ROUND.FINISHED) return;
      if (r.status !== ROUND.LIVE) continue;
      const row = standingsOf(r).find((x) => r.entries[x.index].player.equals(c.me));
      if (!row || row.status !== 'live') return;
      const t = Date.now() / 1000 - r.liveTs;
      if (row.pnlPct >= st.target || row.pnlPct <= st.stop || t >= st.until) { await c.cashOutRound(id, r.asset).catch(() => {}); return; }
    }
  }
  async function maybeJoin(id) {
    if (store.get('practice', true) === false) return;
    const r = await readRound(id);
    if (!r || r.players >= 3) return;
    const list = all(), nm = names();
    for (let i = 0; i < list.length && i < 3 - r.players + 1; i++) {
      (async () => {
        try {
          await sleep(1500 + Math.random() * 6000);
          const x = await readRound(id);
          if (!x || x.status !== ROUND.OPEN || Date.now() / 1000 > x.startsAt - 3 || x.entries.some((e) => e.player.equals(list[i].publicKey))) return;
          const c = await readyBot(list[i], nm[i]);
          await c.joinRound(id, Math.random() > 0.5 ? 'long' : 'short');
          play(c, id, strategy());
        } catch (e) { log('practice', friendlyError(e)); }
      })();
    }
  }
  return { maybeJoin, names };
})();
export const practiceBots = (on) => store.set('practice', !!on);

// ───────────────────────────────────────────────────────── leaderboards
let boardCache = { at: 0, list: [] };
async function profiles() {
  if (Date.now() - boardCache.at < 10000) return boardCache.list;
  const accs = await base.getProgramAccounts(PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: bs58(discriminator('Profile')) } }] });
  boardCache = { at: Date.now(), list: accs.map((a) => decodeProfile(a.account.data)) };
  return boardCache.list;
}
export async function leaderboard(scope = 'today') {
  if (scope === 'round') {
    const r = lastSettled; if (!r) return [];
    return standingsOf(r).map((s, i) => ({ ...s, prize: r.winners.includes(s.index) ? r.prizes[r.winners.indexOf(s.index)] / ONE_USDC : 0 }));
  }
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

export async function shareCard() { return null; }

// test hook (not part of the contract)
export const _debug = { bust() {}, runs, chainRounds, climber: () => climber };
