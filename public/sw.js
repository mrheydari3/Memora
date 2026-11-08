/**
 * Memora Service Worker — network-first with a cache fallback.
 *
 * Registered lazily from the Offline & Install App screen (opt-in).
 * Network-first is deliberate: the app ships a Metro dev bundle during
 * development and content-hashed bundles in production, so serving cache-first
 * would pin users (and the dev preview) to whatever loaded first.
 */

const CACHE_NAME = 'memory-v5';
const RUNTIME_CACHE = 'memory-runtime';

// Assets to pre-cache on install. Icons and the manifest are part of the
// installable surface; they are individually cached so one missing file cannot
// abort the worker install.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon-v4.ico',
  '/manifest.json',
  '/icon-192-v4.png',
  '/icon-512-v4.png',
  '/splash-icon-v4.png',
  '/apple-touch-icon-v4.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Individually, so one 404 (e.g. no index.html in a dev server) cannot
      // fail the whole install and leave the app with no worker at all.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function cacheResponse(request, response) {
  if (response.status !== 200 || response.type === 'opaque') return;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only same-origin GETs; never intercept API or extension traffic.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        await cacheResponse(request, response);
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
  );
});
