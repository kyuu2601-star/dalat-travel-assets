(function () {
    const ADMIN_KEY_STORAGE = 'travelos_admin_key';
    const DATA_CHECKED_AT_STORAGE = 'travelos_data_checked_at';
    const SNAPSHOT_URL = 'data/places.snapshot.json';
    const SNAPSHOT_DB = 'travelos-local-data';
    const SNAPSHOT_STORE = 'snapshots';
    const SNAPSHOT_KEY = 'places';
    const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
    let placesCache = null;
    let loadPromise = null;
    let syncPromise = null;
    let currentVersion = '';

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

    function openSnapshotDb() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
            const request = indexedDB.open(SNAPSHOT_DB, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE)) {
                    request.result.createObjectStore(SNAPSHOT_STORE);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Cannot open local data store'));
        });
    }

    async function readStoredSnapshot() {
        let db;
        try {
            db = await openSnapshotDb();
            return await new Promise((resolve, reject) => {
                const request = db.transaction(SNAPSHOT_STORE, 'readonly').objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('Cannot read local snapshot'));
            });
        } catch (_) {
            return null;
        } finally {
            db?.close();
        }
    }

    async function writeStoredSnapshot(snapshot) {
        let db;
        try {
            db = await openSnapshotDb();
            await new Promise((resolve, reject) => {
                const request = db.transaction(SNAPSHOT_STORE, 'readwrite').objectStore(SNAPSHOT_STORE).put(snapshot, SNAPSHOT_KEY);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error || new Error('Cannot save local snapshot'));
            });
        } catch (error) {
            console.warn('[TravelOS data] Không lưu được snapshot vào thiết bị:', error);
        } finally {
            db?.close();
        }
    }

    async function readBundledSnapshot() {
        try {
            const response = await fetch(SNAPSHOT_URL, { cache: 'force-cache' });
            if (!response.ok) return null;
            const snapshot = await response.json();
            return Array.isArray(snapshot?.places) ? snapshot : null;
        } catch (_) {
            return null;
        }
    }

    function emitSource(source, extra = {}) {
        window.dispatchEvent(new CustomEvent('travelos:data-source', { detail: { source, ...extra } }));
    }

    async function fetchD1Places() {
        const response = await fetch(`${apiBase()}/places?limit=5000`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `D1 data HTTP ${response.status}`);
        const rows = Array.isArray(payload) ? payload : payload.places;
        if (!Array.isArray(rows)) throw new Error('Invalid D1 places payload');
        return rows;
    }

    async function fetchDataManifest() {
        const response = await fetch(`${apiBase()}/data-manifest`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.version) throw new Error(payload.error || `Data manifest HTTP ${response.status}`);
        return payload;
    }

    async function downloadAndStore(version = '') {
        const rows = await fetchD1Places();
        const snapshot = {
            version: String(version || `remote-${Date.now()}`),
            generatedAt: new Date().toISOString(),
            places: rows
        };
        await writeStoredSnapshot(snapshot);
        currentVersion = snapshot.version;
        placesCache = rows.map(normalizePlace);
        return placesCache;
    }

    function shouldCheckForUpdates() {
        const checkedAt = Number(localStorage.getItem(DATA_CHECKED_AT_STORAGE) || 0);
        return !Number.isFinite(checkedAt) || Date.now() - checkedAt >= SYNC_INTERVAL_MS;
    }

    function syncInBackground() {
        if (syncPromise || !CONFIG.D1_ENABLED || !CONFIG.DATA_API_URL || !shouldCheckForUpdates()) return;
        syncPromise = (async () => {
            const manifest = await fetchDataManifest();
            localStorage.setItem(DATA_CHECKED_AT_STORAGE, String(Date.now()));
            if (String(manifest.version) === currentVersion) return;
            const places = await downloadAndStore(manifest.version);
            window.dispatchEvent(new CustomEvent('travelos:data-updated', {
                detail: { version: currentVersion, places }
            }));
        })().catch(error => {
            console.warn('[TravelOS data] Không kiểm tra được phiên bản mới:', error);
        }).finally(() => { syncPromise = null; });
    }

    async function loadPlaces(force = false) {
        if (force) {
            placesCache = null;
            loadPromise = null;
            const manifest = await fetchDataManifest().catch(() => null);
            const places = await downloadAndStore(manifest?.version);
            localStorage.setItem(DATA_CHECKED_AT_STORAGE, String(Date.now()));
            emitSource('device', { version: currentVersion });
            return places;
        }
        if (placesCache) return placesCache;
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            const [stored, bundled] = await Promise.all([readStoredSnapshot(), readBundledSnapshot()]);
            const snapshot = Array.isArray(stored?.places) ? stored : bundled;
            if (snapshot) {
                currentVersion = String(snapshot.version || 'bundled');
                placesCache = snapshot.places.map(normalizePlace);
                emitSource(stored ? 'device' : 'bundled', { version: currentVersion });
                setTimeout(syncInBackground, 0);
                return placesCache;
            }

            const manifest = await fetchDataManifest().catch(() => null);
            await downloadAndStore(manifest?.version);
            localStorage.setItem(DATA_CHECKED_AT_STORAGE, String(Date.now()));
            emitSource('network', { version: currentVersion });
            return placesCache;
        })();
        try { return await loadPromise; }
        finally { loadPromise = null; }
    }

    async function getKnowledgeBase() {
        await loadPlaces();
        return "Let's Go Pipi D1 curated PLACES is active. Live nearby POIs use Geoapify outside China and AMap inside China.";
    }

    function getAdminKey(forcePrompt = false) {
        let key = forcePrompt ? '' : localStorage.getItem(ADMIN_KEY_STORAGE) || '';
        if (!key) {
            key = (window.prompt("Nhập Let's Go Pipi ADMIN_KEY để ghi dữ liệu vào D1:") || '').trim();
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

    window.TravelData = { loadPlaces, getKnowledgeBase, createPlace, normalizePlace, clearAdminKey, syncInBackground };
})();
