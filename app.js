let fullData = [];
let userPos = null;
let selectedCates = new Set();
let renderedPlaces = [];
let lastPos = null;
let isSystemLive = false;
let radarInterval = null;
let currentIntervalTime = 0;
let wakeLock = null;
let bootStarted = false;
const GPS_JITTER_FLOOR_KM = 0.02;
const GPS_LARGE_JUMP_KM = 0.5;
const GPS_RELOCATION_CONFIRMATIONS = 2;
let pendingMotionFix = null;
let progressiveMotionSamples = 0;
let appGpsWatchId = null;
let appGpsRetryTimer = null;
let appGpsConfirmationTimer = null;
let pendingGeoDetectPos = null;

function setLoadingStatus(message, isError = false) {
    const node = document.getElementById('loading-status');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', isError);
}

function withBootTimeout(promise, timeoutMs, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} tải quá lâu.`)), timeoutMs))
    ]);
}

function finishBoot(failures = []) {
    isSystemLive = true;
    window.isSystemLive = true;
    const loading = document.getElementById('loading-screen');
    if (!loading) return;
    if (failures.length) setLoadingStatus(`${failures.join(' · ')} · Vẫn có thể tiếp tục`, true);
    else setLoadingStatus("Let's Go Pipi đã sẵn sàng");
    setTimeout(() => {
        loading.classList.add('hide');
        setTimeout(() => loading.remove(), 1000);
    }, failures.length ? 900 : 250);
}

const GEO_CACHE_KEY = 'travelos_detected_location_v1';
const GEO_RECHECK_DISTANCE_KM = 25;
let geoRequestInFlight = false;
let detectedLocation = null;
let lastGeocodedPos = null;
let pendingDetectedLocation = null;
try { localStorage.removeItem(GEO_CACHE_KEY); } catch (_) {}

const CATEGORIES = [
    { id: 'Ăn', color: '#ffb38a', text: '#5c2d14' },
    { id: 'Chơi', color: '#c5e8b7', text: '#2d4d1e' },
    { id: 'Chụp hình', color: '#b3e0ff', text: '#1e3d5c' },
    { id: 'Uống', color: '#ffeb99', text: '#5c4b14' },
    { id: 'Local', color: '#ff7070', text: '#5c1414' },
    { id: 'Ăn Nhẹ', color: '#f7d1ff', text: '#4d1e5c' },
    { id: 'View Checkin', color: '#bcd6d6', text: '#2d4040' },
    { id: 'Đặc sản', color: '#eaff8a', text: '#404d1e' }
];

const audio500 = new Audio('500m.mp3');
const audio100 = new Audio('100m.mp3');
const audio10 = new Audio('10m.mp3');
let lastAlertDistance = 999;
let audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;
    const audios = [audio500, audio100, audio10];
    Promise.all(audios.map(audio => audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
    }).catch(() => null))).finally(() => {
        audioUnlocked = true;
    });
}

document.addEventListener('click', unlockAudio, { once: true });

audio500.preload = 'auto';
audio100.preload = 'auto';
audio10.preload = 'auto';

function playForegroundAudio(audio) {
    if (!audio || document.visibilityState !== 'visible') return;
    [audio500, audio100, audio10].forEach(other => {
        if (other !== audio && !other.paused) {
            other.pause();
            other.currentTime = 0;
        }
    });
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

function playSmartWarning(distKm) {
    const toggle = document.getElementById('vibrateToggle');
    if (!toggle || !toggle.checked) return;

    const d = Number(distKm);
    if (!Number.isFinite(d)) return;

    let audio = null;
    let label = '';

    if (d <= 0.01 && lastAlertDistance > 0.01) {
        audio = audio10;
        label = '10m';
        lastAlertDistance = 0.01;
    } else if (d <= 0.1 && lastAlertDistance > 0.1) {
        audio = audio100;
        label = '100m';
        lastAlertDistance = 0.1;
    } else if (d <= 0.5 && lastAlertDistance > 0.5) {
        audio = audio500;
        label = '500m';
        lastAlertDistance = 0.5;
    }

    if (audio) {
        playForegroundAudio(audio);
        triggerHeavyWarning('⚠️ TRAVEL OS', `Cảnh báo còn khoảng ${label}`);
    }

    if (d > 1.0) lastAlertDistance = 999;
}

function distanceBetweenCoords(lat1, lon1, lat2, lon2) {
    const values = [lat1, lon1, lat2, lon2].map(Number);
    if (!values.every(Number.isFinite)) return Infinity;

    const R = 6371;
    const p1 = values[0] * Math.PI / 180;
    const p2 = values[2] * Math.PI / 180;
    const dLat = (values[2] - values[0]) * Math.PI / 180;
    const dLon = (values[3] - values[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resetPendingMotion() {
    pendingMotionFix = null;
    progressiveMotionSamples = 0;
}

function shouldAttachGpsFix(next) {
    if (!userPos) return true;

    const movedKm = distanceBetweenCoords(userPos.lat, userPos.lon, next.lat, next.lon);
    const accuracyKm = Number.isFinite(next.accuracy) ? Math.max(0, next.accuracy / 1000) : 0;
    const jitterKm = Math.max(GPS_JITTER_FLOOR_KM, Math.min(0.08, accuracyKm));

    // Một dao động nhỏ không được phép làm điểm tìm kiếm "quanh đây" nhảy vị trí.
    if (movedKm <= jitterKm) {
        resetPendingMotion();
        return false;
    }

    // Một bước nhảy lớn có thể là Sensor vừa đổi, nhưng cũng có thể là một fix lỗi.
    // Chỉ thay anchor sau khi app nhận thêm một mẫu xác nhận gần cùng vị trí mới.
    if (movedKm >= Math.max(GPS_LARGE_JUMP_KM, accuracyKm * 5)) {
        const candidateDistance = pendingMotionFix
            ? distanceBetweenCoords(pendingMotionFix.lat, pendingMotionFix.lon, next.lat, next.lon)
            : Infinity;
        const confirmationRadiusKm = Math.max(0.1, jitterKm * 2);

        if (!pendingMotionFix || candidateDistance > confirmationRadiusKm) {
            pendingMotionFix = next;
            progressiveMotionSamples = 1;
            return false;
        }

        pendingMotionFix = next;
        progressiveMotionSamples += 1;
        if (progressiveMotionSamples < GPS_RELOCATION_CONFIRMATIONS) return false;

        resetPendingMotion();
        return true;
    }

    if (!pendingMotionFix) {
        pendingMotionFix = next;
        progressiveMotionSamples = 1;
        return false;
    }

    const previousDistance = distanceBetweenCoords(userPos.lat, userPos.lon, pendingMotionFix.lat, pendingMotionFix.lon);
    const currentDistance = movedKm;
    const firstLat = pendingMotionFix.lat - userPos.lat;
    const firstLon = pendingMotionFix.lon - userPos.lon;
    const nextLat = next.lat - pendingMotionFix.lat;
    const nextLon = next.lon - pendingMotionFix.lon;
    const continuesForward = firstLat * nextLat + firstLon * nextLon > 0;
    const movesFarther = currentDistance >= previousDistance;

    progressiveMotionSamples = continuesForward && movesFarther ? progressiveMotionSamples + 1 : 1;
    pendingMotionFix = next;
    if (progressiveMotionSamples < 2) return false;

    resetPendingMotion();
    return true;
}

function attachGpsFix(next) {
    clearTimeout(appGpsConfirmationTimer);
    appGpsConfirmationTimer = null;
    lastPos = next;
    userPos = next;
    window.userPos = next;
    const oldAnchor = window.travelosLocationAnchor;
    const sameAnchor = oldAnchor && distanceBetweenCoords(
        oldAnchor.latitude, oldAnchor.longitude, next.lat, next.lon
    ) <= 0.25;
    window.travelosLocationAnchor = {
        latitude: next.lat,
        longitude: next.lon,
        country: sameAnchor ? oldAnchor.country : '',
        city: sameAnchor ? oldAnchor.city : '',
        area: sameAnchor ? oldAnchor.area : ''
    };
    updateGpsDisplay();
    checkRadarStatus();
    applyFilters();
    maybeDetectGpsLocation(next);
}

function getDistanceKm(targetLat, targetLng) {
    if (!userPos) return Infinity;
    return distanceBetweenCoords(userPos.lat, userPos.lon, targetLat, targetLng);
}

function formatDistance(distanceKm) {
    if (!Number.isFinite(distanceKm)) return '--';
    if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
    if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
    return `${Math.round(distanceKm)} km`;
}

function foldLocation(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function findDatasetValue(candidates, values) {
    const list = values.filter(Boolean);
    const candidateKeys = candidates.filter(Boolean).map(foldLocation).filter(Boolean);

    for (const value of list) {
        const key = foldLocation(value);
        if (candidateKeys.includes(key)) return value;
    }

    for (const value of list) {
        const key = foldLocation(value);
        if (candidateKeys.some(candidate => candidate.length >= 4 && (key.includes(candidate) || candidate.includes(key)))) return value;
    }

    return '';
}

function buildCountryCandidates(data) {
    const candidates = [data.countryName, data.countryCode];

    if (data.countryCode === 'VN') candidates.push('Việt Nam', 'Vietnam', 'Viet Nam');
    if (data.countryCode === 'CN') candidates.push('Trung Quốc', 'China', 'PRC');
    if (data.countryCode === 'SG') candidates.push('Singapore');

    return candidates.filter(Boolean);
}

function buildCityCandidates(data) {
    const candidates = [data.city, data.locality, data.principalSubdivision, data.localityInfo?.administrative?.[2]?.name];
    const joined = foldLocation(candidates.filter(Boolean).join(' '));

    if (joined.includes('hochiminh') || joined.includes('saigon')) {
        candidates.push('TP.HCM', 'TP HCM', 'Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'Ho Chi Minh City', 'Saigon');
    }

    if (joined.includes('dalat')) candidates.push('Đà Lạt', 'Da Lat');
    if (joined.includes('danang')) candidates.push('Đà Nẵng', 'Da Nang');
    if (joined.includes('vungtau')) candidates.push('Vũng Tàu', 'Vung Tau');
    if (joined.includes('shanghai')) candidates.push('Thượng Hải', 'Shanghai');
    if (joined.includes('chongqing')) candidates.push('Trùng Khánh', 'Chongqing');
    if (joined.includes('fenghuang')) candidates.push('Phượng Hoàng', 'Fenghuang');

    return candidates.filter(Boolean);
}

function updateGpsDisplay() {
    const node = document.getElementById('gps-coords');
    if (!node || !userPos) return;

    const coords = `${userPos.lat.toFixed(5)}, ${userPos.lon.toFixed(5)}`;
    const label = [detectedLocation?.matchedCity || detectedLocation?.city, detectedLocation?.matchedCountry || detectedLocation?.country]
        .filter(Boolean)
        .join(', ');

    node.textContent = label ? `${label} · ${coords}` : coords;
}

function canonicalDetectedCountry(data) {
    if (data.countryCode === 'VN') return 'Việt Nam';
    if (data.countryCode === 'CN') return 'Trung Quốc';
    if (data.countryCode === 'SG') return 'Singapore';
    return data.country || '';
}

function canonicalDetectedCity(data) {
    const joined = foldLocation(
        [data.city, data.locality, data.principalSubdivision]
            .filter(Boolean)
            .join(' ')
    );

    if (joined.includes('hochiminh') || joined.includes('saigon')) return 'TP.HCM';
    if (joined.includes('dalat')) return 'Đà Lạt';
    if (joined.includes('danang')) return 'Đà Nẵng';
    if (joined.includes('vungtau')) return 'Vũng Tàu';
    if (joined.includes('shanghai')) return 'Thượng Hải';
    if (joined.includes('chongqing')) return 'Trùng Khánh';
    if (joined.includes('fenghuang')) return 'Phượng Hoàng';

    return data.city || data.locality || data.principalSubdivision || '';
}

function applyDetectedLocation(data) {
    detectedLocation = data;

    const countrySelect = document.getElementById('selectCountry');
    const citySelect = document.getElementById('selectCity');
    const areaSelect = document.getElementById('selectArea');

    if (!fullData.length || !countrySelect || !citySelect || !areaSelect) {
        pendingDetectedLocation = data;
        updateGpsDisplay();
        return;
    }

    const dataCountries = uniqSorted(fullData.map(item => item.country));
    const detectedCountry = findDatasetValue(buildCountryCandidates(data), dataCountries) || canonicalDetectedCountry(data);
    const countries = uniqSorted([...dataCountries, detectedCountry]);
    setSelectOptions(countrySelect, countries, 'Tất cả quốc gia');
    countrySelect.value = detectedCountry || '';

    const dataCities = uniqSorted(
        fullData
            .filter(item => !detectedCountry || item.country === detectedCountry)
            .map(item => item.city)
    );
    const detectedCity = findDatasetValue(buildCityCandidates(data), dataCities) || canonicalDetectedCity(data);
    const cities = uniqSorted([...dataCities, detectedCity]);
    setSelectOptions(citySelect, cities, 'Tất cả thành phố');
    citySelect.value = detectedCity || '';

    const areas = uniqSorted(
        fullData
            .filter(item => (!detectedCountry || item.country === detectedCountry) && (!detectedCity || item.city === detectedCity))
            .map(item => item.area)
    );
    setSelectOptions(areaSelect, areas, 'Tất cả khu vực');
    areaSelect.value = '';

    detectedLocation = {
        ...data,
        matchedCountry: detectedCountry || '',
        matchedCity: detectedCity || ''
    };
    if (userPos) {
        window.travelosLocationAnchor = {
            latitude: userPos.lat,
            longitude: userPos.lon,
            country: detectedCountry || canonicalDetectedCountry(data),
            city: detectedCity || canonicalDetectedCity(data),
            area: ''
        };
    }
    pendingDetectedLocation = null;

    updateGpsDisplay();
    applyFilters();
}

function readGeoCache(position) {
    try { localStorage.removeItem(GEO_CACHE_KEY); } catch (_) {}
    return null;
}

function saveGeoCache(position, data) {
    // Privacy: vị trí GPS và kết quả reverse-geocode chỉ sống trong RAM của phiên hiện tại.
}

function inferNativeLocation(position) {
    const lat = Number(position?.lat);
    const lon = Number(position?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    // Trùng Khánh municipality is intentionally broad so the app can switch
    // to its China-only flow without a reverse-geocoding network request.
    if (lat >= 28.0 && lat <= 32.3 && lon >= 105.2 && lon <= 110.3) {
        return { country:'Trung Quốc', countryCode:'CN', city:'Trùng Khánh', locality:'', principalSubdivision:'Trùng Khánh' };
    }

    const outline = [[73.5,39.5],[79,35.5],[80,30],[88,27.5],[92,28],[97,28],[98,24],[101,21.5],[102,22.5],[106.5,22.8],[108,21.5],[110,20.3],[114,22],[117,23],[120,25],[122,29],[122,40],[125,40],[131,43],[135,48],[132,53],[120,54],[108,49],[95,49],[87,47],[80,45]];
    let inMainlandChina = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const [xi, yi] = outline[i];
        const [xj, yj] = outline[j];
        if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inMainlandChina = !inMainlandChina;
    }
    inMainlandChina = inMainlandChina || (lat >= 18 && lat <= 20.6 && lon >= 108.5 && lon <= 111.5);
    if (inMainlandChina) {
        return { country:'Trung Quốc', countryCode:'CN', city:'', locality:'', principalSubdivision:'' };
    }
    return null;
}

async function maybeDetectGpsLocation(position) {
    if (geoRequestInFlight) {
        pendingGeoDetectPos = position;
        return;
    }

    if (lastGeocodedPos) {
        const movedKm = distanceBetweenCoords(position.lat, position.lon, lastGeocodedPos.lat, lastGeocodedPos.lon);
        if (movedKm < GEO_RECHECK_DISTANCE_KM) return;
    }

    const cached = readGeoCache(position);
    if (cached) {
        lastGeocodedPos = { lat: cached.latitude, lon: cached.longitude };
        applyDetectedLocation(cached);
        return;
    }

    const inferred = inferNativeLocation(position);
    if (inferred) {
        lastGeocodedPos = { lat:position.lat, lon:position.lon };
        saveGeoCache(position, inferred);
        applyDetectedLocation(inferred);
        return;
    }

    if (window.TRAVELOS_NATIVE) {
        lastGeocodedPos = { lat:position.lat, lon:position.lon };
        return;
    }

    geoRequestInFlight = true;

    try {
        const endpoint = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
        endpoint.searchParams.set('latitude', position.lat);
        endpoint.searchParams.set('longitude', position.lon);
        endpoint.searchParams.set('localityLanguage', 'vi');

        const response = await fetch(endpoint.toString(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Reverse geocode HTTP ${response.status}`);

        const raw = await response.json();
        const data = {
            country: raw.countryName || '',
            countryCode: raw.countryCode || '',
            city: raw.city || raw.locality || raw.principalSubdivision || '',
            locality: raw.locality || '',
            principalSubdivision: raw.principalSubdivision || '',
            localityInfo: raw.localityInfo || null
        };

        const currentStillMatches = userPos &&
            distanceBetweenCoords(userPos.lat, userPos.lon, position.lat, position.lon) <= 0.25;
        if (!currentStillMatches) return;

        lastGeocodedPos = { lat: position.lat, lon: position.lon };
        saveGeoCache(position, data);
        applyDetectedLocation(data);
    } catch (error) {
        console.warn('Không xác định được Country/City từ GPS:', error);
    } finally {
        geoRequestInFlight = false;
        const queued = pendingGeoDetectPos;
        pendingGeoDetectPos = null;
        if (queued && (!lastGeocodedPos || distanceBetweenCoords(
            queued.lat, queued.lon, lastGeocodedPos.lat, lastGeocodedPos.lon
        ) >= GEO_RECHECK_DISTANCE_KM)) maybeDetectGpsLocation(queued);
    }
}

