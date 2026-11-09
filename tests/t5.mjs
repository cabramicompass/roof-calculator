import { chromium } from "playwright"; import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT="/home/claude/roof-calculator";
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html"); if (!fs.existsSync(p)||fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200); fs.createReadStream(p).pipe(res); }).listen(0);
const port = server.address().port; const b = await chromium.launch(); const pg = await b.newPage();
pg.on("pageerror", e=>console.log("ERR", String(e).slice(0,200)));
await pg.route("**/*", r => r.request().url().startsWith(`http://127.0.0.1:${port}/`) ? r.continue() : r.abort());
await pg.goto(`http://127.0.0.1:${port}/index.html`); await pg.waitForFunction(() => typeof CALC !== "undefined" && CALC.book && document.getElementById("cf-B7"), null, {timeout: 90000});
const set = async (a,v)=>pg.evaluate(([a, v]) => { const el = document.getElementById("cf-" + a); if (el.tagName === "SELECT") { const o = [...el.options].find(o => o.text.startsWith(v)); el.value = o.value; } else el.value = String(v); el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); }, [a,v]);
for(const [a,v] of [["B7","Palm Beach"],["G14","FBC TPO"],["G6","Mechanically"],["G7","Steel"],["FLUTE","Length"],["G8","New"],["F9","22"]]){ await set(a,v); await pg.waitForTimeout(150); }
const shapes = {L1:[[0,0],[420,0],[420,180],[300,180],[300,260],[0,260]], L2:[[0,0],[560,0],[560,240],[380,240],[380,330],[0,330]], U:[[0,0],[500,0],[500,300],[330,300],[330,150],[170,150],[170,300],[0,300]], T:[[0,0],[600,0],[600,120],[380,120],[380,350],[220,350],[220,120],[0,120]]};
for(const h of [22, 30, 38]) for(const [n,P] of Object.entries(shapes)){
  await set("B10", h); await pg.evaluate(P => { const r = CALC.roofs[CALC.active]; r.v.SHAPE = "From satellite outline"; r.v.POLY = JSON.stringify(P); r.v.B11 = String(Math.max(...P.map(p=>p[0]))); r.v.B12 = String(Math.max(...P.map(p=>p[1]))); calcRenderForm(); calcSchedule(false); }, P);
  await pg.waitForTimeout(3500);
  const r = await pg.evaluate(() => { const c = CALC.roofs[0].calc; if(!c) return "no calc"; const f = c.zoneXY; const cnt = p => p.rows.filter(x=>x.extra).reduce((s,x)=>s + (x.v1-x.v0), 0);
    const p1 = sheetPlan(c, c.planOpt||{}); const a = p1 ? cnt(p1) : -1; Object.defineProperty(c,"zoneXY",{value:null,writable:true,configurable:true}); const p0 = sheetPlan(c, c.planOpt||{}); const b = p0 ? cnt(p0) : -1; c.zoneXY = f; return {exactFt: Math.round(a), gridFt: Math.round(b), fingers: p1 ? p1.rows.filter(x=>x.extra).length : 0}; });
  console.log(h, n, JSON.stringify(r));
}
await b.close(); server.close();
