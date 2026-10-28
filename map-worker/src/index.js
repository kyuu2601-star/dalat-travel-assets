const AMAP_WALKING_URL = 'https://restapi.amap.com/v5/direction/walking';
const AMAP_NEARBY_URL = 'https://restapi.amap.com/v5/place/around';
const AMAP_TEXT_SEARCH_URL = 'https://restapi.amap.com/v5/place/text';
const AMAP_PLACE_DETAIL_URL = 'https://restapi.amap.com/v5/place/detail';
const AMAP_GEOCODING_URL = 'https://restapi.amap.com/v3/geocode/geo';
const AMAP_REVERSE_GEOCODING_URL = 'https://restapi.amap.com/v3/geocode/regeo';
const AMAP_WEATHER_URL = 'https://restapi.amap.com/v3/weather/weatherInfo';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';
const GEOAPIFY_ROUTING_URL = 'https://api.geoapify.com/v1/routing';
const GEOAPIFY_GEOCODING_URL = 'https://api.geoapify.com/v1/geocode/search';
const GEOAPIFY_DETAILS_URL = 'https://api.geoapify.com/v2/place-details';
const GOOGLE_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_NEARBY_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const GOOGLE_PLACE_URL = 'https://places.googleapis.com/v1/places';
const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const GOOGLE_WEATHER_URL = 'https://weather.googleapis.com/v1/currentConditions:lookup';
const GOOGLE_WEATHER_HOURLY_URL = 'https://weather.googleapis.com/v1/forecast/hours:lookup';
const GOOGLE_WEATHER_ALERTS_URL = 'https://weather.googleapis.com/v1/publicAlerts:lookup';
const AMAP_DRIVING_URL = 'https://restapi.amap.com/v5/direction/driving';
const AMAP_ELECTRIC_BIKE_URL = 'https://restapi.amap.com/v5/direction/electrobike';
const REQUEST_BUDGET_MS = 9500;

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return '*';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  const allowed = String(env.ALLOWED_ORIGINS || 'https://kyuu2601-star.github.io').split(',').map(x => x.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : '';
}
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':origin || 'null',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin'
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers:{ ...corsHeaders(origin), 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' } });
}
function clean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function fold(value) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,' ').trim();
}
function nameSimilarity(query, candidate) {
  const q=fold(query),c=fold(candidate);
  if(!q||!c)return 0;
  if(q===c)return 1;
  if(c.startsWith(q)||q.startsWith(c))return .94;
  if(c.includes(q)||q.includes(c))return .9;
  const qTokens=[...new Set(q.split(/\s+/).filter(Boolean))],cTokens=[...new Set(c.split(/\s+/).filter(Boolean))];
  const common=qTokens.filter(token=>cTokens.includes(token)).length;
  const tokenCoverage=common/Math.max(1,qTokens.length),tokenPrecision=common/Math.max(1,cTokens.length);
  const tokenScore=.7*tokenCoverage+.3*tokenPrecision;
  const grams=value=>{
    const compact=value.replace(/\s+/g,'');
    if(compact.length<2)return new Set([compact]);
    return new Set(Array.from({length:compact.length-1},(_,index)=>compact.slice(index,index+2)));
  };
  const qGrams=grams(q),cGrams=grams(c),gramCommon=[...qGrams].filter(gram=>cGrams.has(gram)).length;
  const dice=(2*gramCommon)/Math.max(1,qGrams.size+cGrams.size);
  return Math.max(tokenScore,dice*.85);
}
function rankNamedPlaces(places, queries) {
  const names=(Array.isArray(queries)?queries:[queries]).map(value=>clean(value,300)).filter(Boolean);
  const quality=place=>{
    const primary=clean(place?.primaryType||place?.type,120).toLowerCase();
    let score=0;
    if(primary&&!['premise','street_address','route','plus_code'].includes(primary))score+=4;
    if(Number(place?.rating)>0)score+=2;
    if(Number(place?.userRatingCount)>0)score+=1;
    if(typeof place?.openNow==='boolean'||place?.openTime)score+=1;
    if(place?.businessStatus)score+=1;
    if(place?.phone||place?.website)score+=1;
    return score;
  };
  return places.map(place=>{
    const candidates=[place?.name,place?.localizedName,place?.alias].filter(Boolean);
    const nameMatchScore=Math.max(0,...names.flatMap(query=>candidates.map(candidate=>nameSimilarity(query,candidate))));
    return {...place,nameMatchScore};
  }).sort((a,b)=>(b.nameMatchScore||0)-(a.nameMatchScore||0)||quality(b)-quality(a)||(a.distance??Infinity)-(b.distance??Infinity)||trustedRating(b)-trustedRating(a));
}
function isChinaCountry(value) {
  const v = fold(value);
  return ['trung quoc','china','cn','中国','中华人民共和国'].some(x => v === fold(x) || v.includes(fold(x)));
}
const CHINA_MAINLAND_OUTLINE=[[73.5,39.5],[79,35.5],[80,30],[88,27.5],[92,28],[97,28],[98,24],[101,21.5],[102,22.5],[106.5,22.8],[108,21.5],[110,20.3],[114,22],[117,23],[120,25],[122,29],[122,40],[125,40],[131,43],[135,48],[132,53],[120,54],[108,49],[95,49],[87,47],[80,45]];
function pointInOutline(lat,lng,outline) {
  let inside=false;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
    const [xi,yi]=outline[i],[xj,yj]=outline[j],crosses=(yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi;
    if(crosses)inside=!inside;
  }
  return inside;
}
function isChinaCoordinate(value) {
  const point=finiteCoord(value);if(!point)return false;
  const {lat,lng}=point;
  return pointInOutline(lat,lng,CHINA_MAINLAND_OUTLINE)||(lat>=18&&lat<=20.6&&lng>=108.5&&lng<=111.5);
}
function hasChinaPlaceHint(value) {
  const v=fold(value);
  return ['trung khanh','chongqing','重庆','bac kinh','beijing','北京','thuong hai','shanghai','上海','quang chau','guangzhou','广州','tham quyen','shenzhen','深圳','thanh do','chengdu','成都','tay an','xian','西安','hang chau','hangzhou','杭州','nam kinh','nanjing','南京','to chau','suzhou','苏州','vu han','wuhan','武汉','raffles city','来福士','chaotianmen','朝天门'].some(item=>v.includes(fold(item)));
}
function providerFor(body) {
  const country = body?.country || body?.destination?.country || body?.origin?.country || body?.center?.country || '';
  const query=body?.query||body?.name||body?.address||'';
  const chinaContext=isChinaCountry(country)||isChinaCoordinate(body?.center)||isChinaCoordinate(body?.location)||isChinaCoordinate(body?.origin)||isChinaCoordinate(body?.destination)||hasChinaPlaceHint(query);
  // China is a hard provider boundary: never let a stale/forced global provider bypass AMap.
  if(chinaContext) return 'amap';
  const forced = clean(body?.provider, 20).toLowerCase();
  if (forced === 'amap' || forced === 'domestic') return 'amap';
  if (forced === 'geoapify') return 'geoapify';
  if (forced === 'google' || forced === 'google_places' || forced === 'google_routes') return 'google';
  return 'google';
}
function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function finiteCoord(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.lon ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, poiId:clean(point?.poiId || point?.id, 160), coordSystem:clean(point?.coordSystem || point?.coordinate_system || 'wgs84', 20).toLowerCase(), country:clean(point?.country, 120) };
}
function haversineMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng/2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)));
}

// China coordinate conversion. Outside China this function is never used.
const GCJ_PI = Math.PI, GCJ_A = 6378245.0, GCJ_EE = 0.00669342162296594323;
function transformLat(x,y){let r=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*GCJ_PI)+20*Math.sin(2*x*GCJ_PI))*2/3;r+=(20*Math.sin(y*GCJ_PI)+40*Math.sin(y/3*GCJ_PI))*2/3;r+=(160*Math.sin(y/12*GCJ_PI)+320*Math.sin(y*GCJ_PI/30))*2/3;return r;}
function transformLng(x,y){let r=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*GCJ_PI)+20*Math.sin(2*x*GCJ_PI))*2/3;r+=(20*Math.sin(x*GCJ_PI)+40*Math.sin(x/3*GCJ_PI))*2/3;r+=(150*Math.sin(x/12*GCJ_PI)+300*Math.sin(x/30*GCJ_PI))*2/3;return r;}
function wgs84ToGcj02(lat,lng){let dLat=transformLat(lng-105,lat-35),dLng=transformLng(lng-105,lat-35);const rad=lat/180*GCJ_PI;let magic=Math.sin(rad);magic=1-GCJ_EE*magic*magic;const sqrt=Math.sqrt(magic);dLat=dLat*180/((GCJ_A*(1-GCJ_EE))/(magic*sqrt)*GCJ_PI);dLng=dLng*180/(GCJ_A/sqrt*Math.cos(rad)*GCJ_PI);return {lat:lat+dLat,lng:lng+dLng};}
function toAmapPoint(point) { return point?.coordSystem === 'gcj02' ? point : { ...point, ...wgs84ToGcj02(point.lat, point.lng), coordSystem:'gcj02' }; }

