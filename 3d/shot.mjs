// node shot.mjs <dir> <outDir> : screenshots of <dir>/index.html (video + live, desktop + mobile)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core';
const [dir, out] = process.argv.slice(2);
const root = path.resolve(dir);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
fs.mkdirSync(out, { recursive: true });
for (const [name, w, h, q] of [['desktop-video', 1440, 900, ''], ['desktop-live', 1440, 900, '?live'], ['mobile-video', 390, 844, ''], ['mobile-live', 390, 844, '?live']]) {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log(name, '[pageerror]', e.message));
  page.on('console', m => m.type() === 'error' && console.log(name, '[console]', m.text()));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: w < 500 ? 2 : 1 });
  await page.goto(base + q, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: w < 500 });
  await page.close();
}
await browser.close(); server.close();
