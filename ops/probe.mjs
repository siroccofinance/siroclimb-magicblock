// Probe of the MagicBlock path for one solo climb, step by step with timings:
// onboarding, stake + delegate, begin with crank, ticks, cash out, settle.
import { SystemProgram } from '@solana/web3.js';
import { Climber, readPrice } from '../js/chain/climber.js';
import { send, sleep } from '../js/chain/tx.js';
import { adminKeypair, baseConnection, erConnection, namedKeypair } from './lib/env.mjs';

const base = baseConnection(), er = erConnection();
const admin = adminKeypair();
const wallet = namedKeypair('probe-wallet');
if ((await base.getBalance(wallet.publicKey)) < 0.08e9) await send(base, [SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: wallet.publicKey, lamports: 0.15e9 })], [admin], { label: 'fund' });
const c = new Climber({ base, er, wallet });
let t = Date.now();
console.log('onboard', await c.onboard({ name: 'probe' }), Date.now() - t, 'ms');
console.log('usdc', await c.usdc(), 'session sol', await c.sol(c.session.keypair.publicKey));
const crank = process.argv[2] !== 'nocrank';
const asset = Number(process.env.ASSET || 0);
const r = await c.startRun({ asset, side: 'long', stake: 10, crank });
console.log('started', r.ms, r.run.status, r.run.entryPrice, r.sigs);
for (let i = 0; i < 8; i++) { await sleep(1000); const x = await c.run(); console.log('t', i, 'status', x.status, 'ticks', x.ticks, 'value', x.value / 1e6, 'step', x.maxStep); }
t = Date.now();
console.log('cash out', await c.cashOut(asset), Date.now() - t, 'ms');
t = Date.now();
await c.waitOnBase((await import('../js/chain/pdas.js')).runPda(c.me));
console.log('back on base', Date.now() - t, 'ms');
console.log('settle', await c.settleRun());
const fin = await c.run(); console.log('run', fin.status, fin.ticks, fin.value, fin.payout);
console.log('usdc', await c.usdc(), 'session sol', await c.sol(c.session.keypair.publicKey));
