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
    <div class="pvm-top"><div class="pvm-mic-halo"><button type="button" id="pvm-mic" aria-label="Giữ mic để nói"><svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button></div><p id="pvm-status" aria-live="polite">Giữ mic để nói</p><p id="pvm-caption" aria-live="polite">Pipi đang chờ câu hỏi của bạn</p></div>
    <div class="pvm-bottom"><div class="pvm-chat-title">Trò chuyện với Pipi</div><div id="pvm-chat" role="log" aria-live="polite"></div></div>`;
  document.body.appendChild(panel);

  const el = id => document.getElementById(id);
  const status = el('pvm-status');
  const log = el('pvm-chat');
  const mic = el('pvm-mic');
  const caption = el('pvm-caption');
  const nativeVoice = window.TRAVELOS_NATIVE ? window.Capacitor?.Plugins?.PipiVoice : null;
  class NativeRecognition {
    constructor() { this.lang = 'vi-VN'; this.ended = false; this.subscription = null; this.starting = null; }
    end() {
      if (this.ended) return;
      this.ended = true;
      this.subscription?.remove?.();
      this.onend?.();
    }
    start() {
      this.starting = (async () => {
        this.subscription = await nativeVoice.addListener('recognitionResult', event => {
          if (this.ended) return;
          if (event.type === 'error') {
            this.onerror?.({error:event.error || 'no-speech'});
            this.end();
            return;
          }
          if (event.transcript) {
            const result = Object.assign([{transcript:event.transcript, confidence:event.confidence ?? 0}], {isFinal:event.type === 'final'});
            this.onresult?.({results:[result]});
          }
          if (event.type === 'final') this.end();
        });
        if (!this.ended) await nativeVoice.startRecognition({language:this.lang});
      })().catch(error => {
        if (this.ended) return;
        this.onerror?.({error:String(error?.message || error).includes('PERMISSION') ? 'not-allowed' : 'no-speech'});
        this.end();
      });
    }
    stop() { this.starting?.then(() => { if (!this.ended) nativeVoice.stopRecognition().catch(() => this.end()); }); }
    abort() {
      if (this.ended) return;
      nativeVoice.cancelRecognition().catch(() => {});
      this.end();
    }
  }
  const Recognition = nativeVoice?.startRecognition && nativeVoice?.addListener
    ? NativeRecognition : window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, holding = false, transcript = '', confidence = null, recognitionError = '', sending = false, activeRequest = null, activeTyping = null, generation = 0;
  let speechQueue = Promise.resolve();
  let speechEpoch = 0;
  const fixedClips = {
    'Pipi đang phân tích câu hỏi.': 'assets/voice/planning.wav?v=local-2',
    'Pipi đang tìm kiếm thông tin.': 'assets/voice/searching.wav?v=local-2',
    'Pipi đang phân tích kết quả.': 'assets/voice/analyzing.wav?v=local-2',
    'Bạn có cần Pipi giúp gì nữa không?': 'assets/voice/followup.wav?v=local-2',
    'Pipi chưa nghe rõ. Bạn hãy nói to, rõ hơn vào mic nhé.': 'assets/voice/unclear.wav?v=local-2',
    'Bạn hãy cho phép dùng micro rồi thử lại nhé.': 'assets/voice/microphone-permission.wav?v=local-2',
    'Pipi chưa kết nối được. Bạn thử lại nhé.': 'assets/voice/connection-unavailable.wav?v=local-2',
    'Chế độ voice thử nghiệm chưa được bật trên máy chủ.': 'assets/voice/mode-unavailable.wav?v=local-2'
  };
  let activeAudio = null, activeAudioDone = null;
  let voiceReady = false;
  let microphoneReady = !window.TRAVELOS_NATIVE;
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
    activeAudio?.pause(); activeAudio = null;
    activeAudioDone?.(); activeAudioDone = null;
    nativeVoice?.stop?.().catch(() => {});
    window.speechSynthesis?.cancel?.();
    panel.classList.remove('speaking');
  }
  async function playFallback(text, token, epoch, onStart) {
    if (token !== generation || epoch !== speechEpoch) return false;
    if (nativeVoice?.speak) {
      const playback = nativeVoice.speak({text,language:'vi-VN'});
      onStart?.();
      await playback;
      return token === generation && epoch === speechEpoch;
    }
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance !== 'function') return false;
    await new Promise((resolve,reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';utterance.rate = 1.05;
      utterance.onstart = () => onStart?.();
      utterance.onend = resolve;
      utterance.onerror = () => reject(new Error('VOICE_FALLBACK_FAILED'));
      synth.speak(utterance);
    });
    return token === generation && epoch === speechEpoch;
  }
  async function playAudioUrl(url, onStart) {
    const audio = new Audio(url); activeAudio = audio;
    let done;
    try {
      await new Promise((resolve, reject) => {
        done = resolve; activeAudioDone = resolve;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error('AUDIO_PLAYBACK_FAILED'));
        audio.play().then(() => onStart?.(), reject);
      });
    } finally {
      if (activeAudio === audio) activeAudio = null;
      if (activeAudioDone === done) activeAudioDone = null;
    }
  }
  async function playNatural(text, token, epoch, onStart) {
    let objectUrl = null;
    let url = fixedClips[text];
    if (!url) {
      const result = await window.PipiLocalVoice.synthesize(text);
      if (token !== generation || epoch !== speechEpoch) throw new Error('VOICE_INTERRUPTED');
      objectUrl = URL.createObjectURL(new Blob([result.wav], {type:'audio/wav'}));
      url = objectUrl;
    }
    if (token !== generation || epoch !== speechEpoch) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      throw new Error('VOICE_INTERRUPTED');
    }
    try { await playAudioUrl(url, onStart); }
    finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
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
          try { if (await playFallback(text, token, epoch, onStart)) return true; }
          catch (fallbackError) { console.warn('Pipi fallback voice playback unavailable:', fallbackError); }
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
    mic.disabled = !Recognition || !voiceReady || !microphoneReady;
    panel.hidden = true;
    launch.focus();
  }
  function updateVoiceControls() {
    if (panel.hidden) return;
    mic.disabled = !Recognition || !voiceReady || !microphoneReady;
    if (!voiceReady) return;
    if (!microphoneReady) {
      setState('Pipi cần quyền micro để nghe bạn nói', 'error');
      caption.textContent = 'Hãy cho phép khi Android hỏi. Nếu đã từ chối, bật Micro trong Cài đặt ứng dụng.';
    } else if (voiceReady) {
      setState('Giữ mic để nói', 'ready');
      caption.textContent = Recognition ? 'Pipi đang chờ câu hỏi của bạn' : 'Thiết bị chưa hỗ trợ nhận giọng nói';
      if (Recognition) mic.focus();
    }
  }
  async function requestMicrophone() {
    if (!window.TRAVELOS_NATIVE) return;
    try {
      const nativeVoice = window.Capacitor?.Plugins?.PipiVoice;
      if (!nativeVoice?.requestMicrophonePermission) throw new Error('MICROPHONE_PERMISSION_BRIDGE_UNAVAILABLE');
      const result = await nativeVoice.requestMicrophonePermission();
      microphoneReady = result?.microphone === 'granted';
    } catch (error) {
      microphoneReady = false;
      console.warn('Pipi microphone permission:', error);
    }
    updateVoiceControls();
  }
  function open() {
    panel.hidden = false;
    mic.disabled = true;
    if (window.TRAVELOS_NATIVE) requestMicrophone();
    if (voiceReady) {
      updateVoiceControls();
      return;
    }
    setState('Đang chuẩn bị giọng Pipi…', 'busy');
    caption.textContent = 'Gói giọng khoảng 400 MB, chỉ tải lần đầu rồi dùng trên máy.';
    window.PipiLocalVoice.prepare(progress => {
      if (panel.hidden) return;
      if (progress.phase === 'download') {
        const percent = Math.min(100, Math.round(progress.loaded / progress.total * 100));
        setState(`Đang tải giọng Pipi… ${percent}%`, 'busy');
      } else setState('Đang khởi động giọng Pipi…', 'busy');
    }).then(() => {
      voiceReady = true;
      updateVoiceControls();
    }).catch(error => {
      if (!panel.hidden) {
        setState('Chưa tải được giọng Pipi. Bạn đóng rồi mở lại để thử nhé.', 'error');
        caption.textContent = 'Bạn vẫn có thể trò chuyện bằng chữ.';
      }
      console.warn('Pipi local voice setup:', error);
    });
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
    setState(phaseText.planning, 'busy');
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
        mapButton.textContent = 'Chi Tiết';
        mapButton.addEventListener('click', () => { close(); window.TravelNearby?.openFull?.(nearby); });
        log.appendChild(mapButton);
      }
      const travelContext = typeof compactTravelContext === 'function' ? compactTravelContext(detail.travelos) : null;
      if (typeof saveMessage === 'function') saveMessage('ai', detail.text || '', { nearby, travelContext });
    };
    const revealReply = () => {
      if (replyStarted || token !== generation || panel.hidden) return;
      replyStarted = true;
      setState('Pipi đang trả lời bạn…', 'answer');
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
        await briefPromise;
        revealReply();
        if (token === generation) {
          setState('Giữ mic để nói', 'ready');
          caption.textContent = 'Pipi đang chờ câu hỏi của bạn';
        }
      } else if (token === generation) throw new Error('Pipi chưa nhận được câu trả lời chi tiết.');
    } catch (error) {
      if (token === generation && error.name !== 'AbortError') {
        typing.remove();
        if (activeTyping === typing) activeTyping = null;
        const message = error.message?.startsWith('Voice endpoint: 404')
          ? 'Chế độ voice thử nghiệm chưa được bật trên máy chủ.'
          : 'Pipi chưa kết nối được. Bạn thử lại nhé.';
        setState('Giữ mic để nói', 'ready');
        caption.textContent = 'Pipi đang chờ câu hỏi của bạn';
        speak(message, token, true);
        console.warn('Voice Mode:', error);
      }
    } finally {
      if (token === generation) { sending = false; mic.disabled = !Recognition || !voiceReady || !microphoneReady; activeRequest = null; }
    }
  }

  function begin(event) {
    if (!Recognition || !voiceReady || !microphoneReady || sending || holding || panel.hidden) return;
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
      caption.textContent = 'Pipi đang nghe bạn…';
    };
    recognition.onerror = error => {
      if (error.error !== 'aborted') recognitionError = error.error || 'unknown';
      if (error.error !== 'aborted') setState('Giữ mic để nói', 'ready');
    };
    recognition.onend = () => {
      recognition = null;
      if (panel.hidden) return;
      if (!holding) finish();
      else caption.textContent = 'Pipi đang ghi nhận câu hỏi của bạn';
    };
    try { recognition.start(); setState('Pipi đang nghe bạn…', 'listening'); mic.classList.add('active'); caption.textContent = 'Pipi đang ghi nhận câu hỏi của bạn'; }
    catch { holding = false; recognition = null; setState('Không mở được mic. Bạn kiểm tra quyền micro nhé.', 'error'); }
  }
  function finish() {
    mic.classList.remove('active');
    const quality = window.PipiVoiceQuality?.(transcript, confidence, recognitionError) || { clear: Boolean(transcript.trim()), text: transcript.trim() };
    const permissionDenied = recognitionError === 'not-allowed' || recognitionError === 'service-not-allowed';
    transcript = ''; confidence = null; recognitionError = '';
    caption.textContent = 'Pipi đang chờ câu hỏi của bạn';
    if (quality.clear) send(quality.text);
    else {
      const prompt = permissionDenied ? 'Bạn hãy cho phép dùng micro rồi thử lại nhé.' : 'Pipi chưa nghe rõ. Bạn hãy nói to, rõ hơn vào mic nhé.';
      setState('Giữ mic để nói', 'ready');
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
