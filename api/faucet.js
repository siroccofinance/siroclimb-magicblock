// POST /api/faucet { address }: a little devnet SOL for a wallet that has none,
// so a new player (or the built-in burner) can approve their first transaction.
// Needs FAUCET_SECRET_KEY (JSON array, server-side only). Refuses wallets that
// already hold SOL and wallets it funded in the last 24 h (checked from the
// faucet's own recent transactions, so it holds across serverless instances).
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { baseConnection, readJson } from './_lib.js';
import { send } from '../js/chain/tx.js';

/// Enough for the onboarding (session key top-up and rents) and one more top-up later.
const AMOUNT = 0.15e9;
const ENOUGH = 0.05e9;
const perIp = new Map();

export default async function handler(req, res) {
  const out = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
  try {
    if (req.method !== 'POST') return out(405, { error: 'POST only' });
    if (!process.env.FAUCET_SECRET_KEY) return out(503, { error: 'faucet not configured' });
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0];
    const hits = (perIp.get(ip) || []).filter((t) => Date.now() - t < 3600e3);
    const local = /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(ip);
    if (hits.length >= 5 && !local) return out(429, { error: 'too many requests' });
    perIp.set(ip, [...hits, Date.now()]);
    const { address } = await readJson(req);
    const to = new PublicKey(address);
    const conn = baseConnection();
    if ((await conn.getBalance(to)) >= ENOUGH) return out(200, { skipped: 'enough SOL already' });
    const faucet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.FAUCET_SECRET_KEY)));
    const recent = await conn.getSignaturesForAddress(faucet.publicKey, { limit: 200 });
    const day = Date.now() / 1000 - 86400;
    for (const s of recent.filter((x) => (x.blockTime || 0) > day).slice(0, 60)) {
      const t = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null);
      const keys = t ? t.transaction.message.staticAccountKeys || t.transaction.message.accountKeys : [];
      if (keys.some((k) => k.equals(to))) return out(429, { error: 'funded in the last 24 h' });
    }
    const sig = await send(conn, [SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: to, lamports: AMOUNT })], [faucet], { label: 'faucet' });
    out(200, { sig, lamports: AMOUNT });
  } catch (e) {
    out(400, { error: String(e.message || e).slice(0, 200) });
  }
}
