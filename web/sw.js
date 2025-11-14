// sw.js
const CACHE_NAME = 'project-pilot-v1';

self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    self.skipWaiting(); // Активируем сразу
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    // Простая прокси без кэширования для избежания ошибок
    event.respondWith(fetch(event.request));
});
