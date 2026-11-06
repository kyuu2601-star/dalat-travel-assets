const CHAT_STORAGE_KEY = 'travelos_chat_history';
const CHAT_SESSIONS_KEY = 'travelos_chat_sessions';
const LEGACY_CHAT_STORAGE_KEY = 'dalatos_chat_history';
const EXPIRY_TIME = 24 * 60 * 60 * 1000;
const CHAT_HISTORY_VERSION = 4;
let activeChatSessionId = null;
let activeChatRequest = null;
const CHAT_PROGRESS_PHASES = [
    'Đang chuẩn bị vị trí và ngữ cảnh...',
    'Đang chờ Pipi và các nguồn dữ liệu...',
    'Đã nhận dữ liệu phản hồi...',
    'Đang hiển thị kết quả...'
];
const CHAT_FEEDBACK_REASONS = ['Sai địa điểm', 'Dữ liệu cũ', 'Không hữu ích'];
const CHAT_TOOL_LABELS = {
    resolve_place:'Xác định địa điểm',
    search_places:'Tìm địa điểm',
    place_details:'Kiểm tra chi tiết',
    weather:'Kiểm tra thời tiết',
    place_busyness:'Kiểm tra độ đông',
    walking_route:'Tính đường đi bộ',
    traffic_route:'Tính đường di chuyển',
    curated_places:'Tra dữ liệu TravelOS'
};
const CHAT_INTENT_LABELS = {
    PLACE_DISCOVERY:'Tìm địa điểm',
    VENUE_INTELLIGENCE:'Thông tin địa điểm',
    ROUTE_MOBILITY:'Chỉ đường',
    WEATHER_OUTDOOR:'Thời tiết',
    ITINERARY_PLANNING:'Lịch trình',
    SAFETY_HEALTH:'Hỗ trợ an toàn',
    TRAVEL_UTILITY:'Tiện ích du lịch',
    LOCAL_GUIDE:'Hỗ trợ di chuyển'
};

function renderChatProgress(id) {
    const steps = CHAT_PROGRESS_PHASES.map((label, index) => `
        <li class="chat-progress-step${index === 0 ? ' is-active' : ''}" data-progress-step="${index}">
            <span class="chat-progress-marker" aria-hidden="true">${index + 1}</span>
            <span class="chat-progress-label">${label}</span>
        </li>`).join('');
    return `<div class="chat-progress" id="${id}" role="status" aria-live="polite" aria-label="${CHAT_PROGRESS_PHASES[0]}">
        <div class="chat-progress-title"><span class="chat-progress-pulse" aria-hidden="true"></span><span>Pipi đang làm việc</span></div>
        <ol class="chat-progress-list">${steps}</ol>
        <div class="chat-progress-actions">
            <span class="chat-progress-elapsed" data-progress-elapsed>0 giây</span>
            <button type="button" class="chat-stop-button" data-chat-stop>Dừng</button>
        </div>
    </div>`;
}

function updateChatProgress(id, activeIndex) {
    const root = document.getElementById(id);
    if (!root) return;
    const safeIndex = Math.max(0, Math.min(CHAT_PROGRESS_PHASES.length - 1, Number(activeIndex) || 0));
    root.querySelectorAll('[data-progress-step]').forEach((step, index) => {
        const done = index < safeIndex;
        step.classList.toggle('is-done', done);
        step.classList.toggle('is-active', index === safeIndex);
        step.classList.toggle('is-waiting', index > safeIndex);
        const marker = step.querySelector('.chat-progress-marker');
        if (marker) marker.textContent = done ? '✓' : String(index + 1);
    });
    root.setAttribute('aria-label', CHAT_PROGRESS_PHASES[safeIndex]);
    const box = document.getElementById('chat-box');
    if (box) box.scrollTop = box.scrollHeight;
}

function startChatProgress(id, onStop) {
    let current = 0;
    const root = document.getElementById(id);
    const startedAt = Date.now();
    const advance = index => {
        current = Math.max(current, index);
        updateChatProgress(id, current);
    };
    const setPhase = index => {
        current = Math.max(0, Math.min(CHAT_PROGRESS_PHASES.length - 1, Number(index) || 0));
        updateChatProgress(id, current);
    };
    const updateElapsed = () => {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
        const elapsed = root?.querySelector('[data-progress-elapsed]');
        if (elapsed) elapsed.textContent = `${elapsedSeconds} giây`;
        root?.classList.toggle('is-slow', elapsedSeconds >= 15);
        if (elapsedSeconds === 15 && current < 2) {
            const label = root?.querySelector('.chat-progress-title span:last-child');
            if (label) label.textContent = 'Pipi vẫn đang xử lý…';
        }
    };
    const elapsedTimer = setInterval(updateElapsed, 1000);
    const stopButton = root?.querySelector('[data-chat-stop]');
    const stop = () => {
        clearInterval(elapsedTimer);
        stopButton?.removeEventListener('click', handleStop);
    };
    const handleStop = () => {
        if (stopButton) stopButton.disabled = true;
        if (typeof onStop === 'function') onStop();
    };
    stopButton?.addEventListener('click', handleStop);
    return {
        advance,
        setPhase,
        setTitle(title) {
            const label = root?.querySelector('.chat-progress-title span:last-child');
            if (label) label.textContent = title;
        },
        elapsedMs() { return Date.now() - startedAt; },
        stop
    };
}

