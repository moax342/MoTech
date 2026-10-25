/* Regenerates the files derived from index.html:
     Mohammed-Altoum-CV.pdf        the "Download CV" PDF (via tools/cv.html)
     assets/favicon.ico            16/32/48 px monogram
     assets/apple-touch-icon.png   180 px monogram

   Run from the repository root after editing index.html:
     node tools/build-assets.js
   Needs Node 18+ and Playwright with Chromium (npm i -g playwright &&
   npx playwright install chromium). Nothing here ships to the site. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

/* Pulls the CV content out of the live English page. */
function extract() {
  /* <br> separates lines in a few fields; keep it as a separator. */
  const t = el => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('br').forEach(b => b.replaceWith(' · '));
    return c.textContent.replace(/\s+/g, ' ').trim();
  };
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];
  return {
    photo: new URL('assets/images/portrait.webp', location.href).href,
    name: t(document.querySelector('.hero h1')),
    role: t(document.querySelector('.hero-role')),
    contact: ['Baghdad, Iraq', 'mabdulla.alt@gmail.com',
      'linkedin.com/in/mohammed-abdallah28', 'github.com/moax342', 'English · Arabic'],
    summary: $$('.about-copy > p').map(t),
    jobs: $$('#experience .tl-card').map(c => ({
      title: t(c.querySelector('h3')),
      when: t(c.querySelector('.tl-period')),
      org: t(c.querySelector('.tl-org')),
      bullets: $$('.tl-list li', c).map(t),
    })),
    skills: $$('.stack-group').map(g => ({
      group: t(g.querySelector('h3')),
      items: [...$$('.stack-name', g), ...$$('.tag', g)].map(t),
    })),
    projects: $$('.project').map(p => ({
      title: t(p.querySelector('h3')), cat: t(p.querySelector('.p-cat')), text: t(p.querySelector('p')),
    })),
    edu: $$('.edu').map(e => ({
      title: t(e.querySelector('h3')),
      where: [t(e.querySelector('.meta')), t(e.querySelector('.meta-sub'))].filter(Boolean).join(' · '),
    })),
    certs: $$('.cert').map(c => ({
      title: t(c.querySelector('h3')), issuer: t(c.querySelector('.cert-issuer')), when: t(c.querySelector('.cert-when')),
    })),
  };
}

/* ICO container holding PNG frames (supported by every current browser). */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...pngs.map(p => p.buf)]);
}

const MONOGRAM = size => `<!DOCTYPE html><html><head><style>
@font-face{font-family:M;font-weight:800;src:url('/assets/fonts/manrope-latin.woff2') format('woff2')}
html,body{margin:0;background:transparent}
div{width:${size}px;height:${size}px;display:grid;place-items:center;background:#101214;color:#FF7A45;
  border-radius:${Math.round(size * (size >= 180 ? 0 : .2))}px;font:800 ${Math.round(size * .44)}px/1 M;letter-spacing:-.04em}
</style></head><body><div>MA</div></body></html>`;

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('lang', 'en'); } catch (e) {} });
    await page.goto(base, { waitUntil: 'networkidle' });
    const data = await page.evaluate(extract);

    const cv = await browser.newPage();
    await cv.goto(base + 'tools/cv.html', { waitUntil: 'networkidle' });
    await cv.evaluate(d => render(d), data);
    await cv.waitForLoadState('networkidle');
    await cv.evaluate(() => document.fonts.ready);
    await cv.pdf({ path: path.join(ROOT, 'Mohammed-Altoum-CV.pdf'), format: 'A4', printBackground: true,
      preferCSSPageSize: true, tagged: true, outline: true });

    const icon = await browser.newPage();
    const shot = async size => {
      await icon.setViewportSize({ width: size, height: size });
      /* Same origin so the font loads, but not index.html: its CSP would
         block the inline style below. */
      await icon.goto(base + 'tools/cv.html');
      await icon.setContent(MONOGRAM(size), { waitUntil: 'networkidle' });
      await icon.evaluate(() => document.fonts.ready);
      return { size, buf: await icon.screenshot({ omitBackground: true }) };
    };
    const frames = [];
    for (const s of [16, 32, 48]) frames.push(await shot(s));
    fs.writeFileSync(path.join(ROOT, 'assets/favicon.ico'), ico(frames));
    fs.writeFileSync(path.join(ROOT, 'assets/apple-touch-icon.png'), (await shot(180)).buf);
    console.log('Wrote Mohammed-Altoum-CV.pdf, assets/favicon.ico, assets/apple-touch-icon.png');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
