// Separate interpreter. The regular Pipi voice/chat path is untouched.
(() => {
  const MODEL = 'gemini-3.5-live-translate-preview';
  const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
  const targets = ['vi', 'zh-Hans'];
  const SILENCE_FRAME = new Uint8Array(3200); // 100 ms, mono PCM16 at 16 kHz
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
      this.preparing=null;
    }
    async prepare() {
      if (this.ready) return;
      if (this.preparing) return this.preparing;
      this.preparing=Promise.allSettled(targets.map(target=>this.connect(target))).then(results=>{
        if(this.closed)return;
        this.ready=this.sessions.size===targets.length;
        if(!this.ready){
          for(const socket of this.sessions.values()){socket.retired=true;socket.close();}
          this.sessions.clear();
          throw results.find(result=>result.status==='rejected')?.reason || new Error('LIVE_SETUP_UNAVAILABLE');
        }
        this.callbacks.onReady?.();
      }).finally(()=>{this.preparing=null;});
      return this.preparing;
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
        const timeout=setTimeout(()=>{if(!settled){settled=true;socket.close();reject(new Error('LIVE_SETUP_TIMEOUT'));}},5000);
        const fail=message=>{
          if (!settled) {settled=true;clearTimeout(timeout);reject(new Error(message));}
          else this.callbacks.onError?.(new Error(message));
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
          if(socket.retired || this.closed)return;
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
          if(this.closed || socket.retired)return;
          if(!this.sessions.size)this.ready=false;
          fail(`LIVE_SOCKET_CLOSED_${event.code}`);
        };
      });
    }
    async start({deviceId = ''} = {}) {
      if (!this.ready || this.turn) throw new Error('LIVE_NOT_READY');
      const epoch=++this.generation;
      this.turn={epoch,released:false,source:'',chosen:'',pcm:[],data:{vi:emptyTurn(),'zh-Hans':emptyTurn()},
        resolve:null,reject:null,timer:null,tailTimer:null,livePlayed:false,lastAudioAt:0,finalizing:false,fallbackAbort:null};
      const Context=window.AudioContext || window.webkitAudioContext;
      if (!Context || !navigator.mediaDevices?.getUserMedia) {this.turn=null;throw new Error('MICROPHONE_CAPTURE_UNAVAILABLE');}
      try {
        this.audioContext=this.audioContext || new Context();
        await this.audioContext.resume();
        const audio={echoCancellation:true,noiseSuppression:true,channelCount:1};
        if (deviceId && deviceId !== 'default') audio.deviceId={exact:deviceId};
        const stream=await navigator.mediaDevices.getUserMedia({audio});
        if (this.generation!==epoch || !this.turn || this.turn.released) {stream.getTracks().forEach(track=>track.stop());return;}
        // Live Translate uses continuous speech detection. Give it a short
        // silence prefix before the speaker's first captured frame.
        for(let i=0;i<3;i++)this.sendAudio(SILENCE_FRAME);
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
          if (this.turn.pcm.length < 1200) this.turn.pcm.push(output);
          this.sendAudio(output);
        };
        this.capture={stream,source,processor};
        this.callbacks.onState?.('Đang nghe và dịch…');
      } catch(error) {this.cancel();throw error;}
    }
    sendAudio(bytes) {
      const frame=JSON.stringify({realtimeInput:{audio:{data:base64(bytes),mimeType:'audio/pcm;rate=16000'}}});
      for(const socket of this.sessions.values()) if(socket.readyState===WebSocket.OPEN) socket.send(frame);
    }
    finishStream(turn, remaining=5) {
      if(this.turn!==turn)return;
      if(remaining>0) {
        this.sendAudio(SILENCE_FRAME);
        turn.tailTimer=setTimeout(()=>this.finishStream(turn,remaining-1),100);
        return;
      }
      // Let the final syllable reach the model before ending this push-to-talk turn.
      for(const socket of this.sessions.values())if(socket.readyState===WebSocket.OPEN)
        socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));
      turn.tailTimer=null;
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
      this.callbacks.onState?.('Pipi đang suy nghĩ…');
      const turn=this.turn;
      const result=new Promise((resolve,reject)=>{turn.resolve=resolve;turn.reject=reject;});
      this.finishStream(turn);
      this.choose(turn);
      this.completeLive(turn);
      // Live Translate is a continuous stream and can return only a fragment.
      // Run the complete audio translation in parallel, while the Live audio
      // chunks can already be heard as they arrive.
      this.fallbackTranslate(turn);
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
        const detected=language(input.languageCode) || (/[\u3400-\u9fff]/u.test(input.text)?'zh-Hans':/[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/iu.test(input.text)?'vi':'');
        if(detected)turn.source=detected;
      }
      const output=content.outputTranscription;
      if(output?.text)data.output+=output.text;
      for(const part of content.modelTurn?.parts || []) if(part.inlineData?.data) data.audio.push(audioBytes(part.inlineData.data));
      if(content.generationComplete || content.turnComplete)data.complete=true;
      this.choose(turn);
      this.completeLive(turn);
    }
    choose(turn) {
      if(this.turn!==turn || !turn.released)return;
      const preferred=turn.source==='vi'?'zh-Hans':turn.source==='zh-Hans'?'vi':'';
      const candidate=preferred && turn.data[preferred].audio.length ? preferred : '';
      if (!candidate)return;
      if (!turn.chosen)turn.chosen=candidate;
      if(turn.chosen!==candidate)return;
      if(!turn.livePlayed)this.callbacks.onState?.('Pipi đang trả lời…');
      for(const bytes of turn.data[candidate].audio.splice(0)){
        this.playPcm(bytes);
        turn.livePlayed=true;
        turn.lastAudioAt=Date.now();
      }
    }
    async completeLive(turn) {
      const data=turn.data[turn.chosen];
      if(this.turn!==turn || !turn.released || turn.finalizing || !turn.livePlayed || !data?.complete || !data.output.trim() || !data.input.trim())return;
      turn.finalizing=true;
      turn.fallbackAbort?.abort();
      const result={sourceLanguage:turn.source,targetLanguage:turn.chosen,
        sourceText:data.input.trim(),translatedText:data.output.trim(),fallback:false};
      let textEmitted=false;
      try{textEmitted=this.callbacks.onTranscript?.(result)===true;}
      catch(error){this.callbacks.onError?.(error);}
      const remaining=Math.max(0,(this.playAt-this.audioContext.currentTime)*1000);
      if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
      if(this.turn!==turn)return;
      clearTimeout(turn.timer);clearTimeout(turn.tailTimer);this.turn=null;
      turn.resolve?.({...result,textEmitted});
      this.refreshSessions();
    }
    async fallbackTranslate(turn) {
      if(this.turn!==turn || turn.fallbackPending)return;
      turn.fallbackPending=true;
      try {
        const size=turn.pcm.reduce((sum,frame)=>sum+frame.length,0);
        if(size<3200)throw new Error('VOICE_TOO_SHORT');
        const wav=new Uint8Array(size+44),header=new DataView(wav.buffer);
        wav.set([82,73,70,70],0);header.setUint32(4,size+36,true);
        wav.set([87,65,86,69,102,109,116,32],8);header.setUint32(16,16,true);
        header.setUint16(20,1,true);header.setUint16(22,1,true);header.setUint32(24,16000,true);
        header.setUint32(28,32000,true);header.setUint16(32,2,true);header.setUint16(34,16,true);
        wav.set([100,97,116,97],36);header.setUint32(40,size,true);
        let offset=44;for(const frame of turn.pcm){wav.set(frame,offset);offset+=frame.length;}
        turn.fallbackAbort=new AbortController();
        const response=await fetch(`${this.workerUrl}/voice-translate-fallback`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({audio:base64(wav)}),signal:turn.fallbackAbort.signal
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok || !result.translatedText)throw new Error(result.error||'LIVE_TRANSLATION_TIMEOUT');
        if(this.turn!==turn || turn.finalizing)return;
        let textEmitted=false;
        if(this.callbacks.onTranscript){
          try{textEmitted=this.callbacks.onTranscript(result)===true;}
          catch(error){this.callbacks.onError?.(error);}
        }
        if(!turn.livePlayed){
          const deadline=Date.now()+900;
          while(this.turn===turn && !turn.livePlayed && Date.now()<deadline)
            await new Promise(resolve=>setTimeout(resolve,50));
        }
        if(turn.livePlayed){
          const deadline=Date.now()+3000;
          while(this.turn===turn && Date.now()<deadline && Date.now()-turn.lastAudioAt<550)
            await new Promise(resolve=>setTimeout(resolve,100));
          const remaining=Math.max(0,(this.playAt-this.audioContext.currentTime)*1000);
          if(remaining)await new Promise(resolve=>setTimeout(resolve,remaining));
        }
        if(this.turn!==turn || turn.finalizing)return;
        clearTimeout(turn.timer);clearTimeout(turn.tailTimer);this.turn=null;
        turn.resolve?.({...result,fallback:!turn.livePlayed,textEmitted});
        this.refreshSessions();
      }catch(error){if(this.turn===turn && !turn.finalizing)this.failTurn(error);}
    }
    refreshSessions() {
      this.ready=false;
      for(const socket of this.sessions.values()){socket.retired=true;socket.close();}
      this.sessions.clear();
      if(!this.closed)this.prepare().catch(error=>this.callbacks.onError?.(error));
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
      turn.fallbackAbort?.abort();
      clearTimeout(turn.timer);this.turn=null;
      clearTimeout(turn.tailTimer);
      turn.reject?.(error);
      this.refreshSessions();
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
  class ContinuousTranslate extends LiveTranslate {
    constructor(workerUrl,callbacks={}) {
      super(workerUrl,callbacks);
      this.listening=false;
      this.stopping=false;
      this.source='';
      this.lastResponseAt=0;
      this.lastCompleteAt=new Map(targets.map(target=>[target,0]));
      this.segments=new Map(targets.map(target=>[target,{source:'',output:'',detected:'',startedAt:0,timer:null}]));
      this.capturePcm=[];this.captureBytes=0;this.queuedAudio=[];
      this.liveSegments=[];this.sequence=0;this.currentSequence=0;
      this.textTasks=new Set();this.textControllers=new Set();
      this.voiceTurns=new Map();
    }
    async startContinuous({deviceId=''}={}) {
      if(!this.ready || this.sessions.size!==targets.length || this.listening || this.stopping)throw new Error('LIVE_NOT_READY');
      const epoch=++this.generation;
      const Context=window.AudioContext || window.webkitAudioContext;
      if(!Context || !navigator.mediaDevices?.getUserMedia)throw new Error('MICROPHONE_CAPTURE_UNAVAILABLE');
      this.audioContext=this.audioContext || new Context();
      await this.audioContext.resume();
      const audio={echoCancellation:true,noiseSuppression:true,channelCount:1};
      if(deviceId && deviceId!=='default')audio.deviceId={exact:deviceId};
      const stream=await navigator.mediaDevices.getUserMedia({audio});
      if(this.closed || epoch!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
      try{
        const source=this.audioContext.createMediaStreamSource(stream);
        const processor=this.audioContext.createScriptProcessor(4096,1,1);
        source.connect(processor);processor.connect(this.audioContext.destination);
        this.capture={stream,source,processor};
        this.source='';this.listening=true;this.stopping=false;this.lastResponseAt=Date.now();
        this.capturePcm=[];this.captureBytes=0;this.queuedAudio=[];
        this.liveSegments=[];this.currentSequence=++this.sequence;
        this.voiceTurns.set(this.currentSequence,{played:false,finished:false,result:null,fallbackSent:false});
        for(let i=0;i<3;i++)this.sendAudio(SILENCE_FRAME);
        processor.onaudioprocess=event=>{
          if(!this.listening || this.closed || epoch!==this.generation)return;
          const samples=event.inputBuffer.getChannelData(0);
          const ratio=this.audioContext.sampleRate/16000;
          const output=new Uint8Array(Math.floor(samples.length/ratio)*2);
          const view=new DataView(output.buffer);
          for(let i=0;i<output.length/2;i++){
            const sample=Math.max(-1,Math.min(1,samples[Math.floor(i*ratio)]));
            view.setInt16(i*2,sample<0?sample*32768:sample*32767,true);
          }
          if(this.captureBytes+output.length<=900_000){this.capturePcm.push(output);this.captureBytes+=output.length;}
          this.sendAudio(output);
        };
        this.callbacks.onState?.('Pipi đang phiên dịch…');
      }catch(error){stream.getTracks().forEach(track=>track.stop());throw error;}
    }
    receive(target,message) {
      if(!this.listening && !this.stopping)return;
      const content=message.serverContent;
      if(!content)return;
      this.lastResponseAt=Date.now();
      if(content.generationComplete || content.turnComplete)this.lastCompleteAt.set(target,this.lastResponseAt);
      const segment=this.segments.get(target);
      const input=content.inputTranscription;
      const interim=content.interimInputTranscription;
      const heard=input || interim;
      const detected=language(heard?.languageCode) || (/[㐀-鿿]/u.test(heard?.text||'')?'zh-Hans':/[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/iu.test(heard?.text||'')?'vi':'');
      if(detected && detected!==this.source){
        this.flushSegments();
        this.source=detected;
      }
      if(detected)segment.detected=detected;
      if((input?.text || content.outputTranscription?.text) && !segment.startedAt)segment.startedAt=Date.now();
      if(input?.text)segment.source+=input.text;
      if(content.outputTranscription?.text)segment.output+=content.outputTranscription.text;
      for(const part of content.modelTurn?.parts||[]){
        if(!part.inlineData?.data)continue;
        const bytes=audioBytes(part.inlineData.data);
        if(!bytes.length)continue;
        // Hold-to-talk keeps the mic clear of its own translated speaker audio.
        if(this.listening)this.queuedAudio.push({target,bytes});
        else if(this.source && target!==this.source){this.playPcm(bytes);const turn=this.voiceTurns.get(this.currentSequence);if(turn)turn.played=true;this.callbacks.onSpeech?.();}
      }
      if(segment.source || segment.output)this.scheduleSegment(target,content.generationComplete||content.turnComplete?250:1100);
    }
    scheduleSegment(target,delay) {
      const segment=this.segments.get(target);
      clearTimeout(segment.timer);
      segment.timer=setTimeout(()=>this.flushSegment(target),delay);
    }
    flushSegment(target) {
      const segment=this.segments.get(target);
      if(!segment)return;
      clearTimeout(segment.timer);segment.timer=null;
      const source=segment.source.trim(),output=segment.output.trim();
      if(source && output && segment.detected && target!==segment.detected){
        this.liveSegments.push({sourceLanguage:segment.detected,targetLanguage:target,sourceText:source,translatedText:output});
        segment.source='';segment.output='';segment.detected='';segment.startedAt=0;
      }else if(this.stopping || (segment.detected===target && !output) || Date.now()-segment.startedAt>4000){
        segment.source='';segment.output='';segment.detected='';segment.startedAt=0;
      }else if(source || output)this.scheduleSegment(target,700);
    }
    flushSegments(){for(const target of targets){
      const segment=this.segments.get(target);
      if(segment.source && segment.output)this.flushSegment(target);
    }}
    async requestCompleteText(frames,size,controller){
      if(size<3200)throw new Error('VOICE_TOO_SHORT');
      const wav=new Uint8Array(size+44),header=new DataView(wav.buffer);
      wav.set([82,73,70,70],0);header.setUint32(4,size+36,true);
      wav.set([87,65,86,69,102,109,116,32],8);header.setUint32(16,16,true);
      header.setUint16(20,1,true);header.setUint16(22,1,true);header.setUint32(24,16000,true);
      header.setUint32(28,32000,true);header.setUint16(32,2,true);header.setUint16(34,16,true);
      wav.set([100,97,116,97],36);header.setUint32(40,size,true);
      let offset=44;for(const frame of frames){wav.set(frame,offset);offset+=frame.length;}
      const response=await fetch(`${this.workerUrl}/voice-translate-fallback`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({audio:base64(wav)}),signal:controller.signal
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok || !result.sourceText || !result.translatedText)throw new Error(result.error||'TEXT_TRANSLATION_UNAVAILABLE');
      return result;
    }
    offerVoiceFallback(sequence) {
      const turn=this.voiceTurns.get(sequence);
      if(turn?.finished && !turn.played && turn.result && !turn.fallbackSent){
        turn.fallbackSent=true;
        this.callbacks.onVoiceFallback?.(turn.result);
      }
    }
    async stopContinuous() {
      if(this.stopping)return;
      if(!this.listening)return;
      this.listening=false;this.stopping=true;this.stopCapture();
      for(const {target,bytes} of this.queuedAudio){
        if(this.source && target!==this.source){this.playPcm(bytes);const turn=this.voiceTurns.get(this.currentSequence);if(turn)turn.played=true;this.callbacks.onSpeech?.();}
      }
      this.queuedAudio=[];
      const sequence=this.currentSequence,frames=this.capturePcm,size=this.captureBytes,liveSegments=this.liveSegments;
      let finishVoice;
      const voiceDone=new Promise(resolve=>{finishVoice=resolve;});
      const controller=new AbortController();
      this.textControllers.add(controller);
      this.callbacks.onTextPending?.({sequence});
      const textTimeout=setTimeout(()=>controller.abort(),25_000);
      const textTask=this.requestCompleteText(frames,size,controller).then(result=>{
        const turn=this.voiceTurns.get(sequence);if(turn){turn.result=result;this.offerVoiceFallback(sequence);}
        if(!this.closed)this.callbacks.onSegment?.({...result,sequence});
      }).catch(async error=>{
        await voiceDone;
        if(this.closed)return;
        if(liveSegments.length)liveSegments.forEach((result,index)=>this.callbacks.onSegment?.({...result,sequence:index?`${sequence}.${index}`:sequence}));
        else this.callbacks.onNoSpeech?.({sequence});
        if(error?.message!=='VOICE_TOO_SHORT')this.callbacks.onError?.(error);
      }).finally(()=>{
        clearTimeout(textTimeout);this.textControllers.delete(controller);this.textTasks.delete(textTask);
        this.callbacks.onTextDone?.({sequence});
        const turn=this.voiceTurns.get(sequence);if(turn){turn.textDone=true;if(turn.finished)this.voiceTurns.delete(sequence);}
      });
      this.textTasks.add(textTask);
      const stopAt=Date.now();
      const lastTarget=this.source==='vi'?'zh-Hans':this.source==='zh-Hans'?'vi':'';
      this.callbacks.onState?.('Pipi đang hoàn tất bản dịch cuối…');
      for(let i=0;i<5 && !this.closed;i++){
        this.sendAudio(SILENCE_FRAME);
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      for(const socket of this.sessions.values())if(socket.readyState===WebSocket.OPEN)
        socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));
      const deadline=Date.now()+12000;
      while(!this.closed && Date.now()<deadline){
        const voiceRemaining=Math.max(0,(this.playAt-this.audioContext.currentTime)*1000);
        const quietFor=Date.now()-this.lastResponseAt;
        const completed=lastTarget && this.lastCompleteAt.get(lastTarget)>=stopAt-600;
        if(voiceRemaining<100 && quietFor>=1200 && (completed || Date.now()-stopAt>=3500))break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      this.flushSegments();
      for(const target of targets){
        const segment=this.segments.get(target);
        clearTimeout(segment.timer);segment.timer=null;segment.source='';segment.output='';segment.detected='';segment.startedAt=0;
      }
      this.source='';this.stopping=false;
      const turn=this.voiceTurns.get(sequence);if(turn)turn.finished=true;
      this.offerVoiceFallback(sequence);
      if(turn?.textDone)this.voiceTurns.delete(sequence);
      if(!this.closed)this.refreshSessions();
      finishVoice();
    }
    close() {
      this.listening=false;this.stopping=false;
      for(const controller of this.textControllers)controller.abort();
      for(const segment of this.segments.values())clearTimeout(segment.timer);
      super.close();
    }
  }
  window.PipiLiveTranslate=LiveTranslate;
  window.PipiContinuousTranslate=ContinuousTranslate;
})();
