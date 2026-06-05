const CACHE_NAME = 'muslim-pedia-v1';
const API_CACHE_NAME = 'muslim-pedia-api-v1';
const MAX_API_CACHE_ENTRIES = 30;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/storage.js',
  '/js/app.js',
  '/manifest.json',
  '/assets/favicon.svg',
  '/assets/icon-192.svg',
  '/assets/icon-512.svg'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Network first for API, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network first, fallback to cache, with eviction
  if (url.hostname === 'equran.id') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
            // Evict oldest entries if over the limit
            trimCache(API_CACHE_NAME, MAX_API_CACHE_ENTRIES);
          });
          return response;
        })
        .catch(() => caches.open(API_CACHE_NAME).then((cache) => cache.match(request)))
    );
    return;
  }

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) return response;
        return fetch(request).then((fetchResponse) => {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return fetchResponse;
        });
      })
  );
});

// Trim cache to a maximum number of entries (evict oldest first)
function trimCache(cacheName, maxEntries) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > maxEntries) {
        // Delete the oldest entries (first in the list)
        const deleteCount = keys.length - maxEntries;
        for (let i = 0; i < deleteCount; i++) {
          cache.delete(keys[i]);
        }
      }
    });
  });
}
