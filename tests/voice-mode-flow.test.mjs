import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Voice reply stays as typing dots until streamed speech begins', async () => {
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
  let recognition;
  class Recognition {
    start() {
      recognition = this;
      this.onresult?.({results:[Object.assign([{transcript:'Pipi ơi',confidence:0.9}],{isFinal:true})]});
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
  const pcm = Buffer.alloc(24000 * 2 * 0.4);
  const sse = `event: step.delta\r\ndata: ${JSON.stringify({event_type:'step.delta',delta:{type:'audio',sample_rate:24000,data:pcm.toString('base64')}})}\r\n\r\n`;
  const fetch = async url => {
    if (String(url).endsWith('/voice-v1')) return new Response(voiceEvents,{headers:{'Content-Type':'application/x-ndjson'}});
    if (String(url).endsWith('/voice-tts')) {
      const stream = new ReadableStream({async start(controller) {
        await audioGate;
        const chunks = new TextEncoder().encode(sse);
        controller.enqueue(chunks.slice(0,19));
        controller.enqueue(chunks.slice(19,47));
        controller.enqueue(chunks.slice(47));
        controller.close();
      }});
      return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  class FakeAudio {
    play() { queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
    pause() {}
  }
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    resume() { return Promise.resolve(); }
    createBuffer(_channels, frames, sampleRate) {
      const samples = new Float32Array(frames);
      return {duration:frames/sampleRate,getChannelData:() => samples};
    }
    createBufferSource() {
      return {connect() {},start() { queueMicrotask(() => this.onended?.()); },stop() { this.onended?.(); }};
    }
  }
  const window = {SpeechRecognition:Recognition,AudioContext:FakeAudioContext};
  const context = vm.createContext({window,document,fetch,Audio:FakeAudio,Response,ReadableStream,TextEncoder,TextDecoder,AbortController,atob,URL,CONFIG:{WORKER_URL:'https://pipi.test'},console,queueMicrotask});
  vm.runInContext(await readFile(new URL('../voice-mode.js',import.meta.url),'utf8'),context);
  window.PipiVoiceMode.open();
  const mic=elements.get('pvm-mic');
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
});
