let fullData = [];
let userPos = null;
let selectedCates = new Set();
let lastPos = null;
let isSystemLive = false;
let radarInterval = null;
let currentIntervalTime = 0;
let wakeLock = null;

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

function getDistanceKm(targetLat, targetLng) {
    if (!userPos) return Infinity;
    const lat = Number(targetLat);
    const lng = Number(targetLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;

    const R = 6371;
    const lat1 = userPos.lat * Math.PI / 180;
    const lat2 = lat * Math.PI / 180;
    const dLat = (lat - userPos.lat) * Math.PI / 180;
    const dLng = (lng - userPos.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm) {
    if (!Number.isFinite(distanceKm)) return '--';
    if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
    if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
    return `${Math.round(distanceKm)} km`;
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
                if (toggle?.checked && 'vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            }, intervalTime);
        }
    } else {
        radarIcon.classList.remove('radar-blink');
        if (radarInterval) {
            clearInterval(radarInterval);
            radarInterval = null;
        }
        if ('vibrate' in navigator) navigator.vibrate(0);
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
    return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
}

function setSelectOptions(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` + values.map(value => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join('');
    if (values.includes(current)) select.value = current;
}

function renderLocationFilters() {
    const countrySelect = document.getElementById('selectCountry');
    const citySelect = document.getElementById('selectCity');
    const areaSelect = document.getElementById('selectArea');

    const countries = uniqSorted(fullData.map(item => item.country));
    setSelectOptions(countrySelect, countries, 'Tất cả quốc gia');

    const country = countrySelect.value;
    const cities = uniqSorted(fullData.filter(item => !country || item.country === country).map(item => item.city));
    setSelectOptions(citySelect, cities, 'Tất cả thành phố');

    const city = citySelect.value;
    const areas = uniqSorted(fullData.filter(item => (!country || item.country === country) && (!city || item.city === city)).map(item => item.area));
    setSelectOptions(areaSelect, areas, 'Tất cả khu vực');
}

function handleCountryChange() {
    const country = document.getElementById('selectCountry').value;
    const citySelect = document.getElementById('selectCity');
    const cities = uniqSorted(fullData.filter(item => !country || item.country === country).map(item => item.city));
    setSelectOptions(citySelect, cities, 'Tất cả thành phố');
    handleCityChange();
}

function handleCityChange() {
    const country = document.getElementById('selectCountry').value;
    const city = document.getElementById('selectCity').value;
    const areaSelect = document.getElementById('selectArea');
    const areas = uniqSorted(fullData.filter(item => (!country || item.country === country) && (!city || item.city === city)).map(item => item.area));
    setSelectOptions(areaSelect, areas, 'Tất cả khu vực');
    applyFilters();
}

function applyFilters() {
    const query = document.getElementById('inputSearch').value.trim().toLowerCase();
    const country = document.getElementById('selectCountry').value;
    const city = document.getElementById('selectCity').value;
    const area = document.getElementById('selectArea').value;

    let filtered = fullData.filter(item => {
        if (!item.name) return false;
        const haystack = [item.name, item.recommend, item.country, item.city, item.area, item.category].join(' ').toLowerCase();
        const matchLocation = (!country || item.country === country) && (!city || item.city === city) && (!area || item.area === area);
        const matchCategory = selectedCates.size === 0 || [...selectedCates].every(c => item.categories.includes(c));
        return haystack.includes(query) && matchLocation && matchCategory;
    });

    if (userPos) {
        filtered.sort((a, b) => getDistanceKm(a.latitude, a.longitude) - getDistanceKm(b.latitude, b.longitude));
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

function renderGrid(items) {
    const grid = document.getElementById('results-grid');
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
                ${item.map_link ? `<a href="${escapeAttribute(item.map_link)}" target="_blank" rel="noopener noreferrer" class="route-button">Chỉ Đường</a>` : '<span class="route-button disabled">Chưa có link</span>'}
            </article>`;
    }).join('') || '<p class="empty-state grid-empty">Không có địa điểm phù hợp bộ lọc.</p>';
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
    ['latitude','longitude','warning_latitude','warning_longitude'].forEach(key => {
        data[key] = data[key] === '' ? null : Number(data[key]);
    });

    submit.disabled = true;
    status.textContent = 'Saving...';
    try {
        await TravelData.createPlace(data);
        fullData = await TravelData.loadPlaces();
        window.fullData = fullData;
        renderLocationFilters();
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
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function escapeJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, '\\n');
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) {}
}

function triggerHeavyWarning(title, message) {
    const toggle = document.getElementById('vibrateToggle');
    if (!toggle?.checked) return;
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.active?.postMessage({ type: 'SHOW_NOTIFICATION', payload: { title, body: message, silent: false } });
        });
    }
}

async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (_) {}
    }
}

async function initTravelOS() {
    const savedState = localStorage.getItem('vibrateEnabled');
    if (savedState !== null) document.getElementById('vibrateToggle').checked = savedState === 'true';

    document.getElementById('add-place-form').addEventListener('submit', submitAddPlace);
    document.getElementById('add-place-button').classList.toggle('hidden', !(CONFIG.D1_ENABLED && CONFIG.DATA_API_URL));

    try {
        fullData = await TravelData.loadPlaces();
        window.fullData = fullData;
        renderChips();
        renderLocationFilters();
        applyFilters();
        checkRadarStatus();
    } catch (error) {
        const banner = document.getElementById('data-source-banner');
        banner.textContent = `Không tải được data: ${error.message}`;
        banner.classList.remove('hidden');
    }

    if (typeof initBot === 'function') initBot();
}

window.addEventListener('travelos:data-source', event => {
    const banner = document.getElementById('data-source-banner');
    if (event.detail?.source === 'legacy') {
        banner.textContent = 'TravelOS đang dùng Sheet fallback. Sau khi deploy D1, bật D1_ENABLED trong config.js để chuyển hoàn toàn.';
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
});

navigator.geolocation.watchPosition(pos => {
    const newPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    window.userPos = newPos;

    if (!isSystemLive) {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.classList.add('hide');
            setTimeout(() => loading.remove(), 1000);
        }
        isSystemLive = true;
        window.isSystemLive = true;
    }

    if (!lastPos || Math.abs(newPos.lat - lastPos.lat) > 0.00001 || Math.abs(newPos.lon - lastPos.lon) > 0.00001) {
        lastPos = newPos;
        userPos = newPos;
        document.getElementById('gps-coords').textContent = `${userPos.lat.toFixed(5)}, ${userPos.lon.toFixed(5)}`;
        checkRadarStatus();
        applyFilters();
    }
}, () => {
    const statusNode = document.getElementById('loading-status');
    if (statusNode) {
        statusNode.textContent = 'GPS ERROR: PLEASE ENABLE LOCATION';
        statusNode.classList.add('error');
    }
}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });

document.addEventListener('click', () => requestWakeLock(), { once: true });
document.addEventListener('click', requestNotificationPermission, { once: true });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

window.addEventListener('load', initTravelOS);
