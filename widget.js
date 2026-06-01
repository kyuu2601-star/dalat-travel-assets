(function() {
    // 1. INJECT CSS (Nhan sắc của Bot)
    const style = document.createElement('style');
    style.innerHTML = `
        #chat-widget-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(2, 6, 23, 0.75) !important; /* Tạo nền tối mờ 75% */
            backdrop-filter: blur(5px) !important;       /* Làm nhòe App gốc phía sau */
            -webkit-backdrop-filter: blur(5px) !important;
            z-index: 19999 !important;                   /* Nằm dưới window chat nhưng đè lên App */
            display: none;
        }
        
        #chat-widget-button {
            position: fixed; bottom: 30px; right: 30px; width: 50px; height: 50px;
            background-color: #f59e0b; border-radius: 50%; display: flex;
            justify-content: center; align-items: center; box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4);
            cursor: pointer; z-index: 20000; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border: 2px solid rgba(255,255,255,0.2);
        }
        #chat-widget-button:hover { transform: scale(1.1) rotate(10deg); }
        
        #chat-widget-window {
            position: fixed; bottom: 110px; right: 30px; width: 380px; max-width: 90vw;
            height: 600px; max-height: 75vh; background: #0f172a; border-radius: 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: none; flex-direction: column;
            overflow: hidden; z-index: 20000; border: 1px solid rgba(255,255,255,0.1);
            animation: widgetShow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes widgetShow {
            from { opacity: 0; transform: translateY(40px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .widget-header { background: #1e293b; color: #f59e0b; padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .widget-header h2 { margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        
        #chat-box { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; background: #020617; }
        
        .widget-input-area { 
            padding: 12px; /* Thu nhỏ padding từ 15px xuống 12px cho gọn */
            display: flex; 
            align-items: center; /* Căn giữa các phần tử theo chiều dọc */
            gap: 8px; 
            background: #0f172a; 
            border-top: 1px solid rgba(255,255,255,0.05); 
            box-sizing: border-box;
            width: 100%;
        }
        input#userInput { 
            flex: 1; 
            min-width: 0; /* 🌟 ÉP BUỘC: Không cho ô nhập phình to đẩy nút gửi ra ngoài */
            padding: 10px 14px; /* Chỉnh lại padding cho cân đối */
            background: #1e293b; 
            border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 15px; 
            color: white; 
            outline: none; 
        }
        .send-btn { 
            background: #f59e0b; 
            border: none; 
            width: 40px !important;  /* Khóa cứng chiều rộng 40px */
            height: 40px !important; /* Khóa cứng chiều cao 40px tạo nút tròn */
            border-radius: 12px; 
            color: #020617; 
            font-weight: 800; 
            cursor: pointer; 
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;          /* 🌟 ÉP BUỘC: Không cho flexbox bóp méo nút */
            padding: 0;              /* Xóa padding chữ cũ */
        }

        /* Style tin nhắn */
        .msg { padding: 12px 16px; border-radius: 18px; font-size: 14px; max-width: 85%; line-height: 1.5; color: #cbd5e1; }
        .user { align-self: flex-end; background: #334155; color: white; border-bottom-right-radius: 4px; }
        .ai { align-self: flex-start; background: #1e293b; border-bottom-left-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
        .msg img { max-width: 100%; border-radius: 12px; margin-top: 10px; }
        .msg a {
            color: #38bdf8 !important; /* Xanh bầu trời dạ quang */
            text-decoration: underline;
            font-weight: 800;
        }
        
        /* Loading */
        .typing { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #64748b; }
        .dot { width: 5px; height: 5px; background: #f59e0b; border-radius: 50%; animation: bounce 1.4s infinite; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
    `;
    document.head.appendChild(style);

    // 2. INJECT HTML (Khung xương của Bot)
    const widgetContainer = document.createElement('div');
    widgetContainer.innerHTML = `
        <div id="chat-widget-overlay"></div>

        <div id="chat-widget-button">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        </div>
        <div id="chat-widget-window">
            <div class="widget-header">
                <h2>Thổ Địa Đà Lạt</h2>
                <span id="close-widget" style="cursor:pointer; font-size:24px;">×</span>
            </div>
            <div id="chat-box"></div>
            <div class="widget-input-area">
                <input type="text" id="userInput" placeholder="Hỏi đường, quán xá...">
                <button class="send-btn" id="send-btn">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: 0 auto;">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                   </svg>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(widgetContainer);

    // 3. LOGIC ĐÓNG MỞ
    const btn = document.getElementById('chat-widget-button');
    const win = document.getElementById('chat-widget-window');
    const close = document.getElementById('close-widget');
    const overlay = document.getElementById('chat-widget-overlay');

    btn.onclick = () => {
        const isHidden = win.style.display === 'none' || win.style.display === '';
        win.style.display = isHidden ? 'flex' : 'none';
        // Thêm dòng kiểm tra hiển thị overlay song song với cửa sổ chat (win)
        if (overlay) overlay.style.display = isHidden ? 'block' : 'none';
        if (isHidden) setTimeout(() => document.getElementById('userInput').focus(), 300);
    };

    close.onclick = (e) => {
        e.stopPropagation();
        win.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    };

    // Bấm vào overlay cũng tự động đóng widget
    if (overlay) {
        overlay.onclick = () => {
            win.style.display = 'none';
            overlay.style.display = 'none';
        };
    }

    // 4. GÁN SỰ KIỆN ENTER CHO INPUT
    document.getElementById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChat();
    });

    // 5. GÁN SỰ KIỆN CLICK CHO NÚT GỬI
    document.getElementById('send-btn').onclick = () => handleChat();

})();
