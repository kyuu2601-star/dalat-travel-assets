const CHAT_STORAGE_KEY = 'travelos_chat_history';
const LEGACY_CHAT_STORAGE_KEY = 'dalatos_chat_history';
const EXPIRY_TIME = 24 * 60 * 60 * 1000;

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
            if (data?.travelos?.nearby && window.TravelNearby?.render) {
                window.TravelNearby.render(data.travelos.nearby, messageElement);
            }
            saveMessage('ai', aiMsg);
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
    if (!chatBox) return;

    const div = document.createElement('div');
    div.className = `msg ${role}`;

    if (isHtml) div.innerHTML = content;
    else if (role === 'ai') div.innerHTML = renderMarkdownSafe(content);
    else div.textContent = content;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function readHistory() {
    let history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || 'null');

    if (!history) {
        const legacy = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
        if (legacy) {
            history = JSON.parse(legacy);
            localStorage.setItem(CHAT_STORAGE_KEY, legacy);
            localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
        }
    }

    return history;
}

function saveMessage(role, content) {
    let history = readHistory() || { timestamp: Date.now(), messages: [] };
    if (Date.now() - history.timestamp > EXPIRY_TIME) history = { timestamp: Date.now(), messages: [] };
    history.messages.push({ role, content });
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
}

function loadChatHistory() {
    const history = readHistory();

    if (!history || Date.now() - history.timestamp > EXPIRY_TIME) {
        localStorage.removeItem(CHAT_STORAGE_KEY);
        addMessage('ai', 'Chào bạn! Tôi là Thổ Địa. Bạn muốn tìm quán hay lên lịch trình đi đâu?');
        return;
    }

    history.messages.forEach(msg => addMessage(msg.role, msg.role === 'ai' ? normalizeAssistantVoice(msg.content) : msg.content));
}
