const CACHE_NAME = 'project-pilot-max-v1.0.0';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    './src/services/AuthManager.js',
    './src/services/ApiService.js',
    './src/components/ui/LoadingScreen.jsx',
    './src/components/ui/Navigation.jsx',
    './src/components/ui/ProjectCard.jsx',
    './src/components/ui/AIAssistant.jsx',
    './src/components/modals/CreateProjectModal.jsx',
    './src/components/modals/CreateTaskModal.jsx',
    './src/components/modals/SettingsModal.jsx',
    './src/components/modals/NotificationsModal.jsx',
    './src/components/views/Dashboard.jsx',
    './src/components/views/ProjectView.jsx',
    './src/components/views/TaskView.jsx',
    './src/components/views/MyTasksView.jsx',
    './src/components/App.jsx'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching App Shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Skip waiting');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Claiming clients');
            return self.clients.claim();
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    // Пропускаем не-GET запросы
    if (event.request.method !== 'GET') return;

    // Пропускаем chrome-extension запросы
    if (event.request.url.startsWith('chrome-extension://')) return;

    // Пропускаем запросы к внешним ресурсам
    if (!event.request.url.includes('github.io') &&
        !event.request.url.startsWith('http://localhost')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Возвращаем кэшированную версию, если есть
                if (response) {
                    console.log('Service Worker: Serving from cache', event.request.url);
                    return response;
                }

                // Иначе делаем сетевой запрос
                console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Проверяем валидность ответа
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Клонируем ответ
                        const responseToCache = response.clone();

                        // Кэшируем новый ресурс
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Кэшируем только наши ресурсы
                                if (event.request.url.includes('max_project_pilot') ||
                                    event.request.url.includes('localhost')) {
                                    cache.put(event.request, responseToCache);
                                    console.log('Service Worker: Cached new resource', event.request.url);
                                }
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.log('Service Worker: Fetch failed, serving fallback', error);

                        // Fallback для HTML страниц
                        if (event.request.destination === 'document' ||
                            event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }

                        // Fallback для API запросов
                        if (event.request.url.includes('/api/')) {
                            return new Response(
                                JSON.stringify({
                                    error: 'Оффлайн режим',
                                    message: 'Нет соединения с интернетом',
                                    offline: true
                                }),
                                {
                                    status: 503,
                                    headers: { 'Content-Type': 'application/json' }
                                }
                            );
                        }

                        // Fallback для изображений
                        if (event.request.destination === 'image') {
                            return new Response(
                                '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#f0f0f0"/><text x="50" y="50" font-family="Arial" font-size="10" text-anchor="middle" fill="#666">Image</text></svg>',
                                {
                                    headers: { 'Content-Type': 'image/svg+xml' }
                                }
                            );
                        }

                        return new Response('Оффлайн режим', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (error) {
        console.error('Service Worker: Push data parsing failed', error);
        data = {
            title: 'Project Pilot MAX',
            body: 'У вас новое уведомление',
            icon: './icons/icon-192x192.png'
        };
    }

    const options = {
        body: data.body || 'Новое уведомление',
        icon: data.icon || './icons/icon-192x192.png',
        badge: './icons/icon-192x192.png',
        image: data.image,
        vibrate: [100, 50, 100],
        data: {
            url: data.url || './',
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'open',
                title: 'Открыть'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ],
        tag: data.tag || 'general',
        renotify: true,
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Project Pilot MAX', options)
            .then(() => {
                console.log('Service Worker: Notification shown successfully');
            })
            .catch((error) => {
                console.error('Service Worker: Notification failed', error);
            })
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification click', event.notification.tag);
    event.notification.close();

    if (event.action === 'open') {
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            })
                .then((clientList) => {
                    // Ищем открытое окно с нашим приложением
                    for (const client of clientList) {
                        if (client.url.includes('max_project_pilot') && 'focus' in client) {
                            console.log('Service Worker: Focusing existing client');
                            return client.focus();
                        }
                    }

                    // Если окно не найдено, открываем новое
                    if (clients.openWindow) {
                        const url = event.notification.data.url || './';
                        console.log('Service Worker: Opening new window', url);
                        return clients.openWindow(url);
                    }
                })
                .catch((error) => {
                    console.error('Service Worker: Notification click handling failed', error);
                })
        );
    } else if (event.action === 'close') {
        console.log('Service Worker: Notification closed by user');
    } else {
        // Обработка клика по самому уведомлению (не по action)
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            })
                .then((clientList) => {
                    for (const client of clientList) {
                        if (client.url.includes('max_project_pilot') && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow(event.notification.data.url || './');
                    }
                })
        );
    }
});

// Обработка закрытия уведомлений
self.addEventListener('notificationclose', (event) => {
    console.log('Service Worker: Notification closed', event.notification.tag);
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync', event.tag);

    if (event.tag === 'background-sync') {
        event.waitUntil(
            doBackgroundSync()
                .then(() => {
                    console.log('Service Worker: Background sync completed');
                })
                .catch((error) => {
                    console.error('Service Worker: Background sync failed', error);
                })
        );
    }
});

// Функция фоновой синхронизации
async function doBackgroundSync() {
    try {
        // Здесь можно добавить логику синхронизации данных
        // Например, отправка накопившихся запросов
        console.log('Service Worker: Performing background sync');

        // Проверяем наличие отложенных запросов
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();

        console.log('Service Worker: Found', requests.length, 'cached requests');

        // Можно добавить логику повторной отправки запросов
        return Promise.resolve();
    } catch (error) {
        console.error('Service Worker: Background sync error', error);
        throw error;
    }
}

// Периодическая фоновая синхронизация
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'periodic-sync') {
        console.log('Service Worker: Periodic sync');
        event.waitUntil(doPeriodicSync());
    }
});

async function doPeriodicSync() {
    try {
        // Обновление кэша, проверка обновлений и т.д.
        console.log('Service Worker: Performing periodic sync');
        return Promise.resolve();
    } catch (error) {
        console.error('Service Worker: Periodic sync error', error);
    }
}

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
        version: '1.0.0',
        cacheName: CACHE_NAME
        });
    }

    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
            return cache.addAll(event.data.urls);
            })
            .then(() => {
            event.ports[0].postMessage({ success: true });
            })
        );
    }
});

// Обработка ошибок
self.addEventListener('error', (event) => {
    console.error('Service Worker: Error', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker: Unhandled rejection', event.reason);
});

console.log('Service Worker: Loaded successfully');
