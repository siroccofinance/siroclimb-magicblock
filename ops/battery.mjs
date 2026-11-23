// On-chain battery on devnet + the rollup with many concurrent players.
//
//   node ops/battery.mjs [players=24] [rounds=2] [soloWaves=2]
//
// Players are keypairs under ~/.config/siroclimb/battery/ with realistic
// handles, funded by the admin key, onboarded with a MagicBlock session key
// each (exactly like the front). Then:
//   solo waves   every player climbs at once on a random open market; cash
//                outs at random times, some ride to the bell; every climb is
//                checked from stake to settlement (balances, profile, state
//                committed back to Solana equal to the rollup's).
//   refusals     what must fail does, with the expected program error.
//   rounds       the whole field joins the same round (a full 24-seat round),
//                plays it on the rollup, and the pot split is checked.
//   packs        concurrent VRF pack draws, then the free climbs they give.
// Writes BATTERY.md; every bug it finds goes to FINDINGS.md.
import fs from 'fs';
import path from 'path';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { Climber, readPrice } from '../js/chain/climber.js';
import { MARKETS, MAX_PRICE_AGE, ONE_USDC, PACK, PACKS, PROGRAM_ID, RELAY_ASSET, ROUND, ROUND_CYCLE, RUN, LADDER } from '../js/chain/config.js';
import { decodeRun } from '../js/chain/codec.js';
import { ix } from '../js/chain/ix.js';
import { profilePda, runPda, roundPda } from '../js/chain/pdas.js';
import { pushOnce } from '../js/chain/relay.js';
import { inSession } from '../js/chain/hours.js';
import { errorCode, send, sleep } from '../js/chain/tx.js';
import { uniqueHandles } from '../js/chain/handles.js';
import { KEY_DIR, adminKeypair, baseConnection, erConnection, namedKeypair, short } from './lib/env.mjs';

const N = Number(process.argv[2] || 24);
const ROUNDS = Number(process.argv[3] || 2);
const WAVES = Number(process.argv[4] || 2);
const base = baseConnection(), er = erConnection(), admin = adminKeypair();
const T0 = Date.now();
const say = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// ------------------------------------------------------------- bookkeeping
const checks = [];
const lat = new Map();
function check(tag, name, ok, detail = '') {
  checks.push({ tag, name, ok: !!ok, detail });
  if (!ok) say(`FAIL [${tag}] ${name} ${detail}`);
}
async function timed(label, fn) {
  const t = Date.now();
  try { return await fn(); } finally { if (!lat.has(label)) lat.set(label, []); lat.get(label).push(Date.now() - t); }
}
/// `fn` must fail with program error `code` (number) or a name of the IDL.
async function refuse(tag, name, code, fn) {
  try { await fn(); check(tag, `${name} — refused`, false, 'it went through'); }
  catch (e) {
    const got = errorCode(e);
    check(tag, `${name} — refused with ${code}`, got === code, `got ${got} ${String(e.message).slice(0, 80)}`);
  }
}
const usdcOf = async (c) => Math.round((await c.usdc()) * ONE_USDC);

