// Service worker for Rhythm PWA
// Strategy: cache-first for app shell, fall back to network for everything else.
// Bump CACHE_NAME when you change app shell files — old caches will be cleared.

const CACHE_NAME = 'rhythm-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll — but tolerate failures on external fonts
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('Cache skip:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: try cache first, then network. Cache new GETs opportunistically.
self.addEventListener('fetch', (event) => {
  // Only handle GET
  if (event.request.method !== 'GET') return;
  // Skip non-http (data:, chrome-extension:, etc.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Don't cache opaque or error responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        // Only cache same-origin or font requests
        const url = new URL(event.request.url);
        const sameOrigin = url.origin === self.location.origin;
        const isFontHost = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
        if (sameOrigin || isFontHost) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Network failed and not in cache — for navigation, return index
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
