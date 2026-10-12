const CHAT_STORAGE_KEY = 'travelos_chat_history';
const LEGACY_CHAT_STORAGE_KEY = 'dalatos_chat_history';
const EXPIRY_TIME = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_VERSION = 3;

function renderMarkdownSafe(text) {
    let html = escapeChatHtml(String(text ?? ''));
    html = html
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    const lines = html.split(/\r?\n/);
    const output = [];
    let inList = false;

    for (const line of lines) {
        const bullet = line.match(/^\s*[-*]\s+(.+)/);
        if (bullet) {
            if (!inList) {
                output.push('<ul>');
                inList = true;
            }
            output.push(`<li>${bullet[1]}</li>`);
        } else {
            if (inList) {
                output.push('</ul>');
                inList = false;
            }
            output.push(line ? `<p>${line}</p>` : '<br>');
        }
    }

    if (inList) output.push('</ul>');
    return output.join('');
}

function escapeChatHtml(value) {
    return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function isChinaGpsPoint(value) {
    const lat = Number(value?.lat ?? value?.latitude);
    const lng = Number(value?.lng ?? value?.lon ?? value?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    const outline = [[73.5,39.5],[79,35.5],[80,30],[88,27.5],[92,28],[97,28],[98,24],[101,21.5],[102,22.5],[106.5,22.8],[108,21.5],[110,20.3],[114,22],[117,23],[120,25],[122,29],[122,40],[125,40],[131,43],[135,48],[132,53],[120,54],[108,49],[95,49],[87,47],[80,45]];
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const [xi, yi] = outline[i], [xj, yj] = outline[j];
        if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside || (lat >= 18 && lat <= 20.6 && lng >= 108.5 && lng <= 111.5);
}

function getStructuredUserLocation() {
    let country = document.getElementById('selectCountry')?.value || '';
    const city = document.getElementById('selectCity')?.value || '';
    const area = document.getElementById('selectArea')?.value || '';
    const currentPos = window.userPos || null;
    const lat = Number(currentPos?.lat);
    const lon = Number(currentPos?.lon);
    if (isChinaGpsPoint(currentPos)) country = 'Trung Quốc';

    return {
        country,
        city,
        area,
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lon) ? lon : null,
        source: Number.isFinite(lat) && Number.isFinite(lon) ? 'gps' : 'selector'
    };
}

async function initBot() {
    loadChatHistory();
    if (window.TRAVELOS_NATIVE) return { ok:true, deferred:true };
    const workerBase = String(window.CONFIG?.WORKER_URL || '').replace(/\/+$/, '');
    if (!workerBase) throw new Error('Thiếu WORKER_URL cho trợ lý.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${workerBase}/api/health`, {
            cache: 'no-store',
            signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || `Bot health HTTP ${response.status}`);
        return payload;
    } finally {
        clearTimeout(timer);
    }
}

