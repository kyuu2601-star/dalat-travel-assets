let knowledgeBase = "";
const CHAT_STORAGE_KEY = 'dalatos_chat_history';
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 giờ tính bằng miliseconds

async function initBot() {
    // 1. Nạp dữ liệu CSV từ Google Sheets cấu hình
    try {
        const res = await fetch(CONFIG.CSV_URL);
        knowledgeBase = await res.text();
        console.log("✅ Đã nạp dữ liệu cẩm nang");
    } catch (e) {
        console.error("❌ Lỗi nạp dữ liệu!");
    }
    // 2. Phục hồi lịch sử chat hiển thị trên màn hình
    loadChatHistory();
}

async function handleChat() {
    // 🟢 ĐƯA CÁC BIẾN UI LÊN ĐẦU HÀM ĐỂ QUẢN LÝ TẬP TRUNG
    const input = document.getElementById('userInput');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('mic-btn');

    if (!input) return;
    const text = input.value.trim();
    if (!text || !knowledgeBase) return;

    // 🎯 CHẶN SPAM: Khóa toàn bộ các nút ngay lập tức
    if (sendBtn) sendBtn.disabled = true;
    if (voiceBtn) voiceBtn.disabled = true;
    input.disabled = true; 
    
    addMessage('user', text);
    saveMessage('user', text);
    input.value = '';

    const loadingId = 'loading-' + Date.now();
    addMessage('ai', "<div class=\"typing\" id=\"" + loadingId + "\"><span>Thổ địa đang tính...</span><div class=\"dot\"></div><div class=\"dot\"></div><div class=\"dot\"></div></div>");

    let data = null;
    let retries = 3; // Thử tối đa 3 lần nếu dính lỗi region Cloudflare

    // 🌟 DÙNG TRY-CATCH-FINALLY TỔNG ĐỂ ĐẢM BẢO LUÔN MỞ KHÓA NÚT KỂ CẢ KHI CÓ LỖI CHẾT MẠNG
    try {
        while (retries > 0) {
            try {
                // 🎯 1. LẤY TOẠ ĐỘ GPS AN TOÀN
                let gpsInfo = "";
                const currentPos = (typeof window.userPos !== "undefined") ? window.userPos : (typeof userPos !== "undefined" ? userPos : null);

                if (currentPos && currentPos.lat && currentPos.lon && !isNaN(currentPos.lat) && !isNaN(currentPos.lon)) {
                    gpsInfo = "\n[VỊ TRÍ HIỆN TẠI CỦA KHÁCH]: Latitude " + currentPos.lat + ", Longitude " + currentPos.lon + ". Hãy dùng tọa độ này để tính khoảng cách và chỉ đường chính xác.";
                } else {
                    gpsInfo = "\n[HỆ THỐNG]: Hiện chưa lấy được GPS thực tế, hãy hỏi khách đang ở khu nào ở Đà Lạt nếu cần tính khoảng cách.";
                }

                let finalKnowledge = knowledgeBase;
                if (typeof window.layDataHienThiChoBot === "function") {
                    finalKnowledge = window.layDataHienThiChoBot();
                }

                // 🎯 2. BỐC LỊCH SỬ CHAT VÀ GIỚI HẠN TỐI ĐA 6 TIN NHẮN ĐỂ TIẾT KIỆM VI TIỀN TOKEN
                const localHistory = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY));
                let chatHistoryArray = localHistory ? localHistory.messages : [];
                
                // Lọc hớt váng (Sliding Window): Chỉ gửi 6 câu gần nhất lên AI để xử lý mạch ngữ cảnh ngắn hạn
                if (chatHistoryArray.length > 6) {
                    chatHistoryArray = chatHistoryArray.slice(-6);
                }

                // 🎯 3. GỬI REQUEST DATA LÊN WORKER BACKEND
                const response = await fetch(CONFIG.WORKER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        systemPrompt: CONFIG.SYSTEM_PROMPT(text, finalKnowledge) + gpsInfo,
                        userMessage: text,
                        chatHistory: chatHistoryArray // Mảng lịch sử tinh gọn bao gồm tối đa 6 tin nhắn
                    })
                });

                if (response.ok) {
                    data = await response.json();
                    
                    // Kiểm tra xem chuỗi JSON trả về từ Google có chứa từ khóa chặn location không
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
            // 🛠️ BẪY LỖI CẤU TRÚC DỮ LIỆU AN TOÀN TRƯỚC KHI IN
            if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                aiMsg = data.candidates[0].content.parts[0].text;
            } else if (data && data.text) {
                aiMsg = data.text;
            } else {
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
    } catch (globalErr) {
        console.error("Lỗi tổng thống:", globalErr);
    } finally {
        // 🎯 KHỐI LỆNH GIẢI PHÓNG: Bất luận luồng xử lý chạy trơn tru hay sập mạng gãy gánh giữa chừng, LUÔN LUÔN nhả nút về trạng thái cũ tại đây.
        if (sendBtn) sendBtn.disabled = false;
        if (voiceBtn) voiceBtn.disabled = false;
        
        if (input) {
            input.disabled = false;
            input.focus(); 
        }
    }
}

function addMessage(role, content) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return; 
    
    const div = document.createElement('div');
    div.className = "msg " + role;
    div.innerHTML = (role === 'ai' && !content.includes('typing')) ? marked.parse(content) : content;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- LOGIC LƯU TRỮ LỊCH SỬ TRÊN BROWSER KHÁCH HÀNG (24H) ---
function saveMessage(role, content) {
    let history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || { timestamp: Date.now(), messages: [] };

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
    
    if (Date.now() - history.timestamp > EXPIRY_TIME) {
        localStorage.removeItem(CHAT_STORAGE_KEY);
        addMessage('ai', "Chào fen! Tui là Thổ Địa đây. Fen muốn tìm quán gì hay lên lịch trình đi đâu không?");
        return;
    }
    
    history.messages.forEach(msg => {
        addMessage(msg.role, msg.content);
    });
}
