// Real positions on the built program, in LiteSVM: every market, long and short, with token balances
// checked at each stage. A climb opens on Solana (the stake's worth of the market token from the
// Sirocco desk into its escrow, or borrowed from the lending book and sold), books a fill at every
// leverage step, and settles: the booked tokens move, the position closes at the exit price, the real
// P&L is recorded and the rest of the result (the game's boost) is settled with the reserve.
//
//   anchor build (npm run chain:build), then: node ops/test/positions-litesvm.mjs
import { LiteSVM } from 'litesvm';
import { Keypair, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { MARKETS, PROGRAM_ID, TOKEN_PROGRAM_ID, USDC_MINT, VAULT } from '../../js/chain/config.js';
import { ata22Of, ataOf, configPda, deskPda, escrowOf, lendPda, runPda } from '../../js/chain/pdas.js';
import { createAtaIdempotent, ix } from '../../js/chain/ix.js';
import { decodeDesk, decodeRun, discriminator } from '../../js/chain/codec.js';
import { bal22, mint22, pushQuotes, setupDesk, tokenAccount } from './desk-fixture.mjs';

const svm = new LiteSVM();
svm.addProgramFromFile(PROGRAM_ID, new URL('../../chain/target/deploy/siroclimb.so', import.meta.url).pathname);
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const U = 1_000_000n;
const rent = (n) => Math.ceil((n + 128) * 6960);
function tokenMintClassic(authority) {
  const d = Buffer.alloc(82);
  d.writeUInt32LE(1, 0); authority.toBuffer().copy(d, 4); d[44] = 6; d[45] = 1;
  return d;
}
svm.setAccount(USDC_MINT, { lamports: rent(82), data: tokenMintClassic(configPda()), owner: TOKEN_PROGRAM_ID, executable: false });
svm.setAccount(VAULT, { lamports: rent(165), data: tokenAccount(USDC_MINT, configPda(), 1_000_000n * U), owner: TOKEN_PROGRAM_ID, executable: false });
const usdc = (k) => { const a = svm.getAccount(k); return a ? Buffer.from(a.data).readBigUInt64LE(64) : 0n; };

// every market's relay price account, at `prices[a]` and fresh at `ts`
let prices = [38_000_000n, 15_000_000n, 35_000_000n, 3_540_000n, 2_700_000n];
function setRelays(ts) {
  MARKETS.forEach((m, a) => {
    const d = Buffer.alloc(70);
    discriminator('RelayFeed').copy(d, 0); d[8] = a; d.writeInt32LE(m.exponent, 9); d.writeBigInt64LE(prices[a], 13); d.writeBigInt64LE(BigInt(ts), 21);
    svm.setAccount(m.feedKey, { lamports: rent(70), data: d, owner: PROGRAM_ID, executable: false });
  });
}
let desk = null;
function at(ts) {
  const c = svm.getClock(); c.unixTimestamp = BigInt(ts); c.slot += 10n; svm.setClock(c);
  setRelays(ts); svm.expireBlockhash();
  if (desk) pushQuotes(send, desk.relayer, ts, prices);
}
function send(ixs, signers) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signers[0].publicKey; tx.recentBlockhash = svm.latestBlockhash(); tx.sign(...signers);
  const res = svm.sendTransaction(tx);
  const logs = res.meta ? res.meta().logs() : res.logs();
  const err = typeof res.err === 'function' ? res.err() : null;
  const code = /Error Number: (\d+)/.exec(logs.join('\n'));
  return { ok: !err, code: code ? Number(code[1]) : null, logs };
}
const run = (k) => decodeRun(Buffer.from(svm.getAccount(runPda(k)).data));
const deskState = () => decodeDesk(Buffer.from(svm.getAccount(deskPda()).data));
const deskUsdc = () => usdc(ataOf(deskPda(), USDC_MINT));

