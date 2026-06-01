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

    // 🟢 THAY ĐỔI DUY NHẤT: Bọc logic gọi fetch vào vòng lặp tự động retry né server HK
    let data = null;
    let retries = 3; // Thử tối đa 3 lần nếu dính lỗi region

    while (retries > 0) {
        try {
            // 🎯 LẤY GPS AN TOÀN (Ép buộc phải có số thực tế mới gửi lên Google)
            let gpsInfo = "";
            const currentPos = (typeof window.userPos !== "undefined") ? window.userPos : (typeof userPos !== "undefined" ? userPos : null);

            // Phải check kỹ xem có đúng là CHỨA SỐ (Number) không, tránh gửi chữ "undefined" lên Google
            if (currentPos && currentPos.lat && currentPos.lon && !isNaN(currentPos.lat) && !isNaN(currentPos.lon)) {
                gpsInfo = `\n[VỊ TRÍ HIỆN TẠI CỦA KHÁCH]: Latitude ${currentPos.lat}, Longitude ${currentPos.lon}. Hãy dùng tọa độ này để tính khoảng cách và chỉ đường chính xác.`;
            } else {
                // Nếu chưa có tọa độ chuẩn, gửi chuỗi thuần chữ này, tuyệt đối không kẹp biến undefined vào
                gpsInfo = `\n[HỆ THỐNG]: Hiện chưa lấy được GPS thực tế, hãy hỏi khách đang ở khu nào ở Đà Lạt nếu cần tính khoảng cách.`;
            }

            // Giao diện FE đã tính toán sẵn KM qua hàm của index, bốc thẳng thảy cho Bot hít cho nhanh
            let finalKnowledge = knowledgeBase;
            if (typeof window.layDataHienThiChoBot === "function") {
                finalKnowledge = window.layDataHienThiChoBot();
            }

            const response = await fetch(CONFIG.WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Sử dụng format tách biệt tương thích với Worker mới của fen
                body: JSON.stringify({ 
                    systemPrompt: CONFIG.SYSTEM_PROMPT(finalKnowledge) + gpsInfo,
                    userMessage: text 
                })
            });

            if (response.ok) {
                data = await response.json();
                
                // Kiểm tra xem chuỗi JSON trả về từ Google có chứa từ khóa chặn location (do rớt server HK) không
                if (data && data.error && data.error.message && data.error.message.includes("location")) {
                    console.log("⚠️ Trúng server Cloudflare HK lỗi vị trí, đang tự động gửi lại...");
                    retries--;
                    if (retries > 0) {
                        await new Promise(res => setTimeout(res, 300)); // Chờ 0.3s lắc xúc xắc lại tuyến đường
                        continue;
                    }
                } else {
                    // Nhận data sạch thành công, thoát khỏi vòng lặp retry
                    break;
                }
            }
        } catch (err) {
            console.error("Lỗi kết nối mạng, đang thử lại...", err);
        }
        
        retries--;
        if (retries > 0) {
            await new Promise(res => setTimeout(res, 300));
        }
    }

    try {
        let aiMsg = "";
        // 🛠️ BẪY LỖI AN TOÀN: Check cấu trúc trả về xem nằm ở đâu để lấy ra chuỗi text
        if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            aiMsg = data.candidates[0].content.parts[0].text;
        } else if (data && data.text) {
            aiMsg = data.text;
        } else {
            // Nếu sau 3 lần vẫn lỗi hoặc dính lỗi cấu trúc khác, in ra màn hình chat
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
