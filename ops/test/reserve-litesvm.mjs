// The Sirocco Reserve on the built program, in LiteSVM (no validator, no
// devnet): the vault's bankroll becomes the admin's lender position, a lender
// deposits and withdraws at the share price, a solo climb reserves liquidity
// and draws on the reserve, settlement charges the borrow cost and moves the
// share price, the utilization guard refuses a climb the reserve cannot cover,
// and a run account from before the reserve is grown in place.
//
//   anchor build (npm run chain:build), then: node ops/test/reserve-litesvm.mjs
import { LiteSVM } from 'litesvm';
import { Keypair, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { MARKETS, PROGRAM_ID, TOKEN_PROGRAM_ID, USDC_MINT, VAULT } from '../../js/chain/config.js';
import { ataOf, configPda, lenderPda, reservePda, runPda } from '../../js/chain/pdas.js';
import { createAtaIdempotent, ix } from '../../js/chain/ix.js';
import { RUN_SIZE, decodeLender, decodeReserve, decodeRun, discriminator } from '../../js/chain/codec.js';
import { borrowCost, valueOf } from '../../js/chain/reserve.js';

const svm = new LiteSVM();
svm.addProgramFromFile(PROGRAM_ID, new URL('../../chain/target/deploy/siroclimb.so', import.meta.url).pathname);
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = 1_000_000;

// --- accounts the program expects
const rent = (n) => BigInt(Math.ceil((n + 128) * 6960));
function tokenMint(authority) {
  const d = Buffer.alloc(82);
  d.writeUInt32LE(1, 0); authority.toBuffer().copy(d, 4); d[44] = 6; d[45] = 1;
  return d;
}
function tokenAccount(mint, owner, amount) {
  const d = Buffer.alloc(165);
  mint.toBuffer().copy(d, 0); owner.toBuffer().copy(d, 32); d.writeBigUInt64LE(BigInt(amount), 64); d[108] = 1;
  return d;
}
const setVault = (amount) => svm.setAccount(VAULT, { lamports: Number(rent(165)), data: tokenAccount(USDC_MINT, configPda(), amount), owner: TOKEN_PROGRAM_ID, executable: false });
const balanceOf = (key) => Number(Buffer.from(svm.getAccount(key).data).readBigUInt64LE(64));
svm.setAccount(USDC_MINT, { lamports: Number(rent(82)), data: tokenMint(configPda()), owner: TOKEN_PROGRAM_ID, executable: false });
setVault(200 * U); // a small bankroll, so the guards bind

const TSLA = 0;
let price = 38_600_000n;
// TSLAx is priced by the program's relay account (RelayFeed: market, exponent, price, publish_ts, updates, relayer, bump)
function setPrice(ts) {
  const d = Buffer.alloc(70);
  discriminator('RelayFeed').copy(d, 0); d[8] = TSLA; d.writeInt32LE(-5, 9); d.writeBigInt64LE(price, 13); d.writeBigInt64LE(BigInt(ts), 21);
  svm.setAccount(MARKETS[TSLA].feedKey, { lamports: Number(rent(70)), data: d, owner: PROGRAM_ID, executable: false });
}
function at(ts) {
  const c = svm.getClock();
  c.unixTimestamp = BigInt(ts); c.slot = c.slot + 10n;
  svm.setClock(c); setPrice(ts); svm.expireBlockhash();
}
function send(ixs, signers) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signers[0].publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(...signers);
  const res = svm.sendTransaction(tx);
  const logs = res.meta ? res.meta().logs() : res.logs();
  const err = res.err ? res.err() : null;
  const code = /Error Number: (\d+)/.exec(logs.join('\n'));
  return { ok: !err, code: code ? Number(code[1]) : null, logs };
}
const reserve = () => decodeReserve(Buffer.from(svm.getAccount(reservePda()).data));
const lender = (k) => decodeLender(Buffer.from(svm.getAccount(lenderPda(k)).data));
const run = (k) => decodeRun(Buffer.from(svm.getAccount(runPda(k)).data));
const assets = () => balanceOf(VAULT) - reserve().staked;

