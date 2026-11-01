const CACHE = "offline-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/offline.html")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Lets the page request start while this helper is still waking up, instead of after it.
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : undefined,
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    ]).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // only page loads; never data or scripts
  event.respondWith(
    (async () => {
      try {
        const early = await event.preloadResponse;
        if (early) return early;
        return await fetch(event.request);
      } catch {
        return (await caches.match("/offline.html")) || Response.error();
      }
    })(),
  );
});
