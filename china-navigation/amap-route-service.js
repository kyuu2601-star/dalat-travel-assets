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

  function normalizeMode(value) {
    const mode=String(value || '').toLowerCase();
    if (mode === 'drive' || mode === 'driving') return 'drive';
    if (['electrobike','electric_bike','electric-bike','motorbike','two-wheeler'].includes(mode)) return 'electrobike';
    return 'walk';
  }

  function expectedSource(mode) {
    if (mode === 'drive') return 'amap-driving-v5';
    if (mode === 'electrobike') return 'amap-electrobike-v5';
    return SOURCE;
  }

  async function route(origin, destination, options = {}) {
    const endpoint = baseUrl();
    if (!endpoint) throw new Error('Route 2.0 Worker chưa được cấu hình.');
    const o = toGcj(origin), d = toGcj(destination);
    if (!o || !d) throw new Error('Route 2.0 thiếu tọa độ điểm đầu hoặc điểm đến.');
    const mode=normalizeMode(options.mode);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 12000));
    try {
      const payload = {
        country: destination?.country || origin?.country || 'Trung Quốc',
        provider:'amap',
        origin:{ ...o, poiId:origin?.poiId || origin?.id || '' },
        destination:{ ...d, poiId:destination?.poiId || destination?.id || '' },
        alternativeRoute:Number(options.alternativeRoute || 3),
        isIndoor:mode === 'walk' && options.isIndoor !== false,
        mode
      };
      const requestRoute = async body => {
        const path=mode === 'walk' ? '/route/walking' : '/route/directions';
        const response = await fetch(`${endpoint}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal, body:JSON.stringify(body) });
        return { response, data:await response.json().catch(() => ({})) };
      };
      const { response, data } = await requestRoute(payload);
      if (!response.ok || !Array.isArray(data?.routes) || !data.routes.length) throw new Error(data?.error || data?.message || `Route Worker HTTP ${response.status}`);
      if (data.source && data.source !== expectedSource(mode)) throw new Error(`Route Worker trả nguồn không được phép: ${data.source}`);
      const poiFallback = data.meta?.endpointFallback === 'coordinate-only';
      return { ...data, source:expectedSource(mode), mode, meta:{ ...data.meta, provider:'amap', upstreamSource:data.source || '', poiFallback }, origin:data.origin || o, destination:data.destination || d };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Route Worker timeout.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function routeWithFallback(origin, destination, options = {}) {
    const requestedMode=normalizeMode(options.mode);
    try {
      return await route(origin,destination,{...options,mode:requestedMode});
    } catch (walkingError) {
      if (requestedMode !== 'walk' || options.fallbackToRide === false) throw walkingError;
      const fallbackReason=String(walkingError?.message || walkingError || 'Walking route unavailable').slice(0,500);
      console.warn('[AMap Route 2.0] Walking unavailable, switching to electric bike.', walkingError);
      try {
        const fallback=await route(origin,destination,{...options,mode:'electrobike',isIndoor:false,fallbackToRide:false});
        return {
          ...fallback,
          requestedMode,
          mode:'electrobike',
          meta:{...fallback.meta,fallbackFrom:'walk',fallbackReason}
        };
      } catch (rideError) {
        const detail=String(rideError?.message || rideError || 'Electric-bike route unavailable');
        const error=new Error(`Tuyến đi bộ lỗi (${fallbackReason}); tuyến xe điện thay thế cũng lỗi (${detail}).`);
        error.walkingError=walkingError;
        error.rideError=rideError;
        throw error;
      }
    }
  }
  const walkingRoute=(origin,destination,options={})=>route(origin,destination,{...options,mode:'walk'});
  window.AMapRouteService = { configured, route, routeWithFallback, walkingRoute, source:SOURCE };
})();