function formatAgentDuration(durationMs) {
    const seconds = Math.max(0, Number(durationMs) || 0) / 1000;
    return seconds < 10 ? `${seconds.toFixed(1)} giây` : `${Math.round(seconds)} giây`;
}

function compactAgentReceipt(travelos, durationMs = 0) {
    if (!travelos || typeof travelos !== 'object') return null;
    const text = (value, max = 300) => String(value ?? '').trim().slice(0, max);
    const rawSources = Array.isArray(travelos.sources) ? travelos.sources : [];
    const sources = rawSources.slice(0, 10).map((source, index) => typeof source === 'string'
        ? { id:`source-${index + 1}`, tool:'', ok:true, source:text(source, 100), fetchedAt:'', error:'' }
        : {
            id:text(source?.id, 80) || `source-${index + 1}`,
            tool:text(source?.tool, 80),
            ok:source?.ok !== false,
            source:text(source?.source, 100),
            fetchedAt:text(source?.fetchedAt, 80),
            error:text(source?.error, 240)
        });
    const plannedTools = Array.isArray(travelos.plan?.tools)
        ? travelos.plan.tools.slice(0, 10).map(tool => text(tool?.name, 80)).filter(Boolean)
        : [];
    const intent = text(travelos.travelIntent || travelos.plan?.travelIntent, 80);
    if (!sources.length && !plannedTools.length && !intent) return null;
    return {
        intent,
        goal:text(travelos.plan?.goal, 300),
        sources,
        plannedTools,
        durationMs:Math.max(0, Math.round(Number(durationMs) || 0)),
        completedAt:Date.now()
    };
}

function renderAgentReceipt(messageElement, receipt) {
    if (!messageElement || !receipt) return;
    const sources = Array.isArray(receipt.sources) ? receipt.sources : [];
    const successful = sources.filter(source => source.ok !== false).length;
    const details = document.createElement('details');
    details.className = 'agent-receipt';
    const summary = document.createElement('summary');
    const sourceSummary = sources.length ? `${successful}/${sources.length} bước dữ liệu` : `${receipt.plannedTools?.length || 0} bước dự kiến`;
    summary.textContent = `Đã kiểm tra · ${sourceSummary}`;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'agent-receipt-body';
    const meta = document.createElement('div');
    meta.className = 'agent-receipt-meta';
    const intent = CHAT_INTENT_LABELS[receipt.intent] || receipt.intent || 'Yêu cầu du lịch';
    const completedAt = Number(receipt.completedAt);
    const time = Number.isFinite(completedAt)
        ? new Date(completedAt).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })
        : '';
    meta.textContent = [intent, receipt.durationMs ? formatAgentDuration(receipt.durationMs) : '', time ? `cập nhật ${time}` : ''].filter(Boolean).join(' · ');
    body.appendChild(meta);
    if (receipt.goal) {
        const goal = document.createElement('p');
        goal.className = 'agent-receipt-goal';
        goal.textContent = receipt.goal;
        body.appendChild(goal);
    }
    if (sources.length) {
        const list = document.createElement('ul');
        list.className = 'agent-source-list';
        sources.forEach(source => {
            const item = document.createElement('li');
            item.className = source.ok === false ? 'is-error' : 'is-ok';
            const label = CHAT_TOOL_LABELS[source.tool] || source.tool || 'Nguồn dữ liệu';
            const provider = source.source ? ` · ${source.source}` : '';
            item.textContent = `${source.ok === false ? '!' : '✓'} ${label}${provider}`;
            if (source.error) item.title = source.error;
            list.appendChild(item);
        });
        body.appendChild(list);
    }
    details.appendChild(body);
    messageElement.appendChild(details);
}

function formatTravelDistance(value) {
    if (value === null || value === undefined || value === '') return '';
    const meters = Number(value);
    if (!Number.isFinite(meters) || meters < 0) return '';
    return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

function formatTravelMinutes(value) {
    if (value === null || value === undefined || value === '') return '';
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return '';
    return `${Math.max(1, Math.round(seconds / 60))} phút`;
}

function renderTravelDataCards(messageElement, travelContext) {
    if (!messageElement || !travelContext || typeof travelContext !== 'object') return;
    const cards = [];
    const weather = travelContext.weather?.current;
    const hasTemperature = weather?.temperature !== null && weather?.temperature !== undefined && weather?.temperature !== '' && Number.isFinite(Number(weather.temperature));
    if (weather && (weather.condition || hasTemperature)) {
        const temperature = hasTemperature ? `${Math.round(Number(weather.temperature))}°C` : '';
        const detail = [weather.condition, temperature, Number(weather.precipitation) > 0 ? `mưa ${weather.precipitation} mm` : ''].filter(Boolean).join(' · ');
        cards.push({ icon:'☁', title:'Thời tiết hiện tại', detail });
    }
    const route = Array.isArray(travelContext.routes) ? travelContext.routes[0] : null;
    if (route) {
        const detail = [formatTravelDistance(route.distance), formatTravelMinutes(route.duration), route.description].filter(Boolean).join(' · ');
        cards.push({ icon:'➜', title:'Tuyến đường', detail });
    }
    const busyness = travelContext.busyness;
    if (busyness && (busyness.available || busyness.label)) {
        const hasScore = busyness.score !== null && busyness.score !== undefined && busyness.score !== '' && Number.isFinite(Number(busyness.score));
        const score = hasScore ? `${Math.round(Number(busyness.score))}/100` : '';
        cards.push({ icon:'◉', title:'Độ đông', detail:[busyness.label, score].filter(Boolean).join(' · ') });
    }
    const curatedPlaces = Array.isArray(travelContext.curated?.places) ? travelContext.curated.places : [];
    if (curatedPlaces.length) {
        const names = curatedPlaces.slice(0, 3).map(place => place?.name).filter(Boolean).join(', ');
        cards.push({ icon:'▦', title:'Dữ liệu lịch trình', detail:`${curatedPlaces.length} địa điểm${names ? ` · ${names}` : ''}` });
    }
    if (!cards.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'agent-data-cards';
    cards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'agent-data-card';
        const icon = document.createElement('span');
        icon.className = 'agent-data-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = card.icon;
        const content = document.createElement('span');
        const title = document.createElement('strong');
        title.textContent = card.title;
        const detail = document.createElement('small');
        detail.textContent = card.detail;
        content.append(title, detail);
        item.append(icon, content);
        wrap.appendChild(item);
    });
    messageElement.appendChild(wrap);
}

