/*
 * The Joke Shovel service worker: app-shell caching so the app opens offline
 * and installs as a PWA (docs/DESIGN.md §13 Phase 5).
 *
 * It only caches the app's own files. Supabase, Google and /api/* are never
 * touched, so data always comes from the network (offline edits wait in the
 * app's own IndexedDB save queue, not here).
 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL && key !== ASSETS) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

/** Keeps the hashed-asset cache from growing forever across deploys. */
async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: network first, so a deploy shows at once; offline, the cached app.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(SHELL).then((cache) => cache.put('/', copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match('/')) ?? Response.error()),
    );
    return;
  }

  // Built assets have content hashes in their names, so they never change.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches.open(ASSETS).then(async (cache) => {
                  await cache.put(request, copy);
                  await trim(cache);
                }),
              );
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Icons, fonts, the manifest: serve the cached copy, refresh it behind the scenes.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(SHELL).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? network;
    }),
  );
});