function canUseVibration() {
    return 'vibrate' in navigator &&
        (!navigator.userActivation || navigator.userActivation.hasBeenActive);
}

function checkRadarStatus() {
    if (!userPos || fullData.length === 0) return;
    const radarIcon = document.getElementById('radar-box');
    let minDistance = Infinity;
    let nearestWarning = null;

    fullData.forEach(item => {
        if (!item.warning_text) return;
        const d = getDistanceKm(item.warning_latitude, item.warning_longitude);
        if (d < minDistance) {
            minDistance = d;
            nearestWarning = item.warning_text;
        }
    });

    let intervalTime = 0;
    if (minDistance <= 0.2) intervalTime = 1000;
    else if (minDistance <= 0.5) intervalTime = 1500;
    else if (minDistance <= 1.0) intervalTime = 3000;

    if (nearestWarning && intervalTime > 0) {
        radarIcon.classList.add('radar-blink');
        playSmartWarning(minDistance);

        if (radarInterval && currentIntervalTime !== intervalTime) {
            clearInterval(radarInterval);
            radarInterval = null;
        }

        if (!radarInterval) {
            currentIntervalTime = intervalTime;
            radarInterval = setInterval(() => {
                const toggle = document.getElementById('vibrateToggle');
                if (toggle?.checked && canUseVibration()) {
                    navigator.vibrate([200, 100, 200]);
                }
            }, intervalTime);
        }
    } else {
        radarIcon.classList.remove('radar-blink');
        if (radarInterval) {
            clearInterval(radarInterval);
            radarInterval = null;
        }
        if (canUseVibration()) navigator.vibrate(0);
        if (minDistance > 1) lastAlertDistance = 999;
    }
}

