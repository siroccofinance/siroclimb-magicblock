// GET /api/change: each market's price 24 h ago, from Hyperliquid's hourly candles (the venue the relay
// prices from), Kraken's when Hyperliquid has none. The lobby divides the live relay price by it for the "24h" change. Cached at the edge for 60 s.
import { MARKETS, RELAY_ASSETS } from '../js/chain/config.js';

const DAY = 86400;

async function ref(pair, now) {
  const cls = /x[A-Z]*USD$/.test(pair) ? '&asset_class=tokenized_asset' : '';
  const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=60&since=${now - DAY - 4 * 3600}${cls}`, { signal: AbortSignal.timeout(4000) });
  const j = await r.json();
  if (!j || (j.error && j.error.length) || !j.result) return null;
  const rows = Object.entries(j.result).find(([k]) => k !== 'last')?.[1] || [];
  // the hourly candle open 24 h ago: its close is the price a day back
  const c = rows.filter((x) => x[0] <= now - DAY).at(-1);
  const p = c && Number(c[4]);
  return p > 0 && now - DAY - c[0] < 2 * 3600 ? { price: p, at: c[0] } : null;
}

async function refHl(coin, now) {
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: '1h', startTime: (now - DAY - 4 * 3600) * 1000, endTime: now * 1000 } }),
    signal: AbortSignal.timeout(4000) });
  const rows = await r.json();
  if (!Array.isArray(rows)) return null;
  const c = rows.filter((x) => x.t / 1000 <= now - DAY).at(-1);
  const p = c && Number(c.c);
  return p > 0 && now - DAY - c.t / 1000 < 2 * 3600 ? { price: p, at: c.t / 1000 } : null;
}

export default async function handler(req, res) {
  const now = Math.floor(Date.now() / 1000), out = {};
  await Promise.all(RELAY_ASSETS.map(async (a) => {
    const m = MARKETS[a];
    const r = (m.hl && await refHl(m.hl, now).catch(() => null)) || await ref(m.relay, now).catch(() => null);
    if (r) out[m.id] = r;
  }));
  res.setHeader('cache-control', Object.keys(out).length ? 'public, s-maxage=60, stale-while-revalidate=600' : 'no-store');
  res.statusCode = 200; res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ at: now, ref24h: out }));
}
