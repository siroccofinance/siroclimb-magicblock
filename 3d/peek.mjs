// node peek.mjs <url> <outDir> : screenshots (desktop + mobile) and a layout dump of a page's first screen
import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
for (const [name, w, h, dpr] of [['desktop', 1440, 900, 1], ['mobile', 390, 844, 2]]) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36');
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('goto', e.message));
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(out, name + '.png') });
  await page.screenshot({ path: path.join(out, name + '-full.png'), fullPage: true });
  if (name === 'desktop') {
    const dump = await page.evaluate(() => {
      const res = [];
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < 1000; };
      for (const el of document.querySelectorAll('body *')) {
        if (!vis(el)) continue;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
        if (!own && !['VIDEO', 'IMG', 'svg', 'BUTTON', 'A', 'CANVAS', 'NAV', 'HEADER', 'SECTION'].includes(el.tagName)) continue;
        res.push(`${el.tagName} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] ${cs.fontFamily.split(',')[0]} ${cs.fontSize}/${cs.fontWeight} ls:${cs.letterSpacing} color:${cs.color} bg:${cs.backgroundColor} radius:${cs.borderRadius} | ${own.slice(0, 80)} ${el.tagName === 'VIDEO' ? (el.currentSrc || el.querySelector('source')?.src) + ' fit:' + cs.objectFit : ''}`);
      }
      return res.join('\n');
    });
    fs.writeFileSync(path.join(out, 'layout.txt'), dump);
  }
  await page.close();
}
await browser.close();
