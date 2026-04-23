self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const data = event.data.payload;
        
        const options = {
            body: data.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/854/854866.png',
            tag: 'traffic-warning',
            renotify: true
        };

        // Nếu người dùng tắt rung (silent: true), thì không bỏ vibrate vào options
        if (!data.silent) {
            options.vibrate = [500, 200, 500];
        }

        self.registration.showNotification(data.title, options);
    }
});