function parseLngLat(raw) {
  if (Array.isArray(raw)) { const lng=Number(raw[0]),lat=Number(raw[1]); return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null; }
  if (raw && typeof raw==='object') { const lng=Number(raw.lng??raw.longitude),lat=Number(raw.lat??raw.latitude); return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null; }
  const [lng,lat]=String(raw||'').split(',').map(Number); return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;
}
function parsePolyline(raw) {
  if (Array.isArray(raw)) return raw.map(p => ({ lng:num(p?.lng ?? p?.longitude), lat:num(p?.lat ?? p?.latitude) })).filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat));
  return String(raw || '').split(';').map(pair => { const [lng,lat] = pair.split(',').map(Number); return {lng,lat}; }).filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat));
}
function normalizeStep(step, index) {
  const navi = step?.navi || {}, cost = step?.cost || {};
  return { index, instruction:String(step?.instruction || ''), road:String(step?.road_name || step?.road || ''), orientation:String(step?.orientation || ''), distance:num(step?.step_distance ?? step?.distance), duration:num(cost?.duration ?? step?.duration), action:String(navi?.action || step?.action || ''), assistantAction:String(navi?.assistant_action || step?.assistant_action || ''), walkType:String(navi?.walk_type ?? step?.walk_type ?? ''), path:parsePolyline(step?.polyline) };
}
function normalizeAmapPath(path, routeIndex) {
  const steps = Array.isArray(path?.steps) ? path.steps.map(normalizeStep) : [];
  return { routeIndex, distance:num(path?.distance), duration:num(path?.cost?.duration ?? path?.duration) || steps.reduce((s,x)=>s+num(x.duration),0), steps };
}
function validateAmapRouteEndpoints(routes, origin, destination) {
  const directDistance=haversineMeters(origin,destination)||0;
  const tolerance=Math.max(120,Math.min(250,Math.round(directDistance*.2)));
  const diagnostics=(Array.isArray(routes)?routes:[]).map(route=>{
    const points=(route?.steps||[]).flatMap(step=>Array.isArray(step?.path)?step.path:[]);
    const first=points[0]||null,last=points[points.length-1]||null;
    const startGap=first?haversineMeters(origin,first):null,endGap=last?haversineMeters(last,destination):null;
    return {routeIndex:route?.routeIndex??0,points:points.length,startGap,endGap,valid:Boolean(first&&last&&startGap<=tolerance&&endGap<=tolerance)};
  });
  const validIndexes=new Set(diagnostics.filter(item=>item.valid).map(item=>item.routeIndex));
  return {routes:(routes||[]).filter(route=>validIndexes.has(route?.routeIndex??0)),diagnostics:{toleranceMeters:tolerance,routes:diagnostics}};
}
function retryableAmapError(info) {
  return ['UNKNOWN_ERROR','OUT_OF_SERVICE','EMPTY_ROUTE','ROUTE_ENDPOINT_MISMATCH'].includes(String(info || '').toUpperCase());
}
function safeAttempt(profile, result={}) { return { profile:profile.name, indoor:profile.isIndoor, alternativeRoute:profile.alternativeRoute, httpStatus:result.httpStatus ?? null, status:String(result.status ?? ''), info:String(result.info || ''), infocode:String(result.infocode || ''), elapsedMs:Number(result.elapsedMs || 0) }; }
function buildAmapParams(env, origin, destination, profile) {
  const params = new URLSearchParams({ key:env.AMAP_WEB_KEY, origin:`${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`, destination:`${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`, alternative_route:String(profile.alternativeRoute), show_fields:'navi,polyline,cost', isindoor:profile.isIndoor ? '1':'0', output:'json' });
  if (origin.poiId) params.set('origin_id', origin.poiId);
  if (destination.poiId) params.set('destination_id', destination.poiId);
  return params;
}
async function callAmap(env, origin, destination, profile, timeoutMs) {
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(), Math.max(500, timeoutMs)), started=Date.now();
  try {
    const response = await fetch(`${AMAP_WALKING_URL}?${buildAmapParams(env, origin, destination, profile)}`, { signal:controller.signal });
    const raw = await response.json().catch(()=>null), elapsedMs = Date.now()-started;
    if (!raw) return { ok:false, network:true, httpStatus:response.status, info:`AMap HTTP ${response.status}`, elapsedMs };
    return { ok:response.ok && String(raw.status)==='1', httpStatus:response.status, status:raw.status, info:raw.info, infocode:raw.infocode, raw, elapsedMs };
  } catch(error) {
    return { ok:false, network:true, timeout:error?.name==='AbortError', info:error?.name==='AbortError'?'REQUEST_TIMEOUT':'NETWORK_ERROR', message:error?.message || '', elapsedMs:Date.now()-started };
  } finally { clearTimeout(timer); }
}
async function amapWalkingRoute(body, env, originHeader, origin, destination) {
  if (!env.AMAP_WEB_KEY) return json({ error:'Worker chưa có secret AMAP_WEB_KEY.' }, 500, originHeader);
  origin = toAmapPoint(origin); destination = toAmapPoint(destination);
  const requestedAlt=clampInt(body?.alternativeRoute,1,3,3), wantIndoor=body?.isIndoor!==false;
  const profiles=[]; if(wantIndoor) profiles.push({name:'indoor-multi',isIndoor:true,alternativeRoute:requestedAlt});
  profiles.push({name:'outdoor-multi',isIndoor:false,alternativeRoute:requestedAlt}); if(requestedAlt!==1) profiles.push({name:'outdoor-single',isIndoor:false,alternativeRoute:1});
  const hasPoiId=Boolean(origin.poiId||destination.poiId), coordinateOrigin={...origin,poiId:''}, coordinateDestination={...destination,poiId:''};
  const attemptPlan=profiles.flatMap(profile=>[
    {profile,origin,destination,coordinateOnly:false},
    ...(hasPoiId?[{profile:{...profile,name:`${profile.name}-coordinates`},origin:coordinateOrigin,destination:coordinateDestination,coordinateOnly:true}]:[])
  ]);
  const attempts=[], deadline=Date.now()+REQUEST_BUDGET_MS; let last=null;
  for(let i=0;i<attemptPlan.length;i++){
    const item=attemptPlan[i], profile=item.profile, remaining=deadline-Date.now(); if(remaining<600) break;
    const result=await callAmap(env,item.origin,item.destination,profile,Math.min(3000,Math.max(600,Math.floor(remaining/(attemptPlan.length-i))))); last=result; attempts.push(safeAttempt(profile,result)); const attemptIndex=attempts.length-1;
    if(result.ok){
      const routes=(Array.isArray(result.raw?.route?.paths)?result.raw.route.paths:[]).map(normalizeAmapPath).filter(r=>r.steps.length||r.distance>0);
      const checked=validateAmapRouteEndpoints(routes,item.origin,item.destination);
      attempts[attemptIndex].endpointValidation=checked.diagnostics;
      if(checked.routes.length) return json({ source:'amap-route-v2', provider:'amap', origin:{lat:origin.lat,lng:origin.lng,coordSystem:'gcj02',country:body?.country||origin.country||''}, destination:{lat:destination.lat,lng:destination.lng,coordSystem:'gcj02',country:body?.country||destination.country||''}, routes:checked.routes, meta:{count:checked.routes.length,info:result.raw.info||'OK',infocode:result.raw.infocode||'',profile:profile.name,indoor:profile.isIndoor,...(item.coordinateOnly?{endpointFallback:'coordinate-only'}:{}),attempts} },200,originHeader);
      if(routes.length){last={...last,...result,ok:false,info:'ROUTE_ENDPOINT_MISMATCH'};attempts[attemptIndex].info=last.info;}
      else {last={...result,ok:false,info:'EMPTY_ROUTE'};attempts[attemptIndex].info='EMPTY_ROUTE';}
    }
    if(!(result.network||retryableAmapError(last?.info||result.info))) break;
  }
  return json({ error:`AMap Route 2.0: ${String(last?.info||'unknown error')}`, infocode:String(last?.infocode||''), attempts, diagnostic:{origin:{lat:origin.lat,lng:origin.lng},destination:{lat:destination.lat,lng:destination.lng},requestedIndoor:wantIndoor,requestedAlternativeRoute:requestedAlt} },502,originHeader);
}

function geoStepPath(routePath, fromIndex, toIndex) {
  if (!Array.isArray(routePath) || !routePath.length) return [];
  const from = clampInt(fromIndex, 0, routePath.length - 1, 0);
  const to = clampInt(toIndex, from, routePath.length - 1, from);
  return routePath.slice(from, to + 1);
}
function normalizeGeoapifyRoute(feature, routeIndex) {
  const props = feature?.properties || {};
  const geometry = feature?.geometry?.coordinates;
  const lines = Array.isArray(geometry?.[0]?.[0]) ? geometry : (Array.isArray(geometry?.[0]) ? [geometry] : []);
  const path = lines.flatMap(line => (Array.isArray(line) ? line : []).map(pair => ({ lng:Number(pair?.[0]), lat:Number(pair?.[1]) })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)));
  const steps=[];
  let pathOffset=0;
  (Array.isArray(props.legs) ? props.legs : []).forEach((leg, legIndex) => {
    const legLine = lines[legIndex] || [];
    (Array.isArray(leg?.steps) ? leg.steps : []).forEach(step => {
      const instruction = step?.instruction || {};
      const localPath = geoStepPath(legLine.map(pair => ({ lng:Number(pair?.[0]), lat:Number(pair?.[1]) })), step?.from_index, step?.to_index);
      steps.push({
        index:steps.length,
        instruction:clean(instruction?.text || instruction?.transition_instruction || '', 1000),
        road:Array.isArray(instruction?.streets) ? clean(instruction.streets.join(', '), 500) : '',
        orientation:'', distance:num(step?.distance), duration:num(step?.time),
        action:clean(instruction?.type, 100), assistantAction:'', walkType:'',
        path:localPath,
        fromIndex:pathOffset + clampInt(step?.from_index, 0, Math.max(0, legLine.length - 1), 0),
        toIndex:pathOffset + clampInt(step?.to_index, 0, Math.max(0, legLine.length - 1), 0)
      });
    });
    pathOffset += legLine.length;
  });
  return { routeIndex, distance:num(props?.distance), duration:num(props?.time), path, steps };
}
async function geoapifyWalkingRoute(body, env, originHeader, origin, destination) {
  if (!env.GEOAPIFY_API_KEY) return json({ error:'Worker chưa có secret GEOAPIFY_API_KEY.' },500,originHeader);
  const params=new URLSearchParams({
    waypoints:`${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}|${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`,
    mode:'walk', units:'metric', lang:'en', details:'instruction_details', apiKey:env.GEOAPIFY_API_KEY
  });
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),REQUEST_BUDGET_MS);
  try {
    const response=await fetch(`${GEOAPIFY_ROUTING_URL}?${params.toString()}`,{signal:controller.signal});
    const raw=await response.json().catch(()=>null);
    if(!response.ok||!raw) return json({error:raw?.message||raw?.error||`Geoapify Routing HTTP ${response.status}`,provider:'geoapify'},502,originHeader);
    const routes=(Array.isArray(raw?.features)?raw.features:[]).map(normalizeGeoapifyRoute).filter(r=>r.path.length||r.distance>0);
    if(!routes.length) return json({error:'Geoapify không trả tuyến đi bộ.',provider:'geoapify'},404,originHeader);
    const country=clean(body?.country||destination.country||origin.country,120);
    const fallbackFrom=clean(body?._fallbackFrom,80),fallbackReason=clean(body?._fallbackReason,500);
    return json({source:'geoapify-routing-v1',provider:'geoapify',origin:{lat:origin.lat,lng:origin.lng,coordSystem:'wgs84',country},destination:{lat:destination.lat,lng:destination.lng,coordSystem:'wgs84',country},routes,meta:{count:routes.length,...(fallbackFrom?{fallbackFrom,fallbackReason}: {})}},200,originHeader);
  } catch(error) {
    return json({error:error?.name==='AbortError'?'Geoapify Routing timeout.':`Không gọi được Geoapify Routing: ${clean(error?.message,300)}`,provider:'geoapify'},502,originHeader);
  } finally { clearTimeout(timer); }
}
function decodeGooglePolyline(encoded) {
  const points=[]; let index=0,lat=0,lng=0;
  while(index<String(encoded||'').length){
    let result=0,shift=0,byte;
    do{byte=encoded.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5;}while(byte>=32&&index<=encoded.length);
    lat+=(result&1)?~(result>>1):(result>>1);result=0;shift=0;
    do{byte=encoded.charCodeAt(index++)-63;result|=(byte&31)<<shift;shift+=5;}while(byte>=32&&index<=encoded.length);
    lng+=(result&1)?~(result>>1):(result>>1);points.push({lat:lat/1e5,lng:lng/1e5});
  }
  return points;
}
function durationSeconds(value){return Number(String(value||'').replace(/s$/,''))||0;}
function normalizeGoogleRoute(route, routeIndex) {
  const steps=(Array.isArray(route?.legs)?route.legs:[]).flatMap(leg=>(Array.isArray(leg?.steps)?leg.steps:[])).map((step,index)=>({
    index,instruction:clean(step?.navigationInstruction?.instructions||'',1000),road:'',orientation:'',distance:Number(step?.distanceMeters)||0,
    duration:durationSeconds(step?.staticDuration),action:clean(step?.navigationInstruction?.maneuver||'',100),assistantAction:'',walkType:'',
    path:decodeGooglePolyline(step?.polyline?.encodedPolyline)
  }));
  return {
    routeIndex,distance:Number(route?.distanceMeters)||0,duration:durationSeconds(route?.duration),
    path:decodeGooglePolyline(route?.polyline?.encodedPolyline),steps,
    warnings:Array.isArray(route?.warnings)?route.warnings.slice(0,10).map(x=>clean(x,500)):[],provider:'google_routes'
  };
}
async function googleWalkingRoute(body, env, originHeader, origin, destination) {
  if(!env.GOOGLE_MAPS_API_KEY) return geoapifyWalkingRoute({...body,_fallbackFrom:'google_routes',_fallbackReason:'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED'},env,originHeader,origin,destination);
  const payload={
    origin:{location:{latLng:{latitude:origin.lat,longitude:origin.lng}}},
    destination:{location:{latLng:{latitude:destination.lat,longitude:destination.lng}}},
    travelMode:'WALK',computeAlternativeRoutes:false,languageCode:clean(body?.language,10)||'vi-VN',units:'METRIC',
    polylineQuality:'HIGH_QUALITY',polylineEncoding:'ENCODED_POLYLINE'
  };
  const fields=['routes.duration','routes.distanceMeters','routes.polyline.encodedPolyline','routes.warnings','routes.legs.steps.distanceMeters','routes.legs.steps.staticDuration','routes.legs.steps.polyline.encodedPolyline','routes.legs.steps.navigationInstruction.instructions','routes.legs.steps.navigationInstruction.maneuver'].join(',');
  let googleError='Google Routes không trả tuyến đi bộ.';
  try{
    const result=await fetchJson(GOOGLE_ROUTES_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fields},body:JSON.stringify(payload)});
    const routes=(Array.isArray(result.data?.routes)?result.data.routes:[]).map(normalizeGoogleRoute).filter(route=>route.path.length||route.distance>0);
    if(result.ok&&routes.length){
      const country=clean(body?.country||destination.country||origin.country,120);
      return json({ok:true,source:'google-routes-v2',provider:'google_routes',origin:{lat:origin.lat,lng:origin.lng,coordSystem:'wgs84',country},destination:{lat:destination.lat,lng:destination.lng,coordSystem:'wgs84',country},routes,meta:{count:routes.length,walkingBeta:true}},200,originHeader);
    }
    googleError=clean(result.data?.error?.message||`Google Routes HTTP ${result.status}`,500);
  }catch(error){googleError=clean(error?.name==='AbortError'?'Google Routes timeout.':error?.message,500)||googleError;}
  if(env.GEOAPIFY_API_KEY) return geoapifyWalkingRoute({...body,_fallbackFrom:'google_routes',_fallbackReason:googleError},env,originHeader,origin,destination);
  return json({error:`${googleError} Geoapify fallback chưa được cấu hình.`,provider:'google_routes'},502,originHeader);
}
async function walkingRoute(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const origin=finiteCoord(body?.origin), destination=finiteCoord(body?.destination);
  if(!origin||!destination) return json({error:'origin/destination không hợp lệ.'},400,originHeader);
  const provider=providerFor(body);
  if(provider==='amap') return amapWalkingRoute(body,env,originHeader,origin,destination);
  if(provider==='geoapify') return geoapifyWalkingRoute(body,env,originHeader,origin,destination);
  return googleWalkingRoute(body,env,originHeader,origin,destination);
}

