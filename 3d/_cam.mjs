import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core';
const root = process.cwd(); const out = process.argv[2]; const cams = JSON.parse(process.argv[3]); const theme = process.argv[4] || 'noir'; const t = +(process.argv[5] || 0);
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => { const p = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage(); pg.on('pageerror', e => console.log('ERR', e.message)); await pg.setViewport({ width: 720, height: 540 });
await pg.goto(`http://localhost:${server.address().port}/scene.html?w=720&h=540&framing=ref&grain=0&vignette=0&theme=${theme}&scene=${process.env.SCENE||'escalator'}`);
await pg.waitForFunction('window.ready === true'); fs.mkdirSync(out, { recursive: true });
for (const [i, c] of cams.entries()) {
  const url = await pg.evaluate((c, t) => { const s = window.__s; window.__escP = c.esc || null; if (s.cam) { s.cam.p.set(...c.p); s.cam.l.set(...c.l); s.cam.up.set(...(c.up||[0,1,0])); s.placeCamera(); } else { s.camera.position.set(...c.p); s.camera.lookAt(...c.l); } if (c.fov) { s.camera.fov = c.fov; s.camera.updateProjectionMatrix(); } return window.renderFrame(t * 30, 30, 1); }, c, t);
  fs.writeFileSync(path.join(out, `c${i}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
await b.close(); server.close();
