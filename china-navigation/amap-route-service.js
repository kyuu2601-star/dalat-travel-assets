(function () {
  const SOURCE = 'amap-route-v2';

  function baseUrl() {
    const raw = String(window.CONFIG?.MAP_WORKER_URL || window.CHINA_MAP_WORKER_URL || '').trim();
    if (!raw || raw.includes('PASTE_')) return '';
    return raw.replace(/\/+$/, '');
  }

  function configured() { return Boolean(baseUrl()); }

  function point(point) {
    if (!point) return null;
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function toGcj(pointInput) {
    const converted = window.AMapProvider?.toGcj?.(pointInput);
    return point(converted || pointInput);
  }

  async function walkingRoute(origin, destination, options = {}) {
    const endpoint = baseUrl();
    if (!endpoint) throw new Error('Route 2.0 Worker chưa được cấu hình.');

    const o = toGcj(origin);
    const d = toGcj(destination);
    if (!o || !d) throw new Error('Route 2.0 thiếu tọa độ điểm đầu hoặc điểm đến.');

    const timeoutMs = Number(options.timeoutMs || 12000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        origin: { ...o, poiId: origin?.poiId || origin?.id || '' },
        destination: { ...d, poiId: destination?.poiId || destination?.id || '' },
        alternativeRoute: Number(options.alternativeRoute || 3),
        isIndoor: options.isIndoor !== false
      };
      const requestRoute = async body => {
        const response = await fetch(`${endpoint}/route/walking`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          signal: controller.signal,
          body: JSON.stringify(body)
        });
        return { response, data: await response.json().catch(() => ({})) };
      };
      let { response, data } = await requestRoute(payload);
      let poiFallback = false;
      if (!response.ok && (payload.origin.poiId || payload.destination.poiId) &&
          (String(data.infocode) === '20003' || /UNKNOWN_ERROR/.test(data.error || ''))) {
        ({ response, data } = await requestRoute({ ...payload, origin: o, destination: d }));
        poiFallback = response.ok;
      }
      if (!response.ok || !Array.isArray(data?.routes) || !data.routes.length) {
        throw new Error(data?.error || data?.message || `Route 2.0 HTTP ${response.status}`);
      }

      return {
        ...data,
        source: SOURCE,
        meta: { ...data.meta, poiFallback },
        origin: data.origin || o,
        destination: data.destination || d
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Route 2.0 Worker timeout.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  window.AMapRouteService = { configured, walkingRoute, source: SOURCE };
})();