function routeMode(value) {
  const mode=clean(value,20).toLowerCase();
  if(mode==='walk'||mode==='walking') return 'walk';
  if(['electrobike','electric_bike','electric-bike','motorbike','two-wheeler'].includes(mode)) return 'electrobike';
  return 'drive';
}
async function geoapifyDirectionsRoute(body, env, originHeader, origin, destination, mode) {
  if (!env.GEOAPIFY_API_KEY) return json({ error:'Worker chưa có secret GEOAPIFY_API_KEY.' },500,originHeader);
  const params=new URLSearchParams({
    waypoints:`${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}|${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`,
    mode:mode==='drive'?'drive':'walk',units:'metric',lang:'en',details:'instruction_details',apiKey:env.GEOAPIFY_API_KEY
  });
  const result=await fetchJson(`${GEOAPIFY_ROUTING_URL}?${params.toString()}`);
  if(!result.ok||!result.data) return json({error:result.data?.message||result.data?.error||`Geoapify Routing HTTP ${result.status}`,provider:'geoapify'},502,originHeader);
  const routes=(Array.isArray(result.data?.features)?result.data.features:[]).map(normalizeGeoapifyRoute).filter(route=>route.path.length||route.distance>0);
  if(!routes.length) return json({error:`Geoapify không trả tuyến ${mode==='drive'?'lái xe':'đi bộ'}.`,provider:'geoapify'},404,originHeader);
  const country=clean(body?.country||destination.country||origin.country,120);
  return json({ok:true,source:'geoapify-routing-v1',provider:'geoapify',mode,origin:{lat:origin.lat,lng:origin.lng,coordSystem:'wgs84',country},destination:{lat:destination.lat,lng:destination.lng,coordSystem:'wgs84',country},routes,meta:{count:routes.length,fallbackFrom:clean(body?._fallbackFrom,80),fallbackReason:clean(body?._fallbackReason,500)}},200,originHeader);
}
async function amapDrivingRoute(body, env, originHeader, origin, destination) {
  if(!env.AMAP_WEB_KEY) return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
  const from=toAmapPoint(origin),to=toAmapPoint(destination);
  const params=new URLSearchParams({key:env.AMAP_WEB_KEY,origin:`${from.lng.toFixed(6)},${from.lat.toFixed(6)}`,destination:`${to.lng.toFixed(6)},${to.lat.toFixed(6)}`,strategy:'33',show_fields:'navi,cost,polyline',alternative_route:'2',output:'json'});
  if(from.poiId) params.set('origin_id',from.poiId);
  if(to.poiId) params.set('destination_id',to.poiId);
  const result=await fetchJson(`${AMAP_DRIVING_URL}?${params.toString()}`);
  const paths=Array.isArray(result.data?.route?.paths)?result.data.route.paths:[];
  if(!result.ok||String(result.data?.status)!=='1'||!paths.length) return json({error:result.data?.info||`AMap Driving HTTP ${result.status}`,provider:'amap'},502,originHeader);
  const routes=paths.map(normalizeAmapPath).filter(route=>route.steps.length||route.distance>0);
  return json({ok:true,source:'amap-driving-v5',provider:'amap',mode:'drive',origin:{lat:from.lat,lng:from.lng,coordSystem:'gcj02'},destination:{lat:to.lat,lng:to.lng,coordSystem:'gcj02'},routes,meta:{count:routes.length}},200,originHeader);
}
async function amapElectricBikeRoute(body, env, originHeader, origin, destination) {
  if(!env.AMAP_WEB_KEY) return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
  const from=toAmapPoint(origin),to=toAmapPoint(destination);
  const params=new URLSearchParams({key:env.AMAP_WEB_KEY,origin:`${from.lng.toFixed(6)},${from.lat.toFixed(6)}`,destination:`${to.lng.toFixed(6)},${to.lat.toFixed(6)}`,show_fields:'navi,cost,polyline',alternative_route:String(clampInt(body?.alternativeRoute,1,3,3)),output:'json'});
  const result=await fetchJson(`${AMAP_ELECTRIC_BIKE_URL}?${params.toString()}`);
  const paths=Array.isArray(result.data?.route?.paths)?result.data.route.paths:[];
  if(!result.ok||String(result.data?.status)!=='1'||!paths.length) return json({error:result.data?.info||`AMap Electric Bike HTTP ${result.status}`,provider:'amap'},502,originHeader);
  const routes=paths.map(normalizeAmapPath).filter(route=>route.steps.length||route.distance>0);
  const checked=validateAmapRouteEndpoints(routes,from,to);
  if(!checked.routes.length) return json({error:'AMap Electric Bike trả tuyến lệch điểm đầu hoặc điểm đến.',provider:'amap',diagnostic:checked.diagnostics},502,originHeader);
  return json({ok:true,source:'amap-electrobike-v5',provider:'amap',mode:'electrobike',origin:{lat:from.lat,lng:from.lng,coordSystem:'gcj02'},destination:{lat:to.lat,lng:to.lng,coordSystem:'gcj02'},routes:checked.routes,meta:{count:checked.routes.length,endpointValidation:checked.diagnostics}},200,originHeader);
}
async function googleDirectionsRoute(body, env, originHeader, origin, destination, mode) {
  if(!env.GOOGLE_MAPS_API_KEY) return geoapifyDirectionsRoute({...body,_fallbackFrom:'google_routes',_fallbackReason:'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED'},env,originHeader,origin,destination,mode);
  const driving=mode==='drive';
  const payload={
    origin:{location:{latLng:{latitude:origin.lat,longitude:origin.lng}}},
    destination:{location:{latLng:{latitude:destination.lat,longitude:destination.lng}}},
    travelMode:driving?'DRIVE':'WALK',computeAlternativeRoutes:driving,languageCode:clean(body?.language,10)||'vi-VN',units:'METRIC',
    polylineQuality:'HIGH_QUALITY',polylineEncoding:'ENCODED_POLYLINE',...(driving?{routingPreference:'TRAFFIC_AWARE'}:{})
  };
  const fields=['routes.duration','routes.staticDuration','routes.distanceMeters','routes.description','routes.polyline.encodedPolyline','routes.warnings','routes.legs.steps.distanceMeters','routes.legs.steps.staticDuration','routes.legs.steps.polyline.encodedPolyline','routes.legs.steps.navigationInstruction.instructions','routes.legs.steps.navigationInstruction.maneuver'].join(',');
  const result=await fetchJson(GOOGLE_ROUTES_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fields},body:JSON.stringify(payload)});
  const routes=(Array.isArray(result.data?.routes)?result.data.routes:[]).map(normalizeGoogleRoute).filter(route=>route.path.length||route.distance>0).map(route=>({...route,staticDuration:durationSeconds(result.data?.routes?.[route.routeIndex]?.staticDuration),description:clean(result.data?.routes?.[route.routeIndex]?.description,500)}));
  if(result.ok&&routes.length){
    const country=clean(body?.country||destination.country||origin.country,120);
    return json({ok:true,source:'google-routes-v2',provider:'google_routes',mode,origin:{lat:origin.lat,lng:origin.lng,coordSystem:'wgs84',country},destination:{lat:destination.lat,lng:destination.lng,coordSystem:'wgs84',country},routes,meta:{count:routes.length,trafficAware:driving,walkingBeta:!driving}},200,originHeader);
  }
  const reason=clean(result.data?.error?.message||`Google Routes HTTP ${result.status}`,500);
  if(env.GEOAPIFY_API_KEY) return geoapifyDirectionsRoute({...body,_fallbackFrom:'google_routes',_fallbackReason:reason},env,originHeader,origin,destination,mode);
  return json({error:reason,provider:'google_routes'},502,originHeader);
}
async function directionsRoute(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const origin=finiteCoord(body?.origin),destination=finiteCoord(body?.destination),mode=routeMode(body?.mode);
  if(!origin||!destination) return json({error:'origin/destination không hợp lệ.'},400,originHeader);
  const provider=providerFor(body);
  if(provider==='amap') {
    if(mode==='walk') return amapWalkingRoute(body,env,originHeader,origin,destination);
    if(mode==='electrobike') return amapElectricBikeRoute(body,env,originHeader,origin,destination);
    return amapDrivingRoute(body,env,originHeader,origin,destination);
  }
  const globalMode=mode==='walk'?'walk':'drive';
  if(provider==='geoapify') return geoapifyDirectionsRoute(body,env,originHeader,origin,destination,globalMode);
  return googleDirectionsRoute(body,env,originHeader,origin,destination,globalMode);
}

