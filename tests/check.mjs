// Automatic checks: runs each saved test job through the calculator and compares the results
// (pressures, approval, attachment, zone sheets, sheet layout strips) with tests/expected.json.
//   node tests/check.mjs            compare (exit 1 on any difference)
//   node tests/check.mjs --update   save the current results as the new expected results
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const JOBS = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/jobs.json"), "utf8"));
const EXP_FILE = path.join(ROOT, "tests/expected.json");
const UPDATE = process.argv.includes("--update");
const TYPES = {".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".txt":"text/plain",".pdf":"application/pdf",".png":"image/png",".svg":"image/svg+xml"};

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html");
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {"content-type": TYPES[path.extname(p)] || "application/octet-stream"}); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch(process.env.CHECK_PROXY ? {proxy:{server:process.env.CHECK_PROXY}} : {});
const ctx = await browser.newContext();
await ctx.route("**/*", r => { const u = r.request().url(); return u.startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort(); });   // only the site's own files

const results = {}, problems = [];
for (const [job, inputs] of Object.entries(JOBS)) {
  if (process.env.CHECK_VERBOSE) console.log("job", job);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(`http://127.0.0.1:${port}/index.html`); await pg.waitForFunction(() => typeof CALC !== "undefined" && CALC.book && document.getElementById("cf-B7"), null, {timeout: 90000});
  for (const [a, v] of inputs) {
    if (a === "POLY") { await pg.evaluate(P => { const r = CALC.roofs[CALC.active]; r.v.SHAPE = "From satellite outline"; r.v.POLY = JSON.stringify(P);
        const xs = P.map(p=>p[0]), ys = P.map(p=>p[1]); r.v.B11 = String(Math.max(...xs) - Math.min(...xs)); r.v.B12 = String(Math.max(...ys) - Math.min(...ys)); calcRenderForm(); calcSchedule(false); }, v);
      await pg.waitForTimeout(400); continue; }
    const r = await pg.evaluate(([a, v]) => {
      const el = document.getElementById("cf-" + a); if (!el) return "missing field";
      if (el.tagName === "SELECT") { const o = [...el.options].find(o => o.text.startsWith(v)); if (!o) return "option not found"; el.value = o.value; }
      else el.value = String(v);
      el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); return "";
    }, [a, v]);
    if (r) problems.push(`${job}: ${a} = "${v}": ${r}`);
    await pg.waitForTimeout(200);
  }
  await pg.waitForTimeout(6000);
  results[job] = await pg.evaluate(() => {
    const c = CALC.roofs[0].calc; if (!c) return {error: "no result"};
    const r1 = v => typeof v === "number" ? +v.toFixed(2) : v;
    const out = {press: (c.press||[]).map(row => row.map(r1)), appr: c.appr ? c.appr.sys + " " + c.appr.doc : null, approval: ((c.info||[]).find(p => p[0] === "Approval") || [])[1] || null, attach: JSON.parse(JSON.stringify(c.attach || null), (k, v) => r1(v))};
    try { const p = sheetPlan(c, c.planOpt || {}); if (!p) throw new Error("flute direction not entered");
      out.zoneSheets = [0,1,2,3].map(i => zoneSheet(p, i));
      out.strips = p.strips.map(s => [+s.u0.toFixed(1), +s.w.toFixed(2), s.perim ? 1 : 0, (s.segs || []).map(r => r.map(v => +v.toFixed(1)))]);
      out.emptyStrips = p.strips.filter(s => !(s.segs || [[0,1]]).length).length;
      out.legend = planLegend(p);
    } catch (e) { out.plan = "not drawn: " + (e.message || e); }
    return out;
  });
  if (errs.length) problems.push(`${job}: page error ${errs[0]}`);
  if (results[job].emptyStrips) problems.push(`${job}: ${results[job].emptyStrips} sheet(s) in the layout have no length on the roof`);
  await pg.close();
}
await browser.close(); server.close();

if (UPDATE) { fs.writeFileSync(EXP_FILE, JSON.stringify(results, null, 1)); console.log(`Saved expected results for ${Object.keys(results).length} jobs.`); }
else {
  const exp = JSON.parse(fs.readFileSync(EXP_FILE, "utf8"));
  for (const job of Object.keys(JOBS)) {
    const a = JSON.stringify(results[job]), b = JSON.stringify(exp[job]);
    if (a !== b) {
      for (const k of new Set([...Object.keys(results[job]||{}), ...Object.keys(exp[job]||{})]))
        if (JSON.stringify((results[job]||{})[k]) !== JSON.stringify((exp[job]||{})[k]))
          problems.push(`${job}: ${k} changed\n   expected ${JSON.stringify((exp[job]||{})[k]).slice(0, 300)}\n   got      ${JSON.stringify((results[job]||{})[k]).slice(0, 300)}`);
    }
  }
  console.log(`Checked ${Object.keys(JOBS).length} jobs.`);
}
if (problems.length) { console.log("PROBLEMS:\n" + problems.join("\n")); process.exit(1); }
console.log("All results match.");
