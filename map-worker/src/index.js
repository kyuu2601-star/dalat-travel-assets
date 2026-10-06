const AMAP_WALKING_URL = 'https://restapi.amap.com/v5/direction/walking';
const AMAP_NEARBY_URL = 'https://restapi.amap.com/v5/place/around';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';
const GEOAPIFY_ROUTING_URL = 'https://api.geoapify.com/v1/routing';
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
function isChinaCountry(value) {
  const v = fold(value);
  return ['trung quoc','china','cn','中国','中华人民共和国'].some(x => v === fold(x) || v.includes(fold(x)));
}
function providerFor(body) {
  const forced = clean(body?.provider, 20).toLowerCase();
  if (forced === 'amap' || forced === 'domestic') return 'amap';
  if (forced === 'geoapify') return 'geoapify';
  const country = body?.country || body?.destination?.country || body?.origin?.country || body?.center?.country || '';
  return isChinaCountry(country) ? 'amap' : 'geoapify';
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
function retryableAmapError(info) { return String(info || '').toUpperCase() === 'UNKNOWN_ERROR'; }
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
  const attempts=[], deadline=Date.now()+REQUEST_BUDGET_MS; let last=null;
  for(let i=0;i<profiles.length;i++){
    const profile=profiles[i], remaining=deadline-Date.now(); if(remaining<700) break;
    const result=await callAmap(env,origin,destination,profile,Math.min(4000,Math.max(1200,Math.floor(remaining/(profiles.length-i))))); last=result; attempts.push(safeAttempt(profile,result));
    if(result.ok){
      const routes=(Array.isArray(result.raw?.route?.paths)?result.raw.route.paths:[]).map(normalizeAmapPath).filter(r=>r.steps.length||r.distance>0);
      if(routes.length) return json({ source:'amap-route-v2', provider:'amap', origin:{lat:origin.lat,lng:origin.lng,coordSystem:'gcj02',country:body?.country||origin.country||''}, destination:{lat:destination.lat,lng:destination.lng,coordSystem:'gcj02',country:body?.country||destination.country||''}, routes, meta:{count:routes.length,info:result.raw.info||'OK',infocode:result.raw.infocode||'',profile:profile.name,indoor:profile.isIndoor,attempts} },200,originHeader);
      last={...result,ok:false,info:'EMPTY_ROUTE'}; attempts[attempts.length-1].info='EMPTY_ROUTE';
    }
    if(!(result.network||retryableAmapError(result.info)||result.info==='EMPTY_ROUTE')) break;
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
    return json({source:'geoapify-routing-v1',provider:'geoapify',origin:{lat:origin.lat,lng:origin.lng,coordSystem:'wgs84',country},destination:{lat:destination.lat,lng:destination.lng,coordSystem:'wgs84',country},routes,meta:{count:routes.length}},200,originHeader);
  } catch(error) {
    return json({error:error?.name==='AbortError'?'Geoapify Routing timeout.':`Không gọi được Geoapify Routing: ${clean(error?.message,300)}`,provider:'geoapify'},502,originHeader);
  } finally { clearTimeout(timer); }
}
async function walkingRoute(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const origin=finiteCoord(body?.origin), destination=finiteCoord(body?.destination);
  if(!origin||!destination) return json({error:'origin/destination không hợp lệ.'},400,originHeader);
  return providerFor(body)==='amap' ? amapWalkingRoute(body,env,originHeader,origin,destination) : geoapifyWalkingRoute(body,env,originHeader,origin,destination);
}