const SEARCH_RULES=[
  {aliases:['pharmacy','drugstore','nha thuoc','hieu thuoc','tiem thuoc','mua thuoc'],geo:['healthcare.pharmacy','commercial.health_and_beauty.pharmacy','commercial.chemist'],google:'pharmacy',amap:'药店',amapVariants:['药房','大药房']},
  {aliases:['hospital','benh vien','cap cuu'],geo:['healthcare.hospital'],google:'hospital',amap:'医院',amapVariants:['人民医院','急救中心']},
  {aliases:['clinic','phong kham','doctor','bac si'],geo:['healthcare.clinic_or_praxis'],google:'doctor',amap:'诊所',amapVariants:['门诊部','卫生服务中心']},
  {aliases:['convenience store','cua hang tien loi','chtl','minimart','mini mart'],geo:['commercial.convenience'],google:'convenience_store',amap:'便利店',amapVariants:['小卖部','副食店','杂货店']},
  {aliases:['grocery','tap hoa','cua hang tap hoa'],geo:['commercial.food_and_drink'],google:'grocery_store',amap:'便利店',amapVariants:['杂货店','副食店','小卖部','超市']},
  {aliases:['supermarket','sieu thi'],geo:['commercial.supermarket'],google:'supermarket',amap:'超市',amapVariants:['生活超市','生鲜超市','便利店']},
  {aliases:['atm','rut tien'],geo:['service.financial.atm'],google:'atm',amap:'ATM',amapVariants:['自动取款机','自助银行']},
  {aliases:['bank','ngan hang'],geo:['service.financial.bank'],google:'bank',amap:'银行',amapVariants:['银行营业厅']},
  {aliases:['gas station','petrol','tram xang','cay xang','do xang','fuel'],geo:['service.vehicle.fuel'],google:'gas_station',amap:'加油站',amapVariants:['加气站','充电站']},
  {aliases:['police','cong an'],geo:['service.police'],google:'police',amap:'派出所',amapVariants:['公安局','警务室']},
  {aliases:['fire station','cuu hoa'],geo:['service.fire_station'],google:'fire_station',amap:'消防站',amapVariants:['消防救援站']},
  {aliases:['restaurant','quan an','an uong'],geo:['catering.restaurant','catering.fast_food','catering.food_court'],google:'restaurant',amap:'餐厅',amapVariants:['饭店','餐馆','小吃店']},
  {aliases:['cafe','coffee','quan cafe'],geo:['catering.cafe'],google:'cafe',amap:'咖啡店',amapVariants:['咖啡馆']},
  {aliases:['hotel','khach san'],geo:['accommodation.hotel','accommodation.guest_house'],google:'hotel',amap:'酒店',amapVariants:['宾馆','旅馆','民宿']},
  {aliases:['tourist_attraction','attraction','diem tham quan','diem vui choi','dia diem du lich','gi choi','tham quan','check in','checkin','danh lam'],geo:['tourism.attraction','entertainment'],google:'tourist_attraction',amap:'旅游景点',amapVariants:['景区','名胜古迹','观景台']},
  {aliases:['park','cong vien','vuon hoa'],geo:['leisure.park','leisure.garden'],google:'park',amap:'公园',amapVariants:['城市公园','广场','植物园']},
  {aliases:['museum','bao tang'],geo:['entertainment.museum'],google:'museum',amap:'博物馆',amapVariants:['纪念馆','展览馆','美术馆']},
  {aliases:['shopping_mall','mall','trung tam thuong mai','tttm','mua sam'],geo:['commercial.shopping_mall'],google:'shopping_mall',amap:'购物中心',amapVariants:['商场','购物广场','商业街']},
  {aliases:['subway_station','metro station','ga metro','ga tau dien','tau dien ngam'],geo:['public_transport.subway'],google:'subway_station',amap:'地铁站',amapVariants:['轨道交通站','轻轨站']},
  {aliases:['bus_stop','bus station','tram xe buyt','ben xe buyt'],geo:['public_transport.bus'],google:'bus_station',amap:'公交站',amapVariants:['公交车站','汽车站']},
  {aliases:['public_restroom','public bathroom','nha ve sinh','toilet','wc'],geo:['service.public_toilet'],google:'public_bathroom',amap:'公共厕所',amapVariants:['公厕','卫生间','洗手间']},
  {aliases:['bar','pub','quan bar','quan ruou','nightlife'],geo:['catering.bar'],google:'bar',amap:'酒吧',amapVariants:['清吧','精酿啤酒','夜店']},
  {aliases:['parking','bai do xe','giu xe'],geo:['parking'],google:'parking',amap:'停车场',amapVariants:['停车库','停车位']}
];
const SEARCH_EXPANSIONS=[
  {
    aliases:['ga ran','fried chicken','fried-chicken'],
    query:'fried chicken KFC Jollibee Chicken Plus Lotteria Popeyes Texas Chicken'
  }
];
const AMAP_TYPE_EVIDENCE={
  pharmacy:/医疗保健服务|药店|药房|大药房/u,hospital:/医疗保健服务|医院|急救/u,doctor:/诊所|门诊|卫生服务/u,
  convenience_store:/购物服务|便利店|小卖部|副食店|杂货店/u,grocery_store:/购物服务|杂货店|副食店|小卖部|超市/u,
  supermarket:/购物服务|超市|生鲜/u,restaurant:/餐饮服务|餐厅|饭店|餐馆|小吃/u,cafe:/餐饮服务|咖啡/u,
  hotel:/住宿服务|宾馆|酒店|旅馆|民宿/u,tourist_attraction:/风景名胜|旅游景点|景区|名胜古迹|观景台/u,
  park:/公园|园林|广场|植物园/u,museum:/博物馆|纪念馆|展览馆|美术馆/u,shopping_mall:/购物服务|购物中心|商场|购物广场/u
};
function categoryInfo(keyword, category='', name='') {
  const q=fold(`${category} ${keyword}`);
  for(const rule of SEARCH_RULES) if(rule.aliases.some(x=>q.includes(fold(x)))) {
    return {geoCategories:rule.geo,googleType:rule.google,amapKeyword:clean(name,120)||rule.amap,amapVariants:clean(name,120)?[]:(rule.amapVariants||[]),name:clean(name,120)};
  }
  const freeText=clean(name||keyword,120);
  return {geoCategories:['commercial','service','healthcare','catering','tourism','entertainment','accommodation'],googleType:'',amapKeyword:freeText,amapVariants:[],name:freeText};
}
function expandedSearchQuery(value='') {
  const q=fold(value);
  return SEARCH_EXPANSIONS.find(rule=>rule.aliases.some(alias=>q.includes(alias)))?.query||'';
}
function uniqueSearchQueries(...values) {
  const seen=new Set(),queries=[];
  values.flat().forEach(value=>{const query=clean(value,300),key=fold(query);if(!query||!key||seen.has(key))return;seen.add(key);queries.push(query);});
  return queries.slice(0,8);
}
function normalizeAmapPoi(poi, center, country) {
  const point=parseLngLat(poi?.location); if(!point) return null; const {lng,lat}=point;
  const business=poi?.business&&typeof poi.business==='object'?poi.business:{};
  const businessStatus=clean(business?.business_status||business?.status,100),statusKey=fold(businessStatus);
  const openNow=/营业中|正常营业|open/.test(statusKey)?true:(/休息中|暂停营业|已关闭|closed/.test(statusKey)?false:null);
  return {id:clean(poi?.id,160),poiId:clean(poi?.id,160),name:clean(poi?.name,300),address:clean(poi?.address,1000),lat,lng,distance:num(poi?.distance)||haversineMeters(center,{lat,lng}),type:clean(poi?.type,500),typecode:clean(poi?.typecode,100),city:clean(poi?.cityname,200),district:clean(poi?.adname,200),province:clean(poi?.pname,200),phone:clean(business?.tel||poi?.tel,300),openNow,openTime:clean(business?.opentime_today,500),businessStatus,rating:clean(business?.rating,50),tag:clean(business?.tag,500),cost:clean(business?.cost,80),businessArea:clean(business?.business_area,200),alias:clean(business?.alias,300),coordSystem:'gcj02',provider:'amap',country:clean(country,120)};
}
async function amapNearby(body, env, originHeader, center, keyword, types, radius, limit, candidateLimit, country) {
  if(!env.AMAP_WEB_KEY) return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
  const queryCenter=toAmapPoint(center),info=categoryInfo(keyword,body?.category,body?.name),specificChineseFood=/[\u3400-\u9fff]/.test(keyword)&&['restaurant','cafe'].includes(clean(body?.category,80).toLowerCase()),mappedKeyword=clean(info.amapKeyword,300),useMappedKeyword=!specificChineseFood&&mappedKeyword&&mappedKeyword!==clean(keyword,300),namedQueries=info.name?amapQueryVariants(info.name):[],amapQueries=info.name?uniqueSearchQueries(namedQueries,body?.queryVariants):useMappedKeyword?uniqueSearchQueries(mappedKeyword,info.amapVariants,body?.queryVariants):uniqueSearchQueries(keyword,body?.queryVariants,specificChineseFood?'':mappedKeyword,info.amapVariants),amapKeyword=amapQueries.join('|').slice(0,120);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const requestKeywords=info.name?amapQueries.slice(0,4):amapQueries.slice(0,3);
    const requests=requestKeywords.flatMap(query=>info.name?[{query,radius,page:1}]:[{query,radius:Math.min(radius,700),page:1},{query,radius,page:1},{query,radius,page:2}]);
    const attempts=await Promise.all(requests.map(async ({query,radius:searchRadius,page})=>{
      const params=new URLSearchParams({key:env.AMAP_WEB_KEY,location:`${queryCenter.lng.toFixed(6)},${queryCenter.lat.toFixed(6)}`,radius:String(searchRadius),output:'json',page_size:String(Math.min(25,candidateLimit)),page_num:String(page),sortrule:'distance',show_fields:'business,navi'});
      if(query)params.set('keywords',query);if(types)params.set('types',types);
      try{
        const response=await fetch(`${AMAP_NEARBY_URL}?${params}`,{signal:controller.signal}),raw=await response.json().catch(()=>null);
        return {query,searchRadius,page,ok:response.ok&&String(raw?.status)==='1',status:response.status,raw,error:!response.ok?`HTTP ${response.status}`:String(raw?.status)==='1'?'':clean(raw?.info||'unknown error',200)};
      }catch(error){return {query,searchRadius,page,ok:false,status:0,raw:null,error:clean(error?.message,200)};}
    }));
    const successful=attempts.filter(item=>item.ok);
    if(!successful.length){
      const first=attempts[0]||{};
      return json({error:`AMap Nearby: ${first.error||'unknown error'}`,infocode:first.raw?.infocode||'',provider:'amap'},502,originHeader);
    }
    const unique=new Map();
    for(const attempt of successful)for(const rawPoi of Array.isArray(attempt.raw?.pois)?attempt.raw.pois:[]){
      const poi=normalizeAmapPoi(rawPoi,queryCenter,country),key=clean(poi?.id,200)||`${poi?.lat},${poi?.lng},${fold(poi?.name)}`;
      if(poi&&!unique.has(key))unique.set(key,poi);
    }
    const sortBy=clean(body?.sortBy,30).toLowerCase(),normalized=[...unique.values()];
    let ranked=info.name?rankNamedPlaces(normalized,amapQueries):normalized.sort((a,b)=>sortBy==='rating'?(Number(b.rating)||0)-(Number(a.rating)||0)||(a.distance??Infinity)-(b.distance??Infinity):(a.distance??Infinity)-(b.distance??Infinity));
    const categoryEvidence=AMAP_TYPE_EVIDENCE[info.googleType];
    if(info.name&&categoryEvidence){
      // A restaurant inside a hotel often contains “酒店” in its name. Use
      // AMap's category/tag evidence instead of the display name so it cannot
      // replace the requested hotel itself.
      const categoryMatches=ranked.filter(place=>categoryEvidence.test(`${place.type} ${place.tag}`));
      if(categoryMatches.length)ranked=categoryMatches;
    }
    const pois=ranked.slice(0,limit);
    return json({ok:true,source:'amap-place-v5',provider:'amap',query:{keyword:info.name?requestKeywords[0]:amapKeyword,keywords:amapQueries,category:clean(body?.category,80),name:clean(body?.name,120),sortBy:info.name?'name_similarity':sortBy,types,radius,limit,candidateLimit},center:{lat:center.lat,lng:center.lng,coordSystem:'wgs84',country},count:pois.length,pois,candidates:ranked.slice(0,50),meta:{info:'OK',infocode:'10000',total:normalized.length,coverageLimited:attempts.some(item=>Array.isArray(item.raw?.pois)&&item.raw.pois.length>=Math.min(25,candidateLimit)),attempts:attempts.map(item=>({query:item.query,radius:item.searchRadius,page:item.page,ok:item.ok,count:Array.isArray(item.raw?.pois)?item.raw.pois.length:0,error:item.error}))}},200,originHeader);
  }catch(error){return json({error:error?.name==='AbortError'?'AMap Nearby timeout.':`Không gọi được AMap Nearby: ${clean(error?.message,300)}`,provider:'amap'},502,originHeader);}finally{clearTimeout(timer);}
}
function normalizeGeoapifyPoi(feature, center, country) {
  const p=feature?.properties||{}, g=feature?.geometry?.coordinates||[];
  const lng=Number(p?.lon ?? g?.[0]), lat=Number(p?.lat ?? g?.[1]);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  const categories=Array.isArray(p?.categories)?p.categories:[];
  const raw=p?.datasource?.raw||{}, contact=p?.contact||{};
  return {
    id:clean(p?.place_id||p?.datasource?.raw?.osm_id||`${lat},${lng}`,200), poiId:clean(p?.place_id||'',200),
    name:clean(p?.name||p?.address_line1||p?.formatted||'POI',300), address:clean(p?.formatted||[p?.address_line1,p?.address_line2].filter(Boolean).join(', '),1000),
    lat,lng,distance:num(p?.distance)||haversineMeters(center,{lat,lng}), type:clean(categories[0]||'',200), types:categories.slice(0,12),
    city:clean(p?.city||p?.county||'',200), district:clean(p?.district||p?.suburb||'',200), province:clean(p?.state||'',200),
    phone:clean(contact?.phone||raw?.phone||'',300), openTime:clean(raw?.opening_hours||'',500), rating:'', businessStatus:'',
    coordSystem:'wgs84',provider:'geoapify',country:clean(country||p?.country,120)
  };
}
async function geoapifyNearby(body, env, originHeader, center, keyword, radius, limit, candidateLimit, country) {
  if(!env.GEOAPIFY_API_KEY) return json({error:'Worker chưa có secret GEOAPIFY_API_KEY.',provider:'geoapify'},500,originHeader);
  const info=categoryInfo(keyword,body?.category,body?.name), params=new URLSearchParams({
    categories:info.geoCategories.join(','),
    filter:`circle:${center.lng.toFixed(6)},${center.lat.toFixed(6)},${radius}`,
    bias:`proximity:${center.lng.toFixed(6)},${center.lat.toFixed(6)}`,
    limit:String(candidateLimit), lang:clean(body?.language,10)||'vi', apiKey:env.GEOAPIFY_API_KEY
  });
  if(info.name) params.set('name',info.name);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(`${GEOAPIFY_PLACES_URL}?${params.toString()}`,{signal:controller.signal});
    const raw=await response.json().catch(()=>null);
    if(!response.ok||!raw) return json({error:raw?.message||raw?.error||`Geoapify Places HTTP ${response.status}`,provider:'geoapify'},502,originHeader);
    const normalized=(Array.isArray(raw?.features)?raw.features:[]).map(p=>normalizeGeoapifyPoi(p,center,country)).filter(Boolean),pois=(info.name?rankNamedPlaces(normalized,[info.name]):normalized.sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity))).slice(0,limit);
    if(!pois.length&&env.GOOGLE_MAPS_API_KEY){
      const fallback=await googleTextPlaces({query:clean(body?.name||body?.query||keyword,300),center,radius,limit,language:body?.language,country},env);
      if(fallback.ok&&fallback.places.length) return json({ok:true,source:'google-places-text-v1',provider:'google_places',query:{keyword,name:info.name,categories:info.geoCategories,radius,limit,fallbackFrom:'geoapify'},center:{lat:center.lat,lng:center.lng,coordSystem:'wgs84',country},count:fallback.places.length,pois:fallback.places,meta:{fallback:true}},200,originHeader);
    }
    return json({ok:true,source:'geoapify-places-v2',provider:'geoapify',query:{keyword,name:info.name,categories:info.geoCategories,radius,limit,candidateLimit},center:{lat:center.lat,lng:center.lng,coordSystem:'wgs84',country},count:pois.length,pois,meta:{total:Array.isArray(raw?.features)?raw.features.length:pois.length}},200,originHeader);
  }catch(error){return json({error:error?.name==='AbortError'?'Geoapify Places timeout.':`Geoapify Places: ${clean(error?.message,500)}`,provider:'geoapify'},502,originHeader);}finally{clearTimeout(timer);}
}
async function nearbySearch(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const center=finiteCoord(body?.center||body?.location); if(!center) return json({error:'center/location không hợp lệ.'},400,originHeader);
  const name=clean(body?.name,120),keyword=clean(body?.keyword||body?.keywords||body?.query||name,100),types=clean(body?.types,300); if(!keyword&&!types&&!name) return json({error:'Cần keyword, name hoặc types để search nearby.'},400,originHeader);
  const radius=clampInt(body?.radius,100,50000,3000),limit=clampInt(body?.limit,1,20,8),candidateLimit=clampInt(body?.candidateLimit,limit,50,Math.max(20,limit*4)),country=clean(body?.country||center.country,120);
  const normalizedBody={...body,name};
  const provider=providerFor(body);
  if(provider==='amap') return amapNearby(normalizedBody,env,originHeader,center,keyword,types,radius,limit,Math.min(25,candidateLimit),'Trung Quốc');
  if(provider==='geoapify') return geoapifyNearby(normalizedBody,env,originHeader,center,keyword,radius,limit,candidateLimit,country);
  return googleNearby(normalizedBody,env,originHeader,center,keyword,radius,limit,candidateLimit,country);
}

