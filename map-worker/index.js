const AMAP_WALKING_URL = 'https://restapi.amap.com/v5/direction/walking';
const AMAP_OVERSEAS_WALKING_URL = 'https://sg-restapi.opnavi.com/v3/direction/walking';
const AMAP_NEARBY_URL = 'https://restapi.amap.com/v5/place/around';
const AMAP_OVERSEAS_NEARBY_URL = 'https://sg-restapi.opnavi.com/v3/place/around';
const REQUEST_BUDGET_MS = 9500;

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return '*';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  const allowed = String(env.ALLOWED_ORIGINS || 'https://kyuu2601-star.github.io')
    .split(',').map(x => x.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : '';
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }
  });
}

function clean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function fold(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
function isChinaCountry(value) {
  const v = fold(value);
  return ['trung quoc','china','cn','中国','中华人民共和国'].some(x => v === fold(x) || v.includes(fold(x)));
}
function routeMode(body) {
  const forced = clean(body?.provider, 20).toLowerCase();
  if (forced === 'domestic' || forced === 'overseas') return forced;
  const country = body?.country || body?.destination?.country || body?.origin?.country || '';
  return isChinaCountry(country) ? 'domestic' : 'overseas';
}


const GCJ_PI = Math.PI;
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;
function transformLat(x, y) {
  let r = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*Math.sqrt(Math.abs(x));
  r += (20*Math.sin(6*x*GCJ_PI) + 20*Math.sin(2*x*GCJ_PI))*2/3;
  r += (20*Math.sin(y*GCJ_PI) + 40*Math.sin(y/3*GCJ_PI))*2/3;
  r += (160*Math.sin(y/12*GCJ_PI) + 320*Math.sin(y*GCJ_PI/30))*2/3;
  return r;
}
function transformLng(x, y) {
  let r = 300 + x + 2*y + .1*x*x + .1*x*y + .1*Math.sqrt(Math.abs(x));
  r += (20*Math.sin(6*x*GCJ_PI) + 20*Math.sin(2*x*GCJ_PI))*2/3;
  r += (20*Math.sin(x*GCJ_PI) + 40*Math.sin(x/3*GCJ_PI))*2/3;
  r += (150*Math.sin(x/12*GCJ_PI) + 300*Math.sin(x/30*GCJ_PI))*2/3;
  return r;
}
function wgs84ToGcj02(lat, lng) {
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = lat / 180 * GCJ_PI;
  let magic = Math.sin(radLat); magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = dLat * 180 / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * GCJ_PI);
  dLng = dLng * 180 / (GCJ_A / sqrtMagic * Math.cos(radLat) * GCJ_PI);
  return { lat:lat + dLat, lng:lng + dLng };
}

