// Offline support. Code (pages, scripts, styles) is always fetched fresh when online, so updates show on the next reload;
// the saved copy is only used with no signal. Data files (outlines, addresses, approvals, documents) open from the saved
// copy for speed and are refreshed in the background. Satellite pictures and live address search are never saved here.
const CACHE = "roofcalc-v3";
const CORE = ["./", "index.html", "vendor/leaflet.js", "vendor/leaflet.css", "vendor/leaflet-geoman.min.js", "vendor/leaflet-geoman.css",
  "vendor/xlsx.full.min.js", "vendor/pdf-lib.min.js", "ws/workspace.js", "ws/workspace.css", "data/calc.txt", "data/addr.txt", "data/appr_boxes.json",
  "img/carlisle.png", "img/compass_h.png", "pwa/manifest.json", "pwa/compass-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const save = (req, res) => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; };
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;            // outside services: straight to the network
  const data = /\/(data|docs|tpl|vendor)\//.test(u.pathname);
  if (data) {   // saved copy first, refreshed in the background
    e.respondWith(caches.match(e.request).then(hit => { const net = fetch(e.request).then(r => save(e.request, r)).catch(() => hit); return hit || net; }));
    return;
  }
  // pages, scripts, styles, images: network first, saved copy only when offline
  e.respondWith(fetch(e.request, {cache: "no-cache"}).then(r => save(e.request, r)).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
