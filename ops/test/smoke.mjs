// Load the real front against devnet in headless Chrome: no page errors,
// prices flowing, burner wallet connect + onboarding.
import puppeteer from 'puppeteer-core';
const URL = process.env.APP_URL || 'http://127.0.0.1:3042/';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message); });
pg.on('console', (c) => ['error', 'warning'].includes(c.type()) && console.log('CONSOLE', c.text()));
await pg.setViewport({ width: 1440, height: 900 });
await pg.goto(URL + '#play', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 4000));
console.log('screen', await pg.evaluate(() => document.body.dataset.screen));
console.log('markets', await pg.$$eval('.market', (els) => els.map((e) => e.textContent.trim())));
await pg.screenshot({ path: 'out/smoke-lobby.png' });
await b.close();
console.log(errs.length ? 'FAIL' : 'OK');
