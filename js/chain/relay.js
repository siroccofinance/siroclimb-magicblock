// xStock price relay. The xStocks trade around the clock, but MagicBlock's
// rollups carry no TSLAx, NVDAx, AAPLx or GMEx feed and Pyth's equity feeds
// stand still outside US hours, so the program keeps one relay account per
// xStock on the rollup that one named key pushes prices into (gasless).
//
// Source, all week, one per market so the price never jumps between venues:
// the mid of Kraken's xStock book (TSLAx/USD, NVDAx/USD, AAPLx/USD: tight
// books that tick through the night), or Jupiter's price of the Solana mint
// for GMEx (its Kraken book is thin and wide). The other venue is the sanity
// check: a price more than 1.5 % away from it (from Kraken's bid-ask range for
// GMEx) is not pushed, and neither is a market whose source did not answer;
// the relay then ages, and past MAX_PRICE_AGE the program treats the market
// as closed until a good price comes back.
// Pushed by api/relay.js (called by any browser while the game is open) and
// by the ops keeper. Pyth's Crypto.TSLAX/USD (Lazer 1847), NVDAX (1833),
// AAPLX (1792) would drop in here once MagicBlock carries them.
import { MARKETS, RELAY_ASSETS } from './config.js';
import { decodeRelay } from './codec.js';
import { ix } from './ix.js';
import { relayPda } from './pdas.js';
import { send } from './tx.js';

const MAX_GAP = 0.015;
const getJson = (u) => fetch(u, { signal: AbortSignal.timeout(2500) }).then((r) => r.json());

async function kraken() {
  const pairs = RELAY_ASSETS.map((a) => MARKETS[a].relay);
  const j = await getJson(`https://api.kraken.com/0/public/Ticker?pair=${pairs.join(',')}&asset_class=tokenized_asset`).catch(() => null);
  const out = {};
  for (const a of RELAY_ASSETS) {
    const t = j && j.result && j.result[MARKETS[a].relay];
    if (!t) continue;
    const bid = Number(t.b[0]), ask = Number(t.a[0]), mid = (bid + ask) / 2;
    if (bid > 0 && ask >= bid) out[a] = { mid, bid, ask, spread: (ask - bid) / mid };
  }
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
  const [k, jp] = await Promise.all([kraken(), jupiter()]);
  const ts = Math.floor(Date.now() / 1000), out = {};
  for (const a of RELAY_ASSETS) {
    const kq = k[a], jq = jp[a];
    let price, src;
    if (MARKETS[a].source === 'jupiter') {
      if (!jq || (kq && (jq < kq.bid * (1 - MAX_GAP) || jq > kq.ask * (1 + MAX_GAP)))) continue;
      price = jq; src = 'jupiter';
    } else {
      if (!kq || (jq && Math.abs(kq.mid / jq - 1) > MAX_GAP)) continue;
      price = kq.mid; src = 'kraken';
    }
    out[a] = { price, raw: Math.round(price / 10 ** MARKETS[a].exponent), ts, src };
  }
  return out;
}

export async function readRelays(er) {
  const accs = await er.getMultipleAccountsInfo(RELAY_ASSETS.map((a) => relayPda(a)));
  return Object.fromEntries(RELAY_ASSETS.map((a, i) => [a, accs[i] ? decodeRelay(accs[i].data) : null]));
}

/// Push the current prices (one rollup transaction for every xStock) unless
/// the relays were updated less than `minGapS` ago.
export async function pushOnce(er, relayer, { minGapS = 1 } = {}) {
  const cur = await readRelays(er);
  const now = Math.floor(Date.now() / 1000);
  const oldest = Math.min(...RELAY_ASSETS.map((a) => (cur[a] ? cur[a].ts : 0)));
  if (now - oldest < minGapS) return { skipped: true };
  const q = await fetchQuotes();
  const ixs = RELAY_ASSETS.filter((a) => q[a]).map((a) => ix.pushPrice(relayer.publicKey, a, BigInt(q[a].raw), BigInt(Math.max(q[a].ts, cur[a] ? cur[a].ts : 0))));
  if (!ixs.length) return { skipped: true, reason: 'no quotes' };
  const sig = await send(er, ixs, [relayer], { label: 'push prices', attempts: 1, tries: 20 });
  return { sig, prices: Object.fromEntries(Object.entries(q).map(([a, v]) => [MARKETS[a].id, `${v.price.toFixed(3)} ${v.src}`])) };
}
