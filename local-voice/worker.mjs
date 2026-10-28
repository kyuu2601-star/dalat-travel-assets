import * as ort from './vendor/ort.wasm.min.mjs';
import {TextToSpeech, UnicodeProcessor, Style, writeWavFile} from './vendor/supertonic.mjs';

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
let engine = null, style = null, manifest = null, initialization = null;
let queue = Promise.resolve();

async function initialize(baseUrl) {
  manifest = await fetch(new URL('./model-manifest.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('VOICE_MANIFEST_UNAVAILABLE');
    return response.json();
  });
  const cache = typeof caches !== 'undefined' ? await caches.open(`pipi-voice-${manifest.id}`).catch(() => null) : null;
  let loaded = 0, lastUpdate = 0;
  const progress = (phase = 'download') => {
    if (performance.now() - lastUpdate < 100 && phase === 'download') return;
    lastUpdate = performance.now();
    postMessage({type:'progress', phase, loaded, total:manifest.totalBytes});
  };
  async function load(path) {
    const file = manifest.files.find(item => item.path === path);
    if (!file) throw new Error('UNKNOWN_VOICE_FILE');
    const url = new URL(`${path}?chunks=2`, baseUrl).href;
    const cached = await cache?.match(url);
    if (cached?.headers.get('x-pipi-sha256') === file.sha256) {
      const data = await cached.arrayBuffer();
      if (data.byteLength === file.bytes) { loaded += file.bytes; progress(); return data; }
    }
    const bytes = new Uint8Array(file.bytes);
    const chunkSize = 8 * 1024 * 1024;
    for (let offset = 0; offset < file.bytes; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, file.bytes) - 1;
      let chunk, failure;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, {headers:{Range:`bytes=${offset}-${end}`}, signal:AbortSignal.timeout(90000)});
          if (response.status !== 206 || response.headers.get('Content-Range') !== `bytes ${offset}-${end}/${file.bytes}`) throw new Error(`VOICE_MODEL_RANGE_UNAVAILABLE:${response.status}:${response.headers.get('Content-Range') || '-'}`);
          chunk = new Uint8Array(await response.arrayBuffer());
          if (chunk.length !== end - offset + 1) throw new Error('INCOMPLETE_VOICE_MODEL_CHUNK');
          break;
        } catch (error) {
          failure = error;
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!chunk) throw failure || new Error('VOICE_MODEL_DOWNLOAD_FAILED');
      bytes.set(chunk, offset);
      loaded += chunk.length;
      progress();
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const hash = Array.from(digest, byte => byte.toString(16).padStart(2,'0')).join('');
    if (hash !== file.sha256) throw new Error('VOICE_MODEL_CHECKSUM_FAILED');
    await cache?.put(url, new Response(bytes,{headers:{'x-pipi-sha256':hash}})).catch(() => {});
    return bytes.buffer;
  }
  const decoder = new TextDecoder();
  const config = JSON.parse(decoder.decode(await load('onnx/tts.json')));
  const indexer = JSON.parse(decoder.decode(await load('onnx/unicode_indexer.json')));
  const voice = JSON.parse(decoder.decode(await load('voice_styles/F3.json')));
  const sessions = [];
  try {
    for (const name of ['duration_predictor','text_encoder','vector_estimator','vocoder']) {
      const data = await load(`onnx/${name}.onnx`);
      progress('loading');
      sessions.push(await ort.InferenceSession.create(data,{executionProviders:['wasm'],graphOptimizationLevel:'all'}));
    }
    style = new Style(
      new ort.Tensor('float32',Float32Array.from(voice.style_ttl.data.flat(Infinity)),voice.style_ttl.dims),
      new ort.Tensor('float32',Float32Array.from(voice.style_dp.data.flat(Infinity)),voice.style_dp.dims)
    );
    engine = new TextToSpeech(config,new UnicodeProcessor(indexer),...sessions);
    progress('warming');
    await engine.call('Pipi chào bạn.','vi',style,manifest.steps,1.05);
    loaded = manifest.totalBytes; progress('ready');
  } catch (error) {
    for (const session of sessions) await session.release();
    engine = null;
    throw error;
  }
  return {ready:true, model:manifest.id};
}

self.onmessage = ({data}) => {
  queue = queue.then(async () => {
    try {
      if (data.type === 'init') {
        if (!initialization) initialization = initialize(data.baseUrl).catch(error => {initialization = null;throw error;});
        const result = await initialization;
        postMessage({id:data.id,...result});
      } else if (data.type === 'synthesize') {
        if (!engine) throw new Error('LOCAL_VOICE_NOT_READY');
        const started = performance.now();
        const result = await engine.call(String(data.text).slice(0,420),'vi',style,manifest.steps,1.05);
        const frames = Math.floor(result.duration[0] * engine.sampleRate);
        const wav = writeWavFile(result.wav.slice(0,frames),engine.sampleRate);
        postMessage({id:data.id,wav,generationMs:performance.now()-started},[wav]);
      }
    } catch (error) { postMessage({id:data.id,error:error?.message || 'LOCAL_VOICE_FAILED'}); }
  });
};
