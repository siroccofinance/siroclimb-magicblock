// On-chain battery on devnet + the rollup with many concurrent players.
//
//   node ops/battery.mjs [players=24] [soloWaves=2]
//
// Players are keypairs under ~/.config/siroclimb/battery/ with realistic
// handles, funded by the admin key, onboarded with a MagicBlock session key
// each (exactly like the front). Then:
//   solo waves   every player climbs at once on a random open market; cash
//                outs at random times, some ride to the bell; every climb is
//                checked from stake to settlement (balances, profile, state
//                committed back to Solana equal to the rollup's).
//   refusals     what must fail does, with the expected program error.
//   packs        concurrent VRF pack draws, then the free climbs they give.
// Writes BATTERY.md; every bug it finds goes to FINDINGS.md.
import fs from 'fs';
import path from 'path';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { Climber, readPrice } from '../js/chain/climber.js';
import { MARKETS, MAX_PRICE_AGE, ONE_USDC, PACK, PACKS, PROGRAM_ID, RUN, LADDER } from '../js/chain/config.js';
import { decodeRun } from '../js/chain/codec.js';
import { ix } from '../js/chain/ix.js';
import { profilePda, runPda } from '../js/chain/pdas.js';
import { inSession } from '../js/chain/hours.js';
import { errorCode, send, sleep } from '../js/chain/tx.js';
import { uniqueHandles } from '../js/chain/handles.js';
import { KEY_DIR, adminKeypair, baseConnection, erConnection, namedKeypair, short } from './lib/env.mjs';

const N = Number(process.argv[2] || 24);
const WAVES = Number(process.argv[3] || 2);
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

// Top-up of the players' SOL (session-key fuel); lower both on a tight deployer budget.
const FUND_MIN = Number(process.env.BATTERY_FUND_MIN || 0.03) * 1e9;
const FUND_AMOUNT = Number(process.env.BATTERY_FUND_AMOUNT || 0.075) * 1e9;
async function fundAll() {
  const need = [];
  for (const w of wallets) if ((await base.getBalance(w.publicKey)) < FUND_MIN) need.push(w);
  for (let i = 0; i < need.length; i += 8) {
    const batch = need.slice(i, i + 8);
    await timed('fund players (8 per tx)', () => send(base, batch.map((w) => SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: w.publicKey, lamports: FUND_AMOUNT })), [admin], { label: 'fund' }));
  }
  return need.length;
}

const adminStart = await base.getBalance(admin.publicKey);
say(`battery: ${N} players (+1 spare), ${WAVES} solo waves, program ${short(PROGRAM_ID)}`);
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
  await refuse(tag, 'a market that does not exist', 6007, () => send(base, [ix.startRun(c.actor.publicKey, c.me, { asset: 9, side: 0, stake: 10n * BigInt(ONE_USDC) }, c.token)], [c.actor], { label: 'badasset', attempts: 1 }));
  await refuse(tag, 'a pack climb without a pack', 6023, () => send(base, [ix.startRun(c.actor.publicKey, c.me, { asset: 0, side: 0, stake: 0n, usePack: true }, c.token)], [c.actor], { label: 'nopack', attempts: 1 }));
  await refuse(tag, 'faucet twice in a row', 6006, async () => { await c.faucet().catch(() => {}); await c.faucet(); });
}

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

// ------------------------------------------------------------------ report
const adminEnd = await base.getBalance(admin.publicKey);
const passed = checks.filter((c) => c.ok).length;
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const statuses = results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
const md = `Run ${new Date(T0).toISOString()} · program \`${PROGRAM_ID.toBase58()}\` · rollup ${er.rpcEndpoint} · ${N} players · ${WAVES} solo waves · ${Math.round((Date.now() - T0) / 1000)} s

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
// BATTERY.md keeps its header and run table; this run replaces the latest run section.
const file = new URL('../BATTERY.md', import.meta.url);
const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Battery report\n\n';
const cut = prev.indexOf('\n## Run ');
fs.writeFileSync(file, `${cut < 0 ? prev.trimEnd() + '\n' : prev.slice(0, cut + 1)}\n## Run ${process.env.BATTERY_RUN || 'latest'}\n\n${md}`);
say(`${passed}/${checks.length} checks passed; BATTERY.md written`);
process.exit(0);
