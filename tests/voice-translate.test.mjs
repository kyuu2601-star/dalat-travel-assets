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
    assert.equal(upstream.uses,1);
    assert.ok(!JSON.stringify(result).includes('server-only-secret'));
    const bad=await worker.fetch(new Request('https://pipi.test/voice-live-token',{
      method:'POST',headers:{Origin:'https://localhost'},body:JSON.stringify({targetLanguageCode:'en'})
    }),env);
    assert.equal(bad.status,400);
  } finally {globalThis.fetch=originalFetch;}
});

test('Interpreter streams speech while held and plays only after release', async () => {
  const source=await readFile(new URL('../voice-translate.js',import.meta.url),'utf8');
  const sockets=[];
  let packets=0,playbacks=0,stopped=0;
  class FakeSocket {
    static OPEN=1;
    constructor(url){this.url=url;this.readyState=1;sockets.push(this);setTimeout(()=>this.onopen?.(),0);}
    send(raw){
      const message=JSON.parse(raw);
      if(message.setup)setTimeout(()=>this.onmessage?.({data:JSON.stringify({setupComplete:{}})}),0);
      if(message.realtimeInput?.audio)packets++;
      if(message.realtimeInput?.audioStreamEnd && this.url.includes('access_token=vi')) {
        const pcm=Buffer.alloc(480);
        setTimeout(()=>this.onmessage?.({data:JSON.stringify({serverContent:{
          inputTranscription:{text:'你好',languageCode:'zh-Hans'},
          outputTranscription:{text:'Xin chào',languageCode:'vi'},
          modelTurn:{parts:[{inlineData:{data:pcm.toString('base64')}}]},generationComplete:true
        }})}),0);
      }
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
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}},
    fetch:async(_url,options)=>new Response(JSON.stringify({token:JSON.parse(options.body).targetLanguageCode})),
    WebSocket:FakeSocket,Response,Uint8Array,Float32Array,DataView,Buffer,
    atob,btoa,setTimeout,clearTimeout,console
  });
  vm.runInContext(source,context);
  const translator=new context.window.PipiLiveTranslate('https://pipi.test');
  await translator.prepare();
  await translator.start();
  processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  assert.equal(packets,2,'one audio frame reaches both language sessions');
  assert.equal(playbacks,0,'translated audio is held until the user releases the mic');
  const result=await translator.finishInput();
  assert.equal(result.sourceLanguage,'zh-Hans');
  assert.equal(result.targetLanguage,'vi');
  assert.equal(result.translatedText,'Xin chào');
  assert.equal(playbacks,1);
  assert.equal(stopped,1);
  translator.close();
});