function toggleWarningModal() {
    const modal = document.getElementById('warning-modal');
    const open = !modal.classList.contains('open');
    if (open) renderWarningList();
    modal.classList.toggle('open', open);
    modal.setAttribute('aria-hidden', String(!open));
}

function renderWarningList() {
    const container = document.getElementById('warning-list');
    const warnings = fullData
        .filter(item => item.warning_text)
        .map(item => ({ ...item, currentDist: getDistanceKm(item.warning_latitude, item.warning_longitude) }))
        .sort((a, b) => a.currentDist - b.currentDist);

    container.innerHTML = warnings.map(item => {
        const isNear = item.currentDist <= 1.0;
        return `
            <article class="warning-card ${isNear ? 'near-danger' : ''}">
                ${item.warning_image ? `<div class="warning-image-box"><img src="${escapeAttribute(item.warning_image)}" alt="warning-ref"></div>` : ''}
                <div class="warning-content">
                    <div class="warning-row">
                        <span class="warning-badge">${isNear ? 'DANGER ZONE' : 'Traffic Alert'}</span>
                        <span class="warning-distance">DIST: ${formatDistance(item.currentDist)}</span>
                    </div>
                    <p>“${escapeHtml(item.warning_text)}”</p>
                </div>
            </article>`;
    }).join('') || '<p class="empty-state">No traffic intel available.</p>';
}

