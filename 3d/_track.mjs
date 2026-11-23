// stairs-game stills: node _track.mjs outDir w h "t,t,..." end(cash|bust|none) endAt
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core';
const root = process.cwd(); const [out, w, h, tls, end = 'none', endAt = '99'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => { const p = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage(); pg.on('pageerror', e => console.log('ERR', e.message)); pg.on('console', m => console.log('LOG', m.text()));
await pg.setViewport({ width: +w, height: +h });
await pg.goto(`http://localhost:${server.address().port}/scene.html?w=${w}&h=${h}&framing=site&grain=0&vignette=0&theme=terracotta-gloss&scene=escalator`);
await pg.waitForFunction('window.ready === true'); fs.mkdirSync(out, { recursive: true });
await pg.evaluate((end, endAt) => {
  const s = window.__s, pl = s.planLaunch(1.7 * s.SPEED, 1.7);
  // scripted price path, in steps
  const L = t => t < 1.2 ? 0 : t < 2 ? 1 : t < 2.8 ? 2 : t < 3.6 ? 1 : t < 4.6 ? 4 : t < 5.6 ? 5 : t < 6.6 ? 2 : t < 7.4 ? 1 : 2;
  window.__T = s.createTrack(pl); window.__now = 0; window.__end = end; window.__endAt = endAt; window.__L = L;
}, end, +endAt);
const list = tls.split(',').map(Number);
for (const [i, t] of list.entries()) {
  const url = await pg.evaluate(t => {
    const s = window.__s, T = window.__T;
    while (window.__now < t - 1e-6) { const dt = Math.min(1 / 120, t - window.__now); window.__now += dt;
      if (window.__end !== 'none' && !T.end && window.__now >= window.__endAt) s.trackEnd(T, window.__end);
      s.trackStep(T, dt, window.__L(window.__now)); }
    s.trackPose(T, window.__now, 0); s.draw(); return s.renderer.domElement.toDataURL('image/png');
  }, t);
  fs.writeFileSync(path.join(out, `t_${String(i).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
console.log(JSON.stringify(await pg.evaluate(() => ({ end: window.__T.end, y: window.__T.y }))));
await b.close(); server.close();