// ------------------------------------------------------------- price relay
let relayOn = true;
(async () => {
  const relayer = namedKeypair('relayer');
  while (relayOn) { await pushOnce(er, relayer, { minGapS: 0 }).catch(() => {}); await sleep(700); }
})();
async function openMarkets() {
  const now = Date.now() / 1000, out = [];
  for (let i = 0; i < MARKETS.length; i++) {
    const p = await readPrice(er, i).catch(() => null);
    if (p && now - p.ts <= MAX_PRICE_AGE && inSession(MARKETS[i].hours)) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------- players
fs.mkdirSync(path.join(KEY_DIR, 'battery'), { recursive: true });
const wallets = Array.from({ length: N + 1 }, (_, i) => namedKeypair(`battery/player-${String(i).padStart(2, '0')}`));
const names = uniqueHandles(wallets.map((w) => w.publicKey.toBase58()));
const sessFile = (w) => path.join(KEY_DIR, 'battery', `session-${w.publicKey.toBase58().slice(0, 8)}.json`);
function loadSess(w) {
  try { const s = JSON.parse(fs.readFileSync(sessFile(w), 'utf8')); if (s.validUntil < Date.now() / 1000 + 3600) return null; return { keypair: Keypair.fromSecretKey(Uint8Array.from(s.secret)), validUntil: s.validUntil }; } catch { return null; }
}
const saveSess = (w, s) => fs.writeFileSync(sessFile(w), JSON.stringify({ secret: Array.from(s.keypair.secretKey), validUntil: s.validUntil }), { mode: 0o600 });

async function fundAll() {
  const need = [];
  for (const w of wallets) if ((await base.getBalance(w.publicKey)) < 0.03e9) need.push(w);
  for (let i = 0; i < need.length; i += 8) {
    const batch = need.slice(i, i + 8);
    await timed('fund players (8 per tx)', () => send(base, batch.map((w) => SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: w.publicKey, lamports: 0.075e9 })), [admin], { label: 'fund' }));
  }
  return need.length;
}

const adminStart = await base.getBalance(admin.publicKey);
say(`battery: ${N} players (+1 spare), ${WAVES} solo waves, ${ROUNDS} rounds, program ${short(PROGRAM_ID)}`);
say('funded', await fundAll(), 'players');
const climbers = wallets.map((w) => new Climber({ base, er, wallet: w, session: loadSess(w) }));
await Promise.all(climbers.map(async (c, i) => {
  await sleep(i * 150);
  const p = await c.profile();
  if (c.hasSession && p) return;
  await timed('onboard (profile, faucet, session, allowance)', () => c.onboard({ name: names[i] }));
  saveSess(wallets[i], c.session);
  // A session's SOL goes to the delegation fee of each climb: keep it fueled.
}));
await Promise.all(climbers.map(async (c) => {
  if ((await base.getBalance(c.session.keypair.publicKey)) < 0.03e9) await c.topUpSession(0.04e9);
  if ((await c.usdc()) < 300) await c.faucet().catch(() => {});
}));
const field = climbers.slice(0, N), spare = climbers[N];
const F = (i) => field[i % field.length];
say('players ready:', names.slice(0, 8).join(', '), '…');

