const CONFIG = {
    // 🚨 Giữ nguyên 2 đường link chuẩn của fen trên app test
    CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnXggiUJriOBPHz05pt01aIq_qaCDeQAcWpyYTG6zx1XI9WzfVDTbb8rPwYPf2w8uHxeDpx3Tznx53/pub?gid=615358788&single=true&output=csv",
    WORKER_URL: "https://ai-test.kyuu2601.workers.dev",
    
    // 🔥 HÀM CHA ĐIỀU PHỐI PROMPT ĐỘNG THEO CHUYÊN MỤC TỪ KHÓA
    SYSTEM_PROMPT: function(userMessage, knowledgeBase) {
        // Chuyển tin nhắn user về chữ thường để quét không sót ký tự
        const messageLower = userMessage.toLowerCase();
        
        // Bước 1: LUÔN LUÔN nạp bộ Xương Sống Bắt Buộc từ prompts.js vào đầu tiên
        let activeParts = [DALAT_PROMPTS.BASE_XUONG_SONG];

        // Biến cờ hiệu kiểm tra xem có trúng module nào không
        let hasMatched = false;

        // Bước 2: Duyệt qua từng chuyên mục được định nghĩa trong file keywords.js
        for (const groupName in DALAT_KEYWORDS) {
            const keywordList = DALAT_KEYWORDS[groupName];
            
            // Check xem câu chat của user có dính từ khóa nào trong nhóm này không
            const isMatched = keywordList.some(keyword => messageLower.includes(keyword));
            
            if (isMatched) {
                hasMatched = true; // Bật cờ hiệu xác nhận đã bắt được chuyên mục cụ thể
                
                // Chuẩn hóa tên ánh xạ từ KEYWORD sang PROMPT (Xử lý case lệch tên DI_CHUYEN và DU_CHUYEN)
                let promptGroupName = groupName;
                if (groupName === "DI_CHUYEN" && !DALAT_PROMPTS.DI_CHUYEN) {
                    promptGroupName = "DU_CHUYEN"; // Tự động bọc lót nếu file prompt của fen đang để tên cũ là DU_CHUYEN
                }

                console.log(`🧩 [Hàm Cha Cấu Hình]: Phát hiện từ khóa thuộc chuyên mục [${groupName}] -> Đã tiêm tri thức hỗ trợ [${promptGroupName}].`);
                
                // Hốt nội dung Chuyên Mục đó ném vào mảng
                if (DALAT_PROMPTS[promptGroupName]) {
                    activeParts.push(DALAT_PROMPTS[promptGroupName]);
                }
            }
        }

        // BƯỚC CHỐT CHẶN: Nếu không trúng bất kỳ keyword nào -> Tự động kích hoạt module TONG_QUAT
        if (!hasMatched) {
            console.log("⚠️ [Hàm Cha Cấu Hình]: Không trùng từ khóa nào -> Tự động kích hoạt Module [TONG_QUAT] xử lý flexible.");
            if (DALAT_PROMPTS.TONG_QUAT) {
                activeParts.push(DALAT_PROMPTS.TONG_QUAT);
            }
        }

        // Bước 3: Nhồi cục dữ liệu cẩm nang CSV gốc của dự án vào cuối prompt để Bot tra cứu
        activeParts.push(`\n--- DỮ LIỆU CẨM NANG CSV BẮT BUỘC TRONG HỆ THỐNG ---\n${knowledgeBase}`);

        // Gộp tất cả các mảng tri thức lại bằng dấu xuống dòng và trả về prompt hoàn chỉnh
        return activeParts.join("\n\n");
    }
};
