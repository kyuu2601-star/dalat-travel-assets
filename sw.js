// sw.js - "Ông bảo vệ" chạy ngầm
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Lắng nghe lệnh từ index.html gửi sang
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const data = event.data.payload;
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/854/854866.png',
            vibrate: [500, 200, 500],
            tag: 'traffic-warning',
            renotify: true // Buộc phải rung lại khi có cập nhật mới
        });
    }
});
