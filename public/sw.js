// Service Worker for PWA with Push Notifications
const CACHE_VERSION = 'v5';
const APP_CACHE = `app-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

function isSameOrigin(requestUrl) {
    return requestUrl.origin === self.location.origin;
}

function isNextDynamicRequest(url) {
    if (url.pathname.startsWith('/api/')) return true;
    if (url.pathname.startsWith('/_next/data/')) return true;
    if (url.pathname.startsWith('/_next/webpack-hmr')) return true;
    if (url.searchParams.has('_rsc')) return true;
    if (url.searchParams.has('__nextDataReq')) return true;
    if (url.searchParams.has('next-router-state-tree')) return true;
    return false;
}

function isCacheableStaticAsset(request, url) {
    if (!isSameOrigin(url)) return false;
    if (url.pathname.startsWith('/_next/static/')) return true;
    if (url.pathname.startsWith('/icons/')) return true;
    if (url.pathname === '/manifest.json') return true;

    return (
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'image' ||
        request.destination === 'font'
    );
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(APP_CACHE).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== APP_CACHE) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome extensions and other non-http(s) requests
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // Never cache dynamic Next.js/server requests.
    if (isNextDynamicRequest(url)) {
        event.respondWith(fetch(event.request));
        return;
    }

    // STRATEGY 1: Network Only (Never Cache)
    // - Supabase API
    // - Local API routes (/api/*)
    // - Next.js Data JSON (_next/data/*)
    const isSupabaseRequest = url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in');
    if (isSupabaseRequest) {
        event.respondWith(fetch(event.request));
        return;
    }

    // STRATEGY 2: Network First, Fallback to Cache (For HTML/Navigation)
    // Ensures user always gets latest version if online
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    return response;
                })
                .catch(() => {
                    // Fallback to root when offline
                    return caches.match('/');
                })
        );
        return;
    }

    // STRATEGY 3: Stale-While-Revalidate for static assets only
    if (!isCacheableStaticAsset(event.request, url)) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const networkPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(APP_CACHE).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || networkPromise;
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Push event - show notification
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    let data = {
        title: 'Nuevo mensaje',
        body: 'Tienes un nuevo mensaje',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: 'message-notification',
        data: {
            url: '/',
        },
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        vibrate: [200, 100, 200],
        requireInteraction: false,
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event - open app
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Background sync (optional - for offline message sending)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

async function syncMessages() {
    // Implement message sync logic here if needed
    console.log('[SW] Syncing messages...');
}

// End of Service Worker


