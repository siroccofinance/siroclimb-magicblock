// The on-chain market-hours check, run against the built program in LiteSVM
// (an in-process Solana VM: no validator, no devnet, the clock set at will).
//
//   anchor build (npm run chain:build), then: node ops/test/hours-litesvm.mjs
//
// It sets up the config, the test-USDC mint and vault, a player with a
// profile and tokens, and a TSLAx price account whose price is fresh at every
// instant tested (as Pyth's frozen price is outside sessions), then checks
// that staking and starting a climb follow the New York sessions.
import { LiteSVM } from 'litesvm';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { MARKETS, PRICE_ORACLE_PROGRAM_ID, PROGRAM_ID, RELAY_ASSETS, TOKEN_PROGRAM_ID, USDC_MINT, VAULT } from '../../js/chain/config.js';
import { configPda, ataOf, roundSlotPda, runPda } from '../../js/chain/pdas.js';
import { createAtaIdempotent, ix } from '../../js/chain/ix.js';
import { decodeRun, discriminator } from '../../js/chain/codec.js';

const svm = new LiteSVM();
svm.addProgramFromFile(PROGRAM_ID, new URL('../../chain/target/deploy/siroclimb.so', import.meta.url).pathname);
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

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
svm.setAccount(USDC_MINT, { lamports: Number(rent(82)), data: tokenMint(configPda()), owner: TOKEN_PROGRAM_ID, executable: false });
svm.setAccount(VAULT, { lamports: Number(rent(165)), data: tokenAccount(USDC_MINT, configPda(), 1_000_000_000_000), owner: TOKEN_PROGRAM_ID, executable: false });

const TSLA = 0, XAU = 3;
// every market priced at `ts` by its relay account (ours)
function setPrice(ts) {
  for (let a = 0; a < MARKETS.length; a++) {
    if (RELAY_ASSETS.includes(a)) {
      const d = Buffer.alloc(70);
      discriminator('RelayFeed').copy(d, 0); d[8] = a; d.writeInt32LE(-5, 9); d.writeBigInt64LE(38_600_000n, 13); d.writeBigInt64LE(BigInt(ts), 21);
      svm.setAccount(MARKETS[a].feedKey, { lamports: Number(rent(70)), data: d, owner: PROGRAM_ID, executable: false });
    } else {
      const d = Buffer.alloc(134);
      d.writeBigInt64LE(38_600_000n, 73); d.writeBigInt64LE(BigInt(ts), 93);
      svm.setAccount(MARKETS[a].feedKey, { lamports: Number(rent(134)), data: d, owner: PRICE_ORACLE_PROGRAM_ID, executable: false });
    }
  }
}
function at(ts) {
  const c = svm.getClock();
  c.unixTimestamp = BigInt(ts);
  c.slot = c.slot + 10n;
  svm.setClock(c);
  setPrice(ts);
  svm.expireBlockhash();
}
function send(ixs, signers) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signers[0].publicKey;
  tx.recentBlockhash = svm.latestBlockhash();
  tx.sign(...signers);
  const res = svm.sendTransaction(tx);
  const logs = res.meta ? res.meta().logs() : res.logs();
  const err = typeof res.err === 'function' ? res.err() : null;
  const code = /Error Number: (\d+)/.exec(logs.join('\n'));
  return { ok: !err, code: code ? Number(code[1]) : null, logs };
}

