// POST /api/relay: push the xStocks' 24/7 prices (TSLAx, NVDAx, AAPLx, GMEx) into the
// program's relay accounts on the rollup (gasless). Called by browsers while
// the game is open, and by the keeper; pushes at most about once a second.
// Needs RELAYER_SECRET_KEY (JSON array of the relay keypair, server-side only).
import { Keypair } from '@solana/web3.js';
import { erConnection } from './_lib.js';
import { pushOnce } from '../js/chain/relay.js';

let relayer = null;
let last = 0;

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json');
  try {
    if (!relayer) {
      if (!process.env.RELAYER_SECRET_KEY) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'relay not configured' })); }
      relayer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.RELAYER_SECRET_KEY)));
    }
    if (Date.now() - last < 700) { res.statusCode = 200; return res.end(JSON.stringify({ skipped: true })); }
    last = Date.now();
    const out = await pushOnce(erConnection(), relayer, { minGapS: 1 });
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: String(e.message || e).slice(0, 200) }));
  }
}
