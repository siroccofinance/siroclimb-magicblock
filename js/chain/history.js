// Recent price history straight from the rollup, keyless: every update of a
// price account is a rollup transaction, so the last minute of a market is in
// its signature list. MagicBlock's oracle posts `update_price_feed` (borsh
// `UpdateData`: symbol = the Lazer id, timestamp in ns, quantized price i128);
// our xStock relay posts `push_price(price i64, publish_ts i64)`, one per market.
import { Buffer } from 'buffer';
import { MARKETS, PRICE_ORACLE_PROGRAM_ID, PROGRAM_ID } from './config.js';
import { encodeIx } from './codec.js';

const PUSH = encodeIx('push_price', { price: 0, publish_ts: 0 }).subarray(0, 8);

function readString(d, o) { const n = d.readUInt32LE(o); return [d.subarray(o + 4, o + 4 + n).toString('utf8'), o + 4 + n]; }

/// One oracle update instruction → { id, price (raw), ms } (null if not one).
export function decodeOracleUpdate(data) {
  const d = Buffer.from(data);
  if (d.length < 60) return null;
  try {
    let o = 8;
    const [provider, o1] = readString(d, o); o = o1;
    if (provider !== 'pyth-lazer') return null;
    const [symbol, o2] = readString(d, o); o = o2;
    o += 32; // id
    const ns = d.readBigUInt64LE(o); o += 8;
    const lo = d.readBigUInt64LE(o), hi = d.readBigInt64LE(o + 8);
    return { id: symbol, raw: Number((hi << 64n) + lo), ms: Number(ns / 1_000_000n) };
  } catch { return null; }
}

export function decodeRelayPush(data) {
  const d = Buffer.from(data);
  if (d.length !== 24 || !d.subarray(0, 8).equals(PUSH)) return null;
  return { raw: Number(d.readBigInt64LE(8)), ms: Number(d.readBigInt64LE(16)) * 1000 };
}

async function batch(endpoint, calls) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: '2.0', id, ...c }))) });
  const j = await r.json();
  return (Array.isArray(j) ? j : [j]).sort((a, b) => a.id - b.id).map((x) => x.result);
}

/// The last `seconds` of a market from the rollup, about `points` ticks, oldest first.
export async function recentPrices(er, asset, { seconds = 90, points = 60 } = {}) {
  const m = MARKETS[asset];
  const sigs = await er.getSignaturesForAddress(m.feedKey, { limit: 1000 });
  const from = Date.now() / 1000 - seconds;
  const recent = sigs.filter((s) => !s.err && s.blockTime && s.blockTime >= from);
  const step = Math.max(1, Math.floor(recent.length / points));
  const picked = recent.filter((_, i) => i % step === 0).slice(0, points);
  if (!picked.length) return [];
  const txs = await batch(er.rpcEndpoint, picked.map((s) => ({ method: 'getTransaction', params: [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }] })));
  const out = [];
  for (const tx of txs) {
    if (!tx) continue;
    const keys = tx.transaction.message.accountKeys;
    for (const ins of tx.transaction.message.instructions) {
      const program = keys[ins.programIdIndex];
      const data = decodeBase58(ins.data);
      if (m.relay) {
        // one push transaction carries the three relays: keep this market's
        if (program !== PROGRAM_ID.toBase58() || keys[ins.accounts[1]] !== m.feed) continue;
        const p = decodeRelayPush(data);
        if (p) out.push({ price: p.raw * 10 ** m.exponent, ts: (tx.blockTime || 0) * 1000 });
      } else {
        if (program !== PRICE_ORACLE_PROGRAM_ID.toBase58()) continue;
        const u = decodeOracleUpdate(data);
        if (u && u.id === String(m.lazerId) && u.raw > 0) out.push({ price: u.raw * 10 ** m.exponent, ts: u.ms });
      }
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function decodeBase58(s) {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of s) { if (c === '1') bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}
