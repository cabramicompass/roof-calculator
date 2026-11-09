/* Workspace view: rearranges the calculator's existing sections into a top bar + three panels.
   Nothing is rebuilt: the same inputs, maps and tables are moved into the panels, so every calculation
   and download works exactly as before. "Classic view" (in the More menu) switches back, remembered per computer. */
(function(){
  const KEY = "csg-view";
  const view = (()=>{ try{ return localStorage.getItem(KEY) || "workspace"; }catch(e){ return "workspace"; } })();
  const setView = v => { try{ localStorage.setItem(KEY, v); }catch(e){} location.reload(); };
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  function archiveLetterTab(){
    // assembly letter request: archived (kept working, reachable from the More menu)
    const b = document.querySelector('.ptabs [data-go="2"]'); if(b) b.hidden = true;
  }
  function goTab(t){ const b = document.querySelector(`.ptabs [data-go="${t}"]`); if(b) b.click(); }

  if(view === "classic"){
    document.addEventListener("DOMContentLoaded", ()=>{
      archiveLetterTab();
      const sw = el("button", "ws-switch", "Switch to workspace view"); sw.type = "button"; sw.onclick = ()=>setView("workspace"); document.body.appendChild(sw);
    });
    return;
  }

  function build(){
    archiveLetterTab();
    document.body.classList.add("ws");
    const wrap = document.querySelector(".wrap");

    /* ---- top bar ---- */
    const top = el("div", "ws-top");
    top.innerHTML = `
      <div class="ws-brand"><img class="ws-logo" src="img/compass_h.png" alt="Compass Sales Group"><span class="ws-sep"></span>Roof Calculator</div>
      <span class="ws-sep"></span>
      <div class="ws-job"><b id="wsJob">New job</b><span id="wsJobSub"></span></div>
      <div class="ws-seg" role="tablist" aria-label="Sections"><button type="button" class="on" data-ws-go="1">Calculator</button><button type="button" data-ws-go="3">Submittal</button></div>
      <div class="ws-actions">
        <button type="button" class="ws-btn primary" id="wsSum">Summary PDF</button>
        <div class="ws-more"><button type="button" class="ws-btn" id="wsMoreBtn" aria-haspopup="true" aria-expanded="false">More</button>
          <div class="ws-menu" id="wsMenu" hidden>
            <button type="button" id="wsNew">New job</button>
            <a href="https://github.com/cabramicompass/roof-calculator/issues/new?template=problem.md" target="_blank" rel="noopener">Report a problem</a>
            <small>Archived</small>
            <button type="button" id="wsAlr">Assembly letter request</button>
            <small>View</small>
            <button type="button" id="wsClassic">Switch to classic view</button>
          </div></div>
      </div>`;
    document.body.insertBefore(top, document.body.firstChild);

    /* ---- three panels ---- */
    const body = el("div", "ws-body");
    const left = el("aside", "ws-panel ws-left"); left.setAttribute("aria-label", "Inputs");
    const mid = el("main", "ws-panel ws-mid");
    const right = el("aside", "ws-panel ws-right"); right.setAttribute("aria-label", "Results");
    body.append(left, mid, right);
    const step1 = document.querySelector('section.step[data-ptab="1"]');
    step1.parentNode.insertBefore(body, step1);
    step1.hidden = true; step1.dataset.ptab = "x";   // emptied below; kept so nothing else breaks

    // left: roofs + the three input groups as numbered sections, one open at a time
    left.appendChild(el("div", "ws-h", "Roofs"));
    const tools = document.querySelector("#calcUI .ctools"); if(tools) left.appendChild(tools);
    const sec = (n, title, nodes, open) => {
      const d = el("details", "ws-sec"); if(open) d.open = true;
      d.innerHTML = `<summary><span class="n">${n}</span><span class="t"><span>${title}</span><span class="s" data-sum></span></span></summary>`;
      const box = el("div", "ws-in"); nodes.filter(Boolean).forEach(x=>box.appendChild(x)); d.appendChild(box);
      d.addEventListener("toggle", ()=>{ if(d.open) left.querySelectorAll("details.ws-sec").forEach(o=>{ if(o !== d) o.open = false; }); });
      left.appendChild(d); return d;
    };
    const fs = id => { const f = $(id); return f ? f.closest("fieldset") : null; };
    const apLab = $("apSel") ? $("apSel").closest("label") : null;
    const S1 = sec(1, "Job and contractor", [fs("calcJob"), apLab], true);
    const S2 = sec(2, "This roof", [fs("calcRoof")], false);
    const S3 = sec(3, "Assembly", [fs("calcAsmIn"), $("calcSpec")], false);
    { const go = el("button", "ws-btn ws-find", "Find this roof on the map"); go.type = "button"; go.onclick = ()=>show("roof"); S2.querySelector(".ws-in").prepend(go); }

    // middle: status line, tabs, one view at a time
    const tabs = el("div", "ws-tabs"); tabs.setAttribute("role", "tablist");
    const status = el("div", "ws-status"); if($("calcStatus")) status.appendChild($("calcStatus"));
    const viewBox = el("div", "ws-view");
    mid.append(tabs, status, viewBox);
    const V = [
      ["roof", "Find roof", [$("calcGeo")]],
      ["plan", "Sheet layout", [$("calcTrace"), $("calcPlan")]],
      ["zones", "Assembly", [$("calcZones"), $("calcDraw"), $("calcAsm")]],
      ["appr", "Approval & warranty", [$("calcTop"), $("calcWar")]],
      ["sum", "Summary Sheet Generator", [$("roofList"), document.querySelector(".sumh"), $("sumWrap"), document.querySelector(".rbottom")]],
    ];
    let current = (()=>{ try{ return localStorage.getItem("csg-ws-tab") || "roof"; }catch(e){ return "roof"; } })();
    const noRoofYet = () => { try{ const r = CALC.roofs[CALC.active]; return !(r && r.v && +r.v.B11 > 0); }catch(e){ return true; } };
    V.forEach(([k, label, nodes])=>{
      const b = el("button", "", label); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.k = k; tabs.appendChild(b);
      const pane = el("div"); pane.dataset.v = k; nodes.filter(Boolean).forEach(x=>pane.appendChild(x)); viewBox.appendChild(pane);
      b.onclick = ()=>show(k);
    });
    function show(k){
      current = k; try{ localStorage.setItem("csg-ws-tab", k); }catch(e){}
      tabs.querySelectorAll("button").forEach(b=>{ b.classList.toggle("on", b.dataset.k === k); b.setAttribute("aria-selected", b.dataset.k === k); });
      viewBox.querySelectorAll("[data-v]").forEach(p=>p.classList.toggle("on", p.dataset.v === k));
      if(k === "roof" && typeof GEO !== "undefined"){ GEO.open = true; if(GEO.map) setTimeout(()=>GEO.map.invalidateSize(), 50); if(typeof geoRender === "function") geoRender(); }
    }
    show(current);
    setTimeout(()=>{ if(noRoofYet()) show("roof"); }, 1500);   // a job with no roof yet starts on the map
    // after an outline is used: show the sheet layout and open the next section that still needs input
    document.addEventListener("geo:used", ()=>{ show("plan"); setTimeout(()=>{ const next = [S1, S2, S3].find(d=>d.querySelector("label.f.need")) || S3; next.open = true; }, 600); });
    // the old loading message sits in step 1: keep it visible in the middle until the calculator is ready
    const loading = $("calcLoading"); if(loading){ viewBox.insertBefore(loading, viewBox.firstChild); }
    const ui = $("calcUI"); if(ui){ body.appendChild(ui); ui.style.display = "none"; }   // its pieces were moved out above

    /* ---- top bar actions ---- */
    const seg = top.querySelectorAll("[data-ws-go]");
    seg.forEach(b=>b.onclick = ()=>{ seg.forEach(x=>x.classList.toggle("on", x === b)); const t = b.dataset.wsGo;
      document.body.classList.toggle("ws-sub3", t !== "1"); goTab(t === "1" ? "1" : t); if(t === "1"){ document.querySelectorAll('section.step[data-ptab="1"]').forEach(s=>s.hidden = true); } });
    $("wsSum").onclick = ()=>{ const b = $("calcSumBtn"); if(b) b.click(); show("sum"); };
    const menu = $("wsMenu"), mb = $("wsMoreBtn");
    mb.onclick = e=>{ e.stopPropagation(); menu.hidden = !menu.hidden; mb.setAttribute("aria-expanded", !menu.hidden); };
    document.addEventListener("click", e=>{ if(!menu.hidden && !menu.contains(e.target)){ menu.hidden = true; mb.setAttribute("aria-expanded", "false"); } });
    $("wsClassic").onclick = ()=>setView("classic");
    $("wsNew").onclick = ()=>{ menu.hidden = true; const b = $("jobNew"); if(b) b.click(); };
    $("wsAlr").onclick = ()=>{ menu.hidden = true; seg.forEach(x=>x.classList.remove("on")); document.body.classList.add("ws-sub3"); goTab("2"); };

    /* ---- right panel: live results ---- */
    const card = (h, inner) => `<section class="ws-card"><div class="ws-h" style="margin:0 0 8px">${h}</div>${inner}</section>`;
    const ZC = ["#F2F2F2", "#FBE3D3", "#DDEDD2", "#D2D2D2"];
    function results(){
      if(typeof CALC === "undefined" || !CALC.roofs){ right.innerHTML = card("Results", `<div class="ws-empty">Loading calculator…</div>`); return; }
      const r = CALC.roofs[CALC.active] || {}, c = r.calc, v = r.v || {};
      const proj = (c && c.project) || v.B6 || "";
      $("wsJob").textContent = proj || "New job";
      $("wsJobSub").textContent = (CALC.roofs.length > 1 ? `Roof ${CALC.active + 1} of ${CALC.roofs.length}` : "1 roof") + (v.B5 ? " · " + v.B5 : "");
      const inf = k => c ? (((c.info || []).find(p => p[0] === k) || [])[1] || "") : "";
      const infoW = inf("Wind speed"), infoL = inf("Length x width") || (v.B11 && v.B12 ? `${v.B11}' x ${v.B12}'` : ""), infoH = inf("Mean roof height") || (v.B10 ? v.B10 + " ft" : "");
      // short summaries on the closed input sections
      const sumOf = (d, txt) => { const s = d.querySelector("[data-sum]"), need = d.querySelectorAll("label.f.need").length;
        if(s) s.textContent = need ? need + " to fill in" : txt; d.dataset.done = (txt && !need) ? "1" : ""; d.dataset.need = need ? "1" : ""; };
      sumOf(S1, [v.B7, infoW.replace(/ -.*$/, ""), v.B8 ? "Exp. " + v.B8 : ""].filter(Boolean).join(" · "));
      sumOf(S2, [infoL, infoH].filter(Boolean).join(" · "));
      sumOf(S3, [c && c.system || v.G6, c && c.deck || v.G7].filter(Boolean).join(" · "));
      if(!c){ right.innerHTML = card("Results", `<div class="ws-empty">Fill in the job, roof and assembly on the left. Results show here as you type.</div>`); return; }
      const info = k => ((c.info || []).find(p => p[0] === k) || [])[1] || "";
      const appr = info("Approval");
      let html = card("Approval", appr && appr !== "—" ? `<div class="ws-big">${esc(appr.split(/\s+–\s+|\s+-\s+/)[0])}</div><div class="ws-sub">${esc(appr.split(/\s+–\s+/).slice(1).join(" – "))}</div>` : `<div class="ws-empty">No approval picked yet. Open "Approval & warranty" to pick one.</div>`);
      const P = (c.press || []).slice(1, 5);
      if(P.length) html += card("Design uplift (ASD, psf)", `<div class="ws-zones">${P.map((p, i)=>`<div class="ws-zone" style="background:${ZC[i]}"><div>${esc(String(p[0]).replace(/ \(.*\)/, ""))}</div><div>${esc(p[3])}</div></div>`).join("")}</div>
        <div class="ws-sub" style="margin-top:8px">${esc(info("Wind speed"))}</div>`);
      const A = (c.attach || []).slice(1, 5);
      if(A.length) html += card("Attachment", A.map(a=>`<div class="ws-row"><span>${esc(String(a[0]).replace(/ \(.*\)/, ""))}</span><b>${esc([a[3], a[5]].filter(x=>x && !/^n\/a/i.test(x)).join(" · ") || a[2] || "")}</b></div>`).join(""));
      const war = $("calcWar"), wr = war ? [...war.querySelectorAll("tr")].find(tr=>/^\s*System allowed/i.test((tr.cells[0]||{}).textContent||"")) : null, first = wr && wr.cells[1] ? wr.cells[1].textContent.trim() : "";
      if(first) html += card("Carlisle warranty", `<div class="ws-pill ${/^yes/i.test(first) ? "ok" : /^no/i.test(first) ? "bad" : "mid"}">${esc(first)}</div>`);
      html += card("Roof", `<div class="ws-row"><span>Size</span><b>${esc(String(info("Length x width")).replace(/^From satellite outline,\s*A\s*([\d.]+)'?,\s*B\s*([\d.]+)'?/i, "$1' x $2' outline"))}</b></div><div class="ws-row"><span>Area</span><b>${esc(info("Total roof area"))}</b></div><div class="ws-row"><span>Height</span><b>${esc(info("Mean roof height"))}</b></div>`);
      right.innerHTML = html;
    }
    let t = null; const later = ()=>{ clearTimeout(t); t = setTimeout(results, 250); };
    const mo = new MutationObserver(later); [mid, left].forEach(n=>mo.observe(n, {subtree:true, childList:true, characterData:true}));   // never the right panel itself
    document.addEventListener("input", later); document.addEventListener("change", later);
    results();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
