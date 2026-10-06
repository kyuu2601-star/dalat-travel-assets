const CONFIG = {
    DATA_API_URL: "https://ai-test.kyuu2601.workers.dev/api",
    D1_ENABLED: true,
    LEGACY_CSV_URL: "",

    WORKER_URL: "https://ai-test.kyuu2601.workers.dev",
    AI_PATH: "/ai-v3",
    MAP_WORKER_URL: "https://travelos-map.kyuu2601.workers.dev/",

    // Browser key riêng, chỉ bật Maps JavaScript API và restrict theo GitHub Pages domain.
    // Dán key thứ 2 của bạn vào đây trước khi deploy GitHub Pages.
    GOOGLE_MAPS_BROWSER_KEY: "AIzaSyDWDZlRWk9ceORNO-pQfOTfsYMBhjtW0BE",

    // Browser key chỉ dùng cho Geoapify map tiles ngoài Trung Quốc.
    // Giữ lại để fallback nếu Google Maps không tải được.
    GEOAPIFY_BROWSER_KEY: "416094df2d9642f392ffc02c7dd2e81c"
};
window.CONFIG = CONFIG;
