self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('message', event => {
    if (event.data?.type !== 'SHOW_NOTIFICATION') return;
    const data = event.data.payload || {};
    const options = {
        body: data.body || '',
        icon: 'logo.png',
        badge: 'logo.png',
        tag: 'travelos-traffic-warning',
        renotify: true,
        vibrate: [500, 110, 500, 110, 450, 110],
        silent: Boolean(data.silent)
    };
    if (data.silent) delete options.vibrate;
    event.waitUntil(self.registration.showNotification(data.title || 'TravelOS', options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.registration.scope) && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(self.registration.scope);
        })
    );
});
