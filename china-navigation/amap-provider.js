(function () {
  let sdkPromise = null;

  function cfg() { return window.CHINA_NAV_CONFIG || {}; }
  function log(...args) { if (cfg().debug) console.log('[AMapProvider]', ...args); }
  function pointValue(point) {
    if (!point || (point.lat ?? point.latitude) == null || (point.lng ?? point.lon ?? point.longitude) == null || (point.lat ?? point.latitude) === '' || (point.lng ?? point.lon ?? point.longitude) === '') return null;
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, coordSystem: point.coordSystem || 'wgs84' } : null;
  }
  function toGcj(point) {
    const p = pointValue(point);
    if (!p) return null;
    if (String(p.coordSystem).toLowerCase() === 'gcj02') return { lat: p.lat, lng: p.lng };
    return window.GCJ02?.wgs84ToGcj02(p.lat, p.lng) || { lat: p.lat, lng: p.lng };
  }

  function ensureSdk() {
    if (window.AMap?.Map && window.AMap?.Walking) return Promise.resolve(window.AMap);
    if (sdkPromise) return sdkPromise;
    const amap = cfg().amap || {};
    if (!amap.jsKey || amap.jsKey.includes('PASTE_')) return Promise.reject(new Error('Chưa khai báo AMap JS Key trong china-config.js.'));
    if (amap.securityJsCode && !amap.securityJsCode.includes('PASTE_')) {
      window._AMapSecurityConfig = { ...(window._AMapSecurityConfig || {}), securityJsCode: amap.securityJsCode };
    }
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const plugins = ['AMap.Walking','AMap.Geocoder','AMap.PlaceSearch'].join(',');
      script.src = `https://webapi.amap.com/maps?v=${encodeURIComponent(amap.version || '2.0')}&key=${encodeURIComponent(amap.jsKey)}&plugin=${encodeURIComponent(plugins)}`;
      script.async = true;
      script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('AMap SDK load xong nhưng window.AMap không tồn tại.'));
      script.onerror = () => reject(new Error('Không tải được AMap SDK.'));
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  function normalizePath(path) {
    if (!Array.isArray(path)) return [];
    return path.map(p => ({
      lng: Number(typeof p?.getLng === 'function' ? p.getLng() : p?.lng),
      lat: Number(typeof p?.getLat === 'function' ? p.getLat() : p?.lat)
    })).filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat));
  }

  function normalizeStep(step, index) {
    return {
      index,
      instruction: String(step?.instruction || ''),
      road: String(step?.road || step?.road_name || ''),
      orientation: String(step?.orientation || ''),
      distance: Number(step?.distance || step?.step_distance || 0),
      duration: Number(step?.duration || 0),
      action: String(step?.action || step?.navi?.action || ''),
      assistantAction: String(step?.assistant_action || step?.assistantAction || step?.navi?.assistant_action || ''),
      walkType: String(step?.walk_type ?? step?.walkType ?? step?.navi?.walk_type ?? ''),
      path: normalizePath(step?.path || [])
    };
  }

  async function walkingRoute(origin, destination) {
    const AMap = await ensureSdk();
    const o = toGcj(origin);
    const d = toGcj(destination);
    if (!o || !d) throw new Error('Thiếu tọa độ điểm đầu hoặc điểm đến.');
    const walking = new AMap.Walking({});
    return new Promise((resolve, reject) => {
      walking.search([o.lng, o.lat], [d.lng, d.lat], (status, result) => {
        log('walking result', status, result);
        if (status !== 'complete' || !result?.routes?.length) {
          const detail = [status, result?.info, result?.message].filter(Boolean).join(' · ');
          return reject(new Error(detail ? `AMap Walking: ${detail}` : 'AMap không tìm được tuyến đi bộ.'));
        }
        const routes = result.routes.map((route, routeIndex) => ({
          routeIndex,
          distance: Number(route.distance || 0),
          duration: Number(route.time || route.duration || 0),
          steps: (route.steps || []).map(normalizeStep)
        }));
        resolve({ origin: o, destination: d, routes, raw: result });
      });
    });
  }

  async function searchPOI(keyword, city = '') {
    const AMap = await ensureSdk();
    if (!keyword) throw new Error('Thiếu keyword POI.');
    const search = new AMap.PlaceSearch({ city: city || '', pageSize: 10, pageIndex: 1, extensions: 'all' });
    return new Promise((resolve, reject) => {
      search.search(keyword, (status, result) => {
        if (status !== 'complete' || !result?.poiList?.pois?.length) return reject(new Error(result?.info || `Không tìm thấy POI: ${keyword}`));
        resolve(result.poiList.pois.map(p => ({
          id: p.id || '', name: p.name || '', address: p.address || '', city: p.cityname || city || '',
          district: p.adname || '', lat: Number(p.location?.lat), lng: Number(p.location?.lng), coordSystem: 'gcj02', raw: p
        })));
      });
    });
  }

  async function reverseGeocode(point) {
    const AMap = await ensureSdk();
    const p = toGcj(point);
    if (!p) throw new Error('Tọa độ không hợp lệ.');
    const geocoder = new AMap.Geocoder({ radius: 1000, extensions: 'all' });
    return new Promise((resolve, reject) => {
      geocoder.getAddress([p.lng, p.lat], (status, result) => {
        if (status !== 'complete' || !result?.regeocode) return reject(new Error(result?.info || 'Reverse geocode thất bại.'));
        const c = result.regeocode.addressComponent || {};
        resolve({ formattedAddress: result.regeocode.formattedAddress || '', province: c.province || '', city: c.city || c.province || '', district: c.district || '', township: c.township || '', raw: result.regeocode });
      });
    });
  }

  async function createMap(container, center) {
  const AMap = await ensureSdk();
  const c = center ? toGcj(center) : null;

  return new AMap.Map(container, {
  zoom: 16,
  center: c ? [c.lng, c.lat] : undefined,
  viewMode: '3D',
  pitch: 45,
  rotation: 0,
  showBuildingBlock: true,
  pitchEnable: true,
  resizeEnable: true
  });
  }

  function routePath(route) {
    return (route?.steps || []).flatMap(step => step.path || []).map(p => [p.lng, p.lat]);
  }

  function drawRoute(map, route, origin, destination) {
    if (!window.AMap || !map || !route) return null;
    map.clearMap();
    const path = routePath(route);
    const parts = [];
    if (path.length) {
      const line = new AMap.Polyline({ path, isOutline: true, outlineColor: '#ffffff', borderWeight: 2, strokeWeight: 6, strokeColor: '#0ea5e9', strokeOpacity: 0.95, lineJoin: 'round' });
      map.add(line); parts.push(line);
    }
    if (origin) {
      const marker = new AMap.Marker({ position: [origin.lng, origin.lat], anchor: 'bottom-center', label: { content: '<div class="tn-map-label">Bắt đầu</div>', direction: 'top' } });
      map.add(marker); parts.push(marker);
    }
    if (destination) {
      const marker = new AMap.Marker({ position: [destination.lng, destination.lat], anchor: 'bottom-center', label: { content: '<div class="tn-map-label">Điểm đến</div>', direction: 'top' } });
      map.add(marker); parts.push(marker);
    }
    if (parts.length) map.setFitView(parts, false, [60, 60, 60, 60]);
    return { path, parts };
  }

  async function resolveDestination(destination) {
    const direct = pointValue(destination);
    if (direct) return { ...direct, poiId: destination.poiId || '', name: destination.name || '', city: destination.city || '' };
    const results = await searchPOI(destination.name || destination.keyword, destination.city || '');
    const best = results[0];
    return { lat: best.lat, lng: best.lng, coordSystem: 'gcj02', name: destination.name || best.name, city: destination.city || best.city, poiId: best.id };
  }

  window.AMapProvider = { ensureSdk, walkingRoute, searchPOI, reverseGeocode, createMap, drawRoute, resolveDestination, toGcj };
})();
