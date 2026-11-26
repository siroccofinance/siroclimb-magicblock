// POST /api/relay: push the xStocks' 24/7 prices (TSLAx, NVDAx, AAPLx, MSTRx, and XAUt for gold) into the
// program's relay accounts on the rollup (gasless). Called by browsers while
// the game is open, and by the keeper; pushes at most about once a second.
// Vercel's cron calls it every minute and it then keeps pushing every second for
// 55 s, so the prices stay live with nobody on the site. The same pushes keep
// the Solana quotes (what positions open at) under 10 s old.
// Needs RELAYER_SECRET_KEY (JSON array of the relay keypair, server-side only).
import { Keypair } from '@solana/web3.js';
import { baseConnection, erConnection } from './_lib.js';
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
    if (/vercel-cron/.test(String(req.headers['user-agent'] || ''))) {
      // one push a second on the clock, not after the previous one lands (at most two in flight;
      // a late one carrying an older timestamp is refused by the program, never written over a newer price)
      const end = Date.now() + 55000, er = erConnection(), base = baseConnection(), busy = new Set(); let n = 0, err = 0;
      while (Date.now() < end) {
        const t = Date.now();
        if (busy.size < 2) {
          const p = pushOnce(er, relayer, { minGapS: 0, base }).then((o) => { if (o.sig) n++; }).catch(() => { err++; }).finally(() => busy.delete(p));
          busy.add(p);
        }
        last = Date.now();
        await new Promise((r) => setTimeout(r, Math.max(0, 1000 - (Date.now() - t))));
      }
      await Promise.all(busy);
      res.statusCode = 200; return res.end(JSON.stringify({ cron: true, pushes: n, errors: err }));
    }
    if (Date.now() - last < 700) { res.statusCode = 200; return res.end(JSON.stringify({ skipped: true })); }
    last = Date.now();
    const out = await pushOnce(erConnection(), relayer, { minGapS: 1, base: baseConnection() });
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: String(e.message || e).slice(0, 200) }));
  }
}
