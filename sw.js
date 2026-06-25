/* Kjøkken – service worker
   Mål: appen oppfører seg likt i nettleser OG som installert PWA.
   - Selve appen (index.html + app-filer): NETTVERK-FØRST -> alltid nyeste når du har nett,
     cache brukes bare som offline-reserve. (Dette fikser "ser gammel versjon".)
   - Tunge CDN-bibliotek + fonter: CACHE-FØRST (de er versjonslåste og endrer seg ikke).
   - Supabase (data): røres aldri – alltid ferskt fra nett.
*/
const CACHE = "kjokken-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./icon-180.png"
];
const CDN = [
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@supabase/supabase-js@2.45.0",
  "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(APP_SHELL.concat(CDN).map((u) => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isCDN(url) {
  return url.hostname.endsWith("unpkg.com") ||
         url.hostname.endsWith("fonts.googleapis.com") ||
         url.hostname.endsWith("fonts.gstatic.com");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // Supabase-skriv (POST/RPC) går rett til nett
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.hostname.endsWith("supabase.co")) return;  // data alltid ferskt

  // CDN + fonter: cache-først (immutable)
  if (isCDN(url)) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && (res.status === 200 || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // Alt eget (HTML/navigasjon/app-filer): nettverk-først, cache som offline-reserve
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
