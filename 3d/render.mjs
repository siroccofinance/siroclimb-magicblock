// node render.mjs <outDir> <frames: 0-119 | 0,30,66> [w] [h] [subs] [framing] [grain] [vignette]  -> PNG frames
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const [out = 'frames', spec = '0-119', w = 1440, h = 1080, subs = 6, framing = 'center', grain = 0, vignette = 0.8, theme = 'noir', backdrop = '', sceneName = 'stairs'] = process.argv.slice(2);
const frames = spec.includes('-') ? (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(spec.split('-').map(Number)) : spec.split(',').map(Number);
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.setViewport({ width: +w, height: +h });
await page.goto(`http://localhost:${port}/scene.html?w=${w}&h=${h}&framing=${framing}&grain=${grain}&vignette=${vignette}&theme=${theme}&backdrop=${backdrop}&scene=${sceneName}`);
await page.waitForFunction('window.ready === true', { timeout: 30000 });
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
for (const f of frames) {
  const url = await page.evaluate((f, s) => window.renderFrame(f, 30, s), f, +subs);
  fs.writeFileSync(path.join(out, `f_${String(f).padStart(4, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  if (f % 30 === 0) console.log(`frame ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
await browser.close();
server.close();
