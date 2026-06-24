/* Kjøkken – service worker (offline app-skall) */
const CACHE = "kjokken-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./icon-180.png",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@supabase/supabase-js@2.45.0",
  "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map((u) => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // aldri cache Supabase-skriv (POST/RPC)
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.hostname.endsWith("supabase.co")) return;  // data skal alltid hentes ferskt fra nett

  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;                       // cache-first for app-skall + CDN + fonter
    try {
      const res = await fetch(req);
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
