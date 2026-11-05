import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../worker/src/index.js';

test('Live translation token stays restricted to its model and target language', async () => {
  const originalFetch=globalThis.fetch;
  let upstream;
  globalThis.fetch=async (_url, options) => {
    upstream=JSON.parse(options.body);
    assert.equal(options.headers['x-goog-api-key'],'server-only-secret');
    return new Response(JSON.stringify({name:'short-lived-token'}),{status:200});
  };
  try {
    const request=new Request('https://pipi.test/voice-live-token',{
      method:'POST',headers:{Origin:'https://localhost','Content-Type':'application/json'},
      body:JSON.stringify({targetLanguageCode:'zh-Hans'})
    });
    const env={GEMINI_API_KEY:'server-only-secret',ALLOWED_ORIGINS:'https://localhost'};
    const response=await worker.fetch(request,env);
    const result=await response.json();
    assert.equal(response.status,200);
    assert.equal(result.token,'short-lived-token');
    assert.equal(upstream.bidiGenerateContentSetup.model,'models/gemini-3.5-live-translate-preview');
    assert.equal(upstream.bidiGenerateContentSetup.generationConfig.translationConfig.targetLanguageCode,'zh-Hans');
    assert.equal(upstream.bidiGenerateContentSetup.generationConfig.translationConfig.echoTargetLanguage,false);
    assert.deepEqual(upstream.bidiGenerateContentSetup.inputAudioTranscription,{});
    assert.equal(upstream.uses,1);
    assert.ok(!JSON.stringify(result).includes('server-only-secret'));
    const bad=await worker.fetch(new Request('https://pipi.test/voice-live-token',{
      method:'POST',headers:{Origin:'https://localhost'},body:JSON.stringify({targetLanguageCode:'en'})
    }),env);
    assert.equal(bad.status,400);
  } finally {globalThis.fetch=originalFetch;}
});

test('Fallback detects Vietnamese speech and asks Gemini for Chinese translation', async () => {
  const originalFetch=globalThis.fetch;
  let upstream;
  globalThis.fetch=async (_url,options)=>{
    upstream=JSON.parse(options.body);
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({sourceLanguage:'vi',sourceText:'Xin chào',targetLanguage:'zh-Hans',translatedText:'你好'})}]}}]}),{status:200});
  };
  try {
    const request=new Request('https://pipi.test/voice-translate-fallback',{
      method:'POST',headers:{Origin:'https://localhost','Content-Type':'application/json'},
      body:JSON.stringify({audio:Buffer.alloc(5000).toString('base64')})
    });
    const response=await worker.fetch(request,{GEMINI_API_KEY:'server-only-secret',ALLOWED_ORIGINS:'https://localhost'});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{sourceLanguage:'vi',targetLanguage:'zh-Hans',sourceText:'Xin chào',translatedText:'你好'});
    assert.equal(upstream.contents[0].parts[1].inlineData.mimeType,'audio/wav');
  }finally{globalThis.fetch=originalFetch;}
});

test('Fallback retries another Gemini model when the first is unavailable', async () => {
  const originalFetch=globalThis.fetch;
  const models=[];
  globalThis.fetch=async url=>{
    models.push(String(url));
    if(models.length===1)return new Response('{}',{status:503});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({sourceLanguage:'zh-Hans',sourceText:'你好',translatedText:'Xin chào'})}]}}]}),{status:200});
  };
  try {
    const response=await worker.fetch(new Request('https://pipi.test/voice-translate-fallback',{
      method:'POST',headers:{Origin:'https://localhost','Content-Type':'application/json'},
      body:JSON.stringify({audio:Buffer.alloc(5000).toString('base64')})
    }),{GEMINI_API_KEY:'server-only-secret',ALLOWED_ORIGINS:'https://localhost'});
    assert.equal(response.status,200);
    assert.equal((await response.json()).translatedText,'Xin chào');
    assert.match(models[0],/gemini-3\.5-flash-lite/);
    assert.match(models[1],/gemini-3\.8-flash/);
  }finally{globalThis.fetch=originalFetch;}
});

