// GBP/USD relay. MagicBlock does not feed FX into its rollups, and Pyth's FX
// feeds need an entitlement we do not have, so the program keeps a relay
// account on the rollup that one named key pushes prices into (gasless).
// Source: Kraken's public GBP/USD book (mid of best bid and ask).
// Pushed by api/relay.js (called by any browser while a GBP/USD climb is
// live) and by the ops keeper. Swapping the source for a signed Pyth Lazer
// update is a one-function change.
import { MARKETS, RELAY_ASSET } from './config.js';
import { decodeRelay } from './codec.js';
import { ix } from './ix.js';
import { relayPda } from './pdas.js';
import { send } from './tx.js';

const EXP = MARKETS[RELAY_ASSET].exponent;

export async function fetchGbpUsd() {
  const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=GBPUSD');
  const j = await r.json();
  const t = j.result && (j.result.ZGBPZUSD || Object.values(j.result)[0]);
  if (!t) throw new Error('no GBP/USD quote');
  const mid = (Number(t.a[0]) + Number(t.b[0])) / 2;
  return { price: mid, raw: Math.round(mid / 10 ** EXP), ts: Math.floor(Date.now() / 1000) };
}

export async function readRelay(er) {
  const a = await er.getAccountInfo(relayPda(RELAY_ASSET));
  return a ? decodeRelay(a.data) : null;
}

/// Push the current quote unless the relay was updated less than `minGapS` ago.
export async function pushOnce(er, relayer, { minGapS = 1 } = {}) {
  const cur = await readRelay(er);
  const now = Math.floor(Date.now() / 1000);
  if (cur && now - cur.ts < minGapS) return { skipped: true, raw: cur.raw, ts: cur.ts };
  const q = await fetchGbpUsd();
  const sig = await send(er, [ix.pushPrice(relayer.publicKey, RELAY_ASSET, BigInt(q.raw), BigInt(Math.max(q.ts, cur ? cur.ts : 0)))], [relayer], { label: 'push price', attempts: 1, tries: 20 });
  return { sig, raw: q.raw, ts: q.ts };
}
