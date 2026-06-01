let knowledgeBase = "";
const CHAT_STORAGE_KEY = 'dalatos_chat_history';
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 giờ tính bằng miliseconds

async function initBot() {
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
}

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
        // 🟢 1. LẤY DỮ LIỆU ĐANG HIỂN THỊ TRÊN MÀN HÌNH (Giao diện FE đã tính sẵn KM)
        // 🎯 LẤY DỮ LIỆU ĐANG HIỂN THỊ TRÊN MÀN HÌNH (Giao diện FE đã tính sẵn KM)
        let finalKnowledge = knowledgeBase;
        if (typeof window.layDataHienThiChoBot === "function") {
            finalKnowledge = window.layDataHienThiChoBot();
            console.log("🎯 Đã bốc dữ liệu DOM màn hình gửi cho Bot.");
        }

        // 🟢 FIX TRIỆT ĐỂ: Xóa bỏ hoàn toàn số Lat/Lon thập phân để Google không thể bắt bẻ
        let gpsInfo = `\n[PARAMETER_LOGIC]: Toàn bộ khoảng cách KM của các quán trong danh sách trên đều được tính toán trực tiếp từ vị trí thực tế hiện tại của khách hàng. Quán xếp số 1 là quán gần khách nhất. Hãy dựa vào số KM đó để tư vấn chỉ đường.`;

        // ĐÓNG GÓI PAYLOAD GỬI LÊN WORKER (Giữ nguyên format tách biệt)
        const response = await fetch(CONFIG.WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                systemPrompt: CONFIG.SYSTEM_PROMPT(finalKnowledge) + gpsInfo,
                userMessage: text
            })
        });

        const data = await response.json();
        
        let aiMsg = "";
        // 🛠️ BẪY LỖI AN TOÀN: Check cấu trúc trả về xem nằm ở đâu để lấy ra chuỗi text
        if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            aiMsg = data.candidates[0].content.parts[0].text;
        } else if (data && data.text) {
            aiMsg = data.text;
        } else {
            // Nếu Google trả về object lỗi gì đó, in thẳng ra màn hình chat để đọc luôn thay vì văng crash
            aiMsg = "⚠️ Thiết lập lỗi cấu trúc dữ liệu: " + JSON.stringify(data);
        }
        
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.closest('.msg').innerHTML = marked.parse(aiMsg);
            saveMessage('ai', aiMsg);
        }
    } catch (err) {
        console.error(err);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.closest('.msg').innerText = "Lỗi kết nối rồi fen! Thử lại nha.";
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