// ------------------------------------------------------------ solo climbs
async function soloClimb(c, i, wave, markets, opts = {}) {
  const tag = `${names[i]} solo ${wave}`;
  const asset = opts.asset ?? pick(markets), side = opts.side ?? pick(['long', 'short']), stake = opts.stake ?? pick([10, 25, 50, 100]);
  const plan = opts.plan ?? (Math.random() < 0.2 ? 'ride' : 'cash');
  const before = await usdcOf(c);
  const prof0 = await c.profile();
  await sleep(rnd(0, 1500));
  const a = c.actor;
  // stake + delegate on Solana
  await timed('stake + delegate (Solana)', () => send(base, [
    ix.startRun(a.publicKey, c.me, { asset, side: side === 'short' ? 1 : 0, stake: BigInt(stake * ONE_USDC), usePack: !!opts.pack }, c.token),
    ix.delegateRun(a.publicKey, c.me),
  ], [a], { label: 'start' }));
  await timed('delegation visible on the rollup', () => c.waitOnEr(runPda(c.me), (d) => decodeRun(d).status === RUN.STAKED));
  if (opts.refusals) {
    await refuse(tag, 'begin with another market\'s feed', 6012, () => send(er, [ix.beginRun(a.publicKey, c.me, (asset + 1) % MARKETS.length)], [a], { label: 'bad feed', attempts: 1 }));
    await refuse(tag, 'settle while the climb is on the rollup', 3007, () => send(base, [ix.settleRun(a.publicKey, c.me)], [a], { label: 'early settle', attempts: 1 }));
    await refuse(tag, 'a second climb while one is delegated', 3007, () => send(base, [ix.startRun(a.publicKey, c.me, { asset, side: 0, stake: 10n * BigInt(ONE_USDC) }, c.token)], [a], { label: 'second', attempts: 1 }));
  }
  await timed('begin + crank (rollup)', () => send(er, [ix.beginRun(a.publicKey, c.me, asset, true)], [a], { label: 'begin' }));
  let r = decodeRun((await er.getAccountInfo(runPda(c.me))).data);
  check(tag, 'live at the oracle price', r.status === RUN.LIVE && r.entryPrice > 0, `status ${r.status}`);
  if (opts.pack) check(tag, 'pack climb capped at its tier', r.top === PACKS[opts.packTier].top && r.mode === 2, `top ${r.top}`);
  if (opts.refusals) {
    const stranger = climbers[(i + 1) % climbers.length];
    await refuse(tag, 'cash out signed by another player', 6000, () => send(er, [ix.cashOut(stranger.actor.publicKey, c.me, asset)], [stranger.actor], { label: 'steal', attempts: 1 }));
    await refuse(tag, 'finish before the bell', 6011, () => send(er, [ix.finishRun(stranger.actor.publicKey, c.me, asset)], [stranger.actor], { label: 'early finish', attempts: 1 }));
  }
  await sleep(3000);
  r = decodeRun((await er.getAccountInfo(runPda(c.me))).data);
  check(tag, 'crank ticks on the rollup', r.ticks >= 3 || r.status !== RUN.LIVE, `${r.ticks} ticks in 3 s`);
  if (plan === 'cash') {
    await sleep(rnd(0, 20000));
    await timed('cash out + commit/undelegate (rollup)', () => c.cashOut(asset).catch((e) => { if (errorCode(e) !== 6011) throw e; }));
  } else {
    // ride to the bell; the crank expires it, anyone finishes it
    for (;;) { await sleep(1000); r = decodeRun((await er.getAccountInfo(runPda(c.me))).data); if (r.status !== RUN.LIVE) break; }
    check(tag, 'expired by the crank at 60 s', r.status === RUN.EXPIRED || r.status === RUN.BUSTED, `status ${r.status}, ${r.ticks} ticks`);
    check(tag, 'crank ticked ~2/s for the whole climb', r.status === RUN.BUSTED || r.ticks >= 100, `${r.ticks} ticks`);
    const other = climbers[(i + 3) % climbers.length];
    await timed('finish by a stranger (rollup)', () => other.finishRun(c.me, asset));
  }
  const erState = decodeRun((await er.getAccountInfo(runPda(c.me))).data);
  await timed('undelegation back on Solana', () => c.waitOnBase(runPda(c.me)));
  const baseState = decodeRun((await base.getAccountInfo(runPda(c.me))).data);
  check(tag, 'state committed to Solana equals the rollup', baseState.value === erState.value && baseState.status === erState.status && baseState.ticks === erState.ticks,
    `${baseState.value}/${erState.value}`);
  await timed('settle (Solana)', () => c.settleRun());
  const fin = decodeRun((await base.getAccountInfo(runPda(c.me))).data);
  const after = await usdcOf(c);
  const cost = opts.pack ? 0 : stake * ONE_USDC;
  const want = opts.pack ? Math.max(0, fin.value - fin.stake) : fin.value;
  check(tag, 'payout = position (pack: the gain only)', fin.payout === want && after - before === want - cost, `paid ${fin.payout / 1e6} delta ${(after - before) / 1e6}`);
  const prof1 = await c.profile();
  check(tag, 'profile records the climb', prof1.runs === prof0.runs + 1 && prof1.history[0].stake === fin.stake, `runs ${prof0.runs}->${prof1.runs}`);
  await refuse(tag, 'settle twice', 6011, () => send(base, [ix.settleRun(c.actor.publicKey, c.me)], [c.actor], { label: 'twice', attempts: 1 }));
  return { status: erState.status, pnl: (fin.value - fin.stake) / 1e6, maxStep: fin.maxStep, ticks: fin.ticks };
}