function updateStoredMessageFeedback(sessionId, messageId, feedback) {
    if (!sessionId || !messageId) return;
    const store = readSessionStore();
    const session = store.sessions.find(item => item.id === sessionId);
    const message = session?.messages.find(item => item.id === messageId);
    if (!message) return;
    message.feedback = feedback;
    session.updatedAt = Date.now();
    writeSessionStore(store);
}

function renderChatResponseControls(messageElement, { sessionId, messageId, question, feedback } = {}) {
    if (!messageElement || !question) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-response-controls';
    const row = document.createElement('div');
    row.className = 'chat-response-actions';
    const prompt = document.createElement('span');
    prompt.textContent = 'Hữu ích không?';
    const up = document.createElement('button');
    up.type = 'button'; up.className = 'chat-feedback-button'; up.textContent = '👍'; up.setAttribute('aria-label', 'Câu trả lời hữu ích');
    const down = document.createElement('button');
    down.type = 'button'; down.className = 'chat-feedback-button'; down.textContent = '👎'; down.setAttribute('aria-label', 'Câu trả lời chưa hữu ích');
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'chat-retry-button'; retry.textContent = 'Thử lại';
    row.append(prompt, up, down, retry);
    wrap.appendChild(row);
    const reasons = document.createElement('div');
    reasons.className = 'chat-feedback-reasons';
    reasons.hidden = true;
    CHAT_FEEDBACK_REASONS.forEach(reason => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = reason;
        button.addEventListener('click', () => {
            const next = { rating:'down', reason };
            updateStoredMessageFeedback(sessionId, messageId, next);
            reasons.hidden = true;
            up.classList.remove('is-selected');
            down.classList.add('is-selected');
            prompt.textContent = 'Đã ghi nhận';
        });
        reasons.appendChild(button);
    });
    wrap.appendChild(reasons);
    const applyFeedback = value => {
        up.classList.toggle('is-selected', value?.rating === 'up');
        down.classList.toggle('is-selected', value?.rating === 'down');
        if (value?.rating) prompt.textContent = 'Đã ghi nhận';
    };
    applyFeedback(feedback);
    up.addEventListener('click', () => {
        const next = { rating:'up', reason:'' };
        updateStoredMessageFeedback(sessionId, messageId, next);
        reasons.hidden = true;
        applyFeedback(next);
    });
    down.addEventListener('click', () => {
        const next = { rating:'down', reason:'' };
        updateStoredMessageFeedback(sessionId, messageId, next);
        applyFeedback(next);
        reasons.hidden = false;
    });
    retry.addEventListener('click', () => handleChat(question));
    messageElement.appendChild(wrap);
}

function renderChatRequestFailure(messageElement, question, stopped = false) {
    if (!messageElement) return;
    messageElement.replaceChildren();
    const text = document.createElement('p');
    text.textContent = stopped ? 'Đã dừng yêu cầu này.' : 'Kết nối đang gặp lỗi. Bạn có thể thử lại mà không mất nội dung câu hỏi.';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'chat-failure-retry'; retry.textContent = 'Thử lại';
    retry.addEventListener('click', () => handleChat(question));
    messageElement.append(text, retry);
}

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

function setHotelChoiceButtonsDisabled(disabled) {
    document.querySelectorAll('#chat-box .hotel-choice-button').forEach(button => { button.disabled = disabled; });
}