test('Voice translation uses Workers AI when Gemini is blocked by location', async () => {
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async ()=>new Response(JSON.stringify({error:{message:'User location is not supported for the API use.'}}),{status:400});
  try {
    const response=await worker.fetch(new Request('https://pipi.test/voice-translate-fallback',{
      method:'POST',headers:{Origin:'https://localhost','Content-Type':'application/json'},
      body:JSON.stringify({audio:Buffer.alloc(5000).toString('base64')})
    }),{
      GEMINI_API_KEY:'server-only-secret',ALLOWED_ORIGINS:'https://localhost',
      AI:{async run(model,payload){calls.push({model,payload});return model.includes('whisper')?{text:'你好'}:{translated_text:'Xin chào'};}}
    });
    assert.equal(response.status,200);
    assert.equal((await response.json()).translatedText,'Xin chào');
    assert.equal(calls.length,2);
    assert.equal(calls[0].payload.task,'transcribe');
    assert.equal(calls[1].payload.source_lang,'zh');
    assert.equal(calls[1].payload.target_lang,'vi');
  }finally{globalThis.fetch=originalFetch;}
});

test('Chinese speech fallback returns playable audio without exposing AI details', async () => {
  const response=await worker.fetch(new Request('https://pipi.test/voice-translate-speech',{
    method:'POST',headers:{Origin:'https://localhost','Content-Type':'application/json'},
    body:JSON.stringify({text:'你好',language:'zh-Hans'})
  }),{ALLOWED_ORIGINS:'https://localhost',AI:{run:async()=>({audio:Buffer.from('RIFFtest').toString('base64')})}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'audio/wav');
  assert.equal(await response.text(),'RIFFtest');
});

test('Interpreter speaks after release and renews Live sessions for the next turn', async () => {
  const source=await readFile(new URL('../voice-translate.js',import.meta.url),'utf8');
  const sockets=[];
  let packets=0,playbacks=0,stopped=0,captureOptions,earlyText='';
  const states=[];
  class FakeSocket {
    static OPEN=1;
    constructor(url){this.url=url;this.readyState=1;sockets.push(this);setTimeout(()=>this.onopen?.(),0);}
    send(raw){
      const message=JSON.parse(raw);
      if(message.setup){
        assert.deepEqual(message.setup.inputAudioTranscription,{});
        assert.deepEqual(message.setup.outputAudioTranscription,{});
        setTimeout(()=>this.onmessage?.({data:new Blob([JSON.stringify({setupComplete:{}})])}),0);
      }
      if(message.realtimeInput?.audio)packets++;
    }
    close(){this.readyState=3;}
  }
  const processor={connect(){},disconnect(){},onaudioprocess:null};
  class FakeAudioContext {
    sampleRate=48000;currentTime=0;destination={};
    resume(){return Promise.resolve();}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createScriptProcessor(){return processor;}
    createBuffer(_channels,length,rate){return {duration:length/rate,getChannelData(){return new Float32Array(length);}};}
    createBufferSource(){return {connect(){},start(){playbacks++;},stop(){},disconnect(){}};}
    close(){return Promise.resolve();}
  }
  const context=vm.createContext({
    window:{AudioContext:FakeAudioContext},
    navigator:{mediaDevices:{getUserMedia:async options=>{captureOptions=options;return {getTracks:()=>[{stop(){stopped++;}}]};}}},
    fetch:async(url,options)=>{
      if(url.endsWith('/voice-live-token'))return new Response(JSON.stringify({token:JSON.parse(options.body).targetLanguageCode}));
      await new Promise(resolve=>setTimeout(resolve,1100));
      return new Response(JSON.stringify({sourceLanguage:'zh-Hans',targetLanguage:'vi',sourceText:'你好',translatedText:'Xin chào'}));
    },
    WebSocket:FakeSocket,Response,Uint8Array,Float32Array,DataView,Buffer,AbortController,
    atob,btoa,Blob,TextDecoder,ArrayBuffer,setTimeout,clearTimeout,console
  });
  vm.runInContext(source,context);
  const translator=new context.window.PipiLiveTranslate('https://pipi.test',{
    onTranscript:result=>{earlyText=result.translatedText;return true;},
    onState:state=>states.push(state)
  });
  await translator.prepare();
  await translator.start({deviceId:'headset-mic'});
  assert.equal(captureOptions.audio.deviceId.exact,'headset-mic');
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  assert.equal(packets,10,'silence prefix and recorded audio reach both language sessions');
  sockets.find(socket=>socket.url.includes('access_token=vi')).onmessage({data:JSON.stringify({serverContent:{
    inputTranscription:{text:'你好',languageCode:'zh-Hans'},
    outputTranscription:{text:'Xin chào',languageCode:'vi'},
    modelTurn:{parts:[{inlineData:{data:Buffer.alloc(480).toString('base64')}}]}
  }})});
  assert.equal(playbacks,0,'voice waits until the user releases the mic');
  const first=translator.finishInput();
  assert.equal(states.at(-2),'Pipi đang suy nghĩ…');
  assert.equal(states.at(-1),'Pipi đang trả lời…');
  assert.equal(playbacks,1,'Live speech starts on release');
  const result=await first;
  assert.equal(result.sourceLanguage,'zh-Hans');
  assert.equal(result.targetLanguage,'vi');
  assert.equal(result.translatedText,'Xin chào');
  assert.equal(result.fallback,false,'backend supplies complete text without repeating Live audio');
  assert.equal(earlyText,'Xin chào');
  assert.equal(result.textEmitted,true,'complete text is sent to the UI before Live playback finishes');
  assert.equal(playbacks,1);
  assert.equal(stopped,1);
  for(let i=0;i<30 && !translator.ready;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(translator.ready,true,'the next turn has a fresh Live session');
  assert.equal(sockets.length,4,'both language sessions were renewed');
  await translator.start();
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  sockets.findLast(socket=>socket.url.includes('access_token=vi')).onmessage({data:JSON.stringify({serverContent:{
    inputTranscription:{text:'你好',languageCode:'zh-Hans'},
    outputTranscription:{text:'Xin chào',languageCode:'vi'},
    modelTurn:{parts:[{inlineData:{data:Buffer.alloc(480).toString('base64')}}]}
  }})});
  assert.equal(playbacks,1);
  const second=translator.finishInput();
  assert.equal(playbacks,2,'the second turn also has Live voice');
  assert.equal((await second).fallback,false);
  for(let i=0;i<30 && !translator.ready;i++)await new Promise(resolve=>setTimeout(resolve,10));
  await translator.start();
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  const third=translator.finishInput();
  const current=sockets.findLast(socket=>socket.url.includes('access_token=vi'));
  current.onmessage({data:JSON.stringify({serverContent:{
    inputTranscription:{text:'你好',languageCode:'zh-Hans'},
    outputTranscription:{text:'Xin chào',languageCode:'vi'},
    modelTurn:{parts:[{inlineData:{data:Buffer.alloc(480).toString('base64')}}]}
  }})});
  current.onmessage({data:JSON.stringify({serverContent:{generationComplete:true}})});
  const start=Date.now();
  assert.equal((await third).translatedText,'Xin chào');
  assert.ok(Date.now()-start<500,'completed Live transcript bypasses the slower backend text request');
  translator.close();
});

test('Interpreter returns backend translation when Live produces no audio', async () => {
  const source=await readFile(new URL('../voice-translate.js',import.meta.url),'utf8');
  let fallbackCalls=0;
  class SilentSocket {
    static OPEN=1;
    readyState=1;
    constructor(){setTimeout(()=>this.onopen?.(),0);}
    send(raw){if(JSON.parse(raw).setup)setTimeout(()=>this.onmessage?.({data:JSON.stringify({setupComplete:{}})}),0);}
    close(){this.readyState=3;}
  }
  const processor={connect(){},disconnect(){},onaudioprocess:null};
  class FakeAudioContext {
    sampleRate=16000;currentTime=0;destination={};
    resume(){return Promise.resolve();}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createScriptProcessor(){return processor;}
    close(){return Promise.resolve();}
  }
  const context=vm.createContext({
    window:{AudioContext:FakeAudioContext},
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},
    fetch:async(url,options)=>{
      if(url.endsWith('/voice-live-token'))return new Response(JSON.stringify({token:JSON.parse(options.body).targetLanguageCode}));
      fallbackCalls++;
      assert.ok(JSON.parse(options.body).audio.startsWith('UklGR'));
      return new Response(JSON.stringify({sourceLanguage:'vi',targetLanguage:'zh-Hans',sourceText:'Xin chào',translatedText:'你好'}));
    },
    WebSocket:SilentSocket,Response,Uint8Array,Float32Array,DataView,Buffer,AbortController,
    atob,btoa,Blob,TextDecoder,ArrayBuffer,setTimeout,clearTimeout,console
  });
  vm.runInContext(source,context);
  const translator=new context.window.PipiLiveTranslate('https://pipi.test');
  await translator.prepare();await translator.start();
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  const result=await translator.finishInput();
  assert.equal(result.fallback,true);
  assert.equal(result.targetLanguage,'zh-Hans');
  assert.equal(result.translatedText,'你好');
  assert.equal(fallbackCalls,1);
  translator.close();
});

test('Held interpreter plays one direction after release while text completes separately', async () => {
  const source=await readFile(new URL('../voice-translate.js',import.meta.url),'utf8');
  const sockets=[],segments=[],pending=[],done=[];
  let plays=0,stops=0,streamEnds=0,finishText;
  class Socket {
    static OPEN=1;
    constructor(url){this.url=url;this.readyState=1;sockets.push(this);setTimeout(()=>this.onopen?.(),0);}
    send(raw){
      const message=JSON.parse(raw);
      if(message.setup)setTimeout(()=>this.onmessage?.({data:JSON.stringify({setupComplete:{}})}),0);
      if(message.realtimeInput?.audioStreamEnd)streamEnds++;
    }
    close(){this.readyState=3;}
  }
  const processor={connect(){},disconnect(){},onaudioprocess:null};
  class AudioContext {
    sampleRate=16000;destination={};started=Date.now();
    get currentTime(){return (Date.now()-this.started)/1000;}
    resume(){return Promise.resolve();}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createScriptProcessor(){return processor;}
    createBuffer(_channels,length,rate){return {duration:length/rate,getChannelData(){return new Float32Array(length);}};}
    createBufferSource(){return {connect(){},start(){plays++;},stop(){},disconnect(){}};}
    close(){return Promise.resolve();}
  }
  const textGate=new Promise(resolve=>{finishText=resolve;});
  const context=vm.createContext({
    window:{AudioContext},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stops++;}}]})}},
    fetch:async(url,options)=>{
      if(url.endsWith('/voice-live-token'))return new Response(JSON.stringify({token:JSON.parse(options.body).targetLanguageCode}));
      await textGate;
      return new Response(JSON.stringify({sourceLanguage:'vi',targetLanguage:'zh-Hans',sourceText:'Xin chào',translatedText:'你好'}));
    },
    WebSocket:Socket,Response,Uint8Array,Float32Array,DataView,Buffer,AbortController,
    atob,btoa,Blob,TextDecoder,ArrayBuffer,setTimeout,clearTimeout,console
  });
  vm.runInContext(source,context);
  const translator=new context.window.PipiContinuousTranslate('https://pipi.test',{
    onSegment:segment=>segments.push(segment),onTextPending:item=>pending.push(item),onTextDone:item=>done.push(item)
  });
  await translator.prepare();await translator.startContinuous();
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  const emit=(target,spoken,translated,sourceLanguage)=>{
    sockets.find(item=>item.url.includes(`access_token=${target}`)).onmessage({data:JSON.stringify({serverContent:{
      inputTranscription:{text:spoken,languageCode:sourceLanguage},
      outputTranscription:{text:translated},
      modelTurn:{parts:[{inlineData:{data:Buffer.alloc(480).toString('base64')}}]},
      generationComplete:true
    }})});
  };
  emit('vi','Xin chào','Xin chào','vi');
  emit('zh-Hans','Xin chào','你好','vi');
  assert.equal(plays,0,'speaker does not play while microphone is held');
  const stopping=translator.stopContinuous();
  assert.equal(plays,1,'only the Chinese target speaks on release');
  await stopping;
  assert.equal(stops,1);
  assert.equal(streamEnds,2);
  assert.equal(pending.length,1);
  assert.equal(done.length,0,'text request can remain pending after voice is finished');
  for(let i=0;i<30&&!translator.ready;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(translator.ready,true,'a fresh phrase can start without waiting for text');
  finishText();
  await Promise.all([...translator.textTasks]);
  assert.equal(segments.length,1);
  assert.equal(segments[0].translatedText,'你好');
  assert.equal(done.length,1);
  translator.close();
});
