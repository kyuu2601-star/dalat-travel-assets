// The chat microphone opens the portrait voice dialog.
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
    <header class="pvm-header"><div class="pvm-header-main"><span>LET'S GO <strong>PIPI</strong></span><label class="pvm-translate-switch"><span>Translate</span><input id="pvm-translate" type="checkbox" role="switch" aria-label="Bật chế độ dịch Trung Việt"><span class="pvm-switch-track" aria-hidden="true"></span></label></div><div class="pvm-header-actions"><label class="pvm-input-picker" id="pvm-input-picker"><span>Mic</span><select id="pvm-audio-input" aria-label="Chọn micro đầu vào"><option value="default">Mặc định</option></select></label><button type="button" id="pvm-close" aria-label="Đóng trò chuyện giọng nói">×</button></div></header>
    <div class="pvm-top"><div class="pvm-mic-halo"><button type="button" id="pvm-mic" aria-label="Giữ mic để nói"><svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button></div><p id="pvm-status" aria-live="polite">Giữ mic để nói</p><p id="pvm-caption" aria-live="polite">Pipi đang chờ câu hỏi của bạn</p></div>
    <div class="pvm-bottom"><div class="pvm-chat-title">Trò chuyện với Pipi</div><div id="pvm-chat" role="log" aria-live="polite"></div></div>`;
  document.body.appendChild(panel);

  const el = id => document.getElementById(id);
  const status = el('pvm-status');
  const log = el('pvm-chat');
  const mic = el('pvm-mic');
  const caption = el('pvm-caption');
  const translateSwitch = el('pvm-translate');
  const audioInputSelect = el('pvm-audio-input');
  const audioInputPicker = el('pvm-input-picker');
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
  let translateMode = false, translateBusy = false, translator = null, translatorPromise = null;
  let selectedMicId = 'default', audioInputBusy = false;
  const syncToggle = () => {
    const busy = sending || holding || translateBusy || audioInputBusy || Boolean(panel.classList.contains?.('speaking'));
    translateSwitch.disabled = busy;
    audioInputSelect.disabled = busy;
    audioInputPicker.hidden = !nativeVoice?.getAudioInputs && !translateMode;
  };
  const syncMic = () => { mic.disabled = !microphoneReady || sending || translateBusy || audioInputBusy || (translateMode ? !translator?.ready : !Recognition || !voiceReady); };
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
    syncToggle();
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
  async function playTranslatedFallback(result) {
    const language=result.targetLanguage==='zh-Hans'?'zh-CN':'vi-VN';
    if(nativeVoice?.speak) {
      await nativeVoice.speak({text:result.translatedText,language});
      return;
    }
    const synth=window.speechSynthesis;
    if(!synth || typeof SpeechSynthesisUtterance!=='function')throw new Error('VOICE_PLAYBACK_UNAVAILABLE');
    await new Promise((resolve,reject)=>{
      const utterance=new SpeechSynthesisUtterance(result.translatedText);
      utterance.lang=language;utterance.rate=1.05;
      utterance.onend=resolve;
      utterance.onerror=()=>reject(new Error('VOICE_PLAYBACK_UNAVAILABLE'));
      synth.speak(utterance);
    });
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
      syncToggle();
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
      finally { if (token === generation && epoch === speechEpoch) panel.classList.remove('speaking'); syncToggle(); }
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
    translator?.cancel(); translateMode = false; translateBusy = false; translateSwitch.checked = false;
    nativeVoice?.clearAudioInput?.().catch(() => {});
    selectedMicId = 'default';audioInputSelect.value = 'default';
    activeTyping?.remove(); activeTyping = null;
    mic.classList.remove('active');
    syncMic();syncToggle();
    panel.hidden = true;
    launch.focus();
  }
  function updateVoiceControls() {
    if (panel.hidden) return;
    syncMic();syncToggle();
    if (translateMode) return;
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
    refreshAudioInputs();
  }
  async function refreshAudioInputs() {
    if (panel.hidden || holding || sending || audioInputBusy) return;
    try {
      let devices = [];
      if (nativeVoice?.getAudioInputs) {
        const result = await nativeVoice.getAudioInputs();
        devices = result?.devices || [];
      } else if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        devices = (await navigator.mediaDevices.enumerateDevices())
          .filter(device => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
          .map((device, index) => ({id:device.deviceId,label:device.label || `Micro ${index + 1}`}));
      }
      if (panel.hidden) return;
      audioInputSelect.innerHTML = '';
      const add = (id, label) => {
        const option = document.createElement('option');
        option.value = id;option.textContent = label;
        audioInputSelect.appendChild(option);
      };
      add('default','Mặc định');
      for (const device of devices) if (device?.id && device.id !== 'default') add(String(device.id),device.label || 'Micro');
      if (selectedMicId !== 'default' && !devices.some(device => String(device.id) === selectedMicId)) selectedMicId = 'default';
      audioInputSelect.value = selectedMicId;
    } catch(error) { console.warn('Pipi microphone list:',error); }
  }
  function open() {
    panel.hidden = false;
    mic.disabled = true;
    syncToggle();
    refreshAudioInputs();
    if (window.TRAVELOS_NATIVE) requestMicrophone();
    if (voiceReady) {
      updateVoiceControls();
      return;
    }
    setState('Đang chuẩn bị giọng Pipi…', 'busy');
    caption.textContent = 'Gói giọng khoảng 400 MB, chỉ tải lần đầu rồi dùng trên máy.';
    window.PipiLocalVoice.prepare(progress => {
      if (panel.hidden || translateMode) return;
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
  function prewarmTranslate() {
    if (translator?.ready) return Promise.resolve(translator);
    if (translatorPromise) return translatorPromise;
    if (!window.PipiLiveTranslate) return Promise.reject(new Error('LIVE_TRANSLATE_UNAVAILABLE'));
    const instance = new window.PipiLiveTranslate(CONFIG.WORKER_URL,{
      onState:text=>{if(translateMode&&!panel.hidden)setState(text,'busy');},
      onError:error=>{
        if (translator !== instance) return;
        console.warn('Pipi Live Translate:',error);
        if (translateMode&&!panel.hidden) {
          caption.textContent='Pipi sẽ tiếp tục dịch qua kết nối dự phòng';
        }
      }
    });
    translator=instance;
    translatorPromise=instance.prepare().then(()=>instance).catch(error=>{
      if (translator===instance) {instance.close();translator=null;}
      throw error;
    }).finally(()=>{translatorPromise=null;});
    return translatorPromise;
  }
  window.PipiVoiceMode = { open, close, prewarmTranslate };
  el('pvm-close').addEventListener('click', close);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  audioInputSelect.addEventListener('focus', refreshAudioInputs);
  audioInputSelect.addEventListener('change', async () => {
    const requested = audioInputSelect.value;
    if (sending || holding || translateBusy || panel.classList.contains?.('speaking')) {
      audioInputSelect.value = selectedMicId;return;
    }
    audioInputBusy = true;syncMic();syncToggle();
    try {
      if (nativeVoice?.selectAudioInput) await nativeVoice.selectAudioInput({id:requested});
      selectedMicId = requested;
    } catch(error) {
      audioInputSelect.value = selectedMicId;
      caption.textContent = 'Chưa chọn được micro này. Bạn thử lại nhé.';
      console.warn('Pipi microphone selection:',error);
    } finally {audioInputBusy = false;syncMic();syncToggle();}
  });
  if (typeof navigator !== 'undefined') navigator.mediaDevices?.addEventListener?.('devicechange', () => {if(!panel.hidden)refreshAudioInputs();});

  translateSwitch.addEventListener('change', async () => {
    if (sending || holding || translateBusy || panel.classList.contains?.('speaking')) {
      translateSwitch.checked = translateMode;return;
    }
    translateMode = translateSwitch.checked;
    if (!translateMode) {
      const chatTitle=el('pvm-chat').parentElement?.querySelector?.('.pvm-chat-title');
      if(chatTitle)chatTitle.textContent='Trò chuyện với Pipi';
      updateVoiceControls();return;
    }
    translateBusy=true;syncMic();syncToggle();
    setState('Đang kết nối phiên dịch…','busy');
    caption.textContent='Đang chuẩn bị dịch Trung ↔ Việt';
    try {
      await prewarmTranslate();
      if (!translateMode || panel.hidden) return;
      setState('Giữ mic để nói','ready');caption.textContent='Nói tiếng Trung hoặc tiếng Việt';
      const chatTitle=el('pvm-chat').parentElement?.querySelector?.('.pvm-chat-title');
      if(chatTitle)chatTitle.textContent='Bản dịch';
      refreshAudioInputs();
    } catch(error) {
      console.warn('Pipi Live Translate setup:',error);
      translateMode=false;translateSwitch.checked=false;
      setState('Chưa kết nối được phiên dịch. Bạn thử lại sau nhé.','error');
      caption.textContent=error?.message || 'Live Translate chưa sẵn sàng';
    } finally {translateBusy=false;syncMic();syncToggle();}
  });

  async function send(text) {
    if (!text || sending || panel.hidden) return;
    sending = true;
    mic.disabled = true;
    syncToggle();
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
        append('ai', message);
        speak(message, token, true);
        console.warn('Voice Mode:', error);
      }
    } finally {
      if (token === generation) { sending = false; syncMic();syncToggle(); activeRequest = null; }
    }
  }

  function begin(event) {
    if (translateMode) {
      if (!translator?.ready || !microphoneReady || translateBusy || holding || panel.hidden) return;
      event.preventDefault();mic.setPointerCapture?.(event.pointerId);
      stopSpeaking();holding=true;translateBusy=true;syncToggle();mic.classList.add('active');
      setState('Đang nghe và dịch…','listening');caption.textContent='Pipi đang nghe bạn…';
      translator.start({deviceId:nativeVoice?.selectAudioInput ? '' : selectedMicId}).catch(error=>{
        if (!translateMode || panel.hidden) return;
        holding=false;translateBusy=false;mic.classList.remove('active');
        setState('Không mở được micro để dịch','error');caption.textContent=error?.message || 'Kiểm tra quyền micro';
        syncMic();syncToggle();
      });
      return;
    }
    if (!Recognition || !voiceReady || !microphoneReady || sending || holding || panel.hidden) return;
    event.preventDefault();
    mic.setPointerCapture?.(event.pointerId);
    stopSpeaking();
    holding = true; transcript = ''; confidence = null; recognitionError = '';
    syncToggle();
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
      append('ai', prompt);
      speak(prompt, ++generation, true);
    }
  }
  function release(event) {
    if (!holding) return;
    event.preventDefault(); holding = false;
    if (translateMode) {
      mic.classList.remove('active');mic.disabled=true;
      translator.finishInput().then(async result=>{
        if (!translateMode || panel.hidden)return;
        if (result.sourceText)append('user',result.sourceText);
        append('ai',result.translatedText || 'Đã phát bản dịch.');
        if(result.fallback && result.translatedText)await playTranslatedFallback(result);
        setState('Giữ mic để nói','ready');caption.textContent='Nói tiếng Trung hoặc tiếng Việt';
      }).catch(error=>{
        if (!translateMode || panel.hidden)return;
        console.warn('Pipi Live Translate:',error);
        setState('Chưa dịch được câu này. Bạn thử nói lại nhé.','error');
        caption.textContent=error?.message || 'Không nhận được bản dịch';
      }).finally(()=>{translateBusy=false;syncMic();syncToggle();});
      return;
    }
    syncToggle();
    setState('Pipi đang nhận câu hỏi…', 'busy');
    if (recognition) recognition.stop(); else finish();
  }
  mic.addEventListener('pointerdown', begin);
  mic.addEventListener('pointerup', release);
  mic.addEventListener('pointercancel', release);
})();
