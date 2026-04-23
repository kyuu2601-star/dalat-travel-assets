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

        // Khi lệnh được gửi sang đây (tức là nút Notify đang BẬT), ta cho rung mạnh
        if (!data.silent) {
            options.vibrate = [500, 110, 500, 110, 450, 110];
        }

        self.registration.showNotification(data.title, options);
    }
});