async function handleChat() {
    const input = document.getElementById('userInput');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('mic-btn');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    if (sendBtn) sendBtn.disabled = true;
    if (voiceBtn) voiceBtn.disabled = true;
    input.disabled = true;

    addMessage('user', text);
    saveMessage('user', text);
    input.value = '';

    const loadingId = 'loading-' + Date.now();
    addMessage('ai', `<div class="typing" id="${loadingId}"><span>Thổ Địa đang tính...</span><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`, true);

    let data = null;
    let retries = 3;

    try {
        while (retries > 0) {
            try {
                const userLocation = getStructuredUserLocation();
                const selectedLocation = [userLocation.country, userLocation.city, userLocation.area].filter(Boolean).join(' / ');

                const localHistory = readHistory();
                let chatHistoryArray = localHistory ? localHistory.messages : [];
                if (chatHistoryArray.length > 6) chatHistoryArray = chatHistoryArray.slice(-6);
                chatHistoryArray = chatHistoryArray.map(message => ({ role:message.role, content:message.content }));
                const latestStoredContext = [...(localHistory?.messages || [])].reverse().find(message => message?.travelContext || message?.nearby) || null;
                const conversationContext = latestStoredContext?.travelContext || (latestStoredContext?.nearby ? { nearby:compactNearbySnapshot(latestStoredContext.nearby) } : null);

                const requestBody = {
                    userMessage: text,
                    chatHistory: chatHistoryArray,
                    conversationContext: conversationContext || undefined,
                    khuVuc: selectedLocation,
                    userLocation
                };
                const workerBase = CONFIG.WORKER_URL.replace(/\/+$/, '');
                let response = await fetch(`${workerBase}${CONFIG.AI_PATH || '/ai-v3'}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                // Cho phép deploy GitHub Pages trước Worker mà chat không bị gãy.
                if (response.status === 404 || response.status === 405) {
                    response = await fetch(workerBase, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });
                }

                if (response.ok) {
                    data = await response.json();
                    if (data?.error?.message?.includes('location')) {
                        retries--;
                        if (retries > 0) {
                            await new Promise(resolve => setTimeout(resolve, 300));
                            continue;
                        }
                    } else {
                        break;
                    }
                }
            } catch (error) {
                console.error('Lỗi kết nối, đang thử lại...', error);
            }

            retries--;
            if (retries > 0) await new Promise(resolve => setTimeout(resolve, 300));
        }

        let aiMsg = '';
        if (data?.candidates?.[0]?.content?.parts) aiMsg = data.candidates[0].content.parts.map(part => part?.text || '').filter(Boolean).join('\n').trim();
        else if (data?.text) aiMsg = data.text;
        else aiMsg = `⚠️ Thiết lập lỗi cấu trúc dữ liệu: ${JSON.stringify(data)}`;
        aiMsg = normalizeAssistantVoice(aiMsg);

        const loadingElement = document.getElementById(loadingId);
        const messageElement = loadingElement?.closest('.msg');
        if (messageElement) {
            messageElement.innerHTML = renderMarkdownSafe(aiMsg);
            const nearby = compactNearbySnapshot(data?.travelos?.nearby);
            if (nearby && window.TravelNearby?.render) window.TravelNearby.render(nearby, messageElement);
            const travelContext = compactTravelContext(data?.travelos);
            saveMessage('ai', aiMsg, { ...(nearby ? { nearby } : {}), ...(travelContext ? { travelContext } : {}) });
        }
    } catch (error) {
        console.error(error);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement?.closest('.msg')) loadingElement.closest('.msg').textContent = 'Kết nối đang gặp lỗi. Bạn thử lại nhé.';
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        if (voiceBtn) voiceBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

function normalizeAssistantVoice(text) {
    return String(text ?? '')
        .replace(/\bFen\b/g, 'Bạn')
        .replace(/\bfen\b/g, 'bạn')
        .replace(/\bTui\b/g, 'Tôi')
        .replace(/\btui\b/g, 'tôi');
}

function addMessage(role, content, isHtml = false) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return null;

    const div = document.createElement('div');
    div.className = `msg ${role}`;

    if (isHtml) div.innerHTML = content;
    else if (role === 'ai') div.innerHTML = renderMarkdownSafe(content);
    else div.textContent = content;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function compactNearbySnapshot(payload) {
    if (!payload || !Array.isArray(payload.pois) || !payload.pois.length) return null;
    const numberOrNull = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
    const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
    const center = payload.center && typeof payload.center === 'object' ? {
        lat:numberOrNull(payload.center.lat ?? payload.center.latitude),
        lng:numberOrNull(payload.center.lng ?? payload.center.lon ?? payload.center.longitude),
        country:text(payload.center.country, 120),
        coordSystem:text(payload.center.coordSystem || payload.center.coordinate_system, 20)
    } : null;
    const query = typeof payload.query === 'string' ? text(payload.query, 300) : {
        keyword:text(payload.query?.keyword, 200),
        name:text(payload.query?.name, 200),
        googleType:text(payload.query?.googleType, 100)
    };
    const pois = payload.pois.slice(0, 10).map(poi => {
        const provider=text(poi?.provider || payload.provider, 80),explicitCoordSystem=text(poi?.coordSystem || poi?.coordinate_system, 20).toLowerCase();
        return {
            id:text(poi?.id, 200), poiId:text(poi?.poiId || poi?.id, 200),
            name:text(poi?.name, 300), address:text(poi?.address, 700),
            localizedName:text(poi?.localizedName, 300), localizedAddress:text(poi?.localizedAddress, 700),
            lat:numberOrNull(poi?.lat ?? poi?.latitude), lng:numberOrNull(poi?.lng ?? poi?.lon ?? poi?.longitude),
            distance:numberOrNull(poi?.distance), country:text(poi?.country, 120), city:text(poi?.city, 160), district:text(poi?.district, 160),
            coordSystem:explicitCoordSystem||(/amap/i.test(provider)?'gcj02':'wgs84'), provider,
            rating:numberOrNull(poi?.rating), userRatingCount:numberOrNull(poi?.userRatingCount), openTime:text(poi?.openTime, 300),
            phone:text(poi?.phone, 200), website:text(poi?.website, 500), primaryType:text(poi?.primaryType, 120),
            note:text(poi?.note, 500), noteConfidence:text(poi?.noteConfidence, 40)
        };
    }).filter(poi => poi.name && poi.lat !== null && poi.lng !== null);
    if (!pois.length) return null;
    return { version:1, source:text(payload.source, 100), provider:text(payload.provider || pois[0].provider, 80), query, center, count:pois.length, pois };
}

function compactTravelContext(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const numberOrNull = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
    const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
    const list = (value, max, mapper) => Array.isArray(value) ? value.slice(0, max).map(mapper) : [];
    const nearby = compactNearbySnapshot(payload.nearby);
    const rawPlace = payload.placeDetails;
    const placeDetails = rawPlace && typeof rawPlace === 'object' ? {
        id:text(rawPlace.id || rawPlace.poiId, 250), poiId:text(rawPlace.poiId || rawPlace.id, 250), name:text(rawPlace.name, 300),
        localizedName:text(rawPlace.localizedName, 300), address:text(rawPlace.address, 700), localizedAddress:text(rawPlace.localizedAddress, 700),
        lat:numberOrNull(rawPlace.lat ?? rawPlace.latitude), lng:numberOrNull(rawPlace.lng ?? rawPlace.lon ?? rawPlace.longitude),
        country:text(rawPlace.country, 120), city:text(rawPlace.city, 160), provider:text(rawPlace.provider, 80), coordSystem:text(rawPlace.coordSystem, 20),
        rating:numberOrNull(rawPlace.rating), userRatingCount:numberOrNull(rawPlace.userRatingCount), openNow:typeof rawPlace.openNow === 'boolean' ? rawPlace.openNow : null,
        openTime:text(rawPlace.openTime, 500), phone:text(rawPlace.phone, 200), website:text(rawPlace.website, 500)
    } : null;
    const rawWeather = payload.weather;
    const weather = rawWeather && typeof rawWeather === 'object' ? {
        coordinates:rawWeather.coordinates ? { lat:numberOrNull(rawWeather.coordinates.lat), lng:numberOrNull(rawWeather.coordinates.lng) } : null,
        timezone:text(rawWeather.timezone, 100),
        current:rawWeather.current ? {
            time:text(rawWeather.current.time, 80), temperature:numberOrNull(rawWeather.current.temperature), apparentTemperature:numberOrNull(rawWeather.current.apparentTemperature),
            precipitation:numberOrNull(rawWeather.current.precipitation), rain:numberOrNull(rawWeather.current.rain), windSpeed:numberOrNull(rawWeather.current.windSpeed),
            weatherCode:numberOrNull(rawWeather.current.weatherCode), condition:text(rawWeather.current.condition, 120)
        } : null,
        hourly:rawWeather.hourly ? {
            time:list(rawWeather.hourly.time, 24, value => text(value, 80)), temperature:list(rawWeather.hourly.temperature, 24, numberOrNull),
            precipitationProbability:list(rawWeather.hourly.precipitationProbability, 24, numberOrNull), precipitation:list(rawWeather.hourly.precipitation, 24, numberOrNull),
            weatherCode:list(rawWeather.hourly.weatherCode, 24, numberOrNull), windSpeed:list(rawWeather.hourly.windSpeed, 24, numberOrNull)
        } : null,
        daily:rawWeather.daily ? {
            time:list(rawWeather.daily.time, 7, value => text(value, 40)), weatherCode:list(rawWeather.daily.weatherCode, 7, numberOrNull),
            temperatureMax:list(rawWeather.daily.temperatureMax, 7, numberOrNull), temperatureMin:list(rawWeather.daily.temperatureMin, 7, numberOrNull),
            precipitationProbabilityMax:list(rawWeather.daily.precipitationProbabilityMax, 7, numberOrNull), sunrise:list(rawWeather.daily.sunrise, 7, value => text(value, 80)), sunset:list(rawWeather.daily.sunset, 7, value => text(value, 80))
        } : null
    } : null;
    const rawBusyness = payload.busyness;
    const busyness = rawBusyness && typeof rawBusyness === 'object' ? {
        available:rawBusyness.available === true, basis:text(rawBusyness.basis, 30), score:numberOrNull(rawBusyness.score), label:text(rawBusyness.label, 100),
        hourStart:numberOrNull(rawBusyness.hourStart), hourEnd:numberOrNull(rawBusyness.hourEnd),
        venue:rawBusyness.venue ? { name:text(rawBusyness.venue.name, 300), address:text(rawBusyness.venue.address, 700) } : null
    } : null;
    const routes = list(payload.routes, 3, route => ({
        distance:numberOrNull(route?.distance), duration:numberOrNull(route?.duration), trafficDelay:numberOrNull(route?.trafficDelay), description:text(route?.description, 400),
        steps:list(route?.steps, 20, step => ({ instruction:text(step?.instruction, 400), road:text(step?.road, 180), distance:numberOrNull(step?.distance), duration:numberOrNull(step?.duration) }))
    }));
    const rawCurated = payload.curated;
    const curated = rawCurated && typeof rawCurated === 'object' ? {
        places:list(rawCurated.places, 18, place => ({ id:text(place?.id, 200), name:text(place?.name, 300), address:text(place?.address, 700), category:text(place?.category, 120), description:text(place?.description, 700), lat:numberOrNull(place?.lat), lng:numberOrNull(place?.lng), distanceKm:numberOrNull(place?._distance_km) })),
        searchLocation:rawCurated.searchLocation || null
    } : null;
    if (!nearby && !placeDetails && !weather && !busyness && !routes.length && !curated) return null;
    return { version:1, travelIntent:text(payload.travelIntent || payload.plan?.travelIntent, 40), nearby, placeDetails, weather, busyness, routes:routes.length ? routes : null, curated };
}

function readHistory() {
    let history = null;
    try { history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || 'null'); }
    catch { localStorage.removeItem(CHAT_STORAGE_KEY); }

    if (!history) {
        const legacy = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
        if (legacy) {
            try { history = JSON.parse(legacy); }
            catch { history = null; }
            if (history) localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ ...history, version:CHAT_HISTORY_VERSION }));
            localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
        }
    }

    return history;
}

function saveMessage(role, content, extras = {}) {
    let history = readHistory() || { version:CHAT_HISTORY_VERSION, timestamp:Date.now(), messages:[] };
    if (Date.now() - history.timestamp > EXPIRY_TIME) history = { version:CHAT_HISTORY_VERSION, timestamp:Date.now(), messages:[] };
    history.version = CHAT_HISTORY_VERSION;
    history.messages.push({ role, content, ...(extras.nearby ? { nearby:compactNearbySnapshot(extras.nearby) } : {}), ...(extras.travelContext ? { travelContext:compactTravelContext(extras.travelContext) } : {}) });
    if (history.messages.length > 80) history.messages = history.messages.slice(-80);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
}

function loadChatHistory() {
    const history = readHistory();

    if (!history || Date.now() - history.timestamp > EXPIRY_TIME) {
        localStorage.removeItem(CHAT_STORAGE_KEY);
        addMessage('ai', 'Chào bạn! Tôi là Thổ Địa. Bạn muốn tìm quán hay lên lịch trình đi đâu?');
        return;
    }

    history.messages.forEach(msg => {
        const messageElement = addMessage(msg.role, msg.role === 'ai' ? normalizeAssistantVoice(msg.content) : msg.content);
        const nearby = compactNearbySnapshot(msg.nearby);
        if (messageElement && nearby && window.TravelNearby?.render) window.TravelNearby.render(nearby, messageElement);
    });
}
