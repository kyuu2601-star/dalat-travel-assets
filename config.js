const CONFIG = {
    // D1: điền URL Worker API sau khi deploy (vd: https://travelos-data.xxx.workers.dev/api).
    // Khi có URL, TravelOS sẽ tự ưu tiên D1. Nếu chưa có, app tạm fallback sang Sheet để bản live không bị gãy.
    DATA_API_URL: "",
    D1_ENABLED: false,

    // Transitional fallback only. Xóa sau khi D1 đã được deploy + migrate đủ data.
    LEGACY_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnXggiUJriOBPHz05pt01aIq_qaCDeQAcWpyYTG6zx1XI9WzfVDTbb8rPwYPf2w8uHxeDpx3Tznx53/pub?gid=615358788&single=true&output=csv",

    WORKER_URL: "https://ai-test.kyuu2601.workers.dev",

    SYSTEM_PROMPT: function(userMessage, knowledgeBase) {
        const messageLower = userMessage.toLowerCase();
        let activeParts = [DALAT_PROMPTS.BASE_XUONG_SONG];
        let hasMatched = false;

        for (const groupName in DALAT_KEYWORDS) {
            const keywordList = DALAT_KEYWORDS[groupName];
            const isMatched = keywordList.some(keyword => messageLower.includes(keyword));

            if (isMatched) {
                hasMatched = true;
                let promptGroupName = groupName;
                if (groupName === "DI_CHUYEN" && !DALAT_PROMPTS.DI_CHUYEN) {
                    promptGroupName = "DU_CHUYEN";
                }
                if (DALAT_PROMPTS[promptGroupName]) {
                    activeParts.push(DALAT_PROMPTS[promptGroupName]);
                }
            }
        }

        if (!hasMatched && DALAT_PROMPTS.TONG_QUAT) {
            activeParts.push(DALAT_PROMPTS.TONG_QUAT);
        }

        activeParts.push(`\n--- DỮ LIỆU CẨM NANG BẮT BUỘC TRONG HỆ THỐNG ---\n${knowledgeBase}`);
        return activeParts.join("\n\n");
    }
};
