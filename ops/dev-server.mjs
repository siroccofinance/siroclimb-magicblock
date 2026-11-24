// Local dev server: the static site plus the serverless faucet route, on one
// port (default 3042). The faucet key comes from ~/.config/siroclimb/
// (faucet.json) unless already in the environment.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KEY_DIR } from './lib/env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3042);
for (const [env, file] of [['FAUCET_SECRET_KEY', 'faucet.json']]) {
  const f = path.join(KEY_DIR, file);
  if (!process.env[env] && fs.existsSync(f)) process.env[env] = fs.readFileSync(f, 'utf8').trim();
}
const routes = { '/api/faucet': (await import('../api/faucet.js')).default };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4', '.json': 'application/json', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (routes[url.pathname]) return routes[url.pathname](req, res);
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
  const stat = fs.statSync(file), type = TYPES[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = Number(range[1] || 0), end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`siroclimb dev server on http://127.0.0.1:${PORT}`));
