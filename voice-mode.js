// Experimental Voice Mode. The text chat and its microphone remain untouched.
(() => {
  const header = document.querySelector('#chat-widget-window .widget-header');
  if (!header || document.getElementById('pipi-voice-launch')) return;
  const launch = document.createElement('button');
  launch.id = 'pipi-voice-launch';
  launch.type = 'button';
  launch.setAttribute('aria-label', 'Mở trò chuyện giọng nói với Pipi');
  launch.textContent = '🎙 Trò chuyện';
  header.insertBefore(launch, header.querySelector('#close-widget'));

  const panel = document.createElement('section');
  panel.id = 'pipi-voice-mode';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Trò chuyện giọng nói với Pipi');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="pvm-header"><span>LET'S GO <strong>PIPI</strong> · VOICE THỬ NGHIỆM</span><button type="button" id="pvm-close" aria-label="Đóng trò chuyện giọng nói">×</button></header>
    <div class="pvm-top"><div class="pvm-robot" aria-hidden="true"><div class="pvm-eyes"><i></i><i></i></div><div class="pvm-mouth"></div></div><p id="pvm-status" aria-live="polite">Giữ nút mic để nói với Pipi</p><p id="pvm-short" aria-live="polite"></p></div>
    <div class="pvm-bottom"><div class="pvm-chat-title">Nội dung trò chuyện</div><div id="pvm-chat" role="log" aria-live="polite"></div><div class="pvm-controls"><div id="pvm-tip">Giữ để nói · Thả ra để gửi</div><button type="button" id="pvm-mic" aria-label="Giữ để nói, thả ra để gửi">🎙</button><span id="pvm-caption">Nhấn giữ nút mic</span></div></div>`;
  document.body.appendChild(panel);

  const el = id => document.getElementById(id);
  const status = el('pvm-status');
  const short = el('pvm-short');
  const log = el('pvm-chat');
  const mic = el('pvm-mic');
  const caption = el('pvm-caption');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, holding = false, transcript = '', sending = false, activeRequest = null, generation = 0;
  let speechQueue = Promise.resolve();
  let speechEpoch = 0;
  const nativeVoice = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.registerPlugin?.('PipiVoice') : null;
  const phaseText = {
    planning: 'Pipi đang phân tích câu hỏi…',
    searching: 'Pipi đang tìm kiếm thông tin…',
    analyzing: 'Pipi đang phân tích khu vực xung quanh…',
    writing: 'Pipi đang soạn tin nhắn chi tiết…'
  };

  function setState(text, state = '') {
    status.textContent = text;
    panel.dataset.state = state;
  }
  function append(role, text, markdown = false) {
    const item = document.createElement('div');
    item.className = `pvm-message ${role}`;
    if (markdown && typeof renderMarkdownSafe === 'function') item.innerHTML = renderMarkdownSafe(text);
    else item.textContent = text;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }
  function stopSpeaking() {
    speechEpoch++;
    window.speechSynthesis?.cancel();
    const stopped = nativeVoice?.stop?.().catch(() => {});
    panel.classList.remove('speaking');
    return stopped;
  }
  function speak(text, token, priority = false) {
    const stopped = priority ? stopSpeaking() : null;
    const epoch = speechEpoch;
    const say = async () => {
      if (stopped) await stopped;
      if (token !== generation || epoch !== speechEpoch || panel.hidden || !text) return;
      panel.classList.add('speaking');
      try {
        let nativeSucceeded = false;
        if (nativeVoice) {
          try { await nativeVoice.speak({ text, language: 'vi-VN' }); nativeSucceeded = true; }
          catch (error) { if (epoch !== speechEpoch) return; console.warn('Native voice unavailable:', error); }
        }
        if (!nativeSucceeded && window.speechSynthesis) await new Promise(resolve => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'vi-VN'; utterance.rate = 1.05;
          utterance.onend = utterance.onerror = resolve;
          window.speechSynthesis.speak(utterance);
        });
      } catch (error) { console.warn('Voice playback failed:', error); }
      finally { if (token === generation) panel.classList.remove('speaking'); }
    };
    speechQueue = priority ? say() : speechQueue.then(say, say);
    return speechQueue;
  }
  function close() {
    generation++;
    holding = false;
    sending = false;
    activeRequest?.abort(); activeRequest = null;
    recognition?.abort(); recognition = null;
    stopSpeaking();
    mic.classList.remove('active');
    mic.disabled = !Recognition;
    panel.hidden = true;
    document.getElementById('pipi-voice-launch')?.focus();
  }
  function open() {
    panel.hidden = false;
    setState('Giữ nút mic để nói với Pipi');
    caption.textContent = Recognition ? 'Nhấn giữ nút mic' : 'Thiết bị chưa hỗ trợ nhận giọng nói';
    mic.disabled = !Recognition;
    mic.focus();
  }
  launch.addEventListener('click', open);
  el('pvm-close').addEventListener('click', close);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

  async function send(text) {
    if (!text || sending || panel.hidden) return;
    sending = true;
    mic.disabled = true;
    const token = ++generation;
    activeRequest = new AbortController();
    append('user', text);
    if (typeof addMessage === 'function') addMessage('user', text);
    if (typeof saveMessage === 'function') saveMessage('user', text);
    short.textContent = '';
    setState(phaseText.planning, 'busy');
    speak('Pipi đang phân tích câu hỏi.', token);
    const history = typeof readHistory === 'function' ? readHistory() : null;
    const messages = (history?.messages || []).slice(-7, -1).map(message => ({ role: message.role, content: message.content }));
    const latestContext = [...(history?.messages || [])].reverse().find(message => message?.travelContext || message?.nearby);
    const userLocation = typeof getStructuredUserLocation === 'function' ? getStructuredUserLocation() : {};
    const payload = {
      userMessage: text, chatHistory: messages,
      conversationContext: latestContext?.travelContext || (latestContext?.nearby ? { nearby: compactNearbySnapshot(latestContext.nearby) } : undefined),
      userLocation, khuVuc: [userLocation.country, userLocation.city, userLocation.area].filter(Boolean).join(' / ')
    };
    let briefPromise = Promise.resolve();
    let detail = null;
    try {
      const response = await fetch(`${CONFIG.WORKER_URL.replace(/\/+$/, '')}/voice-v1`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: activeRequest.signal
      });
      if (!response.ok || !response.body) throw new Error(`Voice endpoint: ${response.status}`);
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      const consume = line => {
        if (!line.trim() || token !== generation) return;
        let event; try { event = JSON.parse(line); } catch { return; }
        if (event.type === 'phase' && phaseText[event.phase]) {
          setState(phaseText[event.phase], 'busy');
          if (event.phase === 'searching') speak('Pipi đang tìm kiếm thông tin.', token);
          if (event.phase === 'analyzing') speak('Pipi đang phân tích kết quả.', token);
        } else if (event.type === 'spoken') {
          short.textContent = event.text || '';
          setState('Pipi đã tìm thấy câu trả lời', 'answer');
          briefPromise = speak(event.text || '', token, true);
        } else if (event.type === 'detail') {
          detail = event;
          append('ai', event.text || '', true);
          const message = typeof addMessage === 'function' ? addMessage('ai', event.text || '') : null;
          const nearby = typeof compactNearbySnapshot === 'function' ? compactNearbySnapshot(event.travelos?.nearby) : null;
          if (message && nearby?.pois?.length && window.TravelNearby?.render) window.TravelNearby.render(nearby, message);
          if (nearby?.pois?.length) {
            const mapButton = document.createElement('button');
            mapButton.type = 'button';
            mapButton.className = 'pvm-map-link';
            mapButton.textContent = 'Xem danh sách trên bản đồ';
            mapButton.addEventListener('click', () => { close(); message?.scrollIntoView?.({ block: 'end' }); });
            log.appendChild(mapButton);
          }
          const travelContext = typeof compactTravelContext === 'function' ? compactTravelContext(event.travelos) : null;
          if (typeof saveMessage === 'function') saveMessage('ai', event.text || '', { nearby, travelContext });
        } else if (event.type === 'error') throw new Error(event.text || 'Voice request failed');
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) !== -1) {
          consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
        }
      }
      consume(buffer);
      if (token === generation && detail) {
        await briefPromise;
        if (token === generation) {
          setState('Bạn có cần Pipi giúp gì nữa không?', 'ready');
          await speak('Bạn có cần Pipi giúp gì nữa không?', token);
        }
      } else if (token === generation) throw new Error('Pipi chưa nhận được câu trả lời chi tiết.');
    } catch (error) {
      if (token === generation && error.name !== 'AbortError') {
        const message = error.message?.startsWith('Voice endpoint: 404')
          ? 'Chế độ voice thử nghiệm chưa được bật trên máy chủ.'
          : 'Pipi chưa kết nối được. Bạn thử lại nhé.';
        setState(message, 'error'); append('ai', message); speak(message, token, true);
        console.warn('Voice Mode:', error);
      }
    } finally {
      if (token === generation) { sending = false; mic.disabled = !Recognition; activeRequest = null; }
    }
  }

  function begin(event) {
    if (!Recognition || sending || holding || panel.hidden) return;
    event.preventDefault();
    mic.setPointerCapture?.(event.pointerId);
    stopSpeaking();
    holding = true; transcript = '';
    recognition = new Recognition();
    recognition.lang = 'vi-VN'; recognition.continuous = false; recognition.interimResults = true;
    recognition.onresult = result => {
      transcript = Array.from(result.results).map(part => part[0]?.transcript || '').join(' ').trim();
      caption.textContent = transcript || 'Pipi đang nghe bạn…';
    };
    recognition.onerror = error => {
      if (error.error !== 'no-speech' && error.error !== 'aborted') setState('Không nghe rõ. Bạn thử giữ mic và nói lại nhé.', 'error');
    };
    recognition.onend = () => {
      recognition = null;
      if (panel.hidden) return;
      if (!holding) finish();
      else { holding = false; finish(); }
    };
    try { recognition.start(); setState('Pipi đang nghe bạn…', 'listening'); mic.classList.add('active'); caption.textContent = 'Thả tay để gửi'; }
    catch { holding = false; recognition = null; setState('Không mở được mic. Bạn kiểm tra quyền micro nhé.', 'error'); }
  }
  function finish() {
    mic.classList.remove('active');
    const said = transcript.trim(); transcript = '';
    caption.textContent = 'Nhấn giữ nút mic';
    if (said) send(said);
    else setState('Pipi chưa nghe rõ. Giữ mic rồi nói lại nhé.', 'ready');
  }
  function release(event) {
    if (!holding) return;
    event.preventDefault(); holding = false;
    setState('Pipi đang nhận câu hỏi…', 'busy');
    if (recognition) recognition.stop(); else finish();
  }
  mic.addEventListener('pointerdown', begin);
  mic.addEventListener('pointerup', release);
  mic.addEventListener('pointercancel', release);
})();
