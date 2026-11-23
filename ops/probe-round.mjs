// Probe of one timed round with three session-keyed players, plus a leverage
// pack: VRF market draw, joins, delegation, bell, cash outs, settle, record.
import { SystemProgram } from '@solana/web3.js';
import { Climber } from '../js/chain/climber.js';
import { ROUND, ROUND_CYCLE, MARKETS } from '../js/chain/config.js';
import { send, sleep } from '../js/chain/tx.js';
import { adminKeypair, baseConnection, erConnection, namedKeypair } from './lib/env.mjs';

const base = baseConnection(), er = erConnection(), admin = adminKeypair();
const names = ['ghibli', 'khamsin', 'leveche'];
const players = [];
for (const n of names) {
  const w = namedKeypair(`probe-${n}`);
  if ((await base.getBalance(w.publicKey)) < 0.08e9) await send(base, [SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: w.publicKey, lamports: 0.12e9 })], [admin], { label: 'fund' });
  const c = new Climber({ base, er, wallet: w });
  await c.onboard({ name: n });
  players.push(c);
}
console.log('players ready');
const now = () => Date.now() / 1000;
let id = Math.floor(now() / ROUND_CYCLE);
if (now() > id * ROUND_CYCLE + 12) id += 1;
const opens = id * ROUND_CYCLE, starts = opens + 20;
while (now() < opens - 25) await sleep(500);
const t0 = Date.now();
console.log('open round', id, await players[0].openRound(id, 0b111111));
let r;
for (;;) { r = await players[0].round(id); if (r.status === ROUND.OPEN) break; await sleep(300); }
console.log('VRF market', MARKETS[r.asset].id, 'after', Date.now() - t0, 'ms');
while (now() < opens) await sleep(300);
await Promise.all(players.map((p, i) => p.joinRound(id, i % 2 ? 'short' : 'long')));
r = await players[0].round(id);
console.log('joined', r.players, 'pot', r.pot / 1e6);
console.log('pack', await players[1].openPack());
while (now() < starts) await sleep(200);
console.log('delegate', await players[2].delegateRound(id));
console.log('go live', await players[2].goLive(id, r.asset));
await sleep(8000);
await players[0].cashOutRound(id, r.asset);
await sleep(5000);
await players[1].cashOutRound(id, r.asset);
r = await players[0].round(id);
console.log('mid', r.status, r.ticks, r.entries.map((e) => [e.name, e.status, e.value / 1e6]));
while (now() < starts + 62) await sleep(500);
r = await players[0].round(id);
console.log('end', r.status, r.ticks, r.entries.map((e) => [e.name, e.status, e.value / 1e6]), r.winners, r.prizes);
console.log('finish', await players[2].finishRound(id, r.asset));
console.log('settle', await players[2].settleRound(id));
console.log('record', await players[2].recordRound(id));
r = await players[0].round(id);
console.log('final', r.status, r.recorded.toString(2), r.prizes.map((p) => p / 1e6));
for (const p of players) { const pr = await p.profile(); console.log(pr.name, 'usdc', await p.usdc(), 'rounds', pr.rounds, 'podiums', pr.podiums, 'pack', pr.packState, pr.packTier); }
