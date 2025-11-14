// sw.js - простой Service Worker
const CACHE_NAME = 'project-pilot-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/api.js',
  '/js/app.js',
  '/js/main.js',
  '/js/max-integration.js',
  '/js/auth-enhanced.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
