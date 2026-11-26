// The cron's price stream: Hyperliquid's trade.xyz best bid and offer over a WebSocket (`bbo`: every change of
// the top of the book, no REST rate limit); the top-of-book microprice is recomputed on every message and
// pushed into the rollup's relay accounts on every change (checked every 40 ms; all changed markets in one
// transaction; one send in flight, always with the latest values, so they land in order). The
// Solana quotes follow every 10 s. A market whose book has gone quiet on the socket for 5 s is priced by the
// REST path instead (microprice, then mid, then Kraken), and Jupiter's price stays the band check.
import { MARKETS, RELAY_ASSETS } from '../js/chain/config.js';
import { Transaction } from '@solana/web3.js';
import { ix } from '../js/chain/ix.js';
import { fetchQuotes, jupiterPrices, microprice, pushSolanaQuotes } from '../js/chain/relay.js';

/// A rollup push sent and not awaited (pushes are 250 ms apart, so they land in order; the program refuses
/// one with an older timestamp anyway). The blockhash is refreshed every 20 s.
function fastSender(er, relayer) {
  let bh = null, bhAt = 0;
  return async (raws, ts) => {
    if (!bh || Date.now() - bhAt > 20000) { bh = (await er.getLatestBlockhash('confirmed')).blockhash; bhAt = Date.now(); }
    const tx = new Transaction().add(...Object.entries(raws).map(([a, raw]) => ix.pushPrice(relayer.publicKey, Number(a), BigInt(raw), BigInt(ts))));
    tx.feePayer = relayer.publicKey; tx.recentBlockhash = bh; tx.sign(relayer);
    return er.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
  };
}

const PUSH_MS = 40, QUOTES_S = 10, STALE_MS = 5000, BAND = 0.03;

// one feed per market: the top-of-book microprice, recomputed on every bbo message (every change of the best
// bid or ask, about seven a second on NVDA)
async function openSocket(on) {
  const WS = globalThis.WebSocket || (await import('ws')).default;
  const ws = new WS('wss://api.hyperliquid.xyz/ws');
  ws.onopen = () => {
    for (const a of RELAY_ASSETS) {
      const coin = MARKETS[a].hl; if (!coin) continue;
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'bbo', coin } }));
    }
  };
  ws.onmessage = (ev) => {
    try {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()), d = m.data;
      if (m.channel === 'bbo' && d && d.bbo) on(d.coin, 'm1', microprice({ levels: [[d.bbo[0]], [d.bbo[1]]] }));
    } catch {}
  };
  return ws;
}
export async function stream(er, base, relayer, ms) {
  const end = Date.now() + ms, byCoin = Object.fromEntries(RELAY_ASSETS.map((a) => [MARKETS[a].hl, a]));
  const live = {}, pushed = {}, stats = { books: 0, pushes: 0, errors: 0, rest: 0, changes: {}, sent: {} };
  const sendFast = fastSender(er, relayer);
  let jup = {}, jupAt = 0, restAt = 0, quotesAt = 0, inflight = 0, quotesBusy = false, lastTs = 0;
  let ws = null;
  const connect = async () => { try { ws = await openSocket((coin, kind, v) => {
    const a = byCoin[coin]; if (a == null || !(v > 0)) return;
    const p = v;
    stats.books++; if (!live[a] || live[a].raw !== Math.round(p / 10 ** MARKETS[a].exponent)) stats.changes[MARKETS[a].id] = (stats.changes[MARKETS[a].id] || 0) + 1;
    live[a] = { raw: Math.round(p / 10 ** MARKETS[a].exponent), at: Date.now() };
  }); ws.onclose = () => { ws = null; }; } catch { ws = null; } };
  await connect();
  while (Date.now() < end) {
    const t = Date.now();
    if (!ws && t < end - 3000) await connect();
    if (t - jupAt > 30000) { jupAt = t; jupiterPrices().then((j) => { jup = j; }).catch(() => {}); }
    // markets quiet on the socket: the REST path, every 2 s
    const quiet = RELAY_ASSETS.filter((a) => !live[a] || t - live[a].at > STALE_MS);
    if (quiet.length && t - restAt > 2000) {
      restAt = t; stats.rest++;
      fetchQuotes().then((q) => { for (const a of quiet) if (q[a] && (!live[a] || Date.now() - live[a].at > STALE_MS)) live[a] = { raw: q[a].raw, at: Date.now() - STALE_MS + 2500, rest: true }; }).catch(() => {});
    }
    const raws = {};
    for (const a of RELAY_ASSETS) {
      const v = live[a]; if (!v || v.raw === pushed[a]) continue;
      const price = v.raw * 10 ** MARKETS[a].exponent, j = jup[a];
      if (j && Math.abs(price / j - 1) > BAND) continue;   // out of Jupiter's band: not pushed
      raws[a] = v.raw; stats.sent[MARKETS[a].id] = (stats.sent[MARKETS[a].id] || 0) + 1;
    }
    const now = Math.max(lastTs, Math.floor(t / 1000));
    if (Object.keys(raws).length && inflight < 1) {   // one at a time: two in the same second could land out of order
      inflight++; lastTs = now; Object.assign(pushed, raws);
      sendFast(raws, now).then(() => { stats.pushes++; }).catch(() => { stats.errors++; for (const a in raws) if (pushed[a] === raws[a]) delete pushed[a]; }).finally(() => { inflight--; });
    }
    if (!quotesBusy && now - quotesAt >= QUOTES_S && Object.keys(pushed).length) {
      quotesBusy = true; quotesAt = now;
      pushSolanaQuotes(base, relayer, { ...pushed }, now).catch(() => { quotesAt = 0; }).finally(() => { quotesBusy = false; });
    }
    await new Promise((r) => setTimeout(r, Math.max(0, PUSH_MS - (Date.now() - t))));
  }
  try { ws && ws.close(); } catch {}
  return stats;
}