async function fetchJson(url, init = {}, timeoutMs = 9000) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(url,{...init,signal:controller.signal});
    const data=await response.json().catch(()=>null);
    return {ok:response.ok,status:response.status,data};
  } finally { clearTimeout(timer); }
}

function amapQueryVariants(value) {
  const original=clean(value,300),coreName=original
    .replace(/^(?:(?:khách\s*sạn|khach\s*san|hotel|nhà\s*hàng|nha\s*hang|restaurant|quán\s*ăn|quan\s*an|quán|quan|tiệm|tiem|cửa\s*hàng|cua\s*hang|nhà\s*thuốc|nha\s*thuoc|pharmacy)\s+)+/i,'')
    .trim()||original;
  const translated=coreName
    .replace(/Raffles?\s*City/gi,'重庆来福士广场')
    .replace(/(?:ga\s*)?Chaotianmen/gi,'朝天门')
    .replace(/Trùng\s*Khánh|Chongqing/gi,'重庆')
    .replace(/Bắc\s*Kinh|Beijing/gi,'北京')
    .replace(/Thượng\s*Hải|Shanghai/gi,'上海')
    .replace(/Quảng\s*Châu|Guangzhou/gi,'广州')
    .replace(/Thâm\s*Quyến|Shenzhen/gi,'深圳')
    .replace(/Thành\s*Đô|Chengdu/gi,'成都')
    .replace(/Tây\s*An|Xi'?an/gi,'西安')
    .replace(/Hàng\s*Châu|Hangzhou/gi,'杭州')
    .replace(/Nam\s*Kinh|Nanjing/gi,'南京')
    .replace(/Tô\s*Châu|Suzhou/gi,'苏州')
    .replace(/Vũ\s*Hán|Wuhan/gi,'武汉')
    .trim();
  const aliases=[];
  if(/\byitel\b|和颐/iu.test(coreName))aliases.push('Yitel','和颐酒店','和颐至尚酒店');
  if(/\b(?:le duong nhan dan|people s auditorium)\b/.test(fold(coreName))||/人民大礼堂/u.test(coreName))aliases.push('重庆市人民大礼堂','重庆人民大礼堂','人民大礼堂');
  return uniqueSearchQueries(translated,coreName,aliases,original);
}

async function amapResolve(body, env, originHeader, query, center) {
  if(!env.AMAP_WEB_KEY)return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
  const limit=clampInt(body?.limit,1,10,5),queryCenter=center?toAmapPoint(center):null,queries=amapQueryVariants(query);
  let lastError='AMap không trả địa điểm phù hợp.';
  for(const keyword of queries){
    const params=new URLSearchParams({key:env.AMAP_WEB_KEY,keywords:keyword,page_size:String(limit),page_num:'1',show_fields:'business,navi',output:'json'});
    if(queryCenter){params.set('location',`${queryCenter.lng.toFixed(6)},${queryCenter.lat.toFixed(6)}`);params.set('sortrule','distance');}
    const result=await fetchJson(`${AMAP_TEXT_SEARCH_URL}?${params.toString()}`);
    if(!result.ok||String(result.data?.status)!=='1'){lastError=clean(result.data?.info||`AMap Place Text HTTP ${result.status}`,500);continue;}
    const places=(Array.isArray(result.data?.pois)?result.data.pois:[]).map(item=>normalizeAmapPoi(item,queryCenter,'Trung Quốc')).filter(Boolean).slice(0,limit);
    if(places.length)return json({ok:true,source:'amap-place-text-v5',provider:'amap',query,places,meta:{resolvedQuery:keyword,infocode:clean(result.data?.infocode,40)}},200,originHeader);
  }
  return json({error:lastError,provider:'amap'},404,originHeader);
}

async function amapGeocode(body, env, originHeader, query) {
  if(!env.AMAP_WEB_KEY)return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
  const resolvedQuery=amapQueryVariants(query)[0]||query,params=new URLSearchParams({key:env.AMAP_WEB_KEY,address:resolvedQuery,output:'json'}),result=await fetchJson(`${AMAP_GEOCODING_URL}?${params.toString()}`);
  if(!result.ok||String(result.data?.status)!=='1')return json({error:clean(result.data?.info||`AMap Geocoding HTTP ${result.status}`,500),provider:'amap'},502,originHeader);
  const places=(Array.isArray(result.data?.geocodes)?result.data.geocodes:[]).map((item,index)=>{
    const point=parseLngLat(item?.location);if(!point)return null;
    return {id:`amap-geocode-${index}-${point.lat.toFixed(6)},${point.lng.toFixed(6)}`,poiId:'',name:query,address:clean(item?.formatted_address||query,1000),lat:point.lat,lng:point.lng,
      city:clean(item?.city,200),district:clean(item?.district,200),province:clean(item?.province,200),country:'Trung Quốc',provider:'amap',coordSystem:'gcj02',resultType:clean(item?.level,100)};
  }).filter(Boolean).slice(0,clampInt(body?.limit,1,10,5));
  return places.length?json({ok:true,source:'amap-geocoding-v3',provider:'amap',query,places,meta:{resolvedQuery}},200,originHeader):json({error:'AMap không geocode được địa danh này.',provider:'amap'},404,originHeader);
}

async function geoapifyResolve(body, env, originHeader, query, center) {
  if(!env.GEOAPIFY_API_KEY)return json({error:'Geoapify geocoding chưa được cấu hình.',provider:'geoapify'},502,originHeader);
  const params=new URLSearchParams({text:query,format:'json',limit:String(clampInt(body?.limit,1,10,5)),lang:clean(body?.language,10)||'vi',apiKey:env.GEOAPIFY_API_KEY});
  if(center)params.set('bias',`proximity:${center.lng.toFixed(6)},${center.lat.toFixed(6)}`);
  const result=await fetchJson(`${GEOAPIFY_GEOCODING_URL}?${params.toString()}`);
  if(!result.ok||!Array.isArray(result.data?.results))return json({error:result.data?.message||`Geoapify Geocoding HTTP ${result.status}`,provider:'geoapify'},502,originHeader);
  const queryKey=fold(query),rank={city:0,state:1,county:2,district:3,suburb:4,amenity:6,building:7};
  const places=result.data.results.map(item=>({
    id:clean(item?.place_id,200),poiId:clean(item?.place_id,200),name:clean(item?.name||item?.city||item?.address_line1||item?.formatted,300),address:clean(item?.formatted,1000),
    lat:Number(item?.lat),lng:Number(item?.lon),distance:center?haversineMeters(center,{lat:Number(item?.lat),lng:Number(item?.lon)}):null,
    city:clean(item?.city||item?.county,200),district:clean(item?.district||item?.suburb,200),province:clean(item?.state,200),country:clean(item?.country,120),
    provider:'geoapify',coordSystem:'wgs84',resultType:clean(item?.result_type,100)
  })).filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lng)).sort((a,b)=>{
    const aExact=[a.name,a.city,a.province].some(value=>fold(value)===queryKey),bExact=[b.name,b.city,b.province].some(value=>fold(value)===queryKey);
    return Number(bExact)-Number(aExact)+(rank[a.resultType]??5)-(rank[b.resultType]??5);
  }).slice(0,clampInt(body?.limit,1,10,5));
  return places.length?json({ok:true,source:'geoapify-geocoding-v1',provider:'geoapify',query,places},200,originHeader):json({error:'Geoapify không geocode được địa danh này.',provider:'geoapify'},404,originHeader);
}

async function amapPlaceDetails(body, env, originHeader) {
  if(!env.AMAP_WEB_KEY)return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
  const id=clean(body?.placeId||body?.id,200),center=finiteCoord(body?.center||body?.location);
  if(!id){
    const query=clean(body?.query||[body?.name,body?.address].filter(Boolean).join(' '),300);
    if(!query)return json({error:'AMap details cần placeId hoặc query/name.',provider:'amap'},400,originHeader);
    return amapResolve({...body,limit:1},env,originHeader,query,center);
  }
  const params=new URLSearchParams({key:env.AMAP_WEB_KEY,id,show_fields:'business,navi',output:'json'}),result=await fetchJson(`${AMAP_PLACE_DETAIL_URL}?${params.toString()}`);
  if(!result.ok||String(result.data?.status)!=='1')return json({error:result.data?.info||`AMap Place Detail HTTP ${result.status}`,provider:'amap'},502,originHeader);
  const place=(Array.isArray(result.data?.pois)?result.data.pois:[]).map(item=>normalizeAmapPoi(item,center?toAmapPoint(center):null,'Trung Quốc')).find(Boolean)||null;
  return json({ok:Boolean(place),source:'amap-place-detail-v5',provider:'amap',place,places:place?[place]:[]},place?200:404,originHeader);
}

