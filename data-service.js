(function () {
    let placesCache = null;
    let rawLegacyCsv = "";
    let loadPromise = null;

    function splitCsvLine(line) {
        const result = [];
        let current = "";
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (quoted && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch === ',' && !quoted) {
                result.push(current);
                current = "";
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    function parseCsv(text) {
        const rows = [];
        let line = "";
        let quoted = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '"') {
                line += ch;
                if (quoted && text[i + 1] === '"') {
                    line += text[++i];
                } else {
                    quoted = !quoted;
                }
            } else if ((ch === '\n' || ch === '\r') && !quoted) {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                if (line.length) rows.push(splitCsvLine(line));
                line = "";
            } else {
                line += ch;
            }
        }
        if (line.length) rows.push(splitCsvLine(line));
        return rows;
    }

    function numOrNull(value) {
        if (value === null || value === undefined || value === "") return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function parseCoords(value) {
        if (!value || typeof value !== "string") return { lat: null, lng: null };
        const parts = value.split(',').map(v => Number(v.trim()));
        return {
            lat: Number.isFinite(parts[0]) ? parts[0] : null,
            lng: Number.isFinite(parts[1]) ? parts[1] : null
        };
    }

    function normalizePlace(raw) {
        const legacyCoords = parseCoords(raw['Vị trí']);
        const warningCoords = parseCoords(raw._AC || raw.warning_coords);
        const country = raw.country ?? raw.Country ?? raw['Quốc gia'] ?? "";
        const city = raw.city ?? raw.City ?? raw['Thành phố'] ?? raw['Tỉnh/Thành phố'] ?? raw['Khu vực'] ?? "";
        const area = raw.area ?? raw.Area ?? raw['Phân khu'] ?? raw['Khu vực nhỏ'] ?? "";
        const categoryString = raw.category ?? raw.Category ?? "";

        return {
            id: raw.id ?? null,
            name: raw.name ?? raw.Tên ?? "",
            country,
            city,
            area,
            category: categoryString,
            categories: String(categoryString).split(',').map(v => v.trim()).filter(Boolean),
            map_link: raw.map_link ?? raw.Link ?? "",
            latitude: numOrNull(raw.latitude) ?? legacyCoords.lat,
            longitude: numOrNull(raw.longitude) ?? legacyCoords.lng,
            recommend: raw.recommend ?? raw.Recommend ?? "",
            move_difficulty: raw.move_difficulty ?? raw['Di chuyển'] ?? "Dễ",
            road_note: raw.road_note ?? raw['Lưu ý đường vào'] ?? "",
            image_url: raw.image_url ?? raw.Image ?? "",
            open_time_1: raw.open_time_1 ?? raw['Giờ mở cửa'] ?? "",
            open_time_2: raw.open_time_2 ?? raw['Giờ mở cửa 2'] ?? "",
            price: raw.price ?? raw['Giá/món'] ?? "",
            ticket: raw.ticket ?? raw['Vé'] ?? "",
            warning_image: raw.warning_image ?? raw._AA ?? "",
            warning_text: raw.warning_text ?? raw._AB ?? "",
            warning_latitude: numOrNull(raw.warning_latitude) ?? warningCoords.lat,
            warning_longitude: numOrNull(raw.warning_longitude) ?? warningCoords.lng,
            raw
        };
    }

    async function fetchLegacyPlaces() {
        const response = await fetch(CONFIG.LEGACY_CSV_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Legacy data HTTP ${response.status}`);
        rawLegacyCsv = await response.text();
        const rows = parseCsv(rawLegacyCsv);
        if (!rows.length) return [];
        const headers = rows[0];
        return rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                if (header) obj[header] = row[index] ?? "";
            });
            obj._AA = row[26] ?? "";
            obj._AB = row[27] ?? "";
            obj._AC = row[28] ?? "";
            return normalizePlace(obj);
        }).filter(place => place.name || place.warning_text);
    }

    async function fetchD1Places() {
        const base = CONFIG.DATA_API_URL.replace(/\/$/, '');
        const response = await fetch(`${base}/places`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`D1 data HTTP ${response.status}`);
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : payload.places;
        if (!Array.isArray(rows)) throw new Error('Invalid D1 places payload');
        return rows.map(normalizePlace);
    }

    async function loadPlaces(force = false) {
        if (force) {
            placesCache = null;
            loadPromise = null;
        }
        if (placesCache) return placesCache;
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            const wantsD1 = Boolean(CONFIG.D1_ENABLED && CONFIG.DATA_API_URL);
            if (wantsD1) {
                placesCache = await fetchD1Places();
                window.dispatchEvent(new CustomEvent('travelos:data-source', { detail: { source: 'd1' } }));
            } else {
                placesCache = await fetchLegacyPlaces();
                window.dispatchEvent(new CustomEvent('travelos:data-source', { detail: { source: 'legacy' } }));
            }
            return placesCache;
        })();

        try {
            return await loadPromise;
        } finally {
            loadPromise = null;
        }
    }

    function csvEscape(value) {
        const str = String(value ?? "");
        if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    }

    async function getKnowledgeBase() {
        const places = await loadPlaces();
        if (!CONFIG.D1_ENABLED && rawLegacyCsv) return rawLegacyCsv;

        const headers = ['Tên','Khu vực','Category','Link','Vị trí','Recommend','Country','City','Area','Di chuyển','Lưu ý đường vào','Image','Giá/món','Vé','Giờ mở cửa','Giờ mở cửa 2','Điểm đen','Tọa độ điểm đen'];
        const lines = [headers.join(',')];
        places.forEach(p => {
            lines.push([
                p.name,
                p.area || p.city,
                p.category,
                p.map_link,
                p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : '',
                p.recommend,
                p.country,
                p.city,
                p.area,
                p.move_difficulty,
                p.road_note,
                p.image_url,
                p.price,
                p.ticket,
                p.open_time_1,
                p.open_time_2,
                p.warning_text,
                p.warning_latitude != null && p.warning_longitude != null ? `${p.warning_latitude},${p.warning_longitude}` : ''
            ].map(csvEscape).join(','));
        });
        return lines.join('\n');
    }

    async function createPlace(place) {
        if (!CONFIG.D1_ENABLED || !CONFIG.DATA_API_URL) {
            throw new Error('D1 chưa được bật trong config.js');
        }
        const base = CONFIG.DATA_API_URL.replace(/\/$/, '');
        const response = await fetch(`${base}/places`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(place)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `D1 write HTTP ${response.status}`);
        await loadPlaces(true);
        return payload;
    }

    window.TravelData = {
        loadPlaces,
        getKnowledgeBase,
        createPlace,
        normalizePlace
    };
})();
