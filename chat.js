const CHAT_STORAGE_KEY = 'travelos_chat_history';
const LEGACY_CHAT_STORAGE_KEY = 'dalatos_chat_history';
const EXPIRY_TIME = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_VERSION = 2;

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

function getStructuredUserLocation() {
    const country = document.getElementById('selectCountry')?.value || '';
    const city = document.getElementById('selectCity')?.value || '';
    const area = document.getElementById('selectArea')?.value || '';
    const currentPos = window.userPos || null;
    const lat = Number(currentPos?.lat);
    const lon = Number(currentPos?.lon);

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

                const requestBody = {
                    userMessage: text,
                    chatHistory: chatHistoryArray,
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
            saveMessage('ai', aiMsg, nearby ? { nearby } : {});
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
    const pois = payload.pois.slice(0, 10).map(poi => ({
        id:text(poi?.id, 200), poiId:text(poi?.poiId || poi?.id, 200),
        name:text(poi?.name, 300), address:text(poi?.address, 700),
        localizedName:text(poi?.localizedName, 300), localizedAddress:text(poi?.localizedAddress, 700),
        lat:numberOrNull(poi?.lat ?? poi?.latitude), lng:numberOrNull(poi?.lng ?? poi?.lon ?? poi?.longitude),
        distance:numberOrNull(poi?.distance), country:text(poi?.country, 120), city:text(poi?.city, 160), district:text(poi?.district, 160),
        coordSystem:text(poi?.coordSystem || poi?.coordinate_system, 20), provider:text(poi?.provider || payload.provider, 80),
        rating:numberOrNull(poi?.rating), userRatingCount:numberOrNull(poi?.userRatingCount), openTime:text(poi?.openTime, 300),
        phone:text(poi?.phone, 200), website:text(poi?.website, 500), primaryType:text(poi?.primaryType, 120),
        note:text(poi?.note, 500), noteConfidence:text(poi?.noteConfidence, 40)
    })).filter(poi => poi.name && poi.lat !== null && poi.lng !== null);
    if (!pois.length) return null;
    return { version:1, source:text(payload.source, 100), provider:text(payload.provider || pois[0].provider, 80), query, center, count:pois.length, pois };
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
    history.messages.push({ role, content, ...(extras.nearby ? { nearby:compactNearbySnapshot(extras.nearby) } : {}) });
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