async function resolvePlace(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const query=clean(body?.query||body?.name,300),center=finiteCoord(body?.center||body?.location);
  if(!query) return json({error:'query là bắt buộc.'},400,originHeader);
  const provider=providerFor(body),geocodeMode=clean(body?.resolveMode,30)==='geocode';
  if(provider==='amap')return geocodeMode?amapGeocode(body,env,originHeader,query):amapResolve(body,env,originHeader,query,center);
  if(geocodeMode&&env.GEOAPIFY_API_KEY)return geoapifyResolve(body,env,originHeader,query,center);
  if(env.GOOGLE_MAPS_API_KEY){
    const google=await googleTextPlaces({query,center,radius:body?.radius||10000,limit:clampInt(body?.limit,1,10,5),language:body?.language,country:body?.country},env);
    if(google.ok&&google.places.length) return json({ok:true,source:'google-places-text-v1',provider:'google_places',query,places:google.places},200,originHeader);
  }
  if(!env.GEOAPIFY_API_KEY)return json({error:'Google Places không có kết quả và Geoapify fallback chưa được cấu hình.',provider:'google_places'},502,originHeader);
  return geoapifyResolve(body,env,originHeader,query,center);
}

function normalizeGooglePlace(place, center, country) {
  const lat=Number(place?.location?.latitude),lng=Number(place?.location?.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  const reviews=(Array.isArray(place?.reviews)?place.reviews:[]).slice(0,5).map(review=>({
    rating:Number(review?.rating)||null,text:clean(review?.text?.text,1000),relativeTime:clean(review?.relativePublishTimeDescription,120),publishTime:clean(review?.publishTime,80),author:clean(review?.authorAttribution?.displayName,200)
  }));
  const todayOpening=openingHoursForToday(place);
  return {
    id:clean(place?.id,200),poiId:clean(place?.id,200),name:clean(place?.displayName?.text,300),address:clean(place?.formattedAddress,1000),lat,lng,
    distance:center?haversineMeters(center,{lat,lng}):null,phone:clean(place?.nationalPhoneNumber||place?.internationalPhoneNumber,300),website:clean(place?.websiteUri,1000),
    openNow:typeof place?.currentOpeningHours?.openNow==='boolean'?place.currentOpeningHours.openNow:null,
    openTime:todayOpening,
    businessStatus:clean(place?.businessStatus,80),rating:Number(place?.rating)||null,userRatingCount:Number(place?.userRatingCount)||0,reviews,
    primaryType:clean(place?.primaryType,120),types:Array.isArray(place?.types)?place.types.slice(0,20).map(type=>clean(type,120)).filter(Boolean):[],
    provider:'google_places',coordSystem:'wgs84',country:clean(country,120)
  };
}

function matchesRequestedCategory(place, googleType) {
  if(googleType!=='convenience_store') return true;
  const types=new Set([place?.primaryType,...(place?.types||[])].map(value=>clean(value,120).toLowerCase()));
  const excluded=['electronics_store','cell_phone_store','mobile_phone_store','computer_store','home_goods_store','clothing_store'];
  if(excluded.some(type=>types.has(type))) return false;
  return types.has('convenience_store')||types.has('grocery_store')||types.has('food_store')||types.has('market')||types.has('store');
}

function restrictionRectangle(center, radius) {
  const meters=Math.min(50000,Math.max(100,Number(radius)||3000));
  const latDelta=meters/111320,cosine=Math.max(.2,Math.cos(center.lat*Math.PI/180)),lngDelta=meters/(111320*cosine);
  return {low:{latitude:Math.max(-90,center.lat-latDelta),longitude:Math.max(-180,center.lng-lngDelta)},high:{latitude:Math.min(90,center.lat+latDelta),longitude:Math.min(180,center.lng+lngDelta)}};
}

function mergeGooglePlaces(...groups) {
  const merged=new Map();
  groups.flat().forEach(place=>{
    if(!place)return;const key=place.id||`${fold(place.name)}:${Number(place.lat).toFixed(5)},${Number(place.lng).toFixed(5)}`,previous=merged.get(key);
    if(!previous){merged.set(key,place);return;}
    merged.set(key,{...previous,...place,types:[...new Set([...(previous.types||[]),...(place.types||[])])],reviews:(place.reviews||[]).length?place.reviews:previous.reviews});
  });
  return [...merged.values()];
}

function trustedRating(place) {
  const rating=Number(place?.rating)||0,count=Math.max(0,Number(place?.userRatingCount)||0),prior=4,weight=50;
  return rating>0?(count/(count+weight))*rating+(weight/(count+weight))*prior:0;
}

function openingHoursForToday(place) {
  const offset=Number(place?.utcOffsetMinutes),localNow=new Date(Date.now()+(Number.isFinite(offset)?offset:0)*60000),today=localNow.getUTCDay();
  const periods=Array.isArray(place?.currentOpeningHours?.periods)?place.currentOpeningHours.periods:[];
  const pad=value=>String(Math.max(0,Number(value)||0)).padStart(2,'0');
  const clock=point=>`${pad(point?.hour)}:${pad(point?.minute)}`;
  const ranges=[];
  periods.forEach(period=>{
    const open=period?.open,close=period?.close;
    if(Number(open?.day)===today){
      if(!close) ranges.push('Mở cửa 24 giờ');
      else ranges.push(`${clock(open)}–${clock(close)}`);
    }else if(close&&Number(close?.day)===today){
      ranges.push(`00:00–${clock(close)}`);
    }
  });
  const unique=[...new Set(ranges)];
  if(unique.length) return `Hôm nay: ${unique.join(', ')}`;
  if(place?.currentOpeningHours?.openNow===true) return 'Hôm nay: Đang mở cửa';
  if(place?.currentOpeningHours?.openNow===false) return 'Hôm nay: Đóng cửa';
  return '';
}

async function googleTextPlaces(options, env) {
  if(!env.GOOGLE_MAPS_API_KEY) return {ok:false,error:'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED',places:[]};
  const center=finiteCoord(options?.center),query=clean(options?.query,300);
  if(!query) return {ok:false,error:'EMPTY_QUERY',places:[]};
  const payload={textQuery:query,languageCode:clean(options?.language,10)||'vi',pageSize:clampInt(options?.limit,1,20,8)};
  if(center){
    if(options?.restrictArea) payload.locationRestriction={rectangle:restrictionRectangle(center,options?.radius)};
    else payload.locationBias={circle:{center:{latitude:center.lat,longitude:center.lng},radius:Math.min(50000,Math.max(100,Number(options?.radius)||3000))}};
  }
  const fieldMask=['places.id','places.displayName','places.formattedAddress','places.location','places.currentOpeningHours','places.utcOffsetMinutes','places.businessStatus','places.rating','places.userRatingCount','places.nationalPhoneNumber','places.internationalPhoneNumber','places.websiteUri','places.reviews','places.primaryType','places.types','nextPageToken'].join(',');
  const pages=[],pageLimit=options?.paginate?3:1;
  for(let page=0;page<pageLimit;page++){
    const result=await fetchJson(GOOGLE_TEXT_SEARCH_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fieldMask},body:JSON.stringify(payload)});
    if(!result.ok){if(!pages.length)return {ok:false,error:result.data?.error?.message||`Google Places HTTP ${result.status}`,places:[]};break;}
    pages.push(...(Array.isArray(result.data?.places)?result.data.places:[]));
    if(!result.data?.nextPageToken)break;
    payload.pageToken=result.data.nextPageToken;
  }
  const radius=Math.min(50000,Math.max(100,Number(options?.radius)||3000));
  const places=pages.map(place=>normalizeGooglePlace(place,center,options?.country)).filter(place=>place&&(!center||!options?.restrictArea||place.distance<=radius)).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity));
  return {ok:true,places};
}

async function googlePlaceById(placeId, options, env) {
  if(!env.GOOGLE_MAPS_API_KEY) return {ok:false,error:'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED',place:null};
  const id=clean(placeId,500);if(!id)return {ok:false,error:'PLACE_ID_REQUIRED',place:null};
  const fields=['id','displayName','formattedAddress','location','currentOpeningHours','utcOffsetMinutes','businessStatus','rating','userRatingCount','nationalPhoneNumber','internationalPhoneNumber','websiteUri','reviews'].join(',');
  const params=new URLSearchParams({languageCode:clean(options?.language,10)||'vi'});
  const result=await fetchJson(`${GOOGLE_PLACE_URL}/${encodeURIComponent(id)}?${params.toString()}`,{headers:{'X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fields}});
  if(!result.ok) return {ok:false,error:result.data?.error?.message||`Google Place Details HTTP ${result.status}`,place:null};
  return {ok:true,place:normalizeGooglePlace(result.data,finiteCoord(options?.center),options?.country)};
}

async function googleNearbyPlaces(options, env) {
  if(!env.GOOGLE_MAPS_API_KEY) return {ok:false,error:'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED',places:[]};
  const center=finiteCoord(options?.center),googleType=clean(options?.googleType,100);
  if(!center||!googleType) return {ok:false,error:'LOCATION_OR_TYPE_REQUIRED',places:[]};
  const payload={
    includedTypes:[googleType],maxResultCount:clampInt(options?.limit,1,20,8),rankPreference:'DISTANCE',
    locationRestriction:{circle:{center:{latitude:center.lat,longitude:center.lng},radius:Math.min(50000,Math.max(100,Number(options?.radius)||3000))}},
    languageCode:clean(options?.language,10)||'vi'
  };
  const fieldMask=['places.id','places.displayName','places.formattedAddress','places.location','places.currentOpeningHours','places.utcOffsetMinutes','places.businessStatus','places.rating','places.userRatingCount','places.nationalPhoneNumber','places.internationalPhoneNumber','places.websiteUri'].join(',');
  const result=await fetchJson(GOOGLE_NEARBY_SEARCH_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fieldMask},body:JSON.stringify(payload)});
  if(!result.ok) return {ok:false,error:result.data?.error?.message||`Google Places Nearby HTTP ${result.status}`,places:[]};
  const places=(Array.isArray(result.data?.places)?result.data.places:[]).map(place=>normalizeGooglePlace(place,center,options?.country)).filter(Boolean).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity));
  return {ok:true,places};
}

