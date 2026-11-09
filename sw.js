// Offline support: the app and its data are saved on the device as they are used.
// The page itself is checked online first so updates arrive right away; everything else is served from the saved copy.
// Satellite pictures and live address search always need a connection and are never saved here.
const CACHE = "roofcalc-v1";
const CORE = ["./", "index.html", "vendor/leaflet.js", "vendor/leaflet.css", "vendor/leaflet-geoman.min.js", "vendor/leaflet-geoman.css",
  "vendor/xlsx.full.min.js", "vendor/pdf-lib.min.js", "data/calc.txt", "data/addr.txt", "data/appr_boxes.json", "img/carlisle.png", "img/compass_h.png", "pwa/manifest.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;            // outside services: straight to the network
  const page = e.request.mode === "navigate" || u.pathname.endsWith("/index.html") || u.pathname.endsWith("/");
  if (page) { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))); return; }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })));
});
