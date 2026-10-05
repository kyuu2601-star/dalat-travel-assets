const CONFIG = {
    DATA_API_URL: "https://ai-test.kyuu2601.workers.dev/api",
    D1_ENABLED: true,
    LEGACY_CSV_URL: "",

    WORKER_URL: "https://ai-test.kyuu2601.workers.dev",
    MAP_WORKER_URL: "https://travelos-map.kyuu2601.workers.dev/",

    // Browser key only for rendering Google Maps in Vietnam.
    // Restrict this key by HTTP referrer to your TravelOS domain in Google Cloud Console.
    GOOGLE_MAPS_BROWSER_KEY: "",

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
                if (groupName === "DI_CHUYEN" && !DALAT_PROMPTS.DI_CHUYEN) promptGroupName = "DU_CHUYEN";
                if (DALAT_PROMPTS[promptGroupName]) activeParts.push(DALAT_PROMPTS[promptGroupName]);
            }
        }

        if (!hasMatched && DALAT_PROMPTS.TONG_QUAT) activeParts.push(DALAT_PROMPTS.TONG_QUAT);
        if (knowledgeBase) activeParts.push(`\n--- TRAVEL DATA STATUS ---\n${knowledgeBase}`);
        return activeParts.join("\n\n");
    }
};
window.CONFIG = CONFIG;
