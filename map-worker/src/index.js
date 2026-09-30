const AMAP_WALKING_URL = 'https://restapi.amap.com/v5/direction/walking';

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

function finiteCoord(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.lon ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, poiId:String(point?.poiId || point?.id || '').trim() };
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

async function walkingRoute(request, env, originHeader) {
  if (!env.AMAP_WEB_KEY) return json({ error:'Worker chưa có secret AMAP_WEB_KEY.' }, 500, originHeader);

  let body;
  try { body = await request.json(); }
  catch { return json({ error:'JSON body không hợp lệ.' }, 400, originHeader); }

  const origin = finiteCoord(body?.origin);
  const destination = finiteCoord(body?.destination);
  if (!origin || !destination) return json({ error:'origin/destination không hợp lệ.' }, 400, originHeader);

  const params = new URLSearchParams({
    key:env.AMAP_WEB_KEY,
    origin:`${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`,
    destination:`${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`,
    alternative_route:String(clampInt(body?.alternativeRoute, 1, 3, 3)),
    show_fields:'navi,polyline,cost',
    isindoor:body?.isIndoor === false ? '0' : '1',
    output:'json'
  });
  if (origin.poiId) params.set('origin_id', origin.poiId);
  if (destination.poiId) params.set('destination_id', destination.poiId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(`${AMAP_WALKING_URL}?${params.toString()}`, { signal:controller.signal });
  } catch (error) {
    clearTimeout(timer);
    return json({ error:error?.name === 'AbortError' ? 'AMap Route 2.0 timeout.' : 'Không gọi được AMap Route 2.0.' }, 502, originHeader);
  }
  clearTimeout(timer);

  const raw = await response.json().catch(() => null);
  if (!response.ok || !raw) return json({ error:`AMap HTTP ${response.status}` }, 502, originHeader);
  if (String(raw.status) !== '1') {
    return json({ error:`AMap Route 2.0: ${raw.info || 'unknown error'}`, infocode:raw.infocode || '' }, 502, originHeader);
  }

  const paths = Array.isArray(raw?.route?.paths) ? raw.route.paths : [];
  const routes = paths.map(normalizePath).filter(route => route.steps.length || route.distance > 0);
  if (!routes.length) return json({ error:'AMap Route 2.0 không trả tuyến đi bộ.' }, 404, originHeader);

  return json({
    source:'amap-route-v2',
    origin:{ lat:origin.lat, lng:origin.lng },
    destination:{ lat:destination.lat, lng:destination.lng },
    routes,
    meta:{ count:routes.length, info:raw.info || 'OK', infocode:raw.infocode || '' }
  }, 200, originHeader);
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
      return json({ ok:true, service:'travelos-map', route2:Boolean(env.AMAP_WEB_KEY) }, 200, origin);
    }
    if (request.method === 'POST' && url.pathname === '/route/walking') {
      return walkingRoute(request, env, origin);
    }
    return json({ error:'Not found' }, 404, origin);
  }
};
