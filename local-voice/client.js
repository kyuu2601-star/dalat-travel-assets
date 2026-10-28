// One Vietnamese voice, synthesized on this device by a dedicated worker.
(() => {
  const scriptUrl = document.currentScript.src;
  let worker = null, preparation = null, nextId = 0, lastProgress = null;
  const requests = new Map(), listeners = new Set();

  function failAll(error) {
    for (const item of requests.values()) { clearTimeout(item.timer); item.reject(error); }
    requests.clear();
    worker?.terminate(); worker = null; preparation = null;
  }
  function getWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./worker.mjs?v=3', scriptUrl), {type:'module'});
    worker.onmessage = ({data}) => {
      if (data.type === 'progress') {
        lastProgress = data;
        for (const listener of listeners) listener(data);
        return;
      }
      const pending = requests.get(data.id);
      if (!pending) return;
      requests.delete(data.id); clearTimeout(pending.timer);
      if (data.error) pending.reject(new Error(data.error));
      else pending.resolve(data);
    };
    worker.onerror = () => failAll(new Error('LOCAL_VOICE_WORKER_FAILED'));
    return worker;
  }
  function request(type, payload, timeout) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => failAll(new Error('LOCAL_VOICE_TIMEOUT')), timeout);
      requests.set(id, {resolve, reject, timer});
      try { getWorker().postMessage({id, type, ...payload}); }
      catch (error) { clearTimeout(timer); requests.delete(id); reject(error); }
    });
  }
  async function prepare(onProgress) {
    if (onProgress) { listeners.add(onProgress); if (lastProgress) onProgress(lastProgress); }
    try {
      if (!preparation) {
        navigator.storage?.persist?.().catch(() => {});
        const baseUrl = `${CONFIG.WORKER_URL.replace(/\/+$/, '')}/voice-models/supertonic3-f3-vi-r1/`;
        preparation = request('init', {baseUrl}, 1200000).catch(error => { preparation = null; throw error; });
      }
      return await preparation;
    } finally { if (onProgress) listeners.delete(onProgress); }
  }
  window.PipiLocalVoice = {
    prepare,
    async synthesize(text) {
      await prepare();
      return request('synthesize', {text:String(text).trim().slice(0,420)}, 25000);
    }
  };
})();
