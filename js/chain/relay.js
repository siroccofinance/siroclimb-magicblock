// Price relay. Every market trades around the clock, but MagicBlock's rollups
// carry no TSLAx, NVDAx, AAPLx or MSTRx feed, Pyth's equity feeds stand still
// outside US hours and Pyth's XAU/USD closes on weekends, so the program keeps
// one relay account per market on the rollup that one named key pushes prices
// into (gasless). Gold is priced as XAUt (Tether Gold), which trades 24/7.
//
// Source, all week: the mid of Hyperliquid's trade.xyz perp (xyz:TSLA, NVDA, AAPL,
// MSTR, GOLD), which trades 24/7 and keeps ticking when the xStock books stand still
// (US holidays, nights). Kraken's mid (TSLAx/USD, NVDAx/USD, AAPLx/USD, MSTRx/USD,
// XAUt/USD) only when Hyperliquid fails or has no price for the market (logged). A market may also
// take Jupiter's price of its Solana mint (`source: 'jupiter'`), eased in. The
// other venue is the sanity check: a price more than 1.5 % away from it (from
// Kraken's bid-ask range for a Jupiter-priced market) is not pushed, and neither
// is a market whose source did not answer; the relay then ages, and past
// MAX_PRICE_AGE the program treats the market as closed until a good price
// comes back.
// Pushed by api/relay.js (called by any browser while the game is open) and
// by the ops keeper. Pyth's Crypto.TSLAX/USD (Lazer 1847), NVDAX (1833),
// AAPLX (1792) would drop in here once MagicBlock carries them.
import { MARKETS, RELAY_ASSETS } from './config.js';
import { decodeQuotes, decodeRelay } from './codec.js';
import { ix } from './ix.js';
import { quotesPda, relayPda } from './pdas.js';
import { send } from './tx.js';

const MAX_GAP = 0.015;
const HL_GAP = 0.03;   // Hyperliquid's perp vs Jupiter's token price: a looser band (a perp is not the token)
const getJson = (u) => fetch(u, { signal: AbortSignal.timeout(1500) }).then((r) => r.json());

async function kraken() {
  // the xStock pairs are a separate asset class on Kraken (one call each kind; XAUt/USD is a plain pair)
  const pairs = RELAY_ASSETS.map((a) => MARKETS[a].relay);
  const xs = pairs.filter((p) => /x[A-Z]*USD$/.test(p)), plain = pairs.filter((p) => !xs.includes(p));
  const q = (list, cls) => (list.length ? getJson(`https://api.kraken.com/0/public/Ticker?pair=${list.join(',')}${cls}`).catch(() => null) : null);
  const [jx, jp] = await Promise.all([q(xs, '&asset_class=tokenized_asset'), q(plain, '')]);
  const result = { ...((jx && jx.result) || {}), ...((jp && jp.result) || {}) };
  const out = {};
  for (const a of RELAY_ASSETS) {
    const t = result[MARKETS[a].relay];
    if (!t) continue;
    const bid = Number(t.b[0]), ask = Number(t.a[0]), mid = (bid + ask) / 2;
    if (bid > 0 && ask >= bid) out[a] = { mid, bid, ask, spread: (ask - bid) / mid };
  }
  return out;
}
async function hyperliquid() {
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'allMids', dex: 'xyz' }), signal: AbortSignal.timeout(1500) }).then((x) => x.json()).catch(() => null);
  const out = {};
  for (const a of RELAY_ASSETS) { const v = r && MARKETS[a].hl ? Number(r[MARKETS[a].hl]) : 0; if (v > 0) out[a] = v; }
  return out;
}
async function jupiter() {
  const j = await getJson(`https://lite-api.jup.ag/price/v3?ids=${RELAY_ASSETS.map((a) => MARKETS[a].mainnetMint).join(',')}`).catch(() => null);
  const out = {};
  for (const a of RELAY_ASSETS) { const p = j && j[MARKETS[a].mainnetMint]; if (p && p.usdPrice > 0) out[a] = p.usdPrice; }
  return out;
}

