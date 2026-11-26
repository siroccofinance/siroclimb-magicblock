// POST /api/share { player }: the player's last settled climb, read from Solana, as a signed share link
// (/s/<token>) whose page shows the result card (/api/card?t=<token>) in the post. 202 while the climb settles.
import { readJson } from './_lib.js';
import { originOf, settledClimb, sign } from './_share.js';

export default async function handler(req, res) {
  const out = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
  try {
    if (req.method !== 'POST') return out(405, { error: 'POST only' });
    const { player } = await readJson(req);
    const token = sign(await settledClimb(player)), o = originOf(req);
    out(200, { url: `${o}/s/${token}`, image: `${o}/c/${token}.png` });
  } catch (e) {
    // still settling: 202, the client asks again (not an error)
    out(e.code === 409 ? 202 : e.code || 400, { pending: e.code === 409, error: String(e.message || e).slice(0, 200) });
  }
}
