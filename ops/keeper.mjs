// Optional ops keeper. Nothing here is required: every instruction it sends
// is permissionless and the front sends the same ones itself (autopilot). It
// makes the game feel alive with nobody else online:
//
//   relay      pushes GBP/USD into the relay account every 700 ms
//   rounds     opens every round (VRF market draw) so the lobby always has
//              one, delegates, starts, finishes, settles and records them
//   players    two to four house players join a round nobody else joined
//              late in its window, and play their seat on the rollup
//   sweeper    finishes and settles climbs left on the rollup by closed tabs
//
//   node ops/keeper.mjs            (keys in ~/.config/siroclimb/)
import { Keypair, SystemProgram } from '@solana/web3.js';
import { Climber, readPrice } from '../js/chain/climber.js';
import { MARKETS, MAX_PRICE_AGE, PROGRAM_ID, ROUND, ROUND_CYCLE, RUN, RUN_SECONDS } from '../js/chain/config.js';
import { decodeRun, discriminator } from '../js/chain/codec.js';
import { pushOnce } from '../js/chain/relay.js';
import { inSession } from '../js/chain/hours.js';
import { send, sleep } from '../js/chain/tx.js';
import { friendlyError } from '../js/chain/errors.js';
import { uniqueHandles } from '../js/chain/handles.js';
import { adminKeypair, baseConnection, erConnection, namedKeypair, short } from './lib/env.mjs';

const base = baseConnection(), er = erConnection(), admin = adminKeypair();
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const keeperKey = namedKeypair('keeper');
const keeper = new Climber({ base, er, wallet: keeperKey });
const houseKeys = [0, 1, 2, 3].map((i) => namedKeypair(`house-${i}`));
const houseNames = uniqueHandles(houseKeys.map((k) => 'house' + k.publicKey.toBase58()));
const house = houseKeys.map((k) => new Climber({ base, er, wallet: k }));

async function fund(k, min = 0.02e9, amount = 0.04e9) {
  if ((await base.getBalance(k.publicKey)) >= min) return;
  await send(base, [SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: k.publicKey, lamports: amount })], [admin], { label: 'fund' });
}
await fund(keeperKey, 0.05e9, 0.1e9);
for (const [i, c] of house.entries()) {
  await fund(houseKeys[i]);
  if (!(await c.profile())) await send(base, [(await import('../js/chain/ix.js')).createAtaIdempotent(c.me, c.me), (await import('../js/chain/ix.js')).ix.faucet(c.me), (await import('../js/chain/ix.js')).ix.initProfile(c.me, houseNames[i])], [houseKeys[i]], { label: 'house player' });
}
say('keeper', short(keeperKey.publicKey), 'house players', houseNames.join(', '));

// relay
const relayer = namedKeypair('relayer');
(async () => { for (;;) { await pushOnce(er, relayer, { minGapS: 0 }).catch(() => {}); await sleep(700); } })();

const openMask = async () => {
  let m = 0;
  for (let i = 0; i < MARKETS.length; i++) { const p = await readPrice(er, i).catch(() => null); if (p && Date.now() / 1000 - p.ts <= MAX_PRICE_AGE && inSession(MARKETS[i].hours)) m |= 1 << i; }
  return m;
};
const busy = new Set();
const once = (k, fn) => { if (busy.has(k)) return; busy.add(k); fn().catch((e) => say(k, friendlyError(e))).finally(() => setTimeout(() => busy.delete(k), 2000)); };

async function playHouse(c, id, asset) {
  const target = 1 + Math.random() * 6, stop = -3 - Math.random() * 10, until = 8 + Math.random() * 50;
  for (;;) {
    await sleep(500);
    const r = await keeper.round(id).catch(() => null);
    if (!r || r.status !== ROUND.LIVE) { if (r && r.status >= ROUND.FINISHED) return; continue; }
    const e = r.entries.find((x) => x.player.equals(c.me)); if (!e || e.status !== RUN.LIVE) return;
    const pnl = (e.value / r.entry - 1) * 100, t = Date.now() / 1000 - r.liveTs;
    if (pnl >= target || pnl <= stop || t >= until) { await c.cashOutRound(id, asset).catch(() => {}); return; }
  }
}

