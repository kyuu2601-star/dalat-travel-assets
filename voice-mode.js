// Experimental Voice Mode; the chat microphone opens this portrait dialog.
(() => {
  const launch = document.getElementById('mic-btn');
  if (!launch || document.getElementById('pipi-voice-mode')) return;

  const panel = document.createElement('section');
  panel.id = 'pipi-voice-mode';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Trò chuyện giọng nói với Pipi');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="pvm-header"><span>LET'S GO <strong>PIPI</strong> · VOICE THỬ NGHIỆM</span><div class="pvm-header-actions"><button type="button" id="pvm-voice-settings" aria-label="Chọn giọng nói">Giọng</button><button type="button" id="pvm-close" aria-label="Đóng trò chuyện giọng nói">×</button></div></header>
    <div id="pvm-voice-panel" hidden><strong>Giọng nói tiếng Việt</strong><label class="pvm-natural-choice"><input type="checkbox" id="pvm-natural-voice"> Giọng tự nhiên cho câu trả lời (cần mạng)</label><p>Giọng trên máy dùng để báo tiến độ và tự thay thế khi mất mạng.</p><select id="pvm-voice-select" aria-label="Chọn giọng tiếng Việt trên máy"></select><div class="pvm-voice-actions"><button type="button" id="pvm-preview">▶ Nghe thử</button><button type="button" id="pvm-download">Tải thêm giọng</button></div><p id="pvm-voice-help"></p></div>
    <div class="pvm-top"><div class="pvm-mic-halo"><button type="button" id="pvm-mic" aria-label="Giữ để nói, thả ra để gửi"><svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button></div><div id="pvm-tip">Giữ mic để nói · Thả tay để gửi</div><p id="pvm-status" aria-live="polite">Pipi đang chờ bạn nói</p><p id="pvm-caption" aria-live="polite">Nói rõ ràng và gần mic</p><p id="pvm-short" aria-live="polite"></p></div>
    <div class="pvm-bottom"><div class="pvm-chat-title">Trò chuyện với Pipi</div><div id="pvm-chat" role="log" aria-live="polite"></div></div>`;
  document.body.appendChild(panel);

  const el = id => document.getElementById(id);
  const status = el('pvm-status');
  const short = el('pvm-short');
  const log = el('pvm-chat');
  const mic = el('pvm-mic');
  const caption = el('pvm-caption');
  const voicePanel = el('pvm-voice-panel');
  const voiceSelect = el('pvm-voice-select');
  const voiceHelp = el('pvm-voice-help');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, holding = false, transcript = '', confidence = null, recognitionError = '', sending = false, activeRequest = null, generation = 0;
  let speechQueue = Promise.resolve();
  let speechEpoch = 0;
  const nativeVoice = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.registerPlugin?.('PipiVoice') : null;
  let webVoiceId = localStorage.getItem('pipi_voice_id') || 'auto';
  let naturalVoice = localStorage.getItem('pipi_natural_voice') !== 'off';
  el('pvm-natural-voice').checked = naturalVoice;
  let activeTtsFetch = null, activeAudio = null, activeAudioDone = null;
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
    activeTtsFetch?.abort(); activeTtsFetch = null;
    activeAudio?.pause(); activeAudio = null;
    activeAudioDone?.(); activeAudioDone = null;
    window.speechSynthesis?.cancel();
    const stopped = nativeVoice?.stop?.().catch(() => {});
    panel.classList.remove('speaking');
    return stopped;
  }
  async function playNatural(text, token, epoch) {
    const controller = new AbortController(); activeTtsFetch = controller;
    const response = await fetch(`${CONFIG.WORKER_URL.replace(/\/+$/, '')}/voice-tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal: controller.signal
    });
    if (activeTtsFetch === controller) activeTtsFetch = null;
    if (!response.ok || token !== generation || epoch !== speechEpoch) throw new Error('NATURAL_VOICE_UNAVAILABLE');
    const blob = await response.blob();
    if (token !== generation || epoch !== speechEpoch) throw new Error('VOICE_INTERRUPTED');
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url); activeAudio = audio;
    try {
      await new Promise((resolve, reject) => {
        activeAudioDone = resolve;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('AUDIO_PLAYBACK_FAILED'));
        audio.play().catch(reject);
      });
    } finally {
      if (activeAudio === audio) activeAudio = null;
      activeAudioDone = null;
      URL.revokeObjectURL(url);
    }
  }
  function speak(text, token, priority = false, preferNatural = false) {
    const stopped = priority ? stopSpeaking() : null;
    const epoch = speechEpoch;
    const say = async () => {
      if (stopped) await stopped;
      if (token !== generation || epoch !== speechEpoch || panel.hidden || !text) return;
      panel.classList.add('speaking');
      try {
        if (preferNatural && naturalVoice) {
          try { await playNatural(text, token, epoch); return; }
          catch (error) { if (epoch !== speechEpoch) return; console.warn('Natural voice unavailable, using device voice:', error); }
        }
        let nativeSucceeded = false;
        if (nativeVoice) {
          try { await nativeVoice.speak({ text, language: 'vi-VN' }); nativeSucceeded = true; }
          catch (error) { if (epoch !== speechEpoch) return; console.warn('Native voice unavailable:', error); }
        }
        if (!nativeSucceeded && window.speechSynthesis) await new Promise(resolve => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'vi-VN'; utterance.rate = 0.96;
          const voices = window.speechSynthesis.getVoices();
          utterance.voice = voices.find(voice => voice.voiceURI === webVoiceId)
            || voices.find(voice => voice.lang?.toLowerCase().startsWith('vi')) || null;
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
    voicePanel.hidden = true;
    launch.focus();
  }
  function open() {
    panel.hidden = false;
    setState('Pipi đang chờ bạn nói', 'ready');
    short.textContent = '';
    caption.textContent = Recognition ? 'Nói rõ ràng và gần mic' : 'Thiết bị chưa hỗ trợ nhận giọng nói';
    mic.disabled = !Recognition;
    mic.focus();
  }
  window.PipiVoiceMode = { open, close };
  el('pvm-close').addEventListener('click', close);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

  function setVoiceOptions(voices, selected) {
    voiceSelect.replaceChildren();
    const automatic = document.createElement('option');
    automatic.value = 'auto'; automatic.textContent = 'Tự chọn giọng tốt nhất';
    voiceSelect.appendChild(automatic);
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.id; option.textContent = voice.label;
      voiceSelect.appendChild(option);
    }
    voiceSelect.value = voices.some(voice => voice.id === selected) ? selected : 'auto';
  }
  async function loadVoices() {
    voiceHelp.textContent = 'Đang đọc danh sách giọng trên máy…';
    if (nativeVoice?.getVoices) {
      try {
        let data;
        for (const delay of [0, 350, 850]) {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          try { data = await nativeVoice.getVoices(); break; } catch { /* TTS may still be starting. */ }
        }
        if (!data) throw new Error('VOICE_ENGINE_LOADING');
        setVoiceOptions(data.voices || [], data.selected);
        voiceHelp.textContent = data.voices?.length
          ? 'Giọng dùng mạng cần kết nối; giọng offline dùng được khi mất mạng.'
          : 'Máy chưa có gói giọng Việt. Bấm “Tải thêm giọng” để cài.';
        return;
      } catch { voiceHelp.textContent = 'Chưa đọc được danh sách giọng. Bạn thử mở lại sau vài giây.'; return; }
    }
    const voices = window.speechSynthesis?.getVoices()?.filter(voice => voice.lang?.toLowerCase().startsWith('vi')) || [];
    setVoiceOptions(voices.map((voice, i) => ({ id: voice.voiceURI, label: `Giọng ${i + 1} · ${voice.name}` })), webVoiceId);
    voiceHelp.textContent = voices.length ? 'Trình duyệt cung cấp các giọng này.' : 'Trình duyệt chưa có giọng Việt. Trên Android, hãy cài gói giọng trong Cài đặt máy.';
  }
  el('pvm-voice-settings').addEventListener('click', () => {
    voicePanel.hidden = !voicePanel.hidden;
    if (!voicePanel.hidden) loadVoices();
  });
  voiceSelect.addEventListener('change', async () => {
    try {
      if (nativeVoice?.selectVoice) await nativeVoice.selectVoice({ voiceId: voiceSelect.value });
      else { webVoiceId = voiceSelect.value; localStorage.setItem('pipi_voice_id', webVoiceId); }
      voiceHelp.textContent = 'Đã lưu giọng. Bấm “Nghe thử” để kiểm tra.';
    } catch { voiceHelp.textContent = 'Không chọn được giọng này. Bạn thử giọng khác nhé.'; }
  });
  el('pvm-natural-voice').addEventListener('change', event => {
    naturalVoice = event.target.checked;
    localStorage.setItem('pipi_natural_voice', naturalVoice ? 'on' : 'off');
  });
  el('pvm-preview').addEventListener('click', () => {
    speak('Xin chào bạn! Pipi rất vui được đồng hành cùng bạn trong chuyến đi này.', generation, true, true);
  });
  el('pvm-download').addEventListener('click', async () => {
    if (nativeVoice?.openVoiceDownloads) {
      try { await nativeVoice.openVoiceDownloads(); voiceHelp.textContent = 'Sau khi cài xong, quay lại đây và mở lại danh sách giọng.'; return; }
      catch { /* Some Samsung engines do not expose a download screen. */ }
    }
    voiceHelp.textContent = 'Vào Cài đặt máy → Quản lý chung → Văn bản thành giọng nói → Tải dữ liệu giọng nói → Tiếng Việt.';
  });

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
          briefPromise = speak(event.text || '', token, true, true);
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
    holding = true; transcript = ''; confidence = null; recognitionError = '';
    recognition = new Recognition();
    recognition.lang = 'vi-VN'; recognition.continuous = false; recognition.interimResults = true;
    recognition.onresult = result => {
      transcript = Array.from(result.results).map(part => part[0]?.transcript || '').join(' ').trim();
      const finalResult = Array.from(result.results).reverse().find(part => part.isFinal);
      if (finalResult && Number(finalResult[0]?.confidence) > 0) confidence = finalResult[0].confidence;
      caption.textContent = transcript || 'Pipi đang nghe bạn…';
    };
    recognition.onerror = error => {
      if (error.error !== 'aborted') recognitionError = error.error || 'unknown';
      if (error.error === 'not-allowed' || error.error === 'service-not-allowed') setState('Bạn hãy cho phép dùng micro rồi thử lại nhé.', 'error');
      else if (error.error !== 'aborted') setState('Pipi chưa nghe rõ. Bạn hãy nói to, rõ hơn vào mic nhé.', 'error');
    };
    recognition.onend = () => {
      recognition = null;
      if (panel.hidden) return;
      if (!holding) finish();
      else caption.textContent = 'Thả tay để Pipi kiểm tra câu vừa nghe';
    };
    try { recognition.start(); setState('Pipi đang nghe bạn…', 'listening'); mic.classList.add('active'); caption.textContent = 'Thả tay để gửi'; }
    catch { holding = false; recognition = null; setState('Không mở được mic. Bạn kiểm tra quyền micro nhé.', 'error'); }
  }
  function finish() {
    mic.classList.remove('active');
    const quality = window.PipiVoiceQuality?.(transcript, confidence, recognitionError) || { clear: Boolean(transcript.trim()), text: transcript.trim() };
    const permissionDenied = recognitionError === 'not-allowed' || recognitionError === 'service-not-allowed';
    transcript = ''; confidence = null; recognitionError = '';
    caption.textContent = 'Giữ mic để thử lại';
    if (quality.clear) send(quality.text);
    else {
      const prompt = permissionDenied ? 'Bạn hãy cho phép dùng micro rồi thử lại nhé.' : 'Pipi chưa nghe rõ. Bạn hãy nói to, rõ hơn vào mic nhé.';
      setState(prompt, 'unclear');
      short.textContent = '';
      append('ai', prompt);
      speak(prompt, ++generation, true);
    }
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
