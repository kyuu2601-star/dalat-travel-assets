(function () {
    const ADMIN_KEY_STORAGE = 'travelos_admin_key';
    let placesCache = null;
    let loadPromise = null;

    function numOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function normalizePlace(raw) {
        const categoryString = raw.category ?? raw.Category ?? '';
        return {
            id: raw.id ?? null,
            amap_poi_id: raw.amap_poi_id || raw.poi_id || '',
            coordSystem: raw.coordSystem || raw.coordinate_system || 'wgs84',
            name: raw.name ?? raw.Tên ?? '',
            country: raw.country ?? raw.Country ?? raw['Quốc gia'] ?? '',
            city: raw.city ?? raw.City ?? raw['Thành phố'] ?? '',
            area: raw.area ?? raw.Area ?? raw['Phân khu'] ?? '',
            category: categoryString,
            categories: String(categoryString).split(',').map(v => v.trim()).filter(Boolean),
            map_link: raw.map_link ?? raw.Link ?? '',
            latitude: numOrNull(raw.latitude),
            longitude: numOrNull(raw.longitude),
            recommend: raw.recommend ?? raw.Recommend ?? '',
            move_difficulty: raw.move_difficulty ?? raw['Di chuyển'] ?? 'Dễ',
            road_note: raw.road_note ?? raw['Lưu ý đường vào'] ?? '',
            image_url: raw.image_url ?? raw.Image ?? '',
            open_time_1: raw.open_time_1 ?? raw['Giờ mở cửa'] ?? '',
            open_time_2: raw.open_time_2 ?? raw['Giờ mở cửa 2'] ?? '',
            price: raw.price ?? raw['Giá/món'] ?? '',
            ticket: raw.ticket ?? raw['Vé'] ?? '',
            warning_image: raw.warning_image ?? '',
            warning_text: raw.warning_text ?? '',
            warning_latitude: numOrNull(raw.warning_latitude),
            warning_longitude: numOrNull(raw.warning_longitude),
            raw
        };
    }

    function apiBase() {
        if (!CONFIG.D1_ENABLED || !CONFIG.DATA_API_URL) throw new Error('D1 chưa được bật trong config.js');
        return CONFIG.DATA_API_URL.replace(/\/$/, '');
    }

    async function fetchD1Places() {
        const response = await fetch(`${apiBase()}/places?limit=5000`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `D1 data HTTP ${response.status}`);
        const rows = Array.isArray(payload) ? payload : payload.places;
        if (!Array.isArray(rows)) throw new Error('Invalid D1 places payload');
        return rows.map(normalizePlace);
    }

    async function loadPlaces(force = false) {
        if (force) { placesCache = null; loadPromise = null; }
        if (placesCache) return placesCache;
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            placesCache = await fetchD1Places();
            window.dispatchEvent(new CustomEvent('travelos:data-source', { detail: { source: 'd1' } }));
            return placesCache;
        })();
        try { return await loadPromise; }
        finally { loadPromise = null; }
    }

    async function getKnowledgeBase() {
        await loadPlaces();
        return 'TravelOS D1 curated PLACES is active. Live nearby POIs use Geoapify outside China and AMap inside China.';
    }

    function getAdminKey(forcePrompt = false) {
        let key = forcePrompt ? '' : localStorage.getItem(ADMIN_KEY_STORAGE) || '';
        if (!key) {
            key = (window.prompt('Nhập TravelOS ADMIN_KEY để ghi dữ liệu vào D1:') || '').trim();
            if (!key) throw new Error('Chưa nhập ADMIN_KEY.');
            localStorage.setItem(ADMIN_KEY_STORAGE, key);
        }
        return key;
    }
    function clearAdminKey() { localStorage.removeItem(ADMIN_KEY_STORAGE); }

    async function postPlace(place, key) {
        const response = await fetch(`${apiBase()}/places`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(place)
        });
        const payload = await response.json().catch(() => ({}));
        return { response, payload };
    }

    async function createPlace(place) {
        let key = getAdminKey(false);
        let { response, payload } = await postPlace(place, key);
        if (response.status === 401) {
            clearAdminKey(); key = getAdminKey(true);
            ({ response, payload } = await postPlace(place, key));
        }
        if (!response.ok) throw new Error(payload.error || `D1 write HTTP ${response.status}`);
        await loadPlaces(true);
        return payload;
    }

    window.TravelData = { loadPlaces, getKnowledgeBase, createPlace, normalizePlace, clearAdminKey };
})();