function saveVibrateState() {
    const enabled = document.getElementById('vibrateToggle').checked;
    localStorage.setItem('vibrateEnabled', String(enabled));
}

function getOpeningStatus(time1, time2) {
    const combinedTimeStr = [time1, time2].filter(Boolean).join(', ');
    if (!combinedTimeStr || combinedTimeStr.toLowerCase().includes('n/a')) return { status: 'Unknown', type: 'unknown' };

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const shifts = combinedTimeStr.split(/[,|]/).map(s => s.trim()).filter(s => s.includes(':'));

    for (const shift of shifts) {
        const parts = shift.split('-').map(p => p.trim());
        if (parts.length !== 2) continue;

        const parseTime = value => {
            const [h, m] = value.split(':').map(Number);
            return h * 60 + (m || 0);
        };

        const startMins = parseTime(parts[0]);
        const endMins = parseTime(parts[1]);

        if (endMins < startMins) {
            if (currentMins >= startMins || currentMins <= endMins) return { status: 'Open Now', type: 'open' };
        } else if (currentMins >= startMins && currentMins <= endMins) {
            if (endMins - currentMins <= 60) return { status: 'Close in 1h', type: 'soon' };
            return { status: 'Open Now', type: 'open' };
        }

        if (startMins > currentMins && startMins - currentMins <= 60) return { status: 'Open in 1h', type: 'soon' };
    }

    return { status: 'Closed', type: 'closed' };
}