async function googleNearby(body, env, originHeader, center, keyword, radius, limit, candidateLimit, country) {
  const info=categoryInfo(keyword,body?.category,body?.name),name=clean(body?.name,120),textQuery=clean(body?.query,300);
  const expansion=!name&&textQuery?expandedSearchQuery(textQuery):'';
  const textQueries=!name?uniqueSearchQueries(textQuery,body?.queryVariants,expansion):[];
  const categoryRule=SEARCH_RULES.find(rule=>rule.google===info.googleType);
  const categoryOnlyQuery=!name&&Boolean(info.googleType)&&Boolean(categoryRule)&&categoryRule.aliases.some(alias=>fold(textQuery||keyword).includes(fold(alias)));
  let result,source;
  if(categoryOnlyQuery||(!name&&!textQuery&&info.googleType)){
    const options={googleType:info.googleType,center,limit:20,language:body?.language,country};
    const localRadius=Math.min(radius,700);
    const categoryTextQueries=uniqueSearchQueries(keyword,body?.queryVariants,info.googleType==='convenience_store'?'convenience store':'').slice(0,4);
    const [local,wide,...texts]=await Promise.all([
      googleNearbyPlaces({...options,radius:localRadius},env),
      localRadius===radius?Promise.resolve({ok:true,places:[]}):googleNearbyPlaces({...options,radius},env),
      ...categoryTextQueries.map(query=>googleTextPlaces({query,center,radius:localRadius,limit:20,language:body?.language,country,restrictArea:true,paginate:true},env))
    ]);
    const places=mergeGooglePlaces(local.places,wide.places,...texts.map(item=>item.places)).filter(place=>(place.distance??Infinity)<=radius);
    result={ok:local.ok||wide.ok||texts.some(item=>item.ok),places,error:[local.error,wide.error,...texts.map(item=>item.error)].filter(Boolean).join(' / '),coverageLimited:[local,wide,...texts].some(item=>item.places?.length>=20)};
    source='google-places-multi-pass-v1';
  }else if(textQueries.length>1){
    const options={center,radius,limit:Math.min(20,candidateLimit),language:body?.language,country,restrictArea:true};
    const searches=await Promise.all(textQueries.map(query=>googleTextPlaces({...options,query},env)));
    const places=mergeGooglePlaces(...searches.map(search=>search.places||[])).filter(place=>(place.distance??Infinity)<=radius&&matchesRequestedCategory(place,info.googleType));
    result={ok:searches.some(search=>search.ok),places,error:searches.map(search=>search.error).filter(Boolean).join(' / ')};
    source='google-places-expanded-text-v1';
  }else if(name||textQuery||!info.googleType){
    result=await googleTextPlaces({query:clean(name||textQuery||keyword,300),center,radius,limit:Math.min(20,candidateLimit),language:body?.language,country,restrictArea:true},env);
    source='google-places-text-v1';
  }else{
    result=await googleNearbyPlaces({googleType:info.googleType,center,radius,limit:Math.min(20,candidateLimit),language:body?.language,country},env);
    source='google-places-nearby-v1';
  }
  if(result.ok&&result.places.length){
    const sortBy=clean(body?.sortBy,30).toLowerCase();
    const eligible=name?result.places:result.places.filter(place=>matchesRequestedCategory(place,info.googleType));
    const ranked=name?rankNamedPlaces(eligible,[name,...(Array.isArray(body?.queryVariants)?body.queryVariants:[])])
      : eligible.slice().sort((a,b)=>sortBy==='rating'
        ? trustedRating(b)-trustedRating(a)||(Number(b.rating)||0)-(Number(a.rating)||0)||(Number(b.userRatingCount)||0)-(Number(a.userRatingCount)||0)||(a.distance??Infinity)-(b.distance??Infinity)
        : (a.distance??Infinity)-(b.distance??Infinity));
    if(ranked.length){
      const pois=ranked.slice(0,limit);
      return json({ok:true,source,provider:'google_places',query:{keyword,name,googleType:info.googleType,sortBy:name?'name_similarity':sortBy,radius,limit,candidateLimit},center:{lat:center.lat,lng:center.lng,coordSystem:'wgs84',country},count:pois.length,pois,candidates:ranked.slice(0,Math.min(50,candidateLimit)),meta:{total:eligible.length,coverageLimited:Boolean(result.coverageLimited)}},200,originHeader);
    }
  }
  if(env.GEOAPIFY_API_KEY) return geoapifyNearby(body,env,originHeader,center,keyword,radius,limit,candidateLimit,country);
  return json({error:result.error||'Google Places không trả kết quả.',provider:'google_places'},502,originHeader);
}

async function googlePlaceDetails(body, env, originHeader) {
  if(!env.GOOGLE_MAPS_API_KEY) return null;
  const center=finiteCoord(body?.center||body?.location),query=clean(body?.query||[body?.name,body?.address].filter(Boolean).join(' '),300);
  const requestedId=clean(body?.placeId||body?.id,500);
  if(requestedId){
    const direct=await googlePlaceById(requestedId,{center,language:body?.language,country:body?.country},env);
    if(direct.ok&&direct.place)return json({ok:true,source:'google-place-details-v1',provider:'google_places',query:requestedId,places:[direct.place],place:direct.place},200,originHeader);
  }
  if(!query) return json({error:'query/name là bắt buộc.'},400,originHeader);
  const result=await googleTextPlaces({query,center,radius:body?.radius,limit:5,language:body?.language,country:body?.country},env);
  if(!result.ok) return json({error:result.error,provider:'google_places'},502,originHeader);
  const places=result.places;
  let place=places[0]||null,source='google-places-text-v1';
  if(place?.id&&body?.includeReviews!==false){
    const direct=await googlePlaceById(place.id,{center,language:body?.language,country:body?.country},env);
    if(direct.ok&&direct.place){place=direct.place;source='google-place-details-v1';}
  }
  return json({ok:true,source,provider:'google_places',query,places:place?[place,...places.filter(item=>item.id!==place.id)]:places,place},200,originHeader);
}

function normalizeGoogleWeather(data, coord) {
  return {coordinates:coord,timezone:clean(data?.timeZone?.id,100),current:{
    time:clean(data?.currentTime,80),temperature:Number(data?.temperature?.degrees),apparentTemperature:Number(data?.feelsLikeTemperature?.degrees),
    precipitation:Number(data?.precipitation?.qpf?.quantity)||0,precipitationProbability:Number(data?.precipitation?.probability?.percent)||0,
    windSpeed:Number(data?.wind?.speed?.value),weatherCode:clean(data?.weatherCondition?.type,100),condition:clean(data?.weatherCondition?.description?.text,200),
    relativeHumidity:Number(data?.relativeHumidity),uvIndex:Number(data?.uvIndex),isDaytime:data?.isDaytime===true
  }};
}

function normalizeGoogleHourlyWeather(data) {
  const hours=Array.isArray(data?.forecastHours)?data.forecastHours.slice(0,24):[];
  return {
    time:hours.map(item=>clean(item?.interval?.startTime,80)),
    temperature:hours.map(item=>Number(item?.temperature?.degrees)),
    precipitationProbability:hours.map(item=>Number(item?.precipitation?.probability?.percent)||0),
    precipitation:hours.map(item=>Number(item?.precipitation?.qpf?.quantity)||0),
    weatherCode:hours.map(item=>clean(item?.weatherCondition?.type,100)),
    condition:hours.map(item=>clean(item?.weatherCondition?.description?.text,200)),
    windSpeed:hours.map(item=>Number(item?.wind?.speed?.value)||0)
  };
}

function normalizeGoogleWeatherAlerts(data) {
  return (Array.isArray(data?.weatherAlerts)?data.weatherAlerts:[]).slice(0,10).map(item=>({
    id:clean(item?.alertId,300),title:clean(item?.alertTitle?.text||item?.eventType,300),eventType:clean(item?.eventType,120),
    areaName:clean(item?.areaName,500),description:clean(item?.description,2000),severity:clean(item?.severity,80),
    certainty:clean(item?.certainty,80),urgency:clean(item?.urgency,80),startTime:clean(item?.startTime,80),expirationTime:clean(item?.expirationTime,80),
    instructions:(Array.isArray(item?.instruction)?item.instruction:[]).slice(0,5).map(value=>clean(value,500)).filter(Boolean),
    safetyRecommendations:(Array.isArray(item?.safetyRecommendations)?item.safetyRecommendations:[]).slice(0,5).map(value=>({directive:clean(value?.directive,500),subtext:clean(value?.subtext,500)})).filter(value=>value.directive||value.subtext),
    authority:clean(item?.dataSource?.name||item?.dataSource?.publisher,200),authorityUri:clean(item?.dataSource?.authorityUri,800)
  }));
}

async function googleWeatherAlerts(coord, language, env) {
  if(!env.GOOGLE_MAPS_API_KEY)return {ok:false,alerts:[],error:'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED'};
  const params=new URLSearchParams({key:env.GOOGLE_MAPS_API_KEY,'location.latitude':String(coord.lat),'location.longitude':String(coord.lng),languageCode:clean(language,10)||'vi',pageSize:'10'});
  try{
    const result=await fetchJson(`${GOOGLE_WEATHER_ALERTS_URL}?${params.toString()}`,{},5000);
    return result.ok?{ok:true,alerts:normalizeGoogleWeatherAlerts(result.data),regionCode:clean(result.data?.regionCode,10)}:{ok:false,alerts:[],error:clean(result.data?.error?.message||`Google Weather Alerts HTTP ${result.status}`,500)};
  }catch(error){return {ok:false,alerts:[],error:clean(error?.message,500)};}
}

function translateAmapWeather(value) {
  const raw=clean(value,100),labels={'晴':'Trời quang','少云':'Ít mây','晴间多云':'Trời quang xen mây','多云':'Có mây','阴':'Nhiều mây','阵雨':'Mưa rào','雷阵雨':'Mưa dông','雷阵雨并伴有冰雹':'Mưa dông kèm mưa đá','小雨':'Mưa nhẹ','中雨':'Mưa vừa','大雨':'Mưa lớn','暴雨':'Mưa rất lớn','大暴雨':'Mưa cực lớn','特大暴雨':'Mưa đặc biệt lớn','雾':'Sương mù','霾':'Khói mù','雨夹雪':'Mưa tuyết','小雪':'Tuyết nhẹ','中雪':'Tuyết vừa','大雪':'Tuyết lớn','暴雪':'Bão tuyết','浮尘':'Bụi lơ lửng','扬沙':'Cát bụi','沙尘暴':'Bão cát'};
  return labels[raw]||raw;
}

async function amapWeather(coord, env) {
  if(!env.AMAP_WEB_KEY)return {ok:false,error:'AMAP_WEB_KEY_NOT_CONFIGURED'};
  const point=toAmapPoint(coord),regeoParams=new URLSearchParams({key:env.AMAP_WEB_KEY,location:`${point.lng.toFixed(6)},${point.lat.toFixed(6)}`,extensions:'base',output:'json'});
  try{
    const regeo=await fetchJson(`${AMAP_REVERSE_GEOCODING_URL}?${regeoParams.toString()}`,{},5000),component=regeo.data?.regeocode?.addressComponent||{},adcode=clean(component?.adcode,20);
    if(!regeo.ok||String(regeo.data?.status)!=='1'||!adcode)return {ok:false,error:clean(regeo.data?.info||'AMAP_REVERSE_GEOCODING_FAILED',500)};
    const base={key:env.AMAP_WEB_KEY,city:adcode,output:'json'},liveParams=new URLSearchParams({...base,extensions:'base'}),forecastParams=new URLSearchParams({...base,extensions:'all'});
    const [liveResult,forecastResult]=await Promise.all([fetchJson(`${AMAP_WEATHER_URL}?${liveParams.toString()}`,{},5000),fetchJson(`${AMAP_WEATHER_URL}?${forecastParams.toString()}`,{},5000)]),live=Array.isArray(liveResult.data?.lives)?liveResult.data.lives[0]:null,forecast=Array.isArray(forecastResult.data?.forecasts)?forecastResult.data.forecasts[0]:null;
    if(!liveResult.ok||String(liveResult.data?.status)!=='1'||!live)return {ok:false,error:clean(liveResult.data?.info||'AMAP_WEATHER_FAILED',500)};
    const casts=Array.isArray(forecast?.casts)?forecast.casts.slice(0,4):[],reportTime=clean(live?.reporttime,80).replace(' ','T').slice(0,16);
    return {ok:true,adcode,location:{country:'Trung Quốc',province:clean(component?.province,200),city:clean(component?.city,200)||clean(component?.province,200),district:clean(component?.district,200),address:clean(regeo.data?.regeocode?.formatted_address,500)},weather:{coordinates:{...coord,coordSystem:coord.coordSystem||'wgs84',country:'Trung Quốc'},timezone:'Asia/Shanghai',current:{time:reportTime,temperature:Number(live?.temperature),apparentTemperature:Number(live?.temperature),precipitation:0,windSpeed:null,windPower:clean(live?.windpower,50),windDirection:clean(live?.winddirection,80),weatherCode:clean(live?.weather,100),condition:translateAmapWeather(live?.weather),relativeHumidity:Number(live?.humidity),reportTime},daily:{time:casts.map(item=>clean(item?.date,30)),weatherCode:casts.map(item=>clean(item?.dayweather,100)),conditionDay:casts.map(item=>translateAmapWeather(item?.dayweather)),conditionNight:casts.map(item=>translateAmapWeather(item?.nightweather)),temperatureMax:casts.map(item=>Number(item?.daytemp)),temperatureMin:casts.map(item=>Number(item?.nighttemp)),windDay:casts.map(item=>clean(item?.daywind,80)),windNight:casts.map(item=>clean(item?.nightwind,80))}}};
  }catch(error){return {ok:false,error:clean(error?.message,500)};}
}

function googleWeatherUnsupportedCountry(body) {
  const country=fold(body?.country||body?.location?.country||'');
  return /^(?:vn|vietnam|viet nam|cn|china|trung quoc|jp|japan|nhat ban|kr|south korea|korea|han quoc|kp|north korea|trieu tien|cu|cuba|ir|iran)$/.test(country);
}

