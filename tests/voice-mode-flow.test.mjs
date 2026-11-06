import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Android startup keeps loading visible until the local voice is ready', async () => {
  const app = await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source = app.slice(app.indexOf('async function initTravelOS()'),app.indexOf("window.addEventListener('travelos:data-source'"));
  let finishVoice, finished = null, status = '';
  const voiceGate = new Promise(resolve => {finishVoice=resolve;});
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id,{hidden:true,style:{},classList:{toggle(){},remove(){}},setAttribute(name,value){this[name]=value;},addEventListener(){}});
    return nodes.get(id);
  };
  const context = vm.createContext({
    window:{TRAVELOS_NATIVE:true,PipiLocalVoice:{prepare:async report=>{report({phase:'download',loaded:50,total:100});await voiceGate;}}},
    document:{getElementById:node},localStorage:{getItem:()=>null},CONFIG:{D1_ENABLED:false},
    bootStarted:false,fullData:[],pendingDetectedLocation:null,detectedLocation:null,
    setLoadingStatus:text=>{status=text;},withBootTimeout:promise=>promise,finishBoot:failures=>{finished=failures;},
    TravelData:{loadPlaces:async()=>[]},initBot:async()=>({ok:true}),
    renderChips(){},renderLocationFilters(){},applyFilters(){},checkRadarStatus(){},submitAddPlace(){}
  });
  vm.runInContext(`${source}\nthis.start=initTravelOS;`,context);
  const startup = context.start();
  await new Promise(resolve => setTimeout(resolve,0));
  assert.equal(finished,null,'App stays on loading screen while the voice pack downloads');
  assert.equal(node('loading-voice-track').hidden,false);
  assert.equal(node('loading-voice-bar').style.width,'50%');
  assert.match(status,/50%/);
  finishVoice();
  await startup;
  assert.equal(finished.length,0);
  assert.equal(node('loading-voice-track').hidden,true);
});

