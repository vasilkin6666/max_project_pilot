// sw.js - разместите в корневой папке (не в web/)
const CACHE_NAME = 'project-pilot-v2';
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './js/api.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache).catch(error => {
          console.log('Cache addAll failed:', error);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Для API запросов - всегда сеть, для статики - кэш с fallback
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request);
        })
    );
  }
});
