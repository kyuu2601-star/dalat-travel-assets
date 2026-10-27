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
    <header class="pvm-header"><span>LET'S GO <strong>PIPI</strong> · VOICE THỬ NGHIỆM</span><button type="button" id="pvm-close" aria-label="Đóng trò chuyện giọng nói">×</button></header>
    <div class="pvm-top"><div class="pvm-mic-halo"><button type="button" id="pvm-mic" aria-label="Giữ để nói, thả ra để gửi"><svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button></div><div id="pvm-tip">Giữ mic để nói · Thả tay để gửi</div><p id="pvm-status" aria-live="polite">Pipi đang chờ bạn nói</p><p id="pvm-caption" aria-live="polite">Nói rõ ràng và gần mic</p><p id="pvm-short" aria-live="polite"></p></div>
    <div class="pvm-bottom"><div class="pvm-chat-title">Trò chuyện với Pipi</div><div id="pvm-chat" role="log" aria-live="polite"></div></div>`;
  document.body.appendChild(panel);

  const el = id => document.getElementById(id);
  const status = el('pvm-status');
  const short = el('pvm-short');
  const log = el('pvm-chat');
  const mic = el('pvm-mic');
  const caption = el('pvm-caption');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, holding = false, transcript = '', confidence = null, recognitionError = '', sending = false, activeRequest = null, activeTyping = null, generation = 0;
  let speechQueue = Promise.resolve();
  let speechEpoch = 0;
  const fixedClips = {
    'Pipi đang phân tích câu hỏi.': 'assets/voice/planning.wav',
    'Pipi đang tìm kiếm thông tin.': 'assets/voice/searching.wav',
    'Pipi đang phân tích kết quả.': 'assets/voice/analyzing.wav',
    'Bạn có cần Pipi giúp gì nữa không?': 'assets/voice/followup.wav'
  };
  let activeTtsFetch = null, activeAudio = null, activeAudioDone = null;
  let audioContext = null, streamPlaybackDone = null;
  const streamSources = new Set();
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
    for (const source of streamSources) { try { source.stop(); } catch { /* Already stopped. */ } }
    streamSources.clear();
    streamPlaybackDone?.(); streamPlaybackDone = null;
    panel.classList.remove('speaking');
  }
  function getAudioContext() {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return null;
    if (!audioContext) audioContext = new AudioContextType();
    return audioContext;
  }
  async function playAudioUrl(url, onStart) {
    const audio = new Audio(url); activeAudio = audio;
    try {
      await new Promise((resolve, reject) => {
        activeAudioDone = resolve;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('AUDIO_PLAYBACK_FAILED'));
        audio.play().then(() => onStart?.(), reject);
      });
    } finally {
      if (activeAudio === audio) activeAudio = null;
      activeAudioDone = null;
    }
  }
  async function playStreamedVoice(text, token, epoch, onStart) {
    const context = getAudioContext();
    if (!context) throw new Error('AUDIO_CONTEXT_UNAVAILABLE');
    await context.resume();
    const controller = new AbortController(); activeTtsFetch = controller;
    let playbackComplete;
    const playback = new Promise(resolve => { playbackComplete = resolve; });
    streamPlaybackDone = playbackComplete;
    let streamEnded = false, started = false, nextAt = 0, queuedSeconds = 0;
    const queued = [];
    const finishPlayback = () => { if (streamEnded && !streamSources.size) playbackComplete(); };
    const schedule = () => {
      if (!queued.length) return;
      nextAt = Math.max(nextAt, context.currentTime + 0.08);
      for (const buffer of queued.splice(0)) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => { streamSources.delete(source); finishPlayback(); };
        streamSources.add(source);
        source.start(nextAt);
        nextAt += buffer.duration;
      }
      queuedSeconds = 0;
      if (!started) { started = true; onStart?.(); }
    };
    const onEvent = event => {
      if (event?.event_type !== 'step.delta' || event.delta?.type !== 'audio') return;
      const raw = atob(event.delta.data || '');
      if (!raw || raw.length % 2) throw new Error('INVALID_STREAM_AUDIO');
      const sampleRate = Number(event.delta.sample_rate) || 24000;
      const buffer = context.createBuffer(1, raw.length / 2, sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const value = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
        samples[i] = (value & 0x8000 ? value - 0x10000 : value) / 32768;
      }
      queued.push(buffer); queuedSeconds += buffer.duration;
      if (started || queuedSeconds >= 0.35) schedule();
    };
    try {
      const response = await fetch(`${CONFIG.WORKER_URL.replace(/\/+$/, '')}/voice-tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, stream: true }), signal: controller.signal
      });
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('PIPI_VOICE_STREAM_UNAVAILABLE');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let pending = '';
      const consume = block => {
        const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') return;
        onEvent(JSON.parse(data));
      };
      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        if (token !== generation || epoch !== speechEpoch) throw new Error('VOICE_INTERRUPTED');
        pending += decoder.decode(value, {stream:true});
        pending = pending.replace(/\r\n/g, '\n');
        let boundary;
        while ((boundary = pending.indexOf('\n\n')) !== -1) {
          consume(pending.slice(0, boundary));
          pending = pending.slice(boundary + 2);
        }
      }
      if (pending.trim()) consume(pending);
      if (!started) schedule();
      if (!started) throw new Error('EMPTY_VOICE_STREAM');
      streamEnded = true; finishPlayback();
      await playback;
      if (token !== generation || epoch !== speechEpoch) throw new Error('VOICE_INTERRUPTED');
    } catch (error) {
      for (const source of streamSources) { try { source.stop(); } catch { /* Already stopped. */ } }
      streamSources.clear();
      throw error;
    } finally {
      if (activeTtsFetch === controller) activeTtsFetch = null;
      if (streamPlaybackDone === playbackComplete) streamPlaybackDone = null;
    }
  }
  async function playNatural(text, token, epoch, onStart) {
    if (!fixedClips[text] && getAudioContext()) return playStreamedVoice(text, token, epoch, onStart);
    let objectUrl = null;
    let url = fixedClips[text];
    if (!url) {
      const controller = new AbortController(); activeTtsFetch = controller;
      try {
        const response = await fetch(`${CONFIG.WORKER_URL.replace(/\/+$/, '')}/voice-tts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }), signal: controller.signal
        });
        if (!response.ok || token !== generation || epoch !== speechEpoch) throw new Error('PIPI_VOICE_UNAVAILABLE');
        objectUrl = URL.createObjectURL(await response.blob());
        url = objectUrl;
      } finally {
        if (activeTtsFetch === controller) activeTtsFetch = null;
      }
    }
    if (token !== generation || epoch !== speechEpoch) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      throw new Error('VOICE_INTERRUPTED');
    }
    try {
      await playAudioUrl(url, onStart);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }
  function speak(text, token, priority = false, onStart = null) {
    if (priority) stopSpeaking();
    const epoch = speechEpoch;
    const say = async () => {
      if (token !== generation || epoch !== speechEpoch || panel.hidden || !text) return false;
      panel.classList.add('speaking');
      try {
        await playNatural(text, token, epoch, onStart);
        return token === generation && epoch === speechEpoch;
      } catch (error) {
        if (epoch === speechEpoch && token === generation) {
          caption.textContent = 'Chưa phát được giọng Pipi. Bạn có thể đọc nội dung trên màn hình.';
          console.warn('Pipi voice playback unavailable:', error);
        }
        return false;
      }
      finally { if (token === generation && epoch === speechEpoch) panel.classList.remove('speaking'); }
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
    activeTyping?.remove(); activeTyping = null;
    mic.classList.remove('active');
    mic.disabled = !Recognition;
    panel.hidden = true;
    launch.focus();
  }
  function open() {
    panel.hidden = false;
    getAudioContext()?.resume().catch(() => {});
    setState('Pipi đang chờ bạn nói', 'ready');
    short.textContent = '';
    caption.textContent = Recognition ? 'Nói rõ ràng và gần mic' : 'Thiết bị chưa hỗ trợ nhận giọng nói';
    mic.disabled = !Recognition;
    mic.focus();
  }
  window.PipiVoiceMode = { open, close };
  el('pvm-close').addEventListener('click', close);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

  async function send(text) {
    if (!text || sending || panel.hidden) return;
    sending = true;
    mic.disabled = true;
    const token = ++generation;
    activeRequest = new AbortController();
    append('user', text);
    const typing = document.createElement('div');
    typing.className = 'pvm-message ai pvm-typing';
    typing.setAttribute('role', 'status');
    typing.setAttribute('aria-label', 'Pipi đang chuẩn bị câu trả lời');
    typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing);
    activeTyping = typing;
    log.scrollTop = log.scrollHeight;
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
    let briefPromise = Promise.resolve(false);
    let detail = null, spokenText = '', replyStarted = false, detailShown = false;
    const showDetail = () => {
      if (!replyStarted || !detail || detailShown || token !== generation) return;
      detailShown = true;
      typing.remove();
      if (activeTyping === typing) activeTyping = null;
      append('ai', detail.text || '', true);
      const message = typeof addMessage === 'function' ? addMessage('ai', detail.text || '') : null;
      const nearby = typeof compactNearbySnapshot === 'function' ? compactNearbySnapshot(detail.travelos?.nearby) : null;
      if (message && nearby?.pois?.length && window.TravelNearby?.render) window.TravelNearby.render(nearby, message);
      if (nearby?.pois?.length) {
        const mapButton = document.createElement('button');
        mapButton.type = 'button';
        mapButton.className = 'pvm-map-link';
        mapButton.textContent = 'Xem danh sách trên bản đồ';
        mapButton.addEventListener('click', () => { close(); message?.scrollIntoView?.({ block: 'end' }); });
        log.appendChild(mapButton);
      }
      const travelContext = typeof compactTravelContext === 'function' ? compactTravelContext(detail.travelos) : null;
      if (typeof saveMessage === 'function') saveMessage('ai', detail.text || '', { nearby, travelContext });
    };
    const revealReply = () => {
      if (replyStarted || token !== generation || panel.hidden) return;
      replyStarted = true;
      short.textContent = spokenText;
      setState('Pipi đã tìm thấy câu trả lời', 'answer');
      showDetail();
    };
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
          if (!replyStarted) setState(phaseText[event.phase], 'busy');
          if (event.phase === 'searching') speak('Pipi đang tìm kiếm thông tin.', token);
          if (event.phase === 'analyzing') speak('Pipi đang phân tích kết quả.', token);
        } else if (event.type === 'spoken') {
          spokenText = event.text || '';
          setState('Pipi đang chuẩn bị nói…', 'busy');
          briefPromise = speak(spokenText, token, true, revealReply);
          briefPromise.then(played => { if (!played) revealReply(); });
        } else if (event.type === 'detail') {
          detail = event;
          showDetail();
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
        const played = await briefPromise;
        revealReply();
        if (token === generation) {
          setState('Bạn có cần Pipi giúp gì nữa không?', 'ready');
          if (played) await speak('Bạn có cần Pipi giúp gì nữa không?', token);
        }
      } else if (token === generation) throw new Error('Pipi chưa nhận được câu trả lời chi tiết.');
    } catch (error) {
      if (token === generation && error.name !== 'AbortError') {
        typing.remove();
        if (activeTyping === typing) activeTyping = null;
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