function renderChips() {
    const container = document.getElementById('category-container');
    container.innerHTML = CATEGORIES.map(c => `
        <button type="button" onclick="toggleCate('${escapeAttribute(c.id)}')" id="chip-${escapeAttribute(c.id)}" class="cate-chip" style="--chip:${c.color};--chip-text:${c.text}">${escapeHtml(c.id)}</button>
    `).join('');
}

function toggleCate(id) {
    if (selectedCates.has(id)) selectedCates.delete(id);
    else selectedCates.add(id);

    document.getElementById(`chip-${id}`)?.classList.toggle('active', selectedCates.has(id));
    applyFilters();
}

function uniqSorted(values) {
    return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi'));
}

function setSelectOptions(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` +
        values.map(value => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join('');

    if (values.includes(current)) select.value = current;
}

function renderLocationFilters() {
    const countrySelect = document.getElementById('selectCountry');
    const citySelect = document.getElementById('selectCity');
    const areaSelect = document.getElementById('selectArea');

    const countries = uniqSorted(fullData.map(item => item.country));
    setSelectOptions(countrySelect, countries, 'Tất cả quốc gia');

    const country = countrySelect.value;
    const cities = uniqSorted(
        fullData
            .filter(item => !country || item.country === country)
            .map(item => item.city)
    );
    setSelectOptions(citySelect, cities, 'Tất cả thành phố');

    const city = citySelect.value;
    const areas = uniqSorted(
        fullData
            .filter(item => (!country || item.country === country) && (!city || item.city === city))
            .map(item => item.area)
    );
    setSelectOptions(areaSelect, areas, 'Tất cả khu vực');
}

function handleCountryChange() {
    const country = document.getElementById('selectCountry').value;
    const citySelect = document.getElementById('selectCity');
    const cities = uniqSorted(
        fullData
            .filter(item => !country || item.country === country)
            .map(item => item.city)
    );

    setSelectOptions(citySelect, cities, 'Tất cả thành phố');
    citySelect.value = '';
    handleCityChange();
}

function handleCityChange() {
    const country = document.getElementById('selectCountry').value;
    const city = document.getElementById('selectCity').value;
    const areaSelect = document.getElementById('selectArea');
    const areas = uniqSorted(
        fullData
            .filter(item => (!country || item.country === country) && (!city || item.city === city))
            .map(item => item.area)
    );

    setSelectOptions(areaSelect, areas, 'Tất cả khu vực');
    areaSelect.value = '';
    applyFilters();
}

function applyFilters() {
    const query = document.getElementById('inputSearch').value.trim().toLowerCase();
    const country = document.getElementById('selectCountry').value;
    const city = document.getElementById('selectCity').value;
    const area = document.getElementById('selectArea').value;

    let filtered = fullData.filter(item => {
        if (!item.name) return false;

        const haystack = [item.name, item.recommend, item.country, item.city, item.area, item.category]
            .join(' ')
            .toLowerCase();

        const matchLocation =
            (!country || item.country === country) &&
            (!city || item.city === city) &&
            (!area || item.area === area);

        const matchCategory =
            selectedCates.size === 0 ||
            [...selectedCates].every(c => item.categories.includes(c));

        return haystack.includes(query) && matchLocation && matchCategory;
    });

    if (userPos) {
        filtered.sort(
            (a, b) =>
                getDistanceKm(a.latitude, a.longitude) -
                getDistanceKm(b.latitude, b.longitude)
        );
    }

    renderGrid(filtered);
}

function renderRecommend(text) {
    return escapeHtml(text || 'No specific data')
        .replace(/&lt;b&gt;/gi, '<b>')
        .replace(/&lt;\/b&gt;/gi, '</b>')
        .replace(/\*([^*]+)\*/g, '<span class="recommend-highlight">$1</span>')
        .replace(/\n/g, '<br>');
}

function hasValidCoordinates(item) {
    if (item?.latitude == null || item?.longitude == null || item.latitude === '' || item.longitude === '') return false;
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function renderGrid(items) {
    const grid = document.getElementById('results-grid');
    renderedPlaces = items;

    grid.innerHTML = items.map((item, index) => {
        const distance = getDistanceKm(item.latitude, item.longitude);
        const status = getOpeningStatus(item.open_time_1, item.open_time_2);
        const diff = String(item.move_difficulty || 'Dễ');
        const diffType = diff.includes('Dễ') ? 'easy' : diff.includes('Trung') ? 'medium' : 'hard';
        const locationLabel = [item.area, item.city, item.country].filter(Boolean).join(' · ');

        return `
            <article class="card-travel" onclick="selectCard(this)">
                <div id="overlay-${index}" class="image-overlay"><img id="img-${index}" src="" alt="Preview"></div>
                <div class="card-topline">
                    <span class="open-status ${status.type}"><i></i>${escapeHtml(status.status)}</span>
                    <span class="distance-pill ${diffType}">📍 ${formatDistance(distance)}</span>
                </div>
                <h3>${escapeHtml(item.name)}</h3>
                <div class="card-meta-row">
                    <div>
                        <p class="place-area">${escapeHtml(locationLabel)}</p>
                        <p class="place-category">${escapeHtml(item.category)}</p>
                    </div>
                    <button id="btn-${index}" type="button" class="image-button" onclick="toggleImage(${index}, '${escapeJsString(item.image_url)}', event)">Image</button>
                </div>
                <div class="stats-grid">
                    <div class="stat-box"><span>Open Time</span><strong>${escapeHtml(item.open_time_1 || 'N/A')}</strong></div>
                    <div class="stat-box"><span>Price</span><strong>${escapeHtml(item.price || 'N/A')}</strong></div>
                    <div class="stat-box"><span>Ticket</span><strong>${escapeHtml(item.ticket || 'Free')}</strong></div>
                </div>
                <div class="recommend-box"><span>Recommend / Note:</span><div>${renderRecommend(item.recommend)}</div></div>
                <div class="road-note-slot">${item.road_note ? `<div class="road-note">⚠️ <span>${escapeHtml(item.road_note)}</span></div>` : ''}</div>
                ${hasValidCoordinates(item) ? `<button type="button" class="route-button" onclick="openPlaceNavigation(${index}, event)">Chỉ Đường</button>` : '<span class="route-button disabled">Chưa có tọa độ</span>'}
            </article>`;
    }).join('') || '<p class="empty-state grid-empty">Không có địa điểm phù hợp bộ lọc.</p>';
}

async function openPlaceNavigation(index, event) {
    event?.stopPropagation();
    event?.preventDefault();
    const item = renderedPlaces[index];
    if (!item) return;
    const destination = {
        name: item.name || 'Điểm đến',
        localizedName: item.localizedName || '',
        localizedNames: item.localizedNames || null,
        country: item.country || '',
        city: item.city || '',
        area: item.area || '',
        address: [item.area, item.city, item.country].filter(Boolean).join(', '),
        lat: Number(item.latitude),
        lng: Number(item.longitude),
        coordSystem: item.coordinate_system || 'wgs84'
    };
    try {
        const country = foldLocation(destination.country);
        const isChina = ['trungquoc', 'china', 'cn'].some(value => country === value || country.includes(value))
            || window.ChinaNavigation?.isChinaPoint?.(destination)
            || window.ChinaNavigation?.isChinaPoint?.(window.userPos);
        if (isChina) {
            if (window.ChinaNavigation?.ensureLoaded) await window.ChinaNavigation.ensureLoaded(destination.city || '');
            if (!window.TravelNavigation?.open) throw new Error('AMap Navigation chưa sẵn sàng.');
            await window.TravelNavigation.open({ destination });
            return;
        }
        if (!window.GeoapifyNavigation?.open) throw new Error('Điều hướng đi bộ chưa sẵn sàng.');
        await window.GeoapifyNavigation.open({ destination, mode: 'walk' });
    } catch (error) {
        console.error('[TravelOS place navigation]', error);
        alert(error.message || 'Không mở được chỉ đường.');
    }
}

function selectCard(element) {
    document.querySelectorAll('.card-travel').forEach(card => card.classList.remove('active'));
    element.classList.add('active');
}

function toggleImage(index, url, event) {
    event?.stopPropagation();
    event?.preventDefault();

    if (!url) {
        alert('Chưa có ảnh ref!');
        return;
    }

    const overlay = document.getElementById(`overlay-${index}`);
    const button = document.getElementById(`btn-${index}`);
    const image = document.getElementById(`img-${index}`);
    const open = !overlay.classList.contains('open');

    if (open) image.src = url;

    overlay.classList.toggle('open', open);
    button.textContent = open ? 'Close' : 'Image';
    button.classList.toggle('close', open);
}

function openAddPlaceModal() {
    const modal = document.getElementById('add-place-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    const country = document.getElementById('selectCountry')?.value || detectedLocation?.matchedCountry || '';
    const city = document.getElementById('selectCity')?.value || detectedLocation?.matchedCity || '';
    const countryInput = document.getElementById('place-country');
    const cityInput = document.getElementById('place-city');
    const latInput = document.getElementById('place-lat');
    const lngInput = document.getElementById('place-lng');

    if (countryInput && !countryInput.value) countryInput.value = country;
    if (cityInput && !cityInput.value) cityInput.value = city;

    if (userPos) {
        if (latInput && !latInput.value) latInput.value = userPos.lat.toFixed(6);
        if (lngInput && !lngInput.value) lngInput.value = userPos.lon.toFixed(6);
    }
}

function closeAddPlaceModal() {
    const modal = document.getElementById('add-place-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

async function submitAddPlace(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const status = document.getElementById('add-place-status');
    const submit = document.getElementById('add-place-submit');
    const data = Object.fromEntries(new FormData(form).entries());

    ['latitude', 'longitude'].forEach(key => {
        data[key] = data[key] === '' ? null : Number(data[key]);
    });

    submit.disabled = true;
    status.textContent = 'Saving...';

    try {
        await TravelData.createPlace(data);
        fullData = await TravelData.loadPlaces();
        window.fullData = fullData;

        renderLocationFilters();
        if (detectedLocation) applyDetectedLocation(detectedLocation);

        renderChips();
        applyFilters();
        checkRadarStatus();

        form.reset();
        status.textContent = 'Saved to D1.';
        setTimeout(closeAddPlaceModal, 600);
    } catch (error) {
        status.textContent = error.message || 'Save failed.';
    } finally {
        submit.disabled = false;
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, '\\n');
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (_) {}
}

function triggerHeavyWarning(title, message) {
    const toggle = document.getElementById('vibrateToggle');
    if (!toggle?.checked) return;

    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.active?.postMessage({
                type: 'SHOW_NOTIFICATION',
                payload: {
                    title,
                    body: message,
                    silent: false
                }
            });
        });
    }
}

async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        try {
            await Notification.requestPermission();
        } catch (_) {}
    }
}

async function initTravelOS() {
    if (bootStarted) return;
    bootStarted = true;
    const savedState = localStorage.getItem('vibrateEnabled');

    if (savedState !== null) {
        document.getElementById('vibrateToggle').checked = savedState === 'true';
    }

    document.getElementById('add-place-form').addEventListener('submit', submitAddPlace);
    document.getElementById('add-place-button').classList.toggle(
        'hidden',
        !(CONFIG.D1_ENABLED && CONFIG.DATA_API_URL)
    );

    setLoadingStatus('Đang tải địa điểm và kết nối trợ lý...');
    const voiceBoot = Boolean(window.TRAVELOS_NATIVE);
    const ready = { places: false, bot: false, voice: !voiceBoot };
    let voicePercent = 0;
    let voicePhase = 'download';
    const voiceTrack = document.getElementById('loading-voice-track');
    const voiceBar = document.getElementById('loading-voice-bar');
    if (voiceTrack) voiceTrack.hidden = !voiceBoot;
    const updateProgress = () => {
        if (voiceBoot && !ready.voice) {
            if (voicePhase === 'download') {
                setLoadingStatus(`Đang tải giọng Pipi lần đầu… ${voicePercent}%`);
                if (voiceBar) voiceBar.style.width = `${voicePercent}%`;
                if (voiceTrack) voiceTrack.setAttribute('aria-valuenow', String(voicePercent));
            } else setLoadingStatus('Đang khởi động giọng Pipi trên máy…');
        } else if (ready.places && !ready.bot) setLoadingStatus('Đã có địa điểm · đang kết nối trợ lý...');
        else if (!ready.places && ready.bot) setLoadingStatus('Trợ lý đã sẵn sàng · đang tải địa điểm...');
        if (ready.voice && voiceTrack) voiceTrack.hidden = true;
    };

    const voiceTask = voiceBoot ? withBootTimeout((async () => {
        if (!window.PipiLocalVoice) throw new Error('Chưa có module giọng Pipi.');
        updateProgress();
        await window.PipiLocalVoice.prepare(progress => {
            voicePhase = progress.phase || 'download';
            voicePercent = Math.min(100, Math.round(progress.loaded / progress.total * 100));
            updateProgress();
        });
        ready.voice = true;
        updateProgress();
    })(), 900000, 'Giọng Pipi') : Promise.resolve();

    const placesTask = withBootTimeout((async () => {
        fullData = await TravelData.loadPlaces();
        window.fullData = fullData;

        renderChips();
        renderLocationFilters();

        if (pendingDetectedLocation || detectedLocation) {
            applyDetectedLocation(pendingDetectedLocation || detectedLocation);
        } else {
            applyFilters();
        }

        checkRadarStatus();
        ready.places = true;
        updateProgress();
        return fullData;
    })(), 16000, 'Dữ liệu địa điểm');

    const botTask = withBootTimeout((async () => {
        if (typeof initBot !== 'function') throw new Error('Module trợ lý chưa sẵn sàng.');
        const health = await initBot();
        ready.bot = true;
        updateProgress();
        return health;
    })(), 12000, 'Trợ lý');

    const [placesResult, botResult, voiceResult] = await Promise.allSettled([placesTask, botTask, voiceTask]);
    const failures = [];
    if (placesResult.status === 'rejected') {
        const error = placesResult.reason;
        const banner = document.getElementById('data-source-banner');
        banner.textContent = `Không tải được data: ${error.message}`;
        banner.classList.remove('hidden');
        failures.push('Chưa tải được địa điểm');
    }
    if (botResult.status === 'rejected') failures.push('Trợ lý đang kết nối lại');
    if (voiceResult.status === 'rejected') failures.push('Chưa tải được giọng Pipi');
    finishBoot(failures);
}

window.addEventListener('travelos:data-source', event => {
    const banner = document.getElementById('data-source-banner');

    if (event.detail?.source === 'legacy') {
        banner.textContent = "Let's Go Pipi đang dùng Sheet fallback. Sau khi deploy D1, bật D1_ENABLED trong config.js để chuyển hoàn toàn.";
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
});

window.addEventListener('travelos:data-updated', event => {
    if (!Array.isArray(event.detail?.places)) return;
    fullData = event.detail.places;
    window.fullData = fullData;
    renderChips();
    renderLocationFilters();
    if (pendingDetectedLocation || detectedLocation) applyDetectedLocation(pendingDetectedLocation || detectedLocation);
    else applyFilters();
    checkRadarStatus();
});

function handleAppGpsPosition(pos) {
    const newPos = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: Number(pos.coords.accuracy),
        timestamp: Number(pos.timestamp) || Date.now()
    };

    if (!Number.isFinite(newPos.lat) || !Number.isFinite(newPos.lon)) return;
    if (shouldAttachGpsFix(newPos)) {
        attachGpsFix(newPos);
        return;
    }

    // Chrome DevTools Sensor đôi khi chỉ phát một event khi đổi thành phố.
    // Xin thêm một fix ở tầng app để xác nhận relocation; chat không tự gọi GPS.
    if (pendingMotionFix && progressiveMotionSamples === 1 && !appGpsConfirmationTimer) {
        appGpsConfirmationTimer = setTimeout(() => {
            appGpsConfirmationTimer = null;
            navigator.geolocation.getCurrentPosition(handleAppGpsPosition, () => {}, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            });
        }, 400);
    }
}

function handleAppGpsError(error) {
    const gpsNode = document.getElementById('gps-coords');
    if (gpsNode) gpsNode.textContent = 'GPS chưa bật';
    if (appGpsWatchId !== null) navigator.geolocation.clearWatch?.(appGpsWatchId);
    appGpsWatchId = null;
    clearTimeout(appGpsRetryTimer);
    // Permission denied phải chờ user tự bật lại. Các lỗi tạm thời (đặc biệt
    // khi DevTools Sensor vừa đổi) được nối lại ở tầng app, không phải chat.
    if (Number(error?.code) !== 1) appGpsRetryTimer = setTimeout(startAppGpsWatch, 3000);
}

function startAppGpsWatch() {
    if (!navigator.geolocation || appGpsWatchId !== null) return;
    clearTimeout(appGpsRetryTimer);
    appGpsRetryTimer = null;
    appGpsWatchId = navigator.geolocation.watchPosition(handleAppGpsPosition, handleAppGpsError, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000
    });
}

startAppGpsWatch();
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && appGpsWatchId === null) startAppGpsWatch();
});

document.addEventListener('click', () => requestWakeLock(), { once: true });
document.addEventListener('click', requestNotificationPermission, { once: true });

if (!window.TRAVELOS_NATIVE && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTravelOS, { once: true });
else initTravelOS();