const results = [];
for (let w = 1; w <= WAVES; w++) {
  const markets = await openMarkets();
  if (!markets.length) { say('every market is closed: skipping solo waves'); break; }
  say(`solo wave ${w}: ${field.length} climbs at once on ${markets.map((m) => MARKETS[m].id).join(', ')}`);
  const out = await Promise.allSettled(field.map((c, i) => soloClimb(c, i, w, markets, { refusals: w === 1 && i < 3 })));
  out.forEach((o, i) => { if (o.status === 'fulfilled') results.push(o.value); else check(`${names[i]} solo ${w}`, 'climb completed', false, String(o.reason && o.reason.message).slice(0, 160)); });
  say(`wave ${w} done: ${out.filter((o) => o.status === 'fulfilled').length}/${field.length}`);
}

// ---------------------------------------------------------------- refusals
{
  const tag = 'refusals', c = field[0], d = field[1];
  await refuse(tag, 'stake above 100 tUSDC', 6009, () => send(base, [ix.startRun(c.actor.publicKey, c.me, { asset: 0, side: 0, stake: 500n * BigInt(ONE_USDC) }, c.token)], [c.actor], { label: 'big', attempts: 1 }));
  await refuse(tag, 'a session key acting for another wallet', 6000, () => send(base, [ix.startRun(c.actor.publicKey, d.me, { asset: 0, side: 0, stake: 10n * BigInt(ONE_USDC) }, c.token)], [c.actor], { label: 'impersonate', attempts: 1 }));
  await refuse(tag, 'a price pushed by a player', 6000, () => send(er, [ix.pushPrice(c.actor.publicKey, RELAY_ASSET, 130000n, BigInt(Math.floor(Date.now() / 1000)))], [c.actor], { label: 'push', attempts: 1 }));
  await refuse(tag, 'a pack climb without a pack', 6023, () => send(base, [ix.startRun(c.actor.publicKey, c.me, { asset: 0, side: 0, stake: 0n, usePack: true }, c.token)], [c.actor], { label: 'nopack', attempts: 1 }));
  await refuse(tag, 'faucet twice in a row', 6006, async () => { await c.faucet().catch(() => {}); await c.faucet(); });
}

