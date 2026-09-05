// Per-page verify harness for Oasis round 2 (ESM — frontend/ is "type":"module").
// Usage: node verify.js "<route>" ["<label>"]   e.g. node verify.js "" today | node verify.js "reservations"
// Env:   USR/PWD to log in as a specific role (default Front Desk).
// Logs in ONCE, then loops 1440/1024/768/390 x ar/en on one page. Captures
// desktop-ar, mobile-ar, desktop-en screenshots and reports overflow + console
// errors + final paths per config.
import { chromium } from "playwright";
import fs from "fs";

const BASE = "https://hotelpms.yemenfrappe.com", APP = "/hotelpms";
const route = process.argv[2] || "";
const label = (process.argv[3] || route || "index").replace(/[^A-Za-z0-9-]+/g, "_");
const USR = process.env.USR || "frontdesk@hotelpms.local", PWD = process.env.PWD || "HotelPMSDesk1!";
const OUTROOT = "/home/frappe/frappe-bench/apps/hotelpms/docs/design-reference/oasis-v2/implementation-round-2/after";
const viewports = [
  { w: 1440, h: 900, k: "desktop" },
  { w: 1024, h: 768, k: "laptop" },
  { w: 768, h: 1024, k: "tablet" },
  { w: 390, h: 844, k: "mobile" },
];
const langs = ["ar", "en"];
const shots = new Set(["desktop-ar", "mobile-ar", "desktop-en"]);
const benign = /socket\.io|get_quote|favicon/;
const target = BASE + APP + (route ? "/" + route : "");

const out = `${OUTROOT}/${label}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// log in once, on the login page (no authed fetch noise), in the page cookie jar
await page.goto(BASE + APP + "/login", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.evaluate(async ([usr, pwd]) => {
  try { await fetch("/api/method/logout", { method: "POST" }); } catch (e) {}
  const r = await fetch("/api/method/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "usr=" + encodeURIComponent(usr) + "&pwd=" + encodeURIComponent(pwd),
  });
  return r.status;
}, [USR, PWD]);

let errors = [];
page.on("console", (m) => { if (m.type() === "error" && !benign.test(m.text())) errors.push(m.text().slice(0, 140)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 140)));

const results = [];
for (const vp of viewports) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  for (const lang of langs) {
    await page.evaluate((l) => localStorage.setItem("hotelpms-lang", l), lang);
    errors = [];
    const tag = `${vp.k}-${lang}`;
    try {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2600);
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        dir: document.documentElement.getAttribute("dir"),
        finalPath: location.pathname,
      }));
      if (shots.has(tag)) await page.screenshot({ path: `${out}/${tag}.png`, fullPage: true });
      results.push({ tag, overflow: m.overflow, dir: m.dir, finalPath: m.finalPath, errors: [...errors] });
    } catch (e) {
      results.push({ tag, error: String(e).slice(0, 140), errors: [...errors] });
    }
  }
}
await browser.close();
fs.writeFileSync(`${out}/_report.json`, JSON.stringify(results, null, 2));
const overflow = results.filter((r) => r.overflow).map((r) => r.tag);
const withErr = results.filter((r) => (r.errors || []).length || r.error);
const paths = [...new Set(results.map((r) => r.finalPath).filter(Boolean))];
console.log("VERIFY", label, "route=/" + route, "as", USR.split("@")[0]);
console.log("  finalPaths:", paths.join(", "));
console.log("  overflow:", overflow.length ? overflow.join(", ") : "none");
console.log("  console-errors:", withErr.length ? JSON.stringify(withErr.map((r) => ({ t: r.tag, e: r.error, c: r.errors }))) : "none");
console.log("  dirs:", results.filter((r) => r.dir).map((r) => r.tag + "=" + r.dir).join(" "));
