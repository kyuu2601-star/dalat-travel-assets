const CONFIG = {
    DATA_API_URL: "https://ai-test.kyuu2601.workers.dev/api",
    D1_ENABLED: true,
    LEGACY_CSV_URL: "",

    WORKER_URL: "https://ai-test.kyuu2601.workers.dev",
    AI_PATH: "/ai-v3",
    MAP_WORKER_URL: "https://travelos-map.kyuu2601.workers.dev/",

    // Browser key chỉ dùng cho Geoapify map tiles ngoài Trung Quốc.
    // Restrict key theo HTTP referrer/origin của TravelOS trong Geoapify MyProjects.
    GEOAPIFY_BROWSER_KEY: "416094df2d9642f392ffc02c7dd2e81c"
};
window.CONFIG = CONFIG;
