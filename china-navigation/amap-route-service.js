(function () {
  const SOURCE = 'amap-route-v2';

  function baseUrl() {
    const raw = String(window.CONFIG?.MAP_WORKER_URL || window.CHINA_MAP_WORKER_URL || '').trim();
    if (!raw || raw.includes('PASTE_')) return '';
    return raw.replace(/\/+$/, '');
  }
  function configured() { return Boolean(baseUrl()); }
  function fold(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').toLowerCase().trim(); }
  function isChinaCountry(v) {
    const x = fold(v);
    return ['trung quoc','china','cn','中国','中华人民共和国'].some(a => x === fold(a) || x.includes(fold(a)));
  }
  function currentCountry() { return document.getElementById('selectCountry')?.value || ''; }
  function point(input) {
    if (!input) return null;
    const lat = Number(input.lat ?? input.latitude);
    const lng = Number(input.lng ?? input.lon ?? input.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, country:input.country || '', coordSystem:input.coordSystem || input.coordinate_system || 'wgs84' }
      : null;
  }
  function routePoint(input, country) {
    if (isChinaCountry(country)) {
      const converted = window.AMapProvider?.toGcj?.({ ...input, country });
      return point(converted || input);
    }
    return point(input);
  }

  async function walkingRoute(origin, destination, options = {}) {
    const endpoint = baseUrl();
    if (!endpoint) throw new Error('Route 2.0 Worker chưa được cấu hình.');

    const country = destination?.country || origin?.country || currentCountry();
    const o = routePoint(origin, country);
    const d = routePoint(destination, country);
    if (!o || !d) throw new Error('Route 2.0 thiếu tọa độ điểm đầu hoặc điểm đến.');

    const timeoutMs = Number(options.timeoutMs || 12000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        country,
        provider:isChinaCountry(country) ? 'domestic' : 'overseas',
        origin:{ ...o, poiId:origin?.poiId || origin?.id || '' },
        destination:{ ...d, poiId:destination?.poiId || destination?.id || '' },
        alternativeRoute:Number(options.alternativeRoute || 3),
        isIndoor:options.isIndoor !== false
      };
      const requestRoute = async body => {
        const response = await fetch(`${endpoint}/route/walking`, {
          method:'POST', headers:{ 'Content-Type':'application/json' }, signal:controller.signal, body:JSON.stringify(body)
        });
        return { response, data:await response.json().catch(() => ({})) };
      };
      let { response, data } = await requestRoute(payload);
      let poiFallback = false;
      if (!response.ok && payload.provider === 'domestic' && (payload.origin.poiId || payload.destination.poiId) &&
          (String(data.infocode) === '20003' || /UNKNOWN_ERROR/.test(data.error || ''))) {
        ({ response, data } = await requestRoute({ ...payload, origin:o, destination:d }));
        poiFallback = response.ok;
      }
      if (!response.ok || !Array.isArray(data?.routes) || !data.routes.length) {
        throw new Error(data?.error || data?.message || `Route Worker HTTP ${response.status}`);
      }
      return {
        ...data,
        source:SOURCE,
        meta:{ ...data.meta, provider:data.provider || payload.provider, upstreamSource:data.source || '', poiFallback },
        origin:data.origin || o,
        destination:data.destination || d
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Route Worker timeout.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  window.AMapRouteService = { configured, walkingRoute, source:SOURCE };
})();