function renderPlaceChoices(messageElement, area, kind = 'hotel') {
    if (!messageElement || area?.status !== 'awaiting_confirmation') return false;
    const candidates = Array.isArray(area.candidates) ? area.candidates.slice(0, 5) : [];
    if (!candidates.length) return false;
    messageElement.classList.add('hotel-choice-message');
    messageElement.replaceChildren();
    const title = document.createElement('p');
    title.className = 'hotel-choice-title';
    const label = kind === 'hotel' ? 'khách sạn' : 'địa điểm';
    title.textContent = candidates.length === 1
        ? `Pipi tìm thấy ${label} này. Đúng chỗ bạn nói không?`
        : `Pipi tìm thấy các ${label} này. Bạn chọn đúng chỗ nhé:`;
    messageElement.appendChild(title);
    const list = document.createElement('div');
    list.className = 'hotel-choice-list';
    candidates.forEach((place, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hotel-choice-button';
        button.setAttribute('aria-label', `Chọn ${label} ${index + 1}: ${place.localizedName || place.name}`);
        const number = document.createElement('span');
        number.className = 'hotel-choice-number';
        number.textContent = String(index + 1);
        const detail = document.createElement('span');
        detail.className = 'hotel-choice-detail';
        const name = document.createElement('strong');
        name.textContent = place.localizedName || place.name || `${label} ${index + 1}`;
        const address = document.createElement('small');
        address.textContent = place.localizedAddress || place.address || '';
        detail.append(name, address);
        button.append(number, detail);
        button.addEventListener('click', () => handleChat(`Đúng số ${index + 1}`));
        list.appendChild(button);
    });
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'hotel-choice-button hotel-choice-none';
    none.textContent = `Không đúng ${label} nào`;
    none.addEventListener('click', () => handleChat('Không đúng'));
    list.appendChild(none);
    messageElement.appendChild(list);
    return true;
}