async function rounds() {
  const now = Date.now() / 1000, cur = Math.floor(now / ROUND_CYCLE);
  // what every slot holds (a round left on the rollup by a closed tab included)
  const held = new Map();
  for (let slot = 0; slot < 4; slot++) { const r = await keeper.round(slot).catch(() => null); if (r && r.status !== ROUND.FREE) held.set(r.id, r); }
  for (const id of new Set([...held.keys(), cur, cur + 1])) {
    const r = held.get(id) || null;
    if (!r && [...held.values()].some((x) => x.slot === id % 4 && !(x.status === ROUND.SETTLED || ((x.status === ROUND.OPEN || x.status === ROUND.DRAWING) && x.players === 0 && now > x.startsAt)))) continue;
    const opens = id * ROUND_CYCLE, starts = opens + 20;
    if (!r) {
      if (now >= opens - 25 && now < starts - 5) once(`open ${id}`, async () => { const m = await openMask(); if (m) { await keeper.openRound(id, m); say('opened round', id); } });
      continue;
    }
    if (r.status === ROUND.DRAWING && now > r.settledTs + 7 && now < starts - 4) once(`redraw ${id}`, async () => keeper.openRound(id, await openMask()));
    if (r.status === ROUND.OPEN && r.layer === 'base' && now >= starts - 10 && now < starts - 3 && r.players < 2) {
      // a round with nobody (or one player) gets company
      const want = 2 + Math.floor(Math.random() * 3);
      house.slice(0, want).forEach((c, i) => {
        if (r.entries.some((e) => e.player.equals(c.me))) return;
        once(`house ${id} ${i}`, async () => {
          if ((await c.usdc()) < 20) await c.faucet().catch(() => {});
          await c.joinRound(id, Math.random() > 0.5 ? 'long' : 'short');
          playHouse(c, id, r.asset);
        });
      });
    }
    if (r.status === ROUND.OPEN && r.players > 0 && now >= starts) {
      if (r.layer === 'base') once(`delegate ${id}`, () => keeper.delegateRound(id));
      else once(`live ${id}`, () => keeper.goLive(id, r.asset));
    }
    if (r.layer === 'er' && (r.status === ROUND.FINISHED || (r.status === ROUND.LIVE && now > r.liveTs + RUN_SECONDS + 2))) once(`finish ${id}`, () => keeper.finishRound(id, r.asset));
    if (r.layer === 'base' && r.status === ROUND.FINISHED) once(`settle ${id}`, async () => { await keeper.settleRound(id); say('settled round', id, r.players, 'players'); });
    if (r.layer === 'base' && r.status === ROUND.SETTLED && r.players && (r.recorded & (2 ** r.players - 1)) !== 2 ** r.players - 1) once(`record ${id}`, () => keeper.recordRound(id));
    if (r.layer === 'base' && (r.status === ROUND.OPEN || r.status === ROUND.DRAWING) && r.players === 0 && now >= starts + 2) once(`close ${id}`, () => keeper.settleRound(id));
  }
}

// climbs left on the rollup (the player closed the tab): finish them, then settle on Solana
const bs58 = (b) => { const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n = 0n; for (const x of b) n = n * 256n + BigInt(x); let s = ''; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } return s; };
async function sweep() {
  const accs = await er.getProgramAccounts(PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: bs58(discriminator('Run')) } }] });
  const now = Date.now() / 1000;
  for (const a of accs) {
    const r = decodeRun(a.account.data);
    const over = r.status === RUN.BUSTED || r.status === RUN.EXPIRED || (r.status === RUN.LIVE && now > r.startTs + RUN_SECONDS + 6) || (r.status === RUN.STAKED && now > r.createdTs + 35);
    if (!over) continue;
    once(`sweep ${a.pubkey.toBase58()}`, async () => {
      await keeper.finishRun(r.player, r.asset);
      await keeper.settleRun(r.player);
      say('swept climb of', short(r.player));
    });
  }
  // back on Solana but never settled
  const onBase = await base.getProgramAccounts(PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: bs58(discriminator('Run')) } }] });
  for (const a of onBase) {
    const r = decodeRun(a.account.data);
    if (r.status === RUN.CASHED || r.status === RUN.BUSTED || r.status === RUN.EXPIRED) once(`settle ${a.pubkey.toBase58()}`, async () => { await keeper.settleRun(r.player); say('settled climb of', short(r.player)); });
  }
}

let n = 0;
for (;;) {
  await rounds().catch((e) => say('rounds', e.message));
  if (n++ % 10 === 0) await sweep().catch((e) => say('sweep', e.message));
  await sleep(1000);
}
