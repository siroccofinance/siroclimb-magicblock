// node export-svg.mjs <outDir>  -> vector SVG stills of the hero (desktop + mobile) and PNG previews
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || 'vector';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${server.address().port}/vector.html`);
await page.waitForFunction('window.ready === true');
fs.mkdirSync(out, { recursive: true });
const jobs = [['sirocco-hero-1920x1080', 1920, 1080, 'hero'], ['sirocco-hero-mobile-1080x1350', 1080, 1350, 'mobile']];
for (const [name, w, h, framing] of jobs) {
  const svg = await page.evaluate((w, h, fr) => window.exportSVG(0.35, w, h, fr), w, h, framing);
  const file = path.join(out, name + '.svg');
  fs.writeFileSync(file, svg);
  const p2 = await browser.newPage();
  await p2.setViewport({ width: w, height: h });
  await p2.setContent(`<style>body{margin:0}</style>${svg}`);
  await p2.screenshot({ path: path.join(out, name + '.preview.png') });
  await p2.close();
  console.log(name, (svg.length / 1024).toFixed(0) + ' KB');
}
await browser.close(); server.close();
