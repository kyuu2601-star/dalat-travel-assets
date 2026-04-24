self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const data = event.data.payload;
        
        // Gộp các options: ưu tiên nhịp rung và icon từ code gốc của fen
        const options = {
            body: data.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/854/854866.png',
            tag: 'traffic-warning',
            renotify: true,
            // Thêm data để chứa soundUrl phục vụ cho logic âm thanh sau này
            data: { soundUrl: data.sound } 
        };

        // Giữ nguyên logic rung mạnh của fen
        if (!data.silent) {
            options.vibrate = [500, 110, 500, 110, 450, 110];
        }

        self.registration.showNotification(data.title, options);
    }
});

// Thêm sự kiện lắng nghe hiển thị thông báo theo yêu cầu
self.addEventListener('notificationdisplay', (event) => {
    // Logic ép hệ thống phát âm thanh hoặc xử lý khi thông báo hiện ra
    // Note: Tùy trình duyệt di động mà hiệu quả của soundUrl trong data sẽ khác nhau
});
