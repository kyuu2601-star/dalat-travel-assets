const CONFIG = {
    DATA_API_URL: "https://ai-test.kyuu2601.workers.dev/api",
    D1_ENABLED: true,
    LEGACY_CSV_URL: "",

    WORKER_URL: "https://ai-test.kyuu2601.workers.dev",
    MAP_WORKER_URL: "https://travelos-map.kyuu2601.workers.dev/",

    // Browser key chỉ dùng cho Geoapify map tiles ngoài Trung Quốc.
    // Restrict key theo HTTP referrer/origin của TravelOS trong Geoapify MyProjects.
    GEOAPIFY_BROWSER_KEY: "416094df2d9642f392ffc02c7dd2e81c",

    SYSTEM_PROMPT: function(userMessage, knowledgeBase, intentPlan) {
        const router = window.TravelIntentRouter;
        const plan = intentPlan || router?.route?.(userMessage) || { modules:[] };
        const modules = Array.isArray(plan.modules) ? plan.modules : [];
        const activeParts = [DALAT_PROMPTS.BASE_XUONG_SONG];

        for (const groupName of modules) {
            let promptGroupName = groupName;
            if (groupName === "DI_CHUYEN" && !DALAT_PROMPTS.DI_CHUYEN) promptGroupName = "DU_CHUYEN";
            if (DALAT_PROMPTS[promptGroupName]) activeParts.push(DALAT_PROMPTS[promptGroupName]);
        }

        if (!modules.length && DALAT_PROMPTS.TONG_QUAT) activeParts.push(DALAT_PROMPTS.TONG_QUAT);
        if (router?.runtimePolicy) activeParts.push(router.runtimePolicy(plan));
        if (knowledgeBase) activeParts.push(`\n--- TRAVEL DATA STATUS ---\n${knowledgeBase}`);
        return activeParts.join("\n\n");
    }
};
window.CONFIG = CONFIG;