async function openMeteoCurrent(coord) {
  const params=new URLSearchParams({latitude:String(coord.lat),longitude:String(coord.lng),timezone:'auto',forecast_days:'7',current:'temperature_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,relative_humidity_2m',hourly:'temperature_2m,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'});
  const result=await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`,{},5000);
  if(!result.ok)return null;
  const current=result.data?.current||{},hourly=result.data?.hourly||{},daily=result.data?.daily||{};
  const labels={0:'Trời quang',1:'Chủ yếu quang',2:'Có mây rải rác',3:'Nhiều mây',45:'Sương mù',48:'Sương mù đóng băng',51:'Mưa phùn nhẹ',53:'Mưa phùn',55:'Mưa phùn dày',61:'Mưa nhẹ',63:'Mưa vừa',65:'Mưa lớn',80:'Mưa rào nhẹ',81:'Mưa rào',82:'Mưa rào lớn',95:'Dông',96:'Dông kèm mưa đá nhẹ',99:'Dông kèm mưa đá'};
  return {coordinates:coord,timezone:clean(result.data?.timezone,100),current:{time:clean(current.time,80),temperature:Number(current.temperature_2m),apparentTemperature:Number(current.apparent_temperature),precipitation:Number(current.precipitation)||0,rain:Number(current.rain)||0,windSpeed:Number(current.wind_speed_10m),weatherCode:Number(current.weather_code),condition:labels[Number(current.weather_code)]||'Thời tiết hiện tại',relativeHumidity:Number(current.relative_humidity_2m)},hourly:{time:(hourly.time||[]).slice(0,72),temperature:(hourly.temperature_2m||[]).slice(0,72),precipitationProbability:(hourly.precipitation_probability||[]).slice(0,72),precipitation:(hourly.precipitation||[]).slice(0,72),weatherCode:(hourly.weather_code||[]).slice(0,72),windSpeed:(hourly.wind_speed_10m||[]).slice(0,72)},daily:{time:(daily.time||[]).slice(0,7),weatherCode:(daily.weather_code||[]).slice(0,7),temperatureMax:(daily.temperature_2m_max||[]).slice(0,7),temperatureMin:(daily.temperature_2m_min||[]).slice(0,7),precipitationProbabilityMax:(daily.precipitation_probability_max||[]).slice(0,7),sunrise:(daily.sunrise||[]).slice(0,7),sunset:(daily.sunset||[]).slice(0,7)}};
}

async function weatherCurrent(request, env, originHeader) {
  let body;try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const coord=finiteCoord(body?.location||body?.center||body);if(!coord)return json({error:'location không hợp lệ.'},400,originHeader);
  let googleError='';
  const chinaContext=providerFor({...body,location:coord})==='amap';
  const unsupportedGoogleCoverage=googleWeatherUnsupportedCountry(body);
  if(chinaContext){
    const [amapResult,hourlyFallback]=await Promise.all([amapWeather(coord,env),openMeteoCurrent(coord).catch(()=>null)]);
    if(amapResult.ok){
      const weather=amapResult.weather;
      if(hourlyFallback?.hourly)weather.hourly=hourlyFallback.hourly;
      return json({ok:true,source:hourlyFallback?.hourly?'amap-weather-v3+open-meteo-hourly':'amap-weather-v3',provider:'amap',regionMode:'china',weather,location:amapResult.location,meta:{adcode:amapResult.adcode,...(!hourlyFallback?.hourly?{hourlyUnavailable:true}:{})}},200,originHeader);
    }
    if(hourlyFallback)return json({ok:true,source:'open-meteo-china-fallback',provider:'open_meteo',regionMode:'china',weather:hourlyFallback,fallbackFrom:'amap_weather',amapError:amapResult.error},200,originHeader);
    return json({error:amapResult.error||'Không lấy được thời tiết Trung Quốc.',provider:'amap'},502,originHeader);
  }
  if(env.GOOGLE_MAPS_API_KEY&&!chinaContext&&!unsupportedGoogleCoverage){
    const baseParams={key:env.GOOGLE_MAPS_API_KEY,'location.latitude':String(coord.lat),'location.longitude':String(coord.lng),languageCode:clean(body?.language,10)||'vi',unitsSystem:'METRIC'};
    const currentParams=new URLSearchParams(baseParams),hourlyParams=new URLSearchParams({...baseParams,hours:'24',pageSize:'24'});
    try{
      const [currentResult,hourlyResult,alertsResult]=await Promise.all([
        fetchJson(`${GOOGLE_WEATHER_URL}?${currentParams.toString()}`,{},5000),
        fetchJson(`${GOOGLE_WEATHER_HOURLY_URL}?${hourlyParams.toString()}`,{},5000),
        googleWeatherAlerts(coord,body?.language,env)
      ]);
      if(currentResult.ok){
        const weather=normalizeGoogleWeather(currentResult.data,coord);
        if(hourlyResult.ok)weather.hourly=normalizeGoogleHourlyWeather(hourlyResult.data);
        if(alertsResult.ok)weather.alerts=alertsResult.alerts;
        return json({ok:true,source:'google-weather-v1',provider:'google_weather',weather,...(!hourlyResult.ok?{partialErrors:{hourly:clean(hourlyResult.data?.error?.message||`Google Weather hourly HTTP ${hourlyResult.status}`,500)}}:{})},200,originHeader);
      }
      googleError=clean(currentResult.data?.error?.message||`Google Weather HTTP ${currentResult.status}`,500);
    }catch(error){googleError=clean(error?.message,500);}
  }else googleError=chinaContext?'CHINA_LOCAL_MODE':unsupportedGoogleCoverage?'GOOGLE_WEATHER_UNSUPPORTED_COUNTRY':'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED';
  try{
    const [fallback,alertsResult]=await Promise.all([openMeteoCurrent(coord),googleWeatherAlerts(coord,body?.language,env)]);
    if(fallback){if(alertsResult.ok)fallback.alerts=alertsResult.alerts;return json({ok:true,source:alertsResult.ok?'open-meteo+google-alerts':unsupportedGoogleCoverage?'open-meteo-coverage-fallback':'open-meteo-fallback',provider:'open_meteo',weather:fallback,fallbackFrom:'google_weather',googleError,...(alertsResult.ok?{alertsSource:'google-weather-alerts-v1'}:{alertsError:alertsResult.error})},200,originHeader);}
  }catch{}
  return json({error:googleError||'Không lấy được thời tiết.',provider:'google_weather'},502,originHeader);
}

async function placeDetails(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  if(providerFor(body)==='amap')return amapPlaceDetails(body,env,originHeader);
  const google=await googlePlaceDetails(body,env,originHeader);
  if(google) return google;
  const id=clean(body?.placeId||body?.id,500);
  if(!id) return json({error:'Cần GOOGLE_MAPS_API_KEY hoặc placeId Geoapify để lấy details.'},503,originHeader);
  if(!env.GEOAPIFY_API_KEY) return json({error:'Worker chưa có secret GEOAPIFY_API_KEY.',provider:'geoapify'},500,originHeader);
  const params=new URLSearchParams({id,features:'details',apiKey:env.GEOAPIFY_API_KEY});
  const result=await fetchJson(`${GEOAPIFY_DETAILS_URL}?${params.toString()}`);
  if(!result.ok) return json({error:result.data?.message||`Geoapify Details HTTP ${result.status}`,provider:'geoapify'},502,originHeader);
  const feature=Array.isArray(result.data?.features)?result.data.features[0]:null;
  const place=feature?normalizeGeoapifyPoi(feature,finiteCoord(body?.center)||null,body?.country):null;
  return json({ok:Boolean(place),source:'geoapify-place-details-v2',provider:'geoapify',place,places:place?[place]:[]},place?200:404,originHeader);
}

async function trafficRoute(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const origin=finiteCoord(body?.origin),destination=finiteCoord(body?.destination);
  if(!origin||!destination) return json({error:'origin/destination không hợp lệ.'},400,originHeader);
  if(providerFor(body)==='amap') {
    if(!env.AMAP_WEB_KEY) return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
    const from=toAmapPoint(origin),to=toAmapPoint(destination),params=new URLSearchParams({key:env.AMAP_WEB_KEY,origin:`${from.lng.toFixed(6)},${from.lat.toFixed(6)}`,destination:`${to.lng.toFixed(6)},${to.lat.toFixed(6)}`,show_fields:'cost,polyline',output:'json'});
    const result=await fetchJson(`${AMAP_DRIVING_URL}?${params.toString()}`);
    const paths=Array.isArray(result.data?.route?.paths)?result.data.route.paths:[];
    if(!result.ok||String(result.data?.status)!=='1'||!paths.length) return json({error:result.data?.info||`AMap Driving HTTP ${result.status}`,provider:'amap'},502,originHeader);
    const routes=paths.map((path,index)=>({routeIndex:index,distance:Number(path?.distance)||0,duration:Number(path?.cost?.duration)||0,trafficLights:Number(path?.cost?.traffic_lights)||null,provider:'amap'}));
    return json({ok:true,source:'amap-driving-v5',provider:'amap',routes},200,originHeader);
  }
  if(!env.GOOGLE_MAPS_API_KEY) return json({error:'Traffic live cần secret GOOGLE_MAPS_API_KEY.',provider:'google_routes',code:'PROVIDER_NOT_CONFIGURED'},503,originHeader);
  const payload={origin:{location:{latLng:{latitude:origin.lat,longitude:origin.lng}}},destination:{location:{latLng:{latitude:destination.lat,longitude:destination.lng}}},travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',computeAlternativeRoutes:true,languageCode:clean(body?.language,10)||'vi-VN',units:'METRIC'};
  const fields='routes.duration,routes.staticDuration,routes.distanceMeters,routes.description,routes.warnings';
  const result=await fetchJson(GOOGLE_ROUTES_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':fields},body:JSON.stringify(payload)});
  if(!result.ok) return json({error:result.data?.error?.message||`Google Routes HTTP ${result.status}`,provider:'google_routes'},502,originHeader);
  const routes=(Array.isArray(result.data?.routes)?result.data.routes:[]).map((route,index)=>{const duration=durationSeconds(route?.duration),staticDuration=durationSeconds(route?.staticDuration);return {routeIndex:index,distance:Number(route?.distanceMeters)||0,duration,staticDuration,trafficDelay:Math.max(0,duration-staticDuration),description:clean(route?.description,500),warnings:Array.isArray(route?.warnings)?route.warnings.slice(0,10):[],provider:'google_routes'};});
  return json({ok:true,source:'google-routes-v2',provider:'google_routes',routes},200,originHeader);
}

export default {
  async fetch(request, env) {
    const origin=allowedOrigin(request,env);
    if(request.method==='OPTIONS') return origin?new Response(null,{status:204,headers:corsHeaders(origin)}):new Response(null,{status:403});
    if(!origin) return json({error:'Origin không được phép.'},403,'null');
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/health') return json({ok:true,service:'travelos-map',version:'google-primary-v3',amap:{walking:Boolean(env.AMAP_WEB_KEY),electrobike:Boolean(env.AMAP_WEB_KEY),driving:Boolean(env.AMAP_WEB_KEY),weather:Boolean(env.AMAP_WEB_KEY),nearby:Boolean(env.AMAP_WEB_KEY)},google:{routes:Boolean(env.GOOGLE_MAPS_API_KEY),places:Boolean(env.GOOGLE_MAPS_API_KEY),weather:Boolean(env.GOOGLE_MAPS_API_KEY),traffic:Boolean(env.GOOGLE_MAPS_API_KEY)},geoapify:{fallbackRoutes:Boolean(env.GEOAPIFY_API_KEY),fallbackPlaces:Boolean(env.GEOAPIFY_API_KEY),fallbackGeocoding:Boolean(env.GEOAPIFY_API_KEY),fallbackDetails:Boolean(env.GEOAPIFY_API_KEY)},routing:'china-amap-global-google',retryProfiles:true},200,origin);
    if(request.method==='POST'&&url.pathname==='/route/walking') return walkingRoute(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/route/directions') return directionsRoute(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/route/traffic') return trafficRoute(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/poi/nearby') return nearbySearch(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/poi/details') return placeDetails(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/place/resolve') return resolvePlace(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/weather/current') return weatherCurrent(request,env,origin);
    return json({error:'Not found'},404,origin);
  }
};