const admin = Keypair.generate();
svm.airdrop(admin.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
let t = Math.floor(Date.parse('2026-12-05T15:00:00Z') / 1000); // a Saturday: every market open
at(t);
let r = send([ix.initialize(admin.publicKey, USDC_MINT, VAULT)], [admin]);
ok('initialize', r.ok, r.logs.slice(-2).join(' '));
r = send([ix.initReserve(admin.publicKey)], [admin]);
ok('reserve opens', r.ok, r.logs.slice(-2).join(' '));
desk = setupDesk(svm, send, admin, { inventory: 10n ** 14n, usdc: 10_000_000n * U });
ok('desk opens with the five market tokens', desk.ok && deskState().mints.every((m, a) => m.equals(MARKETS[a].mintKey)), desk.logs.slice(-2).join(' '));
at(++t);

function player(name) {
  const p = Keypair.generate(); svm.airdrop(p.publicKey, BigInt(LAMPORTS_PER_SOL));
  const res = send([createAtaIdempotent(p.publicKey, p.publicKey), ix.faucet(p.publicKey), ix.initProfile(p.publicKey, name)], [p]);
  if (!res.ok) ok(`${name} set up`, false, res.logs.slice(-3).join(' '));
  return p;
}

// --- one climb per market and side: open, two steps, a move, the bell, settle
const STAKE = 20n * U;
for (const [a, m] of MARKETS.entries()) {
  for (const side of [0, 1]) {
    const tag = `${m.ticker} ${side ? 'short' : 'long'}`;
    const p = player(`${m.ticker.toLowerCase()}_${side}`);
    const mintK = m.mintKey, esc = escrowOf(p.publicKey, mintK), dTok = ata22Of(deskPda(), mintK), lTok = ata22Of(lendPda(), mintK);
    const d0 = bal22(svm, dTok), l0 = bal22(svm, lTok), du0 = deskUsdc(), v0 = usdc(VAULT);
    r = send([ix.startRun(p.publicKey, p.publicKey, { asset: a, side, stake: STAKE }), ix.openPosition(p.publicKey, p.publicKey, a)], [p]);
    let rn = run(p.publicKey);
    ok(`${tag}: stake + open position`, r.ok && rn.unitsOpen > 0 && rn.notionalOpen === Number(STAKE), r.ok ? `${rn.unitsOpen} units at ${rn.fillPrice}` : r.logs.slice(-3).join(' '));
    if (side === 0) {
      ok(`${tag}: the tokens sit in the climb's escrow, bought from the desk`, bal22(svm, esc) === BigInt(rn.unitsOpen) && d0 - bal22(svm, dTok) === BigInt(rn.unitsOpen) && deskUsdc() - du0 === STAKE,
        `escrow ${bal22(svm, esc)} desk -${d0 - bal22(svm, dTok)}`);
    } else {
      ok(`${tag}: borrowed from the lending book and sold to the desk, the reserve holds the tUSDC`, bal22(svm, esc) === 0n && l0 - bal22(svm, lTok) === BigInt(rn.unitsOpen) && bal22(svm, dTok) - d0 === BigInt(rn.unitsOpen) && du0 - deskUsdc() === STAKE,
        `lend -${l0 - bal22(svm, lTok)} desk +${bal22(svm, dTok) - d0}`);
    }
    r = send([ix.beginRun(p.publicKey, p.publicKey, a, false)], [p]);
    ok(`${tag}: begin`, r.ok, r.logs.slice(-2).join(' '));
    const t0 = t;
    at(t0 + 7); send([ix.tickRun(p.publicKey, a)], [p]);              // step 1 (1.5x): stake x 0.5 booked
    const before = prices[a];
    prices[a] = before + before / 1000n;                                   // +0.1 %
    at(t0 + 13); send([ix.tickRun(p.publicKey, a)], [p]);             // step 2 (2x) at the new price
    rn = run(p.publicKey);
    ok(`${tag}: two leverage steps booked (2x: 40 tUSDC of position)`, rn.bookedStep === 2 && rn.notional === 2 * Number(STAKE) && rn.units > rn.unitsOpen, `step ${rn.bookedStep} notional ${rn.notional}`);
    at(t0 + 61); send([ix.tickRun(p.publicKey, a)], [p]);             // the bell
    rn = run(p.publicKey);
    ok(`${tag}: over`, rn.status === 5 || rn.status === 4, `status ${rn.status}`);
    const pu0 = usdc(ataOf(p.publicKey, USDC_MINT)), du1 = deskUsdc();
    r = send([ix.settleRun(p.publicKey, p.publicKey, a)], [p]);
    rn = run(p.publicKey);
    const paid = usdc(ataOf(p.publicKey, USDC_MINT)) - pu0;
    ok(`${tag}: settled`, r.ok && rn.status === 6, r.ok ? '' : r.logs.slice(-4).join(' '));
    ok(`${tag}: escrow empty, desk and lending book inventories back`, bal22(svm, esc) === 0n && bal22(svm, dTok) === d0 && bal22(svm, lTok) === l0,
      `escrow ${bal22(svm, esc)} desk ${bal22(svm, dTok) - d0} lend ${bal22(svm, lTok) - l0}`);
    // fills: 20 at the open (P0), 10 at step 1 (P0), then 10 at step 2 and 40 more booked at the bell (P1, the ladder at 4x);
    // all sold (long) or bought back (short) at P1, the desk's spread on every fill
    const sp = 5 / 1e4, P0 = Number(before), P1 = Number(prices[a]);
    const expected = side === 0
      ? 30 * ((P1 * (1 - sp)) / (P0 * (1 + sp)) - 1) + 50 * ((1 - sp) / (1 + sp) - 1)
      : 30 * (1 - (P1 * (1 + sp)) / (P0 * (1 - sp))) + 50 * (1 - (1 + sp) / (1 - sp));
    ok(`${tag}: real P&L = the +0.1 % move on the tokens less the spread (${(rn.realPnl / 1e6).toFixed(4)} vs ${expected.toFixed(4)} tUSDC)`,
      Math.abs(rn.realPnl / 1e6 - expected) < (m.decimals < 8 ? 0.02 : 0.002), `real ${rn.realPnl}`);
    ok(`${tag}: the desk paid or got exactly the real P&L`, Number(du0 - deskUsdc()) === rn.realPnl, `desk ${Number(du0 - deskUsdc())} real ${rn.realPnl}`);
    ok(`${tag}: boost P&L is the rest of the result`, rn.boostPnl === rn.value - Number(STAKE) - rn.realPnl && paid === BigInt(rn.value - rn.cost), `value ${rn.value} boost ${rn.boostPnl} paid ${paid}`);
    ok(`${tag}: vault net = stake - payout + real P&L`, usdc(VAULT) - v0 === STAKE - paid + BigInt(rn.realPnl) - STAKE + STAKE, `vault ${usdc(VAULT) - v0}`);
    prices[a] = before;
    void du1;
    at(++t + 70); t += 70;
  }
}

// --- a bust closes the position too
{
  const p = player('buster');
  const a = 0, m = MARKETS[a];
  r = send([ix.startRun(p.publicKey, p.publicKey, { asset: a, side: 0, stake: STAKE }), ix.openPosition(p.publicKey, p.publicKey, a)], [p]);
  send([ix.beginRun(p.publicKey, p.publicKey, a, false)], [p]);
  const t0 = t, before = prices[a];
  prices[a] = before - before / 50n;                                       // -2 %: boost 90 at 1x wipes the stake
  at(t0 + 3); send([ix.tickRun(p.publicKey, a)], [p]);
  let rn = run(p.publicKey);
  ok('a -2 % move busts a long', rn.status === 4 && rn.value === 0, `status ${rn.status}`);
  r = send([ix.settleRun(p.publicKey, p.publicKey, a)], [p]);
  rn = run(p.publicKey);
  ok('the busted climb\'s tokens are sold back: escrow empty, real P&L about -2 %', r.ok && bal22(svm, escrowOf(p.publicKey, m.mintKey)) === 0n && rn.realPnl < -0.015 * 20e6 && rn.realPnl > -0.03 * 20e6,
    `real ${rn.realPnl}`);
  ok('the player loses the stake, no more', rn.payout === 0, `payout ${rn.payout}`);
  prices[a] = before; at(++t + 70); t += 70;
}

// --- refusals
{
  const p = player('refused'), q = player('stranger');
  r = send([ix.startRun(p.publicKey, p.publicKey, { asset: 0, side: 0, stake: STAKE })], [p]);
  ok('a climb can be staked without its position in the same transaction', r.ok, r.logs.slice(-2).join(' '));
  r = send([ix.beginRun(p.publicKey, p.publicKey, 0, false)], [p]);
  ok('it cannot begin without a position (NoPosition 6030)', !r.ok && r.code === 6030, `code ${r.code}`);
  r = send([ix.openPosition(q.publicKey, p.publicKey, 0)], [q]);
  ok('a stranger cannot open someone\'s position (Unauthorized 6000)', !r.ok && r.code === 6000, `code ${r.code}`);
  const wrong = ix.openPosition(p.publicKey, p.publicKey, 0);
  wrong.keys[6].pubkey = MARKETS[1].mintKey;                               // the NVDAx mint for a TSLAx climb
  r = send([wrong], [p]);
  ok('the wrong market token is refused (BadMint 6003)', !r.ok && r.code === 6003, `code ${r.code}`);
  const c = svm.getClock(); c.unixTimestamp += 40n; svm.setClock(c); svm.expireBlockhash();   // quotes 40 s old
  r = send([ix.openPosition(p.publicKey, p.publicKey, 0)], [p]);
  ok('a Solana quote older than 30 s cannot open a position (StalePrice 6013)', !r.ok && r.code === 6013, `code ${r.code}`);
  r = send([ix.pushQuotes(q.publicKey, prices, c.unixTimestamp)], [q]);
  ok('only the relay key pushes quotes (Unauthorized 6000)', !r.ok && r.code === 6000, `code ${r.code}`);
  r = send([ix.pushQuotes(desk.relayer.publicKey, prices, c.unixTimestamp)], [desk.relayer]);
  ok('the relay key pushes fresh quotes', r.ok, r.logs.slice(-2).join(' '));
  svm.expireBlockhash();   // the same transaction as the refused one: a new blockhash
  r = send([ix.openPosition(p.publicKey, p.publicKey, 0)], [p]);
  ok('then the position opens', r.ok, r.logs.slice(-4).join(' '));
  svm.expireBlockhash();
  r = send([ix.openPosition(p.publicKey, p.publicKey, 0)], [p]);
  ok('a position opens once (BadStatus 6011)', !r.ok && r.code === 6011, `code ${r.code}`);
  r = send([ix.fundDesk(q.publicKey, 1n)], [q]);
  ok('only the admin funds the desk (Unauthorized 6000)', !r.ok && r.code === 6000, `code ${r.code}`);
}
const ds = deskState();
ok('desk books balance: no open long cost or short proceeds left but the one open climb', ds.openLongCost === Number(STAKE) && ds.openShortProceeds === 0, `long ${ds.openLongCost} short ${ds.openShortProceeds}`);
void mint22;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