const admin = Keypair.generate(), lend = Keypair.generate(), player = Keypair.generate(), late = Keypair.generate();
for (const k of [admin, lend, player, late]) svm.airdrop(k.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
const t0 = Math.floor(Date.parse('2026-11-23T15:00:00Z') / 1000); // Monday 10:00 New York
at(t0);
let r = send([ix.initialize(admin.publicKey, USDC_MINT, VAULT)], [admin]);
ok('initialize', r.ok, r.logs.slice(-2).join(' '));
for (const k of [admin, lend, player, late]) {
  r = send([createAtaIdempotent(k.publicKey, k.publicKey), ix.faucet(k.publicKey), ix.initProfile(k.publicKey, 'p' + k.publicKey.toBase58().slice(0, 6))], [k]);
  if (!r.ok) ok('player setup', false, r.logs.slice(-3).join(' '));
}

// --- the bankroll becomes the admin's position
r = send([ix.initReserve(lend.publicKey)], [lend]);
ok('only the admin opens the reserve (Unauthorized 6000)', !r.ok && r.code === 6000, `code ${r.code}`);
r = send([ix.initReserve(admin.publicKey)], [admin]);
ok('init_reserve: 200 tUSDC bankroll = 200 admin shares', r.ok && reserve().shares === 200 * U && lender(admin.publicKey).shares === 200 * U, r.logs.slice(-2).join(' '));

// --- a lender deposits at 1.0
r = send([ix.deposit(lend.publicKey, lend.publicKey, BigInt(300 * U))], [lend]);
ok('deposit 300 tUSDC at share price 1.0 = 300 shares', r.ok && lender(lend.publicKey).shares === 300 * U && balanceOf(ataOf(lend.publicKey, USDC_MINT)) === 700 * U, r.logs.slice(-2).join(' '));
r = send([ix.deposit(lend.publicKey, player.publicKey, BigInt(10 * U))], [lend]);
ok('a stranger cannot deposit from someone else (Unauthorized 6000)', !r.ok && r.code === 6000, `code ${r.code}`);

// --- a solo climb draws on the reserve
const stake = 100 * U;
r = send([ix.startRun(player.publicKey, player.publicKey, { asset: TSLA, side: 0, stake: BigInt(stake) })], [player]);
let rs = reserve(), rn = run(player.publicKey);
ok('start: stake in, 4 x stake reserved, borrow line 3 x stake', r.ok && rs.staked === stake && rs.reserved === 4 * stake && rs.lines === 3 * stake && rn.reserved === 4 * stake && rn.line === 3 * stake,
  `${r.ok} staked ${rs.staked} reserved ${rs.reserved} lines ${rs.lines}`);
ok('a new run account has the reserve layout', svm.getAccount(runPda(player.publicKey)).data.length === RUN_SIZE, `${svm.getAccount(runPda(player.publicKey)).data.length} bytes`);
const free = assets() - rs.reserved;
r = send([ix.withdraw(lend.publicKey, lend.publicKey, BigInt(300 * U))], [lend]);
ok('withdrawing what an open climb reserved is refused (NotEnoughLiquidity 6028)', !r.ok && r.code === 6028, `free ${free / U} code ${r.code}`);

// the climb on the "rollup" (no delegation in LiteSVM): begin, ticks, the bell
r = send([ix.beginRun(player.publicKey, player.publicKey, TSLA, false)], [player]);
ok('begin at the oracle price', r.ok, r.logs.slice(-2).join(' '));
at(t0 + 13); price = 38_610_000n; send([ix.tickRun(player.publicKey, TSLA)], [player]);
rn = run(player.publicKey);
ok('borrowed follows the ladder (2x at 12 s: 1 x stake)', rn.borrowed === stake, `borrowed ${rn.borrowed / U}`);
at(t0 + 61); send([ix.tickRun(player.publicKey, TSLA)], [player]);
rn = run(player.publicKey);
ok('expired at the bell, top leverage 4x', rn.status === 5 && rn.maxStep === 6, `status ${rn.status} step ${rn.maxStep}`);

// settle: payout = value - borrow cost; the reserve keeps the cost and pays (or keeps) the rest
const vaultBefore = balanceOf(VAULT), assetsBefore = assets(), lendSharesValue = () => valueOf(lender(lend.publicKey).shares, assets(), reserve().shares);
const lendBefore = lendSharesValue(), playerBefore = balanceOf(ataOf(player.publicKey, USDC_MINT));
r = send([ix.settleRun(player.publicKey, player.publicKey)], [player]);
rn = run(player.publicKey); rs = reserve();
const cost = borrowCost(stake, rn.endTs - rn.startTs, rn.top, rn.maxStep);
const paid = balanceOf(ataOf(player.publicKey, USDC_MINT)) - playerBefore;
ok('settle charges the borrow cost (fee on the peak borrow + interest), as the front computes it', r.ok && rn.cost === cost && cost > 0, `cost ${rn.cost} expected ${cost}`);
ok('the player gets value - cost', paid === rn.value - rn.cost, `paid ${paid} value ${rn.value}`);
ok('reservation, line and stake released', rs.reserved === 0 && rs.lines === 0 && rs.staked === 0, `reserved ${rs.reserved} lines ${rs.lines} staked ${rs.staked}`);
ok('lender assets move by stake - payout', assets() - assetsBefore === stake - paid && vaultBefore - balanceOf(VAULT) === paid, `delta ${(assets() - assetsBefore) / U}`);
ok('the lender\'s position moves with the climb result', lendSharesValue() - lendBefore === Math.floor(((stake - paid) * 300) / 500) || Math.abs(lendSharesValue() - lendBefore - ((stake - paid) * 300) / 500) <= 1,
  `${(lendSharesValue() - lendBefore) / U} tUSDC`);
ok('reserve counters: fees, runs, borrowed volume', rs.fees === cost && rs.runs === 1 && rs.borrowedVolume === 3 * stake, `fees ${rs.fees} runs ${rs.runs} volume ${rs.borrowedVolume}`);

// --- the lender withdraws everything at the new share price
const shares = lender(lend.publicKey).shares, due = valueOf(shares, assets(), reserve().shares), before = balanceOf(ataOf(lend.publicKey, USDC_MINT));
r = send([ix.withdraw(lend.publicKey, lend.publicKey, BigInt(shares))], [lend]);
ok('withdraw all shares at the share price', r.ok && balanceOf(ataOf(lend.publicKey, USDC_MINT)) - before === due && lender(lend.publicKey).shares === 0, `got ${(balanceOf(ataOf(lend.publicKey, USDC_MINT)) - before) / U} due ${due / U}`);
r = send([ix.withdraw(lend.publicKey, lend.publicKey, 1n)], [lend]);
ok('withdrawing shares one does not hold is refused (BadShares 6029)', !r.ok && r.code === 6029, `code ${r.code}`);

// --- the utilization guard: the admin's ~200 tUSDC left cannot back a 100 tUSDC climb (4 x 100 reserved)
at(t0 + 120);
r = send([ix.startRun(late.publicKey, late.publicKey, { asset: TSLA, side: 1, stake: BigInt(100 * U) })], [late]);
ok('a 100 tUSDC climb the reserve cannot cover is refused (ReserveFull 6027)', !r.ok && r.code === 6027, `assets ${(assets() / U).toFixed(2)} code ${r.code}`);
r = send([ix.startRun(late.publicKey, late.publicKey, { asset: TSLA, side: 1, stake: BigInt(40 * U) })], [late]);
ok('a 40 tUSDC climb it can cover starts', r.ok && reserve().reserved === 160 * U, r.logs.slice(-2).join(' '));

// --- a run account from before the reserve (168 bytes) is grown in place, then plays
const old = Keypair.generate(); svm.airdrop(old.publicKey, BigInt(LAMPORTS_PER_SOL));
send([createAtaIdempotent(old.publicKey, old.publicKey), ix.faucet(old.publicKey), ix.initProfile(old.publicKey, 'oldtimer')], [old]);
const legacy = Buffer.alloc(168); Buffer.from(discriminator('Run')).copy(legacy, 0); old.publicKey.toBuffer().copy(legacy, 8);
legacy[8 + 64 + 4] = 6; // status SETTLED
legacy[167] = 255; // bump (any: not checked by grow_run)
svm.setAccount(runPda(old.publicKey), { lamports: Number(rent(168)), data: legacy, owner: PROGRAM_ID, executable: false });
r = send([ix.startRun(old.publicKey, old.publicKey, { asset: TSLA, side: 0, stake: BigInt(10 * U) })], [old]);
ok('an old run account cannot start without growing', !r.ok, `code ${r.code}`);
r = send([ix.growRun(old.publicKey, old.publicKey)], [old]);
ok('grow_run brings it to the reserve layout', r.ok && svm.getAccount(runPda(old.publicKey)).data.length === RUN_SIZE, r.logs.slice(-2).join(' '));
svm.expireBlockhash();
r = send([ix.growRun(old.publicKey, old.publicKey)], [old]);
ok('grow_run twice is a no-op', r.ok, r.logs.slice(-2).join(' '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
