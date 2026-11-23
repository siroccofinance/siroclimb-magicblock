import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core';
const [root, out, W = 1440, H = 900, tag = 'i'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const p = path.join(root, u); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } const st = fs.statSync(p); const t = types[path.extname(p)] || 'application/octet-stream'; const range = q.headers.range;
  if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const s = +a, e = b ? +b : st.size - 1; r.writeHead(206, { 'content-type': t, 'content-range': `bytes ${s}-${e}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 }); fs.createReadStream(p, { start: s, end: e }).pipe(r); }
  else { r.writeHead(200, { 'content-type': t, 'content-length': st.size }); fs.createReadStream(p).pipe(r); } }).listen(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage(); pg.on('pageerror', e => console.log('ERR', e.message)); pg.on('console', c => ['error', 'warning'].includes(c.type()) && console.log('CONSOLE', c.text()));
const mob = +W < 768; await pg.setViewport({ width: +W, height: +H, isMobile: mob, hasTouch: mob });
const wait = ms => new Promise(r => setTimeout(r, ms)), shot = n => pg.screenshot({ path: `${out}/${tag}-${n}.png` });
const base = `http://localhost:${srv.address().port}/`;
await pg.goto(base + '?mock', { waitUntil: 'networkidle2' }); await wait(3200);
console.log('state', JSON.stringify(await pg.evaluate(() => ({ screen: document.body.dataset.screen, live: !!document.querySelector('canvas.is-live'), film: document.querySelector('#film').paused }))));
await shot('0intro');
const t0 = Date.now(); await pg.click('#startPlaying');
for (let i = 0; i < 14; i++) { const ms = Date.now() - t0; await shot('s' + String(i).padStart(2, '0')); console.log('s' + i, ms); }
await b.close(); srv.close();
