// Separate, hold-to-talk interpreter. The regular Pipi voice/chat path is untouched.
(() => {
  const MODEL = 'gemini-3.5-live-translate-preview';
  const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
  const targets = ['vi', 'zh-Hans'];
  const emptyTurn = () => ({input:'',output:'',audio:[],complete:false});
  const language = value => String(value || '').toLowerCase().startsWith('zh') ? 'zh-Hans'
    : String(value || '').toLowerCase().startsWith('vi') ? 'vi' : '';
  const audioBytes = data => {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return bytes;
  };
  const base64 = bytes => {
    let binary='';
    for (let i=0;i<bytes.length;i++) binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  class LiveTranslate {
    constructor(workerUrl, callbacks={}) {
      this.workerUrl=workerUrl.replace(/\/+$/,'');
      this.callbacks=callbacks;
      this.sessions=new Map();
      this.ready=false;
      this.turn=null;
      this.capture=null;
      this.audioContext=null;
      this.playAt=0;
      this.playing=[];
      this.generation=0;
      this.closed=false;
    }
    async prepare() {
      if (this.ready) return;
      try { await Promise.all(targets.map(target=>this.connect(target))); }
      catch(error) {
        this.close();
        throw error;
      }
      this.ready=true;
    }
    async connect(target) {
      const response=await fetch(`${this.workerUrl}/voice-live-token`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({targetLanguageCode:target})
      });
      const data=await response.json().catch(()=>({}));
      if (!response.ok || !data.token) throw new Error(data.providerMessage || data.error || 'LIVE_TOKEN_UNAVAILABLE');
      return new Promise((resolve,reject)=>{
        const socket=new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(data.token)}`);
        let settled=false;
        const timeout=setTimeout(()=>{if(!settled){settled=true;socket.close();reject(new Error('LIVE_SETUP_TIMEOUT'));}},15000);
        const fail=message=>{
          if (!settled) {settled=true;clearTimeout(timeout);reject(new Error(message));}
          else {this.ready=false;this.callbacks.onError?.(new Error(message));}
        };
        socket.onopen=()=>socket.send(JSON.stringify({setup:{
          model:`models/${MODEL}`,
          inputAudioTranscription:{},outputAudioTranscription:{},
          generationConfig:{
            responseModalities:['AUDIO'],
            translationConfig:{targetLanguageCode:target,echoTargetLanguage:false}
          }
        }}));
        socket.onmessage=async event=>{
          let message;
          try {
            const payload=event.data instanceof Blob ? await event.data.text()
              : event.data instanceof ArrayBuffer ? new TextDecoder().decode(event.data)
              : event.data;
            message=JSON.parse(payload);
          } catch(error) {this.callbacks.onError?.(error);return;}
          if (message.setupComplete) {
            if(this.closed){socket.close();fail('LIVE_CANCELLED');return;}
            settled=true;clearTimeout(timeout);this.sessions.set(target,socket);resolve();return;
          }
          this.receive(target,message);
        };
        socket.onerror=()=>fail('LIVE_SOCKET_ERROR');
        socket.onclose=event=>{
          if (this.sessions.get(target)===socket) this.sessions.delete(target);
          if(this.closed)return;
          fail(`LIVE_SOCKET_CLOSED_${event.code}`);
        };
      });
    }
    async start() {
      if (!this.ready || this.turn) throw new Error('LIVE_NOT_READY');
      const epoch=++this.generation;
      this.turn={epoch,released:false,source:'',chosen:'',data:{vi:emptyTurn(),'zh-Hans':emptyTurn()},
        resolve:null,reject:null,timer:null,playback:null};
      const Context=window.AudioContext || window.webkitAudioContext;
      if (!Context || !navigator.mediaDevices?.getUserMedia) {this.turn=null;throw new Error('MICROPHONE_CAPTURE_UNAVAILABLE');}
      try {
        this.audioContext=this.audioContext || new Context();
        await this.audioContext.resume();
        const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
        if (this.generation!==epoch || !this.turn || this.turn.released) {stream.getTracks().forEach(track=>track.stop());return;}
        const source=this.audioContext.createMediaStreamSource(stream);
        const processor=this.audioContext.createScriptProcessor(4096,1,1);
        source.connect(processor);
        processor.connect(this.audioContext.destination);
        processor.onaudioprocess=event=>{
          if (!this.turn || this.turn.epoch!==epoch || this.turn.released) return;
          const samples=event.inputBuffer.getChannelData(0);
          const ratio=this.audioContext.sampleRate/16000;
          const output=new Uint8Array(Math.floor(samples.length/ratio)*2);
          const view=new DataView(output.buffer);
          for(let i=0;i<output.length/2;i++) {
            const sample=Math.max(-1,Math.min(1,samples[Math.floor(i*ratio)]));
            view.setInt16(i*2,sample<0?sample*32768:sample*32767,true);
          }
          const frame=JSON.stringify({realtimeInput:{audio:{data:base64(output),mimeType:'audio/pcm;rate=16000'}}});
          for(const socket of this.sessions.values()) if(socket.readyState===WebSocket.OPEN) socket.send(frame);
        };
        this.capture={stream,source,processor};
        this.callbacks.onState?.('Đang nghe và dịch…');
      } catch(error) {this.cancel();throw error;}
    }
    stopCapture() {
      if (!this.capture) return;
      const {stream,source,processor}=this.capture;
      processor.onaudioprocess=null;
      processor.disconnect();source.disconnect();
      stream.getTracks().forEach(track=>track.stop());
      this.capture=null;
    }
    finishInput() {
      this.stopCapture();
      if (!this.turn) return Promise.reject(new Error('LIVE_NOT_RECORDING'));
      this.turn.released=true;
      for(const socket of this.sessions.values()) if(socket.readyState===WebSocket.OPEN)
        socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));
      this.callbacks.onState?.('Đang hoàn tất bản dịch…');
      const turn=this.turn;
      const result=new Promise((resolve,reject)=>{turn.resolve=resolve;turn.reject=reject;});
      turn.timer=setTimeout(()=>{
        if(this.turn!==turn)return;
        if (!turn.chosen) this.choose(turn);
        if (!turn.chosen) this.failTurn(new Error('LIVE_TRANSLATION_TIMEOUT'));
      },7000);
      this.choose(turn);
      return result;
    }
    receive(target,message) {
      const turn=this.turn;
      if (!turn || !message.serverContent) return;
      const content=message.serverContent;
      const data=turn.data[target];
      const input=content.inputTranscription;
      if(input?.text) {
        data.input+=input.text;
        const detected=language(input.languageCode) || (/[\u3400-\u9fff]/u.test(input.text)?'zh-Hans':'');
        if(detected)turn.source=detected;
      }
      const output=content.outputTranscription;
      if(output?.text)data.output+=output.text;
      for(const part of content.modelTurn?.parts || []) if(part.inlineData?.data) data.audio.push(audioBytes(part.inlineData.data));
      if(content.generationComplete || content.turnComplete)data.complete=true;
      if(turn.released)this.choose(turn);
    }
    choose(turn) {
      if(this.turn!==turn || !turn.released)return;
      const preferred=turn.source==='vi'?'zh-Hans':turn.source==='zh-Hans'?'vi':'';
      const candidate=preferred && turn.data[preferred].audio.length?preferred
        : targets.find(target=>turn.data[target].audio.length);
      if (!candidate)return;
      if (!turn.chosen)turn.chosen=candidate;
      if (!turn.playback)turn.playback=this.playTurn(turn);
    }
    async playTurn(turn) {
      const target=turn.chosen;
      this.callbacks.onState?.('Đang phát bản dịch…');
      try {
        let idle=0;
        while(this.turn===turn && idle<30) {
          const data=turn.data[target];
          const bytes=data.audio.shift();
          if(bytes){this.playPcm(bytes);idle=0;}
          else if(data.complete)break;
          else {await new Promise(resolve=>setTimeout(resolve,100));idle++;}
        }
        const remaining=Math.max(0,(this.playAt-this.audioContext.currentTime)*1000);
        if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
        if(this.turn!==turn)return;
        clearTimeout(turn.timer);
        const source=turn.source || (target==='vi'?'zh-Hans':'vi');
        const result={sourceLanguage:source,targetLanguage:target,
          sourceText:turn.data[target].input.trim(),translatedText:turn.data[target].output.trim()};
        this.turn=null;
        turn.resolve?.(result);
      } catch(error){this.failTurn(error);}
    }
    playPcm(bytes) {
      const count=Math.floor(bytes.byteLength/2);
      if (!count)return;
      const buffer=this.audioContext.createBuffer(1,count,24000);
      const samples=buffer.getChannelData(0),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      for(let i=0;i<count;i++)samples[i]=view.getInt16(i*2,true)/32768;
      const node=this.audioContext.createBufferSource();node.buffer=buffer;node.connect(this.audioContext.destination);
      this.playAt=Math.max(this.playAt,this.audioContext.currentTime+0.02);
      node.start(this.playAt);
      this.playAt+=buffer.duration;
      this.playing.push(node);
      node.onended=()=>{this.playing=this.playing.filter(item=>item!==node);node.disconnect();};
    }
    failTurn(error) {
      const turn=this.turn;
      if(!turn)return;
      clearTimeout(turn.timer);this.turn=null;
      turn.reject?.(error);
    }
    cancel() {
      ++this.generation;
      this.stopCapture();
      this.failTurn(new Error('LIVE_CANCELLED'));
      for(const node of this.playing)try{node.stop();}catch{}
      this.playing=[];this.playAt=0;
    }
    close() {
      this.closed=true;
      this.cancel();
      for(const socket of this.sessions.values())socket.close();
      this.sessions.clear();this.ready=false;
      this.audioContext?.close?.();this.audioContext=null;
    }
  }
  window.PipiLiveTranslate=LiveTranslate;
})();