// ------------------------------------------------------------------ rounds
let lastRoundId = 0;
async function playRound(k) {
  const markets = await openMarkets();
  if (!markets.length) { say('every market is closed: skipping rounds'); return; }
  const now = () => Date.now() / 1000;
  let id = Math.max(Math.floor(now() / ROUND_CYCLE) + 1, lastRoundId + 1);
  lastRoundId = id;
  const opens = id * ROUND_CYCLE, starts = opens + 20, tag = `round ${id}`;
  while (now() < opens - 25) await sleep(500);
  const mask = markets.reduce((m, i) => m | (1 << i), 0);
  await refuse(tag, 'open with no market', 6007, () => send(base, [ix.openRound(field[0].actor.publicKey, id, 0)], [field[0].actor], { label: 'nomask', attempts: 1 }));
  await timed('open round + VRF request (Solana)', () => field[0].openRound(id, mask));
  const tv = Date.now();
  let r;
  for (;;) { r = await field[0].round(id); if (r && r.status === ROUND.OPEN) break; if (Date.now() - tv > 20000) break; await sleep(250); }
  lat.set('round market VRF callback', [...(lat.get('round market VRF callback') || []), Date.now() - tv]);
  check(tag, 'VRF drew an open market', r && r.status === ROUND.OPEN && markets.includes(r.asset), r ? `asset ${r.asset}` : 'no callback');
  if (!r || r.status !== ROUND.OPEN) return;
  while (now() < opens) await sleep(200);
  const before = await Promise.all(field.map(usdcOf));
  const sides = field.map(() => pick(['long', 'short']));
  const joins = await Promise.allSettled(field.map(async (c, i) => { await sleep(rnd(0, 3000)); return timed('join (Solana)', () => c.joinRound(id, sides[i])); }));
  const joined = joins.filter((j) => j.status === 'fulfilled').length;
  check(tag, `all ${field.length} players seated at once`, joined === field.length, `${joined} seated; ${joins.filter((j) => j.status === 'rejected').map((j) => j.reason.message.slice(0, 60)).slice(0, 2).join(' | ')}`);
  if (field.length >= 24) await refuse(tag, 'a 25th seat', 6019, () => spare.joinRound(id, 'long'));
  await refuse(tag, 'the same player twice', 6020, () => F(2).joinRound(id, 'long'));
  await refuse(tag, 'delegate before the bell', 6015, () => send(base, [ix.delegateRound(F(1).actor.publicKey, id)], [F(1).actor], { label: 'early', attempts: 1 }));
  r = await field[0].round(id);
  check(tag, 'pot = entries', r.pot === r.players * 10 * ONE_USDC, `${r.players} players pot ${r.pot / 1e6}`);
  while (now() < starts) await sleep(200);
  // the devnet clock runs a second or two behind the wall clock: wait for it
  for (;;) { const t = await base.getBlockTime(await base.getSlot()).catch(() => 0); if (t >= starts) break; await sleep(400); }
  await refuse(tag, 'join after the bell', 6016, () => spare.joinRound(id, 'long'));
  await timed('delegate round (Solana)', () => F(3).delegateRound(id));
  await timed('go live + crank (rollup)', () => F(4).goLive(id, r.asset));
  r = await field[0].round(id);
  check(tag, 'every seat live at the same entry', r.status === ROUND.LIVE && r.entryPrice > 0 && r.entries.every((e) => e.status === RUN.LIVE), `status ${r.status}`);
  // cash outs at random moments; a third ride to the bell
  await Promise.allSettled(field.map(async (c, i) => {
    if (Math.random() < 0.33) return;
    await sleep(rnd(2000, 50000));
    await timed('round cash out (rollup)', () => c.cashOutRound(id, r.asset)).catch(() => {});
  }));
  await refuse(tag, 'cash out by a stranger', 6021, () => send(er, [ix.cashOutRound(spare.actor.publicKey, id, r.asset)], [spare.actor], { label: 'stranger', attempts: 1 }));
  for (;;) { r = await field[0].round(id); if (r.status !== ROUND.LIVE) break; await sleep(1000); }
  check(tag, 'ended by the crank at the bell', r.status === ROUND.FINISHED, `status ${r.status}, ${r.ticks} ticks`);
  const vals = r.entries.map((e) => e.value);
  const order = vals.map((v, i) => i).sort((a, b) => vals[b] - vals[a] || a - b);
  check(tag, 'podium = best three positions', JSON.stringify(r.winners.slice(0, Math.min(3, r.players))) === JSON.stringify(order.slice(0, 3)), `${r.winners} vs ${order.slice(0, 3)}`);
  check(tag, 'prizes 50/30/20 sum to the pot', r.prizes.reduce((a, b) => a + b, 0) === r.pot, r.prizes.map((p) => p / 1e6).join('/'));
  await timed('finish round + commit/undelegate (rollup)', () => F(5).finishRound(id, r.asset));
  await timed('round back on Solana', () => F(5).waitOnBase(roundPda(id)));
  await timed('settle round (Solana)', () => F(6).settleRound(id));
  await timed('record profiles (10 per tx)', () => F(7).recordRound(id));
  r = await field[0].round(id);
  check(tag, 'settled and every profile recorded', r.status === ROUND.SETTLED && r.recorded === 2 ** r.players - 1, `recorded ${r.recorded.toString(2)}`);
  const after = await Promise.all(field.map(usdcOf));
  let ok = 0;
  field.forEach((c, i) => {
    const j = r.entries.findIndex((e) => e.player.equals(c.me)); if (j < 0) return;
    const k2 = r.winners.indexOf(j), prize = k2 >= 0 ? r.prizes[k2] : 0;
    if (after[i] - before[i] === prize - 10 * ONE_USDC) ok++;
  });
  check(tag, 'every balance moved by prize minus entry', ok === r.players, `${ok}/${r.players}`);
  say(`round ${id} on ${MARKETS[r.asset].id}: ${r.players} players, ${r.ticks} ticks, podium ${r.winners.map((w) => r.entries[w].name).join(' / ')}`);
  return r;
}
for (let k = 0; k < ROUNDS; k++) await playRound(k).catch((e) => check('round', 'round completed', false, e.message.slice(0, 200)));

