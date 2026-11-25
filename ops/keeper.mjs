// Optional ops keeper. Nothing here is required: every instruction it sends
// is permissionless and the front sends the same ones itself (autopilot).
//
//   relay      pushes the xStocks' 24/7 prices into the relay accounts every
//              700 ms (the site does it too, while someone has the game open)
//   sweeper    finishes and settles climbs left on the rollup by closed tabs,
//              and settles climbs back on Solana that nobody settled
//
//   node ops/keeper.mjs            (keys in ~/.config/siroclimb/)
import { SystemProgram } from '@solana/web3.js';
import { Climber } from '../js/chain/climber.js';
import { PROGRAM_ID, RUN, RUN_SECONDS } from '../js/chain/config.js';
import { decodeRun, discriminator } from '../js/chain/codec.js';
import { send, sleep } from '../js/chain/tx.js';
import { pushOnce } from '../js/chain/relay.js';
import { friendlyError } from '../js/chain/errors.js';
import { adminKeypair, baseConnection, erConnection, namedKeypair, short } from './lib/env.mjs';

const base = baseConnection(), er = erConnection(), admin = adminKeypair();
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const keeperKey = namedKeypair('keeper');
const keeper = new Climber({ base, er, wallet: keeperKey });

if ((await base.getBalance(keeperKey.publicKey)) < 0.05e9) {
  await send(base, [SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: keeperKey.publicKey, lamports: 0.1e9 })], [admin], { label: 'fund' });
}
say('keeper', short(keeperKey.publicKey));

// relay
const relayer = namedKeypair('relayer');
(async () => { for (;;) { await pushOnce(er, relayer, { minGapS: 0, base }).catch((e) => say('relay', friendlyError(e))); await sleep(700); } })();

const busy = new Set();
const once = (k, fn) => { if (busy.has(k)) return; busy.add(k); fn().catch((e) => say(k, friendlyError(e))).finally(() => setTimeout(() => busy.delete(k), 2000)); };

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

for (;;) {
  await sweep().catch((e) => say('sweep', e.message));
  await sleep(10000);
}