/// The relayed xStocks' prices now: { asset: { price, raw, ts, src } }.
export async function fetchQuotes() {
  const [k, jp, hl] = await Promise.all([kraken(), jupiter(), hyperliquid()]);
  const ts = Math.floor(Date.now() / 1000), out = {};
  for (const a of RELAY_ASSETS) {
    const kq = k[a], jq = jp[a];
    let price, src;
    if (MARKETS[a].source === 'jupiter') {
      if (!jq || (kq && (jq < kq.bid * (1 - MAX_GAP) || jq > kq.ask * (1 + MAX_GAP)))) continue;
      price = jq; src = 'jupiter';
    } else {
      const h = hl[a];
      if (h && !(jq && Math.abs(h / jq - 1) > HL_GAP)) { price = h; src = 'hl'; }
      else {
        if (!kq || (jq && Math.abs(kq.mid / jq - 1) > MAX_GAP)) continue;
        price = kq.mid; src = 'kraken';
        console.log(`[relay] ${MARKETS[a].id}: Kraken fallback (${h ? `Hyperliquid ${h} is ${((h / jq - 1) * 100).toFixed(2)} % from Jupiter` : 'no Hyperliquid mid'})`);
      }
    }
    out[a] = { price, raw: Math.round(price / 10 ** MARKETS[a].exponent), ts, src };
  }
  return out;
}

export async function readRelays(er) {
  const accs = await er.getMultipleAccountsInfo(RELAY_ASSETS.map((a) => relayPda(a)));
  return Object.fromEntries(RELAY_ASSETS.map((a, i) => [a, accs[i] ? decodeRelay(accs[i].data) : null]));
}

/// Push the current prices (one rollup transaction for every market) unless the relays were updated less
/// than `minGapS` ago. With `base`, also push them on Solana (the quotes positions open at) when those are
/// older than `quoteGapS`: a Solana transaction, so about every 10 s rather than every second.
export async function pushOnce(er, relayer, { minGapS = 1, base = null, quoteGapS = 10 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const [cur, qa] = await Promise.all([readRelays(er), base ? base.getAccountInfo(quotesPda()).catch(() => null) : null]);
  const oldest = Math.min(...RELAY_ASSETS.map((a) => (cur[a] ? cur[a].ts : 0)));
  const quotesDue = !!(base && qa && now - decodeQuotes(qa.data).ts >= quoteGapS);
  if (now - oldest < minGapS && !quotesDue) return { skipped: true };
  const q = await fetchQuotes();
  // Jupiter's price hops between routes (a few tenths of a percent): ease it from
  // the price on chain, a third of the way per push, at most 0.15 % a second
  for (const a of RELAY_ASSETS) {
    if (!q[a] || q[a].src !== 'jupiter' || !cur[a] || !cur[a].raw || now - cur[a].ts > 30) continue;
    const step = Math.max(-0.0015, Math.min(0.0015, (q[a].raw / cur[a].raw - 1) / 3));
    q[a].raw = Math.round(cur[a].raw * (1 + step)); q[a].price = q[a].raw * 10 ** MARKETS[a].exponent;
  }
  const out = { prices: Object.fromEntries(Object.entries(q).map(([a, v]) => [MARKETS[a].id, `${v.price.toFixed(3)} ${v.src}`])) };
  const jobs = [];
  if (now - oldest >= minGapS) {
    const ixs = RELAY_ASSETS.filter((a) => q[a]).map((a) => ix.pushPrice(relayer.publicKey, a, BigInt(q[a].raw), BigInt(Math.max(q[a].ts, cur[a] ? cur[a].ts : 0))));
    if (ixs.length) jobs.push(send(er, ixs, [relayer], { label: 'push prices', attempts: 1, tries: 20 }).then((sig) => { out.sig = sig; }));
  }
  if (quotesDue) {
    // a market whose source did not answer keeps its last quote (0 = unchanged on chain)
    const prices = MARKETS.map((m, a) => (q[a] ? BigInt(q[a].raw) : 0n));
    jobs.push(send(base, [ix.pushQuotes(relayer.publicKey, prices, BigInt(now))], [relayer], { label: 'push quotes', attempts: 1, tries: 40 }).then((sig) => { out.quotes = sig; }));
  }
  await Promise.all(jobs);
  if (!out.sig && !out.quotes) return { skipped: true, reason: 'no quotes' };
  return out;
}
