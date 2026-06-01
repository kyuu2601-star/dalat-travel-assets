let knowledgeBase = "";
const CHAT_STORAGE_KEY = 'dalatos_chat_history';
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 giờ tính bằng miliseconds

window.onload = async () => {
    // 1. Nạp dữ liệu CSV
    try {
        const res = await fetch(CONFIG.CSV_URL);
        knowledgeBase = await res.text();
        console.log("✅ Đã nạp dữ liệu cẩm nang");
    } catch (e) {
        console.error("❌ Lỗi nạp dữ liệu!");
    }
    // 2. Phục hồi lịch sử chat
    loadChatHistory();
};

async function handleChat() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text || !knowledgeBase) return;

    addMessage('user', text);
    saveMessage('user', text);
    input.value = '';

    const loadingId = 'loading-' + Date.now();
    addMessage('ai', `
        <div class="typing" id="${loadingId}">
            <span>Thổ địa đang tính...</span>
            <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>
    `);

    try {
        // 🎯 LẤY GPS AN TOÀN TỪ WINDOW (Ưu tiên biến từ App Radar)
        let gpsInfo = "";
        const currentPos = (typeof window.userPos !== "undefined") ? window.userPos : (typeof userPos !== "undefined" ? userPos : null);

        if (currentPos && currentPos.lat && currentPos.lon) {
            gpsInfo = `\n[VỊ TRÍ HIỆN TẠI CỦA KHÁCH]: Latitude ${currentPos.lat}, Longitude ${currentPos.lon}. Hãy dùng tọa độ này để tính khoảng cách và chỉ đường chính xác.`;
        } else {
            gpsInfo = `\n[HỆ THỐNG]: Hiện chưa lấy được GPS thực tế, hãy hỏi khách đang ở đâu nếu cần tính khoảng cách.`;
        }

        const response = await fetch(CONFIG.WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // ✅ Inject knowledgeBase và gpsInfo vào chung Prompt gửi đi
            body: JSON.stringify({ 
                message: CONFIG.SYSTEM_PROMPT(knowledgeBase) + gpsInfo + "\n\nKhách: " + text 
            })
        });

        const data = await response.json();
        const aiMsg = data.candidates[0].content.parts[0].text;
        
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.closest('.msg').innerHTML = marked.parse(aiMsg);
            saveMessage('ai', aiMsg);
        }
    } catch (err) {
        console.error(err);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.closest('.msg').innerText = "Lỗi kết nối rồi fen! " + err.message;
        }
    }
}

function addMessage(role, content) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return; // Tránh lỗi nếu widget chưa load kịp
    
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = (role === 'ai' && !content.includes('typing')) ? marked.parse(content) : content;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- LOGIC LƯU TRỮ (24H) ---
function saveMessage(role, content) {
    let history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || { timestamp: Date.now(), messages: [] };

    // Nếu quá 24h kể từ tin đầu tiên thì reset sạch
    if (Date.now() - history.timestamp > EXPIRY_TIME) {
        history = { timestamp: Date.now(), messages: [] };
    }
    
    history.messages.push({ role, content });
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
}

function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY));
    if (!history) {
        addMessage('ai', "Chào fen! Tui là Thổ Địa đây. Fen muốn tìm quán gì hay lên lịch trình đi đâu không?");
        return;
    }
    
    // Kiểm tra hết hạn 24h khi load lại trang
    if (Date.now() - history.timestamp > EXPIRY_TIME) {
        localStorage.removeItem(CHAT_STORAGE_KEY);
        addMessage('ai', "Chào fen! Tui là Thổ Địa đây. Fen muốn tìm quán gì hay lên lịch trình đi đâu không?");
        return;
    }
    
    // Hiển thị lại toàn bộ các tin nhắn đã lưu
    history.messages.forEach(msg => {
        addMessage(msg.role, msg.content);
    });
}
