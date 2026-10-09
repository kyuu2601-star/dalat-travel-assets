(function () {
  const SOURCE = 'amap-route-v2';
  function baseUrl() {
    const raw = String(window.CONFIG?.MAP_WORKER_URL || window.CHINA_MAP_WORKER_URL || '').trim();
    return !raw || raw.includes('PASTE_') ? '' : raw.replace(/\/+$/, '');
  }
  function configured() { return Boolean(baseUrl()); }
  function point(input) {
    if (!input) return null;
    const lat = Number(input.lat ?? input.latitude), lng = Number(input.lng ?? input.lon ?? input.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, coordSystem:String(input?.coordSystem || '').toLowerCase() || undefined } : null;
  }
  function toGcj(input) { const p=point(window.AMapProvider?.toGcj?.(input) || input); return p ? { ...p, coordSystem:'gcj02' } : null; }

  async function walkingRoute(origin, destination, options = {}) {
    const endpoint = baseUrl();
    if (!endpoint) throw new Error('Route 2.0 Worker chưa được cấu hình.');
    const o = toGcj(origin), d = toGcj(destination);
    if (!o || !d) throw new Error('Route 2.0 thiếu tọa độ điểm đầu hoặc điểm đến.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 12000));
    try {
      const payload = {
        country: destination?.country || origin?.country || 'Trung Quốc',
        provider:'amap',
        origin:{ ...o, poiId:origin?.poiId || origin?.id || '' },
        destination:{ ...d, poiId:destination?.poiId || destination?.id || '' },
        alternativeRoute:Number(options.alternativeRoute || 3),
        isIndoor:options.isIndoor !== false
      };
      const requestRoute = async body => {
        const response = await fetch(`${endpoint}/route/walking`, { method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal, body:JSON.stringify(body) });
        return { response, data:await response.json().catch(() => ({})) };
      };
      let { response, data } = await requestRoute(payload);
      let poiFallback = false;
      if (!response.ok && (payload.origin.poiId || payload.destination.poiId) && (String(data.infocode) === '20003' || /UNKNOWN_ERROR/.test(data.error || ''))) {
        ({ response, data } = await requestRoute({ ...payload, origin:o, destination:d }));
        poiFallback = response.ok;
      }
      if (!response.ok || !Array.isArray(data?.routes) || !data.routes.length) throw new Error(data?.error || data?.message || `Route Worker HTTP ${response.status}`);
      return { ...data, source:data.source || SOURCE, meta:{ ...data.meta, provider:'amap', upstreamSource:data.source || '', poiFallback }, origin:data.origin || o, destination:data.destination || d };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Route Worker timeout.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  window.AMapRouteService = { configured, walkingRoute, source:SOURCE };
})();
