self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const data = event.data.payload;
        
        const options = {
            body: data.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/854/854866.png',
            tag: 'traffic-warning',
            renotify: true,
            vibrate: [500, 110, 500, 110, 450, 110], // Giữ nhịp rung mạnh của fen
            data: { sound: data.sound } // Truyền tên file âm thanh vào data của notification
        };

        // Giữ nguyên logic kiểm tra silent nếu cần, nhưng ưu tiên vibrate mạnh theo yêu cầu add mới
        if (data.silent) {
            delete options.vibrate;
        }

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Lắng nghe sự kiện hiển thị thông báo (Dành cho logic ép âm thanh nếu trình duyệt hỗ trợ)
self.addEventListener('notificationdisplay', (event) => {
    // Note: Tùy trình duyệt di động mà hiệu quả xử lý tại đây sẽ khác nhau
});

// Lắng nghe sự kiện thông báo được click để mở/focus lại App
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Logic mở lại app khi bấm vào thông báo
    event.waitUntil(
        clients.matchAll({type: 'window'}).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                // Kiểm tra nếu app đang mở thì focus vào
                if (client.url === '/' && 'focus' in client) return client.focus();
            }
            // Nếu chưa mở thì mở cửa sổ mới
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
