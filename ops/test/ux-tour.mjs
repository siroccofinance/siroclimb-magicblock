// Screens of the real front for a UX review (out/ux-*.png): landing, lobby,
// wallet chooser (a fake injected wallet makes it appear), wallet menu,
// closed markets (the page's clock moved to a Saturday), faucet, mobile.
import puppeteer from 'puppeteer-core';
const URL = process.env.APP_URL || 'http://127.0.0.1:3042/';
const exe = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
async function page(b, { w = 1440, h = 900, mobile = false, init } = {}) {
  const pg = await b.newPage();
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  if (init) await pg.evaluateOnNewDocument(init);
  return pg;
}
const shot = (pg, n) => pg.screenshot({ path: `out/ux-${n}.png` });

const b = await puppeteer.launch({ userDataDir: 'out/chrome-profile', executablePath: exe, headless: 'new' });
// 1. landing and lobby, connected burner
let pg = await page(b);
await pg.goto(URL, { waitUntil: 'networkidle2' }); await wait(2500); await shot(pg, '1-landing');
await pg.goto(URL + '#play', { waitUntil: 'networkidle2' }); await wait(3500); await shot(pg, '2-lobby');
await pg.click('#wallet'); await wait(1500); await shot(pg, '3-wallet-menu');
await pg.click('#wallet'); await pg.click('#mode [data-v=round]'); await wait(1200); await shot(pg, '4-round-lobby');
await pg.close();
// 2. closed markets: the page believes it is Saturday noon in New York
pg = await page(b, { init: () => { const real = Date.now, shift = Date.parse('2026-11-28T17:00:00Z') - real(); Date.now = () => real() + shift; const D = Date; globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [D.now()])); } static now() { return D.now(); } }; } });
await pg.goto(URL + '#play', { waitUntil: 'networkidle2' }); await wait(3500); await shot(pg, '5-closed-markets');
await pg.close();
// 3. a visitor with a browser wallet: the chooser
const b2 = await puppeteer.launch({ executablePath: exe, headless: 'new' });
pg = await page(b2, { init: () => { window.phantom = { solana: { isPhantom: true, connect: () => new Promise(() => {}), signTransaction: async (t) => t } }; } });
await pg.goto(URL + '#play', { waitUntil: 'networkidle2' }); await wait(2500);
if (await pg.$('.sheet:not([hidden]) .sheet__ok')) await pg.click('.sheet__ok');
await wait(600); await pg.click('#wallet'); await wait(900); await shot(pg, '6-wallet-chooser');
await b2.close();
// 4. mobile
pg = await page(b, { w: 390, h: 844, mobile: true });
await pg.goto(URL + '#play', { waitUntil: 'networkidle2' }); await wait(3500); await shot(pg, '7-mobile-lobby');
await pg.click('#wallet'); await wait(1200); await shot(pg, '8-mobile-menu');
await b.close();
console.log(errs.length ? `errors: ${errs.join(' | ')}` : 'OK, 0 page errors');