// ------------------------------------------------------------------- packs
{
  const markets = await openMarkets();
  const openers = field.slice(0, 6);
  const draws = await Promise.allSettled(openers.map(async (c, i) => {
    const p0 = await c.profile();
    if (p0.packState === PACK.READY) return p0.packTier;
    if (p0.packTs && Date.now() / 1000 - p0.packTs < 600) return null;
    await timed('open pack + VRF request (Solana)', () => c.openPack());
    const t = Date.now();
    for (;;) { const p = await c.profile(); if (p.packState === PACK.READY) { lat.set('pack VRF callback', [...(lat.get('pack VRF callback') || []), Date.now() - t]); return p.packTier; } if (Date.now() - t > 30000) throw new Error('no VRF callback'); await sleep(300); }
  }));
  const tiers = draws.map((d) => (d.status === 'fulfilled' ? d.value : undefined));
  check('packs', 'VRF packs drawn', tiers.filter((t) => t != null).length >= 1, tiers.map((t) => (t == null ? '-' : PACKS[t].tier)).join(','));
  if (tiers.some((t) => t != null)) {
    const c = openers[tiers.findIndex((t) => t != null)];
    await refuse('packs', 'a second pack while one waits', 6011, () => c.openPack());
  }
  if (markets.length) {
    const plays = await Promise.allSettled(openers.map((c, i) => (tiers[i] == null ? null : soloClimb(c, i, 'pack', markets, { pack: true, packTier: tiers[i], stake: 10 }))));
    plays.forEach((p, i) => { if (tiers[i] != null && p.status === 'rejected') check(`${names[i]} pack`, 'pack climb completed', false, p.reason.message.slice(0, 160)); });
  }
}
relayOn = false;

// ------------------------------------------------------------------ report
const adminEnd = await base.getBalance(admin.publicKey);
const passed = checks.filter((c) => c.ok).length;
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const statuses = results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
const md = `# Battery report

Run ${new Date(T0).toISOString()} · program \`${PROGRAM_ID.toBase58()}\` · rollup ${er.rpcEndpoint} · ${N} players · ${WAVES} solo waves · ${ROUNDS} rounds · ${Math.round((Date.now() - T0) / 1000)} s

**${passed} / ${checks.length} checks passed.** Admin SOL ${(adminStart / 1e9).toFixed(4)} -> ${(adminEnd / 1e9).toFixed(4)} (funding players).

Solo climbs settled: ${results.length} (${Object.entries(statuses).map(([k, v]) => `${v} ${['free', 'staked', 'live', 'cashed', 'busted', 'expired', 'settled'][k] || k}`).join(', ')}), top leverage reached ${Math.max(0, ...results.map((r) => LADDER[r.maxStep]))}x.

Players (handles on chain): ${names.slice(0, N).join(', ')}.

## Latencies

| step | n | median ms | max ms |
|---|---|---|---|
${[...lat.entries()].map(([k, v]) => `| ${k} | ${v.length} | ${med(v)} | ${Math.max(...v)} |`).join('\n')}

## Checks

${checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'} [${c.tag}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`).join('\n')}
`;
fs.writeFileSync(new URL('../BATTERY.md', import.meta.url), md);
say(`${passed}/${checks.length} checks passed; BATTERY.md written`);
process.exit(0);
