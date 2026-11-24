// GET /api/card?t=<token>: the result card as a 1200 x 630 PNG (the og:image of a shared climb).
import { cardPng, verify } from './_share.js';

export default async function handler(req, res) {
  try {
    const t = new URL(req.url, 'http://x').searchParams.get('t');
    const c = verify(t);
    if (!c) { res.statusCode = 404; return res.end('unknown card'); }
    const png = await cardPng(c);
    res.statusCode = 200;
    res.setHeader('content-type', 'image/png');
    res.setHeader('cache-control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.end(png);
  } catch (e) {
    res.statusCode = e.code || 500; res.end(String(e.message || e).slice(0, 200));
  }
}
