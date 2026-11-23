// node fonts.mjs <url>... : computed fonts of headings/body + @font-face sources
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
for (const url of process.argv.slice(2)) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('goto', e.message));
  await new Promise(r => setTimeout(r, 2500));
  const info = await page.evaluate(() => {
    const out = new Map();
    for (const el of document.querySelectorAll('h1,h1 *,h2,p,a,button,nav *,span,em,i')) {
      const r = el.getBoundingClientRect(); if (r.top > 900 || !r.width) continue;
      const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim(); if (!t) continue;
      const cs = getComputedStyle(el);
      const k = `${cs.fontFamily} | ${cs.fontSize} ${cs.fontWeight} ${cs.fontStyle} ls:${cs.letterSpacing} lh:${cs.lineHeight} tt:${cs.textTransform}`;
      if (!out.has(k)) out.set(k, `${el.tagName}: ${t.slice(0, 40)}`);
    }
    const faces = [];
    for (const f of document.fonts) faces.push(`${f.family} ${f.weight} ${f.style} ${f.status}`);
    return { styles: [...out].map(([k, v]) => `${v}  ->  ${k}`), faces: [...new Set(faces)] };
  });
  console.log('=====', url); console.log(info.styles.join('\n')); console.log('-- faces:', info.faces.join(' ; '));
  await page.close();
}
await browser.close();
