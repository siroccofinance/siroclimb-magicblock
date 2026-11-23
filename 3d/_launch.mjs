// renders the click→launch animation as stills: node _launch.mjs outDir w h time0 "tl,tl,..." [theme]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core';
const root = process.cwd(); const [out, w, h, t0, tls, theme = 'terracotta-gloss'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => { const p = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage(); pg.on('pageerror', e => console.log('ERR', e.message)); pg.on('console', m => m.type() === 'error' && console.log('CONSOLE', m.text()));
await pg.setViewport({ width: +w, height: +h });
await pg.goto(`http://localhost:${server.address().port}/scene.html?w=${w}&h=${h}&framing=site&grain=0&vignette=0&theme=${theme}&scene=escalator`);
await pg.waitForFunction('window.ready === true'); fs.mkdirSync(out, { recursive: true });
const list = tls.split(',').map(Number);
for (const [i, tl] of list.entries()) {
  const url = await pg.evaluate((t0, tl) => { const s = window.__s; const pl = s.planLaunch(t0 * s.SPEED, t0); const r = s.launchPose(pl, tl); s.draw(); window.__r = r; return s.renderer.domElement.toDataURL('image/png'); }, +t0, tl);
  fs.writeFileSync(path.join(out, `l_${String(i).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
console.log(JSON.stringify(await pg.evaluate(() => window.__r)));
await b.close(); server.close();
