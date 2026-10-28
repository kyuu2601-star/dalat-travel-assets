import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Voice reply stays as typing dots until local speech begins', async () => {
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
    createElement: () => new Element()
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
    {type:'detail',text:'Đây là câu trả lời chi tiết.',travelos:{version:3}},
    {type:'done'}
  ].map(event => JSON.stringify(event)).join('\n') + '\n';
  let networkCalls = 0, synthesisCalls = 0;
  const playedUrls = [];
  const fetch = async url => {
    networkCalls++;
    if (String(url).endsWith('/voice-v1')) return new Response(voiceEvents,{headers:{'Content-Type':'application/x-ndjson'}});
    throw new Error(`Unexpected network request: ${url}`);
  };
  class FakeAudio {
    constructor(url) { playedUrls.push(String(url)); }
    play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
    pause() {}
  }
  let finishPreparation;
  const preparation = new Promise(resolve => { finishPreparation = resolve; });
  const window = {
    SpeechRecognition:Recognition,
    PipiLocalVoice:{
      prepare:async()=>{await preparation;return {ready:true};},
      synthesize:async()=>{synthesisCalls++;await audioGate;return {wav:new Uint8Array([82,73,70,70]).buffer};}
    }
  };
  const context = vm.createContext({window,document,fetch,Audio:FakeAudio,Blob,Response,ReadableStream,TextEncoder,TextDecoder,AbortController,atob,URL,CONFIG:{WORKER_URL:'https://pipi.test'},console,queueMicrotask});
  vm.runInContext(await readFile(new URL('../voice-mode.js',import.meta.url),'utf8'),context);
  window.PipiVoiceMode.open();
  const mic=elements.get('pvm-mic');
  assert.equal(mic.disabled,true);
  mic.listeners.pointerdown({pointerId:1,preventDefault() {}});
  assert.equal(recognition,undefined);
  finishPreparation();
  await new Promise(resolve => setTimeout(resolve,0));
  assert.equal(mic.disabled,false);
  mic.listeners.pointerdown({pointerId:1,preventDefault() {}});
  assert.ok(recognition);
  mic.listeners.pointerup({preventDefault() {}});
  await new Promise(resolve => setTimeout(resolve,10));
  const log=elements.get('pvm-chat');
  assert.equal(elements.get('pvm-short').textContent,'');
  assert.ok(log.children.some(child => child.className === 'pvm-message ai pvm-typing'));
  assert.ok(!log.children.some(child => child.textContent === 'Đây là câu trả lời chi tiết.'));
  releaseAudio();
  await new Promise(resolve => setTimeout(resolve,10));
  assert.equal(elements.get('pvm-short').textContent,'Pipi chào bạn.');
  assert.ok(log.children.some(child => child.textContent === 'Đây là câu trả lời chi tiết.'));
  assert.ok(!log.children.some(child => child.className === 'pvm-message ai pvm-typing'));
  recognizedText = '';
  mic.listeners.pointerdown({pointerId:2,preventDefault() {}});
  mic.listeners.pointerup({preventDefault() {}});
  await new Promise(resolve => setTimeout(resolve,0));
  assert.equal(synthesisCalls,1,'Unclear speech uses its prepared clip immediately');
  assert.equal(networkCalls,1,'Unclear speech does not request an AI or cloud voice');
  assert.ok(playedUrls.some(url => url.includes('unclear.wav')));
});