function renderHotelChoices(messageElement, hotelArea) {
    return renderPlaceChoices(messageElement, hotelArea, 'hotel');
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

function isChongqingGpsPoint(value) {
    const lat = Number(value?.lat ?? value?.latitude);
    const lng = Number(value?.lng ?? value?.lon ?? value?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= 28.0 && lat <= 32.3 && lng >= 105.2 && lng <= 110.3;
}

function sameGpsAnchor(position, anchor) {
    const lat1 = Number(position?.lat ?? position?.latitude);
    const lng1 = Number(position?.lng ?? position?.lon ?? position?.longitude);
    const lat2 = Number(anchor?.latitude);
    const lng2 = Number(anchor?.longitude);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return false;
    const dy = (lat1 - lat2) * 111;
    const dx = (lng1 - lng2) * 111 * Math.cos(lat1 * Math.PI / 180);
    return Math.hypot(dx, dy) <= 0.25;
}

function getStructuredUserLocation() {
    const selectedCountry = document.getElementById('selectCountry')?.value || '';
    const selectedCity = document.getElementById('selectCity')?.value || '';
    const selectedArea = document.getElementById('selectArea')?.value || '';
    const currentPos = window.userPos || null;
    const anchor = window.travelosLocationAnchor || null;
    const rawLat = Number(currentPos?.lat);
    const rawLon = Number(currentPos?.lon ?? currentPos?.lng);
    const anchorLat = Number(anchor?.latitude);
    const anchorLon = Number(anchor?.longitude);
    const hasAnchor = Number.isFinite(anchorLat) && Number.isFinite(anchorLon);
    // travelosLocationAnchor chỉ được cập nhật sau khi app đã lọc nhiễu và
    // xác nhận chuyển động. Các module bản đồ không được phép thay tâm tìm kiếm.
    const lat = hasAnchor ? anchorLat : rawLat;
    const lon = hasAnchor ? anchorLon : rawLon;
    const accuracy = Number(hasAnchor ? anchor?.accuracy : currentPos?.accuracy);
    const gpsTimestamp = Number(hasAnchor ? anchor?.timestamp : currentPos?.timestamp);
    const hasGps = Number.isFinite(lat) && Number.isFinite(lon);
    const anchorMatches = hasGps && sameGpsAnchor(currentPos, anchor);
    const chinaGps = hasGps && isChinaGpsPoint(currentPos);
    const chongqingGps = chinaGps && isChongqingGpsPoint(currentPos);
    let country = anchorMatches && anchor.country ? anchor.country : selectedCountry;
    let city = anchorMatches && anchor.city ? anchor.city : selectedCity;
    let area = anchorMatches && anchor.area ? anchor.area : selectedArea;
    let locationMismatch = false;

    if (chinaGps) {
        country = 'Trung Quốc';
        if (chongqingGps) city = 'Trùng Khánh';
        if (selectedCountry && selectedCountry !== 'Trung Quốc') area = '';
    } else if (hasGps && selectedCountry === 'Trung Quốc' &&
        (!anchorMatches || anchor.country !== 'Trung Quốc')) {
        // Không được ghép nhãn Trung Quốc với tọa độ GPS cũ ở Việt Nam.
        locationMismatch = true;
    }

    return {
        country,
        city,
        area,
        latitude: hasGps ? lat : null,
        longitude: hasGps ? lon : null,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        gpsTimestamp: Number.isFinite(gpsTimestamp) ? gpsTimestamp : null,
        source: hasGps ? (hasAnchor ? 'app-anchor' : 'app-gps') : 'selector',
        locationMismatch,
        selectedCountry,
        selectedCity
    };
}

function locationRefreshError(data) {
    const error = data?.error?.code ? data.error : data?.travelos?.nearbyError;
    return ['GPS_STALE_OR_INACCURATE', 'GPS_REQUIRED'].includes(error?.code) ? error : null;
}

async function refreshLocationForAssistant(error = {}) {
    const requestFreshPosition = window.TravelLocation?.requestFreshPosition;
    if (typeof requestFreshPosition !== 'function') throw new Error('GPS_REFRESH_UNAVAILABLE');
    return requestFreshPosition({
        maxAccuracyMeters: Number(error.maxAccuracyMeters) || 200,
        timeoutMs: 15000
    });
}

function showLocationRefreshProgress(id) {
    const root = document.getElementById(id);
    if (!root) return;
    const title = root.querySelector('.chat-progress-title span:last-child');
    if (title) title.textContent = 'Pipi đang cập nhật vị trí…';
    root.setAttribute('aria-label', 'Đang cập nhật vị trí GPS');
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

async function handleChat(presetText = '') {
    const input = document.getElementById('userInput');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('mic-btn');
    if (!input) return;

    if (sendBtn?.disabled || input.disabled) return;
    const text = String(presetText || input.value).trim();
    if (!text) return;

    if (sendBtn) sendBtn.disabled = true;
    if (voiceBtn) voiceBtn.disabled = true;
    input.disabled = true;
    setHotelChoiceButtonsDisabled(true);

    addMessage('user', text);
    saveMessage('user', text);
    const activeSession = readHistory();
    const requestSessionId = activeSession?.id;
    if (activeSession?.messages.filter(message => message.role === 'user').length === 1) {
        requestChatTitle(activeSession.id, text);
    }
    if (!presetText) input.value = '';

    const loadingId = 'loading-' + Date.now();
    addMessage('ai', renderChatProgress(loadingId), true);
    const requestController = new AbortController();
    let stoppedByUser = false;
    const progress = startChatProgress(loadingId, () => {
        stoppedByUser = true;
        requestController.abort();
    });
    activeChatRequest = { id:loadingId, controller:requestController };

    let data = null;
    let retries = 3;
    let locationRefreshAttempts = 0;
    let conversationContext = null;

    let completed = false;
    try {
        while (retries > 0) {
            try {
                const userLocation = getStructuredUserLocation();
                const selectedLocation = [userLocation.country, userLocation.city, userLocation.area].filter(Boolean).join(' / ');

                const localHistory = readSessionStore().sessions.find(session => session.id === requestSessionId);
                let chatHistoryArray = localHistory ? localHistory.messages : [];
                if (chatHistoryArray.length > 6) chatHistoryArray = chatHistoryArray.slice(-6);
                chatHistoryArray = chatHistoryArray.map(message => ({ role:message.role, content:message.content }));
                const latestStoredContext = [...(localHistory?.messages || [])].reverse().find(message => message?.travelContext || message?.nearby) || null;
                conversationContext = latestStoredContext?.travelContext || (latestStoredContext?.nearby ? { nearby:compactNearbySnapshot(latestStoredContext.nearby) } : null);
                const conversationSummary = buildConversationSummary(localHistory);

                const requestBody = {
                    userMessage: text,
                    chatHistory: chatHistoryArray,
                    conversationContext: conversationContext || undefined,
                    conversationSummary: conversationSummary || undefined,
                    khuVuc: selectedLocation,
                    userLocation
                };
                const workerBase = CONFIG.WORKER_URL.replace(/\/+$/, '');
                progress.advance(1);
                let response = await fetch(`${workerBase}${CONFIG.AI_PATH || '/ai-v3'}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: requestController.signal
                });
                // Cho phép deploy GitHub Pages trước Worker mà chat không bị gãy.
                if (response.status === 404 || response.status === 405) {
                    response = await fetch(workerBase, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                        signal: requestController.signal
                    });
                }

                if (response.ok) {
                    progress.advance(2);
                    data = await response.json();
                    const refreshError = locationRefreshError(data);
                    if (refreshError && locationRefreshAttempts < 1) {
                        locationRefreshAttempts += 1;
                        progress.setPhase(0);
                        showLocationRefreshProgress(loadingId);
                        try {
                            await refreshLocationForAssistant(refreshError);
                            if (stoppedByUser) throw new DOMException('Stopped by user', 'AbortError');
                            progress.setTitle('Pipi đang làm việc');
                            progress.setPhase(1);
                            continue;
                        } catch (error) {
                            if (error?.name === 'AbortError' || stoppedByUser) throw error;
                            console.warn('Không thể cập nhật GPS cho chat:', error);
                            data = {
                                text:'Pipi chưa lấy được vị trí đủ chính xác. Bạn bật quyền Vị trí, ra chỗ thoáng hơn rồi thử lại nhé.',
                                error:{code:error?.code || 'GPS_REFRESH_FAILED'}
                            };
                            break;
                        }
                    } else if (data?.error?.message?.includes('location')) {
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
                if (error?.name === 'AbortError' || stoppedByUser) throw error;
                console.error('Lỗi kết nối, đang thử lại...', error);
            }

            retries--;
            if (retries > 0) await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!data) throw new Error('CHAT_REQUEST_FAILED');
        let aiMsg = '';
        if (data?.candidates?.[0]?.content?.parts) aiMsg = data.candidates[0].content.parts.map(part => part?.text || '').filter(Boolean).join('\n').trim();
        else if (data?.text) aiMsg = data.text;
        else aiMsg = `⚠️ Thiết lập lỗi cấu trúc dữ liệu: ${JSON.stringify(data)}`;
        aiMsg = normalizeAssistantVoice(aiMsg);
        progress.advance(3);

        const loadingElement = document.getElementById(loadingId);
        const messageElement = loadingElement?.closest('.msg');
        const nearby = compactNearbySnapshot(data?.travelos?.nearby);
        const travelContext = mergeChatTopicContext(compactTravelContext(data?.travelos), conversationContext, text);
        const receipt = compactAgentReceipt(data?.travelos, progress.elapsedMs());
        const savedMessage = saveMessage('ai', aiMsg, {
            ...(nearby ? { nearby } : {}),
            ...(travelContext ? { travelContext } : {}),
            ...(receipt ? { receipt } : {})
        }, requestSessionId);
        if (messageElement && activeChatSessionId === requestSessionId) {
            messageElement.innerHTML = renderMarkdownSafe(aiMsg);
            const renderedChoices = renderHotelChoices(messageElement, travelContext?.hotelArea)
                || renderPlaceChoices(messageElement, travelContext?.namedArea, 'place');
            if (!renderedChoices) {
                renderTravelDataCards(messageElement, travelContext || data?.travelos);
                if (nearby?.pois?.length && window.TravelNearby?.render) window.TravelNearby.render(nearby, messageElement);
            }
            renderAgentReceipt(messageElement, receipt);
            renderChatResponseControls(messageElement, {
                sessionId:requestSessionId,
                messageId:savedMessage?.id,
                question:text,
                feedback:savedMessage?.feedback
            });
        }
        completed = true;
    } catch (error) {
        const loadingElement = document.getElementById(loadingId);
        const messageElement = loadingElement?.closest('.msg');
        if (!stoppedByUser) console.error(error);
        renderChatRequestFailure(messageElement, text, stoppedByUser || error?.name === 'AbortError');
    } finally {
        progress.stop();
        if (activeChatRequest?.id === loadingId) activeChatRequest = null;
        if (!completed) setHotelChoiceButtonsDisabled(false);
        if (sendBtn) sendBtn.disabled = false;
        if (voiceBtn) voiceBtn.disabled = false;
        input.disabled = false;
        if (!presetText && activeChatSessionId === requestSessionId) input.focus();
    }
}

function normalizeAssistantVoice(text) {
    return String(text ?? '')
        .replace(/Thổ Địa/g, 'Pipi')
        .replace(/\bFen\b/g, 'Bạn')
        .replace(/\bfen\b/g, 'bạn')
        .replace(/\bChúng tôi\b/g, 'Pipi')
        .replace(/\bchúng tôi\b/g, 'Pipi')
        .replace(/\bTôi\b/g, 'Pipi')
        .replace(/\btôi\b/g, 'Pipi')
        .replace(/\bTui\b/g, 'Pipi')
        .replace(/\btui\b/g, 'Pipi');
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
    if (!payload || !Array.isArray(payload.pois)) return null;
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
        keywords:Array.isArray(payload.query?.keywords) ? payload.query.keywords.slice(0, 10).map(value => text(value, 100)).filter(Boolean) : [],
        category:text(payload.query?.category, 80),
        name:text(payload.query?.name, 200),
        googleType:text(payload.query?.googleType, 100),
        radius:numberOrNull(payload.query?.radius)
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
    const hasQuery=typeof query === 'string' ? Boolean(query) : Boolean(query.keyword || query.category);
    if (!pois.length && !center && !hasQuery) return null;
    return {
        version:1, source:text(payload.source, 100), provider:text(payload.provider || pois[0]?.provider, 80), query, center,
        count:pois.length, pois,
        attemptedRadii:Array.isArray(payload.attemptedRadii) ? payload.attemptedRadii.slice(0, 5).map(numberOrNull).filter(value => value !== null) : []
    };
}

function compactTravelContext(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const numberOrNull = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
    const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
    const list = (value, max, mapper) => Array.isArray(value) ? value.slice(0, max).map(mapper) : [];
    const nearby = compactNearbySnapshot(payload.nearby);
    const rawHotelArea = payload.hotelArea;
    const rawAnchor = payload.topicAnchor;
    const topicAnchor = rawAnchor && typeof rawAnchor === 'object' ? {
        name:text(rawAnchor.name,300),city:text(rawAnchor.city,120),country:text(rawAnchor.country,120),
        lat:numberOrNull(rawAnchor.lat),lng:numberOrNull(rawAnchor.lng),coordSystem:text(rawAnchor.coordSystem,20)
    } : null;
    const hotelArea = rawHotelArea && ['awaiting_confirmation','awaiting_description'].includes(rawHotelArea.status) ? {
        status:text(rawHotelArea.status,40), hotelName:text(rawHotelArea.hotelName,200), city:text(rawHotelArea.city,120),
        landmark:text(rawHotelArea.landmark,200), request:text(rawHotelArea.request,600),
        candidates:list(rawHotelArea.candidates,5,place=>({id:text(place?.id,250),name:text(place?.name,300),localizedName:text(place?.localizedName,300),address:text(place?.address,700),localizedAddress:text(place?.localizedAddress,700),lat:numberOrNull(place?.lat),lng:numberOrNull(place?.lng),country:text(place?.country,120),city:text(place?.city,120),provider:text(place?.provider,80),coordSystem:text(place?.coordSystem,20)}))
    } : null;
    const rawNamedArea = payload.namedArea;
    const namedArea = rawNamedArea && ['awaiting_confirmation','awaiting_description'].includes(rawNamedArea.status) ? {
        status:text(rawNamedArea.status,40),area:text(rawNamedArea.area,300),query:text(rawNamedArea.query,300),
        country:text(rawNamedArea.country,120),radius:numberOrNull(rawNamedArea.radius),limit:numberOrNull(rawNamedArea.limit),sortBy:text(rawNamedArea.sortBy,30),
        candidates:list(rawNamedArea.candidates,5,place=>({id:text(place?.id,250),name:text(place?.name,300),localizedName:text(place?.localizedName,300),address:text(place?.address,700),localizedAddress:text(place?.localizedAddress,700),lat:numberOrNull(place?.lat),lng:numberOrNull(place?.lng),country:text(place?.country,120),city:text(place?.city,120),provider:text(place?.provider,80),coordSystem:text(place?.coordSystem,20)}))
    } : null;
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
    if (!nearby && !placeDetails && !weather && !busyness && !routes.length && !curated && !hotelArea && !namedArea && !topicAnchor) return null;
    return { version:1, travelIntent:text(payload.travelIntent || payload.plan?.travelIntent, 40), nearby, placeDetails, weather, busyness, routes:routes.length ? routes : null, curated, hotelArea, namedArea, topicAnchor };
}

function mergeChatTopicContext(current, previous, question) {
    if (!current) return previous || null;
    const key = String(question || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
    const asksCurrent = /\b(quanh day|gan day|o day|gan toi|quanh toi|vi tri hien tai)\b/.test(key);
    const explicitArea = /\b(da lat|trung khanh|chongqing|da nang|ha noi|ho chi minh|sai gon)\b/.test(key);
    const prior = previous?.topicAnchor;
    if ((current.hotelArea || current.namedArea) && !current.placeDetails) return { ...current, topicAnchor:prior || null, weather:current.weather || previous?.weather || null };
    const place = current.placeDetails;
    const center = current.nearby?.center;
    const source = place?.lat != null && place?.lng != null ? place : center?.lat != null && center?.lng != null ? center : current.weather?.coordinates;
    const newlyResolved = source ? {
        name:place?.localizedName || place?.name || (asksCurrent ? 'vị trí hiện tại' : current.nearby?.query?.keyword || 'khu vực đang tìm'),
        city:place?.city || '',country:place?.country || center?.country || '',
        lat:source.lat,lng:source.lng,coordSystem:place?.coordSystem || center?.coordSystem || 'wgs84'
    } : null;
    const topicAnchor = current.topicAnchor || (!asksCurrent && prior && !explicitArea ? prior : newlyResolved || prior || null);
    return { ...current, topicAnchor, weather:current.weather || (!asksCurrent && prior && !explicitArea ? previous?.weather : null) || null };
}

function readSessionStore() {
    let store;
    try { store = JSON.parse(localStorage.getItem(CHAT_SESSIONS_KEY) || 'null'); } catch { store = null; }
    if (!store || !Array.isArray(store.sessions)) {
        let legacy;
        try { legacy = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || localStorage.getItem(LEGACY_CHAT_STORAGE_KEY) || 'null'); } catch { legacy = null; }
        const oldMessages = Array.isArray(legacy?.messages) ? legacy.messages : [];
        const oldTime = Number(legacy?.timestamp) || Date.now();
        store = { version:CHAT_HISTORY_VERSION, sessions:oldMessages.length && Date.now() - oldTime < EXPIRY_TIME
            ? [{ id:`legacy-${oldTime}`, title:oldMessages.find(message => message.role === 'user')?.content?.slice(0, 60) || 'Cuộc trò chuyện trước', createdAt:oldTime, updatedAt:oldTime, messages:oldMessages.slice(-40) }]
            : [] };
        try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(store)); } catch { /* Keep the current chat usable without persistent storage. */ }
        localStorage.removeItem(CHAT_STORAGE_KEY);
        localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
    }
    store.sessions = store.sessions.filter(session => session && Array.isArray(session.messages) && Date.now() - Number(session.updatedAt || session.createdAt) < EXPIRY_TIME).slice(-12);
    return store;
}

function writeSessionStore(store) {
    try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(store)); }
    catch (error) {
        // Keep the active conversation if storage fills up with old map snapshots.
        store.sessions = store.sessions.filter(session => session.id === activeChatSessionId || session.messages?.length).slice(-5);
        store.sessions.forEach(session => { session.messages = session.messages.slice(-25); });
        try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(store)); } catch { console.warn('Chat history storage unavailable', error); }
    }
}

function readHistory() {
    return readSessionStore().sessions.find(session => session.id === activeChatSessionId) || null;
}

function createChatSession() {
    const store = readSessionStore();
    store.sessions = store.sessions.filter(session => session.messages.length);
    const session = { id:`chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title:'Chat mới', createdAt:Date.now(), updatedAt:Date.now(), messages:[] };
    store.sessions.push(session);
    activeChatSessionId = session.id;
    writeSessionStore(store);
    return session;
}

function saveMessage(role, content, extras = {}, sessionId = activeChatSessionId) {
    const store = readSessionStore();
    let session = store.sessions.find(item => item.id === sessionId);
    if (!session) {
        session = { id:`chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title:'Chat mới', createdAt:Date.now(), updatedAt:Date.now(), messages:[] };
        activeChatSessionId = session.id;
        store.sessions.push(session);
    }
    const savedMessage = {
        id:String(extras.messageId || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        role,
        content,
        ...(extras.nearby ? { nearby:compactNearbySnapshot(extras.nearby) } : {}),
        ...(extras.travelContext ? { travelContext:compactTravelContext(extras.travelContext) } : {}),
        ...(extras.receipt ? { receipt:extras.receipt } : {}),
        ...(extras.feedback ? { feedback:extras.feedback } : {})
    };
    session.messages.push(savedMessage);
    session.messages = session.messages.slice(-40);
    session.updatedAt = Date.now();
    writeSessionStore(store);
    return savedMessage;
}

function renderChatSession(session) {
    const box = document.getElementById('chat-box');
    if (box) box.replaceChildren();
    if (!session?.messages?.length) {
        addMessage('ai', "Chào bạn! Pipi là trợ lý du lịch của Let's Go Pipi. Bạn muốn tìm quán hay lên lịch trình đi đâu?");
        return;
    }
    session.messages.forEach((msg, index) => {
        const messageElement = addMessage(msg.role, msg.role === 'ai' ? normalizeAssistantVoice(msg.content) : msg.content);
        if (msg.role !== 'ai') return;
        const nearby = compactNearbySnapshot(msg.nearby);
        const renderedChoices = index === session.messages.length - 1 && (renderHotelChoices(messageElement, msg.travelContext?.hotelArea)
            || renderPlaceChoices(messageElement, msg.travelContext?.namedArea, 'place'));
        if (!renderedChoices) {
            renderTravelDataCards(messageElement, msg.travelContext);
            if (messageElement && nearby?.pois?.length && window.TravelNearby?.render) window.TravelNearby.render(nearby, messageElement);
        }
        renderAgentReceipt(messageElement, msg.receipt);
        const question = [...session.messages.slice(0, index)].reverse().find(item => item.role === 'user')?.content || '';
        renderChatResponseControls(messageElement, {
            sessionId:session.id,
            messageId:msg.id,
            question,
            feedback:msg.feedback
        });
    });
}

function loadChatHistory() { renderChatSession(null); }

function buildConversationSummary(session) {
    if (!session?.messages?.length) return '';
    const context = [...session.messages].reverse().find(message => message.travelContext)?.travelContext;
    const anchor = context?.topicAnchor;
    const location = anchor?.name ? `Chủ đề đang ở ${anchor.name}${anchor.city ? `, ${anchor.city}` : ''}; tọa độ ${anchor.lat}, ${anchor.lng}; quốc gia ${anchor.country || 'chưa rõ'}.` : '';
    const weather = context?.weather?.current?.condition ? `Thời tiết đã kiểm tra: ${context.weather.current.condition}.` : '';
    const priorMessages = session.messages.at(-1)?.role === 'user' ? session.messages.slice(0, -1) : session.messages;
    const turns = priorMessages.slice(-6).map(message => `${message.role === 'user' ? 'Bạn' : 'Pipi'}: ${String(message.content || '').replace(/\s+/g, ' ').slice(0, 230)}`).join('\n');
    return [location, weather, turns].filter(Boolean).join('\n').slice(0, 1700);
}

async function requestChatTitle(sessionId, firstQuestion) {
    const fallback = String(firstQuestion).replace(/\s+/g, ' ').trim().slice(0, 58) || 'Chat mới';
    let title = fallback;
    try {
        const workerBase = String(window.CONFIG?.WORKER_URL || CONFIG?.WORKER_URL || '').replace(/\/+$/, '');
        if (workerBase) {
            const response = await fetch(`${workerBase}/conversation/title`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ firstQuestion }) });
            if (response.ok) title = String((await response.json()).title || fallback).trim().slice(0, 70) || fallback;
        }
    } catch { /* The first question remains a readable title when AI is unavailable. */ }
    const store = readSessionStore();
    const session = store.sessions.find(item => item.id === sessionId);
    if (!session) return;
    session.title = title;
    writeSessionStore(store);
    if (!document.getElementById('chat-history-panel')?.hidden) renderChatSessionList();
}

function renderChatSessionList() {
    const list = document.getElementById('chat-history-list');
    if (!list) return;
    list.replaceChildren();
    const sessions = readSessionStore().sessions.filter(session => session.messages.length).reverse();
    if (!sessions.length) {
        const empty = document.createElement('p'); empty.className = 'chat-history-empty'; empty.textContent = 'Chưa có cuộc trò chuyện nào trong 24 giờ qua.'; list.appendChild(empty); return;
    }
    sessions.forEach(session => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'chat-history-item';
        const title = document.createElement('strong'); title.textContent = session.title || 'Chat mới';
        const time = document.createElement('small'); time.textContent = new Date(session.updatedAt).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
        button.append(title, time);
        button.addEventListener('click', () => {
            activeChatSessionId = session.id;
            renderChatSession(session);
            toggleChatSessionHistory(false);
        });
        list.appendChild(button);
    });
}

function toggleChatSessionHistory(force) {
    const panel = document.getElementById('chat-history-panel');
    const win = document.getElementById('chat-widget-window');
    if (!panel || !win) return;
    const show = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !show;
    win.classList.toggle('history-open', show);
    if (show) renderChatSessionList();
}

window.TravelChatSessions = {
    startNew() { renderChatSession(createChatSession()); toggleChatSessionHistory(false); },
    toggleHistory() { toggleChatSessionHistory(); }
};
