// The real front against devnet + the rollup, in headless Chrome, from an
// empty burner wallet: site faucet SOL, one-approval onboarding, a solo climb
// cashed out, explorer proof links; FLOW=pack plays a leverage pack, FLOW=menu
// the wallet menu. Screenshots in out/.
import puppeteer from 'puppeteer-core';
const URL = process.env.APP_URL || 'http://127.0.0.1:3042/';
const FLOW = process.env.FLOW || 'solo';
// The burner lives in the browser profile: reuse it between runs (FRESH=1 starts from an empty wallet).
const profileDir = process.env.FRESH ? undefined : 'out/chrome-profile';
const b = await puppeteer.launch({ userDataDir: profileDir, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => { errs.push(e.message); console.log('ERR', e.message); });
pg.on('console', (c) => { if (c.type() === 'error') { errs.push(c.text()); console.log('CONSOLE', c.text()); } });
await pg.setViewport({ width: 1440, height: 900 });
await pg.evaluateOnNewDocument(() => { window.SIROCLIMB_DEBUG = true; });
pg.on('console', (c) => { if (c.type() === 'log' && c.text().startsWith('[siroclimb]')) console.log('   ', c.text()); });
await pg.exposeFunction('__toast', (t) => console.log('    toast:', t));
await pg.evaluateOnNewDocument(() => {
  let last = ''; new MutationObserver(() => { const t = document.getElementById('toast'); if (t && t.textContent && t.textContent !== last) { last = t.textContent; window.__toast(last); } })
    .observe(document, { subtree: true, childList: true, characterData: true });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const say = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const scr = () => pg.evaluate(() => document.body.dataset.screen);
const text = (s) => pg.$eval(s, (e) => e.textContent.trim()).catch(() => '');
async function until(fn, ms = 60000, label = '') {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await fn()) return true; await wait(250); }
  throw new Error('timeout ' + label);
}
await pg.goto(URL + '#play', { waitUntil: 'networkidle2' });
await wait(2500);
if (await pg.$('.sheet:not([hidden]) .sheet__ok')) await pg.click('.sheet__ok');
await wait(800);
// an open market
const open = await pg.$$eval('.market', (els) => els.filter((e) => !e.classList.contains('is-closed')).map((e) => e.dataset.v));
say('open markets', open.join(' '));
await pg.click(`.market[data-v="${process.env.MARKET && open.includes(process.env.MARKET) ? process.env.MARKET : open[0]}"]`);
await pg.screenshot({ path: 'out/ui-1lobby.png' });
const connected = /^\w{4}…\w{4}$/.test(await text('#wallet'));
const byMenu = FLOW === 'menu' || FLOW === 'reserve';
if (!(byMenu && connected)) await pg.click(byMenu ? '#wallet' : '#go');
// no browser wallet in headless Chrome: the burner is the only choice, picked directly
await wait(800);
if (await pg.$('#walletSheet:not([hidden])')) { await pg.screenshot({ path: 'out/ui-2wallets.png' }); await pg.click('#walletList [data-w=burner]'); }
say('burner, onboarding…');
if (FLOW === 'menu') {
  // connect from the wallet button, then the menu: handle, session, rename on chain
  await until(async () => /^\w{4}…\w{4}$/.test(await text('#wallet')), 90000, 'connected');
  await pg.click('#wallet'); await wait(1500);
  say('who', await text('#walletWho'));
  const handle = 'climber' + Math.floor(Math.random() * 900 + 100);
  pg.once('dialog', (d) => d.accept(handle));
  await pg.click('[data-act=name]');
  await until(async () => (await text('#toast')).includes(handle), 30000, 'renamed');
  await pg.click('#wallet'); await wait(800);
  say('renamed', await text('#walletWho'));
  await pg.screenshot({ path: 'out/ui-6menu.png' });
} else if (FLOW === 'reserve') {
  // the Sirocco Reserve panel: stats, lend 25 tUSDC, withdraw everything
  await until(async () => /^\w{4}…\w{4}$/.test(await text('#wallet')), 90000, 'connected');
  await pg.click('[data-open=reserve]');
  await until(async () => /TVL/.test(await text('#resStats')), 30000, 'reserve stats');
  say('reserve', (await pg.$$eval('#resStats div', (d) => d.map((x) => x.textContent))).join(' | '));
  const bal0 = await text('#bal');
  await pg.$eval('#resAmt', (e) => { e.value = '25'; });
  await pg.click('#resDeposit');
  await until(async () => /You lend/.test(await text('#resMe')), 60000, 'deposit');
  say('after deposit', await text('#resMe'), '| balance', bal0, '->', await text('#bal'));
  await pg.screenshot({ path: 'out/ui-7reserve.png' });
  await pg.$eval('#resAmt', (e) => { e.value = '1000'; });
  await pg.click('#resWithdraw');
  await until(async () => /nothing lent/.test(await text('#resMe')), 60000, 'withdraw');
  say('after withdraw', await text('#resMe'), '| balance', await text('#bal'));
} else if (FLOW === 'pack') {
  // a first climb onboards the burner; then the pack: VRF draw, free climb on the house
  await until(async () => (await scr()) === 'game', 90000, 'game screen');
  await wait(3000); await pg.click('#cash');
  await until(async () => (await scr()) === 'result', 30000, 'result');
  await pg.click('#again'); await wait(1500);
  await until(() => pg.$('#packBtn:not([hidden])'), 10000, 'pack button');
  await pg.click('#packBtn'); await wait(600);
  await pg.click('#packGo');
  await until(async () => /Play the/.test(await text('#packGo')), 60000, 'pack drawn');
  say('pack', await text('#packGo'), '|', await text('.pack__tiers .is-won'));
  await pg.screenshot({ path: 'out/ui-5pack.png' });
  await pg.click('#packGo');
  await until(async () => (await scr()) === 'game', 60000, 'pack climb');
  say('pack climb, ladder top', await pg.$$eval('#gTicks li', (l) => l[l.length - 1].textContent));
  await wait(5000); await pg.click('#cash');
  await until(async () => (await scr()) === 'result', 30000, 'pack result');
  say('pack result', await text('#rV'));
} else if (FLOW === 'solo') {
  await until(async () => (await scr()) === 'game', 90000, 'game screen');
  say('climbing', await text('#hT'), await text('#hP'));
  await wait(9000);
  await pg.screenshot({ path: 'out/ui-3game.png' });
  say('pnl', await text('#pV'), 'lev', await text('#pL'), '|', await text('#pB'));
  await pg.click('#cash');
  await until(async () => (await scr()) === 'result', 30000, 'result');
  say('result', await text('#rE'), await text('#rV'), '|', (await pg.$$eval('#rS div', (d) => d.map((x) => x.textContent))).slice(-2).join(' | '));
  await until(async () => (await pg.$$('#rProof a')).length >= 4, 30000, 'proof links');
  say('proof', (await pg.$$eval('#rProof a', (as) => as.map((a) => a.textContent))).join(' | '));
  await pg.screenshot({ path: 'out/ui-4result.png' });
  say('balance', await text('#bal'));
}
await b.close();
say(errs.length ? `FAIL ${errs.length} console errors` : 'OK, 0 console errors');
process.exit(errs.length ? 1 : 0);
