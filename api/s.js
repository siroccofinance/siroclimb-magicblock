// GET /s/<token> (rewritten to /api/s?t=<token>, a token of about 30 characters): the shared climb's page. Link previews read its
// summary_large_image card; people are sent on to the game.
import { originOf, describe, headline, verify } from './_share.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export default function handler(req, res) {
  const t = new URL(req.url, 'http://x').searchParams.get('t') || '';
  let c = null;
  try { c = verify(t); } catch { c = null; }
  const o = originOf(req), play = `${o}/#play`;
  if (!c) { res.statusCode = 302; res.setHeader('location', play); return res.end(); }
  const d = describe(c), title = `${headline(c)} | Siroclimb`;
  const desc = `${d.eyebrow}: ${d.ret} at up to ${d.top} on ${d.ticker} ${d.side}. Climb live stock and gold prices, fully on-chain on a MagicBlock Ephemeral Rollup.`;
  const img = `${o}/c/${t}.png`, url = `${o}/s/${t}`;
  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=86400');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Siroclimb">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}">
<meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(headline(c))}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}"><meta name="twitter:image:alt" content="${esc(headline(c))}">
<meta name="theme-color" content="#c2552d">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#c2552d;font:500 16px Inter,system-ui,sans-serif;color:#fff}main{width:min(720px,92vw);text-align:center}img{width:100%;border-radius:16px;box-shadow:0 30px 60px -30px rgba(43,20,10,.7)}a{display:inline-block;margin-top:24px;padding:16px 28px;border-radius:10px;background:linear-gradient(#f2c94c,#e6b25c);color:#2b211a;font-weight:600;text-decoration:none}</style>
<script>setTimeout(function(){location.replace(${JSON.stringify(play)})},1200)</script>
</head><body><main><img src="${esc(img)}" alt="${esc(headline(c))}"><br><a href="${esc(play)}">Play Siroclimb</a></main></body></html>`);
}