const SEARCH_RULES=[
  {aliases:['pharmacy','drugstore','nha thuoc','hieu thuoc','tiem thuoc','mua thuoc'],geo:['healthcare.pharmacy'],amap:'药店'},
  {aliases:['hospital','benh vien','cap cuu'],geo:['healthcare.hospital'],amap:'医院'},
  {aliases:['clinic','phong kham','doctor','bac si'],geo:['healthcare.clinic_or_praxis'],amap:'诊所'},
  {aliases:['convenience store','cua hang tien loi','minimart','mini mart'],geo:['commercial.convenience'],amap:'便利店'},
  {aliases:['grocery','tap hoa','cua hang tap hoa'],geo:['commercial.food_and_drink'],amap:'杂货店'},
  {aliases:['supermarket','sieu thi'],geo:['commercial.supermarket'],amap:'超市'},
  {aliases:['atm','rut tien'],geo:['service.financial.atm'],amap:'ATM'},
  {aliases:['bank','ngan hang'],geo:['service.financial.bank'],amap:'银行'},
  {aliases:['gas station','petrol','tram xang','cay xang','do xang','fuel'],geo:['service.vehicle.fuel'],amap:'加油站'},
  {aliases:['police','cong an'],geo:['service.police'],amap:'派出所'},
  {aliases:['fire station','cuu hoa'],geo:['service.fire_station'],amap:'消防站'},
  {aliases:['restaurant','quan an','an uong'],geo:['catering.restaurant','catering.fast_food','catering.food_court'],amap:'餐厅'},
  {aliases:['cafe','coffee','quan cafe'],geo:['commercial.cafe'],amap:'咖啡店'},
  {aliases:['hotel','khach san'],geo:['accommodation.hotel','accommodation.guest_house'],amap:'酒店'},
  {aliases:['parking','bai do xe','giu xe'],geo:['parking'],amap:'停车场'}
];
function categoryInfo(keyword, category='') {
  const q=fold(`${category} ${keyword}`);
  for(const rule of SEARCH_RULES) if(rule.aliases.some(x=>q.includes(fold(x)))) return {geoCategories:rule.geo,amapKeyword:rule.amap};
  return {geoCategories:['commercial','service','healthcare','catering','tourism','entertainment'],amapKeyword:clean(keyword,80),name:clean(keyword,120)};
}
function normalizeAmapPoi(poi, center, country) {
  const point=parseLngLat(poi?.location); if(!point) return null; const {lng,lat}=point;
  const business=poi?.business&&typeof poi.business==='object'?poi.business:{};
  return {id:clean(poi?.id,160),poiId:clean(poi?.id,160),name:clean(poi?.name,300),address:clean(poi?.address,1000),lat,lng,distance:num(poi?.distance)||haversineMeters(center,{lat,lng}),type:clean(poi?.type,500),typecode:clean(poi?.typecode,100),city:clean(poi?.cityname,200),district:clean(poi?.adname,200),province:clean(poi?.pname,200),phone:clean(business?.tel||poi?.tel,300),openTime:clean(business?.opentime_today,500),rating:clean(business?.rating,50),coordSystem:'gcj02',provider:'amap',country:clean(country,120)};
}
async function amapNearby(body, env, originHeader, center, keyword, types, radius, limit, country) {
  if(!env.AMAP_WEB_KEY) return json({error:'Worker chưa có secret AMAP_WEB_KEY.',provider:'amap'},500,originHeader);
  const queryCenter=toAmapPoint(center), info=categoryInfo(keyword,body?.category), amapKeyword=info.amapKeyword||keyword;
  const params=new URLSearchParams({key:env.AMAP_WEB_KEY,location:`${queryCenter.lng.toFixed(6)},${queryCenter.lat.toFixed(6)}`,radius:String(radius),output:'json',page_size:String(limit),page_num:'1',sortrule:'distance',show_fields:'business,navi'});
  if(amapKeyword) params.set('keywords',amapKeyword); if(types) params.set('types',types);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(`${AMAP_NEARBY_URL}?${params}`,{signal:controller.signal}),raw=await response.json().catch(()=>null);
    if(!response.ok||!raw) return json({error:`AMap Nearby HTTP ${response.status}`,provider:'amap'},502,originHeader);
    if(String(raw.status)!=='1') return json({error:`AMap Nearby: ${raw.info||'unknown error'}`,infocode:raw.infocode||'',provider:'amap'},502,originHeader);
    const pois=(Array.isArray(raw.pois)?raw.pois:[]).map(p=>normalizeAmapPoi(p,queryCenter,country)).filter(Boolean).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)).slice(0,limit);
    return json({ok:true,source:'amap-place-v5',provider:'amap',query:{keyword:amapKeyword,types,radius,limit},center:{lat:center.lat,lng:center.lng,coordSystem:'wgs84',country},count:pois.length,pois,meta:{info:raw.info||'OK',infocode:raw.infocode||'',total:Number(raw.count||pois.length)}},200,originHeader);
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
async function geoapifyNearby(body, env, originHeader, center, keyword, radius, limit, country) {
  if(!env.GEOAPIFY_API_KEY) return json({error:'Worker chưa có secret GEOAPIFY_API_KEY.',provider:'geoapify'},500,originHeader);
  const info=categoryInfo(keyword,body?.category), params=new URLSearchParams({
    categories:info.geoCategories.join(','),
    filter:`circle:${center.lng.toFixed(6)},${center.lat.toFixed(6)},${radius}`,
    bias:`proximity:${center.lng.toFixed(6)},${center.lat.toFixed(6)}`,
    limit:String(limit), lang:clean(body?.language,10)||'vi', apiKey:env.GEOAPIFY_API_KEY
  });
  if(info.name) params.set('name',info.name);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(`${GEOAPIFY_PLACES_URL}?${params.toString()}`,{signal:controller.signal});
    const raw=await response.json().catch(()=>null);
    if(!response.ok||!raw) return json({error:raw?.message||raw?.error||`Geoapify Places HTTP ${response.status}`,provider:'geoapify'},502,originHeader);
    const pois=(Array.isArray(raw?.features)?raw.features:[]).map(p=>normalizeGeoapifyPoi(p,center,country)).filter(Boolean).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)).slice(0,limit);
    return json({ok:true,source:'geoapify-places-v2',provider:'geoapify',query:{keyword,categories:info.geoCategories,radius,limit},center:{lat:center.lat,lng:center.lng,coordSystem:'wgs84',country},count:pois.length,pois,meta:{total:pois.length}},200,originHeader);
  }catch(error){return json({error:error?.name==='AbortError'?'Geoapify Places timeout.':`Geoapify Places: ${clean(error?.message,500)}`,provider:'geoapify'},502,originHeader);}finally{clearTimeout(timer);}
}
async function nearbySearch(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const center=finiteCoord(body?.center||body?.location); if(!center) return json({error:'center/location không hợp lệ.'},400,originHeader);
  const keyword=clean(body?.keyword||body?.keywords,100),types=clean(body?.types,300); if(!keyword&&!types) return json({error:'Cần keyword hoặc types để search nearby.'},400,originHeader);
  const radius=clampInt(body?.radius,100,50000,3000),limit=clampInt(body?.limit,1,20,8),country=clean(body?.country||center.country,120);
  return providerFor(body)==='amap' ? amapNearby(body,env,originHeader,center,keyword,types,radius,limit,country) : geoapifyNearby(body,env,originHeader,center,keyword,radius,limit,country);
}

export default {
  async fetch(request, env) {
    const origin=allowedOrigin(request,env);
    if(request.method==='OPTIONS') return origin?new Response(null,{status:204,headers:corsHeaders(origin)}):new Response(null,{status:403});
    if(!origin) return json({error:'Origin không được phép.'},403,'null');
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/health') return json({ok:true,service:'travelos-map',amap:{route:Boolean(env.AMAP_WEB_KEY),nearby:Boolean(env.AMAP_WEB_KEY)},geoapify:{routes:Boolean(env.GEOAPIFY_API_KEY),places:Boolean(env.GEOAPIFY_API_KEY)},routing:'country-switch',retryProfiles:true},200,origin);
    if(request.method==='POST'&&url.pathname==='/route/walking') return walkingRoute(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/poi/nearby') return nearbySearch(request,env,origin);
    return json({error:'Not found'},404,origin);
  }
};