function finiteCoord(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.lon ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat, lng,
    poiId:clean(point?.poiId || point?.id, 120),
    coordSystem:clean(point?.coordSystem || point?.coordinate_system || 'wgs84', 20).toLowerCase(),
    country:clean(point?.country, 120)
  };
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function parseLngLat(raw) {
  if (Array.isArray(raw)) {
    const lng = Number(raw[0]); const lat = Number(raw[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  if (raw && typeof raw === 'object') {
    const lng = Number(raw.lng ?? raw.longitude); const lat = Number(raw.lat ?? raw.latitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  const [lng, lat] = String(raw || '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
function parsePolyline(raw) {
  if (Array.isArray(raw)) {
    return raw.map(p => ({ lng:num(p?.lng ?? p?.longitude), lat:num(p?.lat ?? p?.latitude) }))
      .filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat));
  }
  return String(raw || '').split(';').map(pair => {
    const [lng, lat] = pair.split(',').map(Number);
    return { lng, lat };
  }).filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat));
}

function normalizeStep(step, index) {
  const navi = step?.navi || {};
  const cost = step?.cost || {};
  return {
    index,
    instruction:String(step?.instruction || ''),
    road:String(step?.road_name || step?.road || ''),
    orientation:String(step?.orientation || ''),
    distance:num(step?.step_distance ?? step?.distance),
    duration:num(cost?.duration ?? step?.duration),
    action:String(navi?.action || step?.action || ''),
    assistantAction:String(navi?.assistant_action || step?.assistant_action || ''),
    walkType:String(navi?.walk_type ?? step?.walk_type ?? ''),
    path:parsePolyline(step?.polyline)
  };
}

function normalizePath(path, routeIndex) {
  const steps = Array.isArray(path?.steps) ? path.steps.map(normalizeStep) : [];
  const stepDuration = steps.reduce((sum, s) => sum + num(s.duration), 0);
  return {
    routeIndex,
    distance:num(path?.distance),
    duration:num(path?.cost?.duration ?? path?.duration) || stepDuration,
    steps
  };
}

function retryableAmapError(info) {
  return String(info || '').toUpperCase() === 'UNKNOWN_ERROR';
}
function safeAttempt(profile, result = {}) {
  return {
    profile:profile.name,
    indoor:profile.isIndoor,
    alternativeRoute:profile.alternativeRoute,
    httpStatus:result.httpStatus ?? null,
    status:String(result.status ?? ''),
    info:String(result.info || ''),
    infocode:String(result.infocode || ''),
    elapsedMs:Number(result.elapsedMs || 0)
  };
}

function buildParams(env, origin, destination, profile) {
  const params = new URLSearchParams({
    key:env.AMAP_WEB_KEY,
    origin:`${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`,
    destination:`${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`,
    alternative_route:String(profile.alternativeRoute),
    show_fields:'navi,polyline,cost',
    isindoor:profile.isIndoor ? '1' : '0',
    output:'json'
  });
  if (origin.poiId) params.set('origin_id', origin.poiId);
  if (destination.poiId) params.set('destination_id', destination.poiId);
  return params;
}

async function callAmap(env, origin, destination, profile, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  const started = Date.now();
  try {
    const params = buildParams(env, origin, destination, profile);
    const response = await fetch(`${AMAP_WALKING_URL}?${params.toString()}`, { signal:controller.signal });
    const raw = await response.json().catch(() => null);
    const elapsedMs = Date.now() - started;
    if (!raw) return { ok:false, network:true, httpStatus:response.status, info:`AMap HTTP ${response.status}`, elapsedMs };
    return {
      ok:response.ok && String(raw.status) === '1',
      httpStatus:response.status,
      status:raw.status,
      info:raw.info,
      infocode:raw.infocode,
      raw,
      elapsedMs
    };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    return {
      ok:false,
      network:true,
      timeout:error?.name === 'AbortError',
      info:error?.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      message:error?.message || '',
      elapsedMs
    };
  } finally { clearTimeout(timer); }
}

async function domesticWalkingRoute(body, env, originHeader, origin, destination) {
  const requestedAlt = clampInt(body?.alternativeRoute, 1, 3, 3);
  const wantIndoor = body?.isIndoor !== false;
  const profiles = [];
  if (wantIndoor) profiles.push({ name:'indoor-multi', isIndoor:true, alternativeRoute:requestedAlt });
  profiles.push({ name:'outdoor-multi', isIndoor:false, alternativeRoute:requestedAlt });
  if (requestedAlt !== 1) profiles.push({ name:'outdoor-single', isIndoor:false, alternativeRoute:1 });

  const attempts = [];
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  let last = null;

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    const remaining = deadline - Date.now();
    if (remaining < 700) break;
    const left = profiles.length - i;
    const perAttempt = Math.min(4000, Math.max(1200, Math.floor(remaining / left)));
    const result = await callAmap(env, origin, destination, profile, perAttempt);
    last = result;
    attempts.push(safeAttempt(profile, result));

    if (result.ok) {
      const paths = Array.isArray(result.raw?.route?.paths) ? result.raw.route.paths : [];
      const routes = paths.map(normalizePath).filter(route => route.steps.length || route.distance > 0);
      if (!routes.length) {
        last = { ...result, ok:false, info:'EMPTY_ROUTE', infocode:result.infocode || '' };
        attempts[attempts.length - 1].info = 'EMPTY_ROUTE';
      } else {
        return json({
          source:'amap-route-v2', provider:'domestic',
          origin:{ lat:origin.lat, lng:origin.lng, coordSystem:'gcj02', country:body?.country || origin.country || '' },
          destination:{ lat:destination.lat, lng:destination.lng, coordSystem:'gcj02', country:body?.country || destination.country || '' },
          routes,
          meta:{ count:routes.length, info:result.raw.info || 'OK', infocode:result.raw.infocode || '', profile:profile.name, indoor:profile.isIndoor, attempts }
        }, 200, originHeader);
      }
    }

    const canRetry = result.network || retryableAmapError(result.info) || result.info === 'EMPTY_ROUTE';
    if (!canRetry) break;
  }

  const lastInfo = String(last?.info || 'unknown error');
  const lastCode = String(last?.infocode || '');
  return json({
    error:`AMap Route 2.0: ${lastInfo}`, infocode:lastCode, attempts,
    diagnostic:{ origin:{ lat:origin.lat, lng:origin.lng }, destination:{ lat:destination.lat, lng:destination.lng }, requestedIndoor:wantIndoor, requestedAlternativeRoute:requestedAlt }
  }, 502, originHeader);
}

async function overseasWalkingRoute(body, env, originHeader, origin, destination) {
  const params = new URLSearchParams({
    key:env.AMAP_WEB_KEY,
    origin:`${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`,
    destination:`${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`,
    output:'json'
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_BUDGET_MS);
  try {
    const response = await fetch(`${AMAP_OVERSEAS_WALKING_URL}?${params.toString()}`, { signal:controller.signal });
    const raw = await response.json().catch(() => null);
    if (!response.ok || !raw) return json({ error:`AMap overseas HTTP ${response.status}` }, 502, originHeader);
    if (String(raw.status) !== '1') return json({ error:`AMap overseas walking: ${raw.info || 'unknown error'}`, infocode:raw.infocode || '' }, 502, originHeader);
    const paths = Array.isArray(raw?.route?.paths) ? raw.route.paths : [];
    const routes = paths.map(normalizePath).filter(route => route.steps.length || route.distance > 0);
    if (!routes.length) return json({ error:'AMap overseas không trả tuyến đi bộ.' }, 404, originHeader);
    const country = clean(body?.country || destination.country || origin.country, 120);
    return json({
      source:'amap-route-overseas-v3', provider:'overseas',
      origin:{ lat:origin.lat, lng:origin.lng, coordSystem:'wgs84', country },
      destination:{ lat:destination.lat, lng:destination.lng, coordSystem:'wgs84', country },
      routes,
      meta:{ count:routes.length, info:raw.info || 'OK', infocode:raw.infocode || '', overseas:true }
    }, 200, originHeader);
  } catch (error) {
    return json({ error:error?.name === 'AbortError' ? 'AMap overseas walking timeout.' : `Không gọi được AMap overseas walking: ${clean(error?.message, 300)}` }, 502, originHeader);
  } finally { clearTimeout(timer); }
}

async function walkingRoute(request, env, originHeader) {
  if (!env.AMAP_WEB_KEY) return json({ error:'Worker chưa có secret AMAP_WEB_KEY.' }, 500, originHeader);
  let body;
  try { body = await request.json(); }
  catch { return json({ error:'JSON body không hợp lệ.' }, 400, originHeader); }
  const origin = finiteCoord(body?.origin);
  const destination = finiteCoord(body?.destination);
  if (!origin || !destination) return json({ error:'origin/destination không hợp lệ.' }, 400, originHeader);
  return routeMode(body) === 'domestic'
    ? domesticWalkingRoute(body, env, originHeader, origin, destination)
    : overseasWalkingRoute(body, env, originHeader, origin, destination);
}

function normalizePoi(poi, provider, country) {
  const point = parseLngLat(poi?.location);
  if (!point) return null;
  const business = poi?.business && typeof poi.business === 'object' ? poi.business : {};
  return {
    id:clean(poi?.id, 160),
    poiId:clean(poi?.id, 160),
    name:clean(poi?.name, 300),
    address:clean(poi?.address, 1000),
    lat:point.lat,
    lng:point.lng,
    distance:num(poi?.distance),
    type:clean(poi?.type, 500),
    typecode:clean(poi?.typecode, 100),
    city:clean(poi?.cityname, 200),
    district:clean(poi?.adname, 200),
    province:clean(poi?.pname, 200),
    phone:clean(business?.tel || poi?.tel, 300),
    openTime:clean(business?.opentime_today, 500),
    rating:clean(business?.rating, 50),
    coordSystem:provider === 'domestic' ? 'gcj02' : 'wgs84',
    provider,
    country:clean(country, 120)
  };
}

async function nearbySearch(request, env, originHeader) {
  if (!env.AMAP_WEB_KEY) return json({ error:'Worker chưa có secret AMAP_WEB_KEY.' }, 500, originHeader);
  let body;
  try { body = await request.json(); }
  catch { return json({ error:'JSON body không hợp lệ.' }, 400, originHeader); }

  const center = finiteCoord(body?.center || body?.location);
  if (!center) return json({ error:'center/location không hợp lệ.' }, 400, originHeader);
  const keyword = clean(body?.keyword || body?.keywords, 80);
  const types = clean(body?.types, 300);
  if (!keyword && !types) return json({ error:'Cần keyword hoặc types để search nearby.' }, 400, originHeader);

  const provider = routeMode(body);
  const radius = clampInt(body?.radius, 100, 50000, 3000);
  const limit = clampInt(body?.limit, 1, provider === 'domestic' ? 25 : 50, 8);
  const country = clean(body?.country || center.country, 120);
  const url = provider === 'domestic' ? AMAP_NEARBY_URL : AMAP_OVERSEAS_NEARBY_URL;
  const queryCenter = provider === 'domestic' && center.coordSystem !== 'gcj02'
    ? wgs84ToGcj02(center.lat, center.lng)
    : center;
  const params = new URLSearchParams({
    key:env.AMAP_WEB_KEY,
    location:`${queryCenter.lng.toFixed(6)},${queryCenter.lat.toFixed(6)}`,
    radius:String(radius),
    output:'json'
  });
  if (keyword) params.set('keywords', keyword);
  if (types) params.set('types', types);

  if (provider === 'domestic') {
    params.set('page_size', String(limit));
    params.set('page_num', '1');
    params.set('sortrule', 'distance');
    params.set('show_fields', 'business,navi');
  } else {
    params.set('page', '1');
    params.set('offset', String(limit));
    params.set('langCode', clean(body?.language, 20) || 'vi');
    params.set('extensions', 'all');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${url}?${params.toString()}`, { signal:controller.signal });
    const raw = await response.json().catch(() => null);
    if (!response.ok || !raw) return json({ error:`AMap Nearby HTTP ${response.status}`, provider }, 502, originHeader);
    if (String(raw.status) !== '1') {
      return json({ error:`AMap Nearby: ${raw.info || 'unknown error'}`, infocode:raw.infocode || '', provider }, 502, originHeader);
    }
    const pois = (Array.isArray(raw.pois) ? raw.pois : []).map(p => normalizePoi(p, provider, country)).filter(Boolean)
      .sort((a,b) => (a.distance || Infinity) - (b.distance || Infinity)).slice(0, limit);
    return json({
      ok:true, source:provider === 'domestic' ? 'amap-place-v5' : 'amap-place-overseas-v3', provider,
      query:{ keyword, types, radius, limit },
      center:{ lat:center.lat, lng:center.lng, coordSystem:center.coordSystem || 'wgs84', country },
      count:pois.length,
      pois,
      meta:{ info:raw.info || 'OK', infocode:raw.infocode || '', total:Number(raw.count || pois.length) }
    }, 200, originHeader);
  } catch (error) {
    return json({ error:error?.name === 'AbortError' ? 'AMap Nearby timeout.' : `Không gọi được AMap Nearby: ${clean(error?.message, 300)}`, provider }, 502, originHeader);
  } finally { clearTimeout(timer); }
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status:403 });
      return new Response(null, { status:204, headers:corsHeaders(origin) });
    }
    if (!origin) return json({ error:'Origin không được phép.' }, 403, 'null');

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok:true, service:'travelos-map', route2:Boolean(env.AMAP_WEB_KEY), nearby:Boolean(env.AMAP_WEB_KEY), overseas:true, retryProfiles:true }, 200, origin);
    }
    if (request.method === 'POST' && url.pathname === '/route/walking') return walkingRoute(request, env, origin);
    if (request.method === 'POST' && url.pathname === '/poi/nearby') return nearbySearch(request, env, origin);
    return json({ error:'Not found' }, 404, origin);
  }
};