const admin = Keypair.generate(), player = Keypair.generate();
svm.airdrop(admin.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
svm.airdrop(player.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
const utc = (s) => Math.floor(Date.parse(s) / 1000);

at(utc('2026-11-23T15:00:00Z'));
let r = send([ix.initialize(admin.publicKey, USDC_MINT, VAULT)], [admin]);
ok('initialize', r.ok, r.logs.slice(-2).join(' '));
r = send([ix.initReserve(admin.publicKey)], [admin]);
ok('the Sirocco Reserve opens on the bankroll', r.ok, r.logs.slice(-2).join(' '));
r = send([createAtaIdempotent(player.publicKey, player.publicKey), ix.faucet(player.publicKey), ix.initProfile(player.publicKey, 'nomad_trader')], [player]);
ok('player: token account, faucet, profile', r.ok, r.logs.slice(-2).join(' '));

const stake = (label, when, expectCode, asset = XAU, who = player) => {
  at(utc(when));
  const res = send([ix.startRun(who.publicKey, who.publicKey, { asset, side: 0, stake: 10_000_000n })], [who]);
  if (expectCode) ok(`${label}: stake refused with ${expectCode}`, !res.ok && res.code === expectCode, `code ${res.code}`);
  else ok(`${label}: stake accepted`, res.ok, res.logs.slice(-3).join(' '));
  return res.ok;
};
const begin = (label, when, expectCode, asset = XAU, who = player) => {
  at(utc(when));
  const res = send([ix.beginRun(who.publicKey, who.publicKey, asset, false)], [who]);
  if (expectCode) ok(`${label}: begin refused with ${expectCode}`, !res.ok && res.code === expectCode, `code ${res.code}`);
  else ok(`${label}: begin accepted`, res.ok, res.logs.slice(-3).join(' '));
  return res.ok;
};
const runStatus = (who = player) => decodeRun(Buffer.from(svm.getAccount(runPda(who.publicKey)).data)).status;

// every market trades around the clock: a climb on each of the five on a Saturday, gold (XAUt) included
const names = ['TSLAx', 'NVDAx', 'AAPLx', 'XAUt', 'GMEx'];
for (const asset of [0, 1, 2, 3, 4]) {
  const name = names[asset], p = asset === XAU ? player : Keypair.generate();
  if (p !== player) {
    svm.airdrop(p.publicKey, BigInt(LAMPORTS_PER_SOL));
    const r2 = send([createAtaIdempotent(p.publicKey, p.publicKey), ix.faucet(p.publicKey), ix.initProfile(p.publicKey, 'sat_' + name.toLowerCase())], [p]);
    ok(`${name} player set up`, r2.ok, r2.logs.slice(-2).join(' '));
  }
  stake(`${name}, Saturday 10:00 New York`, '2026-12-05T15:00:00Z', null, asset, p);
  begin(`${name}, Saturday 10:00:05 New York`, '2026-12-05T15:00:05Z', null, asset, p);
  ok(`${name}: the climb is live on a Saturday`, runStatus(p) === 2, `status ${runStatus(p)}`);
}
// gold on Thanksgiving afternoon and in spot gold's daily break: open too
for (const [label, when] of [['Thanksgiving 15:00', '2026-11-26T20:00:00Z'], ['17:30 daily break', '2026-11-23T22:30:00Z']]) {
  const p = Keypair.generate(); svm.airdrop(p.publicKey, BigInt(LAMPORTS_PER_SOL));
  send([createAtaIdempotent(p.publicKey, p.publicKey), ix.faucet(p.publicKey), ix.initProfile(p.publicKey, 'gold_' + label.slice(0, 4).toLowerCase())], [p]);
  stake(`XAUt, ${label} New York`, when, null, XAU, p);
}

// a relay price that stopped (older than MAX_PRICE_AGE) is a closed market
{
  const p = Keypair.generate(); svm.airdrop(p.publicKey, BigInt(LAMPORTS_PER_SOL));
  send([createAtaIdempotent(p.publicKey, p.publicKey), ix.faucet(p.publicKey), ix.initProfile(p.publicKey, 'stale_relay')], [p]);
  at(utc('2026-12-06T15:00:00Z'));
  const d = Buffer.from(svm.getAccount(MARKETS[TSLA].feedKey).data); d.writeBigInt64LE(BigInt(utc('2026-12-06T14:59:00Z')), 21);
  svm.setAccount(MARKETS[TSLA].feedKey, { lamports: Number(rent(70)), data: d, owner: PROGRAM_ID, executable: false });
  const st = send([ix.startRun(p.publicKey, p.publicKey, { asset: TSLA, side: 0, stake: 10_000_000n })], [p]);
  ok('stake on Solana (no price read)', st.ok, st.logs.slice(-2).join(' '));
  const res = send([ix.beginRun(p.publicKey, p.publicKey, TSLA, false)], [p]);
  ok('a relay price a minute old: the climb cannot begin (StalePrice 6013)', !res.ok && res.code === 6013, `code ${res.code}`);
}

// retired round slots: only an idle one closes, only for the admin, and its rent goes back
function roundSlot(slot, status, players = 0) {
  const d = Buffer.alloc(2640);
  d[2632] = slot; d[2633] = status; d[2635] = players;
  svm.setAccount(roundSlotPda(slot), { lamports: 14_061_440, data: d, owner: PROGRAM_ID, executable: false });
}
roundSlot(0, 5); roundSlot(1, 3); roundSlot(2, 2, 3); roundSlot(3, 2, 0);
let cr = send([ix.closeRoundSlot(player.publicKey, 0)], [player]);
ok('a player cannot close a round slot (Unauthorized 6000)', !cr.ok && cr.code === 6000, `code ${cr.code}`);
cr = send([ix.closeRoundSlot(admin.publicKey, 1)], [admin]);
ok('a live round slot is not closed (SlotBusy 6018)', !cr.ok && cr.code === 6018, `code ${cr.code}`);
cr = send([ix.closeRoundSlot(admin.publicKey, 2)], [admin]);
ok('an open round with players is not closed (SlotBusy 6018)', !cr.ok && cr.code === 6018, `code ${cr.code}`);
cr = send([ix.closeRoundSlot(admin.publicKey, 3)], [admin]);
ok('an open round nobody joined closes', cr.ok, cr.logs.slice(-2).join(' '));
const before = svm.getBalance(admin.publicKey);
cr = send([ix.closeRoundSlot(admin.publicKey, 0)], [admin]);
const gone = svm.getAccount(roundSlotPda(0));
ok('a settled round slot closes and its rent goes to the admin', cr.ok && (!gone || gone.lamports === 0) && svm.getBalance(admin.publicKey) > before, cr.logs.slice(-2).join(' '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