test('Native voice asks for mic permission and keeps typing dots until local speech begins', async () => {
  const elements = new Map();
  class Element {
    constructor(id = '') {
      this.id = id;
      this.children = [];
      this.listeners = {};
      this.dataset = {};
      this.classList = {add() {}, remove() {}};
      this.textContent = '';
      this.hidden = false;
      this.scrollHeight = 0;
    }
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element(match[1]));
    }
    appendChild(child) { this.children.push(child); child.parent = this; return child; }
    append(...children) { for(const child of children)this.appendChild(child); }
    replaceChildren(...children) { this.children=[];for(const child of children)this.appendChild(child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    focus() {}
    setPointerCapture() {}
  }
  elements.set('mic-btn', new Element('mic-btn'));
  const document = {
    body: new Element('body'),
    getElementById: id => elements.get(id) || null,
    createElement: () => new Element(),
    createTextNode: text => ({textContent:text})
  };
  let recognition, recognizedText = 'Pipi ơi';
  class Recognition {
    start() {
      recognition = this;
      this.onresult?.({results:[Object.assign([{transcript:recognizedText,confidence:0.9}],{isFinal:true})]});
    }
    stop() { this.onend?.(); }
    abort() {}
  }
  let releaseAudio;
  const audioGate = new Promise(resolve => { releaseAudio = resolve; });
  const voiceEvents = [
    {type:'phase',phase:'planning'},
    {type:'spoken',text:'Pipi chào bạn.'},
    {type:'detail',text:'Đây là câu trả lời chi tiết.',travelos:{version:3,nearby:{provider:'google_places',pois:[{id:'shop',name:'Cửa hàng gần đây',lat:10.77,lng:106.69}]}}},
    {type:'done'}
  ].map(event => JSON.stringify(event)).join('\n') + '\n';
  const refreshEvents = [
    {type:'location_refresh_required',error:{code:'GPS_STALE_OR_INACCURATE',maxAccuracyMeters:200}},
    {type:'done'}
  ].map(event=>JSON.stringify(event)).join('\n')+'\n';
  let networkCalls = 0, synthesisCalls = 0, nativeSpeakCalls = 0, failSynthesis = false, gpsRefreshCalls = 0;
  const playedUrls = [];
  const fetch = async url => {
    networkCalls++;
    if (String(url).endsWith('/voice-v1')) return new Response(networkCalls===1?refreshEvents:voiceEvents,{headers:{'Content-Type':'application/x-ndjson'}});
    throw new Error(`Unexpected network request: ${url}`);
  };
  class FakeAudio {
    constructor(url) { playedUrls.push(String(url)); }
    play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
    pause() {}
  }
  let finishPreparation;
  const preparation = new Promise(resolve => { finishPreparation = resolve; });
  let permission = 'denied', permissionRequests = 0, recognitionStarts = 0, nativeListener = null;
  let openedMap = null;
  const window = {
    SpeechRecognition:Recognition,
    TRAVELOS_NATIVE:true,
    TravelLocation:{requestFreshPosition:async()=>{gpsRefreshCalls++;return {lat:10.77,lon:106.69,accuracy:20,timestamp:Date.now()};}},
    Capacitor:{Plugins:{PipiVoice:{
      requestMicrophonePermission:async()=>{permissionRequests++;return {microphone:permission};},
      addListener:async(_event,listener)=>{nativeListener=listener;return {remove(){nativeListener=null;}};},
      startRecognition:async()=>{recognitionStarts++;},
      stopRecognition:async()=>{nativeListener?.({type:'final',transcript:recognizedText,confidence:0.9});},
      cancelRecognition:async()=>{},
      speak:async()=>{nativeSpeakCalls++;},
      stop:async()=>{}
    }}},
    TravelNearby:{openFull:payload=>{openedMap=payload;}},
    PipiLocalVoice:{
      prepare:async()=>{await preparation;return {ready:true};},
      synthesize:async()=>{synthesisCalls++;if(failSynthesis)throw new Error('LOCAL_VOICE_FAILED');await audioGate;return {wav:new Uint8Array([82,73,70,70]).buffer};}
    }
  };
  const context = vm.createContext({window,document,fetch,Audio:FakeAudio,Blob,Response,ReadableStream,TextEncoder,TextDecoder,AbortController,atob,URL,setTimeout,clearTimeout,CONFIG:{WORKER_URL:'https://pipi.test'},compactNearbySnapshot:value=>value,console,queueMicrotask});
  vm.runInContext(await readFile(new URL('../voice-mode.js',import.meta.url),'utf8'),context);
  window.PipiVoiceMode.open();
  const mic=elements.get('pvm-mic');
  assert.equal(mic.disabled,true);
  mic.listeners.pointerdown({pointerId:1,preventDefault() {}});
  assert.equal(recognition,undefined);
  finishPreparation();
  await new Promise(resolve => setTimeout(resolve,0));
  assert.equal(mic.disabled,true,'Native mic remains locked when Android permission is denied');
  window.PipiVoiceMode.close();
  permission = 'granted';
  window.PipiVoiceMode.open();
  await new Promise(resolve => setTimeout(resolve,0));
  assert.equal(permissionRequests,2,'Opening voice mode requests Android permission again');
  assert.equal(mic.disabled,false);
  mic.listeners.pointerdown({pointerId:1,preventDefault() {}});
  await new Promise(resolve => setTimeout(resolve,0));
  assert.equal(recognitionStarts,1,'Native recognition starts after permission is granted');
  mic.listeners.pointerup({preventDefault() {}});
  await new Promise(resolve => setTimeout(resolve,10));
  const log=elements.get('pvm-chat');
  assert.equal(elements.has('pvm-short'),false,'Spoken answer is not duplicated above the detailed text');
  assert.ok(log.children.some(child => child.className === 'pvm-message ai pvm-typing'));
  assert.ok(!log.children.some(child => child.textContent === 'Đây là câu trả lời chi tiết.'));
  releaseAudio();
  await new Promise(resolve => setTimeout(resolve,10));
  assert.ok(log.children.some(child => child.textContent === 'Đây là câu trả lời chi tiết.'));
  assert.ok(!log.children.some(child => child.className === 'pvm-message ai pvm-typing'));
  assert.equal(gpsRefreshCalls,1,'Voice refreshes stale GPS once before replaying the same request');
  assert.equal(networkCalls,2,'Voice retries the same backend request after the GPS refresh');
  assert.equal(playedUrls.length,1,'The first answer uses the local voice');
  failSynthesis = true;
  mic.listeners.pointerdown({pointerId:3,preventDefault() {}});
  mic.listeners.pointerup({preventDefault() {}});
  await new Promise(resolve => setTimeout(resolve,10));
  assert.equal(nativeSpeakCalls,1,'Android speaks the answer when local synthesis fails');
  recognizedText = '';
  mic.listeners.pointerdown({pointerId:2,preventDefault() {}});
  mic.listeners.pointerup({preventDefault() {}});
  await new Promise(resolve => setTimeout(resolve,0));
  assert.equal(synthesisCalls,2,'Unclear speech uses its prepared clip immediately');
  assert.equal(networkCalls,3,'Unclear speech does not request an AI or cloud voice');
  assert.ok(playedUrls.some(url => url.includes('unclear.wav')));
  assert.equal(elements.get('pvm-status').textContent,'Giữ mic để nói');
  assert.equal(elements.get('pvm-caption').textContent,'Pipi đang chờ câu hỏi của bạn');
  assert.ok(log.children.some(child=>String(child.textContent).includes('Pipi chưa nghe rõ')),'Spoken feedback remains visible in the lower chat');
  const detailsButton=log.children.find(child=>child.className==='pvm-map-link');
  assert.equal(detailsButton?.textContent,'Chi Tiết');
  detailsButton.listeners.click();
  assert.equal(openedMap?.pois?.[0]?.id,'shop','Voice details open the place list map directly');
  window.PipiVoiceMode.open();
  await new Promise(resolve=>setTimeout(resolve,0));
  let finishTranslation;
  const translationDrain=new Promise(resolve=>{finishTranslation=resolve;});
  class FakeContinuousTranslate {
    ready=false;playAt=0;audioContext={currentTime:0};
    constructor(_url,callbacks){this.callbacks=callbacks;}
    async prepare(){this.ready=true;this.callbacks.onReady?.();}
    async startContinuous(){this.listening=true;}
    async stopContinuous(){await translationDrain;this.listening=false;}
    close(){}
  }
  window.PipiContinuousTranslate=FakeContinuousTranslate;
  const translateSwitch=elements.get('pvm-translate');
  translateSwitch.checked=true;await translateSwitch.listeners.change();
  assert.equal(elements.get('pvm-status').textContent,'Giữ mic để nói');
  mic.listeners.pointerdown({pointerId:4,preventDefault(){}});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(elements.get('pvm-status').textContent,'Pipi đang nghe bạn…');
  assert.equal(mic.disabled,false,'mic keeps pointerup while held');
  const activeTranslator=window.PipiVoiceMode.prewarmTranslate();
  assert.equal((await activeTranslator).listening,true);
  mic.listeners.pointerup({preventDefault(){}});
  assert.equal(mic.disabled,true,'mic waits while Live voice finishes');
  assert.equal(elements.get('pvm-status').textContent,'Pipi đang suy nghĩ…');
  const interpreter=await activeTranslator;
  interpreter.callbacks.onTextPending({sequence:1});
  interpreter.callbacks.onSegment({sequence:1,sourceLanguage:'vi',targetLanguage:'zh-Hans',sourceText:'Xin chào',translatedText:'你好'});
  interpreter.callbacks.onTextDone({sequence:1});
  interpreter.callbacks.onTextPending({sequence:2});
  interpreter.callbacks.onSegment({sequence:2,sourceLanguage:'zh-Hans',targetLanguage:'vi',sourceText:'你好',translatedText:'Xin chào'});
  const cards=log.children.filter(child=>String(child.className).startsWith('pvm-translation-card'));
  assert.equal(cards.length,2);
  assert.match(cards[0].className,/source-vi/);
  assert.match(cards[1].className,/source-zh/);
  assert.equal(cards[0].children[0].children[1].textContent,'Xin chào');
  assert.equal(cards[0].children[1].children[1].textContent,'你好');
  assert.equal(elements.get('pvm-close').disabled,true,'close waits for the final text');
  window.PipiVoiceMode.close();
  assert.equal(document.body.children[0].hidden,false);
  finishTranslation();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(elements.get('pvm-status').textContent,'Giữ mic để nói');
  assert.equal(mic.disabled,false,'next held phrase can start while earlier text remains pending');
  assert.equal(elements.get('pvm-close').disabled,true);
  interpreter.callbacks.onTextDone({sequence:2});
  assert.equal(elements.get('pvm-close').disabled,false);
  interpreter.callbacks.onVoiceFallback({targetLanguage:'zh-Hans',translatedText:'你好'});
  assert.equal(nativeSpeakCalls,2,'Android speaks the backend translation if Live returned no voice');
  assert.equal(elements.get('pvm-status').textContent,'Pipi đang trả lời…');
  assert.equal(elements.get('pvm-close').disabled,true,'popup stays open while fallback voice plays');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(elements.get('pvm-close').disabled,false);
});
