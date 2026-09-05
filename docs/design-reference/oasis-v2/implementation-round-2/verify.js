// Per-page verify harness for Oasis round 2.
// Usage: node verify.js "<route>" ["<label>"]     e.g. node verify.js "" today   |   node verify.js "reservations"
// Env:   USR/PWD to log in as a specific role (default Hotel Admin gm@).
// Captures 1440-ar, 390-ar, 1440-en screenshots into after/<label>/, and reports
// overflow + console errors for every viewport x language.
const { chromium } = require('/home/frappe/frappe-bench/apps/hotelpms/frontend/node_modules/playwright');
const fs = require('fs');
const BASE = 'https://hotelpms.yemenfrappe.com', APP = '/hotelpms';
const route = process.argv[2] || '';
const label = (process.argv[3] || route || 'index').replace(/[^A-Za-z0-9-]+/g, '_');
const USR = process.env.USR || 'gm@hotelpms.local', PWD = process.env.PWD || 'HotelPMSDesk1!';
const OUTROOT = '/home/frappe/frappe-bench/apps/hotelpms/docs/design-reference/oasis-v2/implementation-round-2/after';
const viewports = [
  { w: 1440, h: 900, k: 'desktop' },
  { w: 1024, h: 768, k: 'laptop' },
  { w: 768, h: 1024, k: 'tablet' },
  { w: 390, h: 844, k: 'mobile' },
];
const langs = ['ar', 'en'];
const shots = new Set(['desktop-ar', 'mobile-ar', 'desktop-en']);
const benign = /socket\.io|get_quote|favicon/;

(async () => {
  const out = `${OUTROOT}/${label}`;
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  for (const vp of viewports) {
    for (const lang of langs) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      await ctx.addInitScript((l) => { try { localStorage.setItem('hotelpms-lang', l); } catch (e) {} }, lang);
      await ctx.request.post(BASE + '/api/method/login', { form: { usr: USR, pwd: PWD } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error' && !benign.test(m.text())) errors.push(m.text().slice(0, 120)); });
      page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 120)));
      const tag = `${vp.k}-${lang}`;
      try {
        await page.goto(BASE + APP + (route ? '/' + route : ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2600);
        const m = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          dir: document.documentElement.getAttribute('dir'),
          finalPath: location.pathname,
          w: document.documentElement.clientWidth,
          sw: document.documentElement.scrollWidth,
        }));
        if (shots.has(tag)) await page.screenshot({ path: `${out}/${tag}.png`, fullPage: true });
        results.push({ tag, overflow: m.overflow, dir: m.dir, finalPath: m.finalPath, w: m.w, sw: m.sw, errors });
      } catch (e) {
        results.push({ tag, error: String(e).slice(0, 120), errors });
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(`${out}/_report.json`, JSON.stringify(results, null, 2));
  const overflow = results.filter((r) => r.overflow).map((r) => r.tag);
  const withErr = results.filter((r) => (r.errors || []).length || r.error);
  console.log('VERIFY', label, 'route=/' + route);
  console.log('  overflow:', overflow.length ? overflow.join(', ') : 'none');
  console.log('  console-errors:', withErr.length ? JSON.stringify(withErr.map((r) => ({ t: r.tag, e: r.error, c: r.errors }))) : 'none');
  console.log('  dirs:', results.filter(r=>r.dir).map((r) => r.tag + '=' + r.dir).join(' '));
})();
