const AMAP_WALKING_URL = 'https://restapi.amap.com/v5/direction/walking';
const AMAP_NEARBY_URL = 'https://restapi.amap.com/v5/place/around';
const GOOGLE_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const GOOGLE_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
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
  if (forced === 'google') return 'google';
  const country = body?.country || body?.destination?.country || body?.origin?.country || body?.center?.country || '';
  return isChinaCountry(country) ? 'amap' : 'google';
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
  return json({ error:`AMap Route 2.0: ${String(last?.info||'unknown error')}`, infocode:String(last?.infocode||''), attempts },502,originHeader);
}

function seconds(value) { const m=String(value||'').match(/^([\d.]+)s$/); return m ? Number(m[1]) : num(value); }
async function googleWalkingRoute(body, env, originHeader, origin, destination) {
  if (!env.GOOGLE_MAPS_API_KEY) return json({ error:'Worker chưa có secret GOOGLE_MAPS_API_KEY.' },500,originHeader);
  const requestBody={
    origin:{location:{latLng:{latitude:origin.lat,longitude:origin.lng}}},
    destination:{location:{latLng:{latitude:destination.lat,longitude:destination.lng}}},
    travelMode:'WALK', computeAlternativeRoutes:true, languageCode:clean(body?.language,10)||'vi', units:'METRIC', polylineQuality:'OVERVIEW', polylineEncoding:'ENCODED_POLYLINE'
  };
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),REQUEST_BUDGET_MS);
  try {
    const response=await fetch(GOOGLE_ROUTES_URL,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.warnings'},body:JSON.stringify(requestBody)});
    const raw=await response.json().catch(()=>null);
    if(!response.ok||!raw) return json({error:raw?.error?.message||`Google Routes HTTP ${response.status}`,provider:'google'},502,originHeader);
    const routes=(Array.isArray(raw.routes)?raw.routes:[]).map((r,i)=>({routeIndex:i,distance:num(r.distanceMeters),duration:seconds(r.duration),encodedPolyline:clean(r?.polyline?.encodedPolyline,200000),warnings:Array.isArray(r.warnings)?r.warnings:[],steps:[]})).filter(r=>r.encodedPolyline||r.distance>0);
    if(!routes.length) return json({error:'Google Routes không trả tuyến đi bộ.',provider:'google'},404,originHeader);
    const country=clean(body?.country||destination.country||origin.country,120);
    return json({source:'google-routes-v2',provider:'google',origin:{lat:origin.lat,lng:origin.lng,coordSystem:'wgs84',country},destination:{lat:destination.lat,lng:destination.lng,coordSystem:'wgs84',country},routes,meta:{count:routes.length,walkingBetaWarning:true}},200,originHeader);
  } catch(error) {
    return json({error:error?.name==='AbortError'?'Google Routes timeout.':`Không gọi được Google Routes: ${clean(error?.message,300)}`,provider:'google'},502,originHeader);
  } finally { clearTimeout(timer); }
}
async function walkingRoute(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const origin=finiteCoord(body?.origin), destination=finiteCoord(body?.destination);
  if(!origin||!destination) return json({error:'origin/destination không hợp lệ.'},400,originHeader);
  return providerFor(body)==='amap' ? amapWalkingRoute(body,env,originHeader,origin,destination) : googleWalkingRoute(body,env,originHeader,origin,destination);
}

const GOOGLE_TYPE_RULES=[
  [['pharmacy','drugstore','nha thuoc','hieu thuoc','tiem thuoc','mua thuoc'],['pharmacy','drugstore'],'药店'],
  [['hospital','benh vien','cap cuu'],['hospital','general_hospital'],'医院'],
  [['clinic','phong kham'],['medical_clinic','doctor'],'诊所'],
  [['convenience store','cua hang tien loi','minimart','mini mart'],['convenience_store'],'便利店'],
  [['grocery','tap hoa','cua hang tap hoa'],['grocery_store','general_store','food_store'],'杂货店'],
  [['supermarket','sieu thi'],['supermarket','hypermarket'],'超市'],
  [['atm','rut tien'],['atm'],'ATM'],
  [['bank','ngan hang'],['bank'],'银行'],
  [['gas station','petrol','tram xang','cay xang','do xang'],['gas_station'],'加油站'],
  [['police','cong an'],['police'],'派出所'],
  [['fire station','cuu hoa'],['fire_station'],'消防站'],
  [['restaurant','quan an','an uong'],['restaurant'],'餐厅'],
  [['cafe','coffee','quan cafe'],['cafe','coffee_shop'],'咖啡店']
];
function categoryInfo(keyword, category='') {
  const q=fold(`${category} ${keyword}`);
  for(const [aliases,types,amapKeyword] of GOOGLE_TYPE_RULES) if(aliases.some(x=>q.includes(fold(x)))) return {types,amapKeyword};
  return {types:[],amapKeyword:clean(keyword,80)};
}
function normalizeAmapPoi(poi, center, country) {
  const [lng,lat]=String(poi?.location||'').split(',').map(Number); if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
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
function normalizeGooglePoi(place, center, country) {
  const lat=Number(place?.location?.latitude),lng=Number(place?.location?.longitude); if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  const openNow=place?.currentOpeningHours?.openNow;
  return {id:clean(place?.id,200),poiId:clean(place?.id,200),name:clean(place?.displayName?.text,300),address:clean(place?.formattedAddress,1000),lat,lng,distance:haversineMeters(center,{lat,lng}),type:clean(place?.primaryType,200),types:Array.isArray(place?.types)?place.types.slice(0,10):[],city:'',district:'',province:'',phone:clean(place?.nationalPhoneNumber,300),openTime:typeof openNow==='boolean'?(openNow?'Đang mở':'Đang đóng'):'',rating:'',businessStatus:clean(place?.businessStatus,80),coordSystem:'wgs84',provider:'google',country:clean(country,120)};
}
async function googlePlacesRequest(url, body, env) {
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.nationalPhoneNumber,places.businessStatus,places.currentOpeningHours.openNow'},body:JSON.stringify(body)});
  const raw=await response.json().catch(()=>null);
  if(!response.ok||!raw) throw new Error(raw?.error?.message||`Google Places HTTP ${response.status}`);
  return raw;
}
async function googleNearby(body, env, originHeader, center, keyword, radius, limit, country) {
  if(!env.GOOGLE_MAPS_API_KEY) return json({error:'Worker chưa có secret GOOGLE_MAPS_API_KEY.',provider:'google'},500,originHeader);
  const info=categoryInfo(keyword,body?.category), controller=new AbortController(), timer=setTimeout(()=>controller.abort(),9000);
  try{
    let raw, source;
    if(info.types.length){
      raw=await Promise.race([
        googlePlacesRequest(GOOGLE_NEARBY_URL,{includedTypes:info.types,maxResultCount:limit,rankPreference:'DISTANCE',languageCode:clean(body?.language,10)||'vi',locationRestriction:{circle:{center:{latitude:center.lat,longitude:center.lng},radius}}},env),
        new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));})
      ]); source='google-places-nearby-v1';
    } else {
      raw=await Promise.race([
        googlePlacesRequest(GOOGLE_TEXT_URL,{textQuery:keyword,pageSize:limit,languageCode:clean(body?.language,10)||'vi',locationBias:{circle:{center:{latitude:center.lat,longitude:center.lng},radius}}},env),
        new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));})
      ]); source='google-places-text-v1';
    }
    const pois=(Array.isArray(raw?.places)?raw.places:[]).map(p=>normalizeGooglePoi(p,center,country)).filter(Boolean).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)).slice(0,limit);
    return json({ok:true,source,provider:'google',query:{keyword,types:info.types,radius,limit},center:{lat:center.lat,lng:center.lng,coordSystem:'wgs84',country},count:pois.length,pois,meta:{total:pois.length}},200,originHeader);
  }catch(error){return json({error:error?.name==='AbortError'?'Google Places timeout.':`Google Places: ${clean(error?.message,500)}`,provider:'google'},502,originHeader);}finally{clearTimeout(timer);}
}
async function nearbySearch(request, env, originHeader) {
  let body; try{body=await request.json();}catch{return json({error:'JSON body không hợp lệ.'},400,originHeader);}
  const center=finiteCoord(body?.center||body?.location); if(!center) return json({error:'center/location không hợp lệ.'},400,originHeader);
  const keyword=clean(body?.keyword||body?.keywords,100),types=clean(body?.types,300); if(!keyword&&!types) return json({error:'Cần keyword hoặc types để search nearby.'},400,originHeader);
  const radius=clampInt(body?.radius,100,50000,3000),limit=clampInt(body?.limit,1,20,8),country=clean(body?.country||center.country,120);
  return providerFor(body)==='amap' ? amapNearby(body,env,originHeader,center,keyword,types,radius,limit,country) : googleNearby(body,env,originHeader,center,keyword,radius,limit,country);
}

export default {
  async fetch(request, env) {
    const origin=allowedOrigin(request,env);
    if(request.method==='OPTIONS') return origin?new Response(null,{status:204,headers:corsHeaders(origin)}):new Response(null,{status:403});
    if(!origin) return json({error:'Origin không được phép.'},403,'null');
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/health') return json({ok:true,service:'travelos-map',amap:{route:Boolean(env.AMAP_WEB_KEY),nearby:Boolean(env.AMAP_WEB_KEY)},google:{routes:Boolean(env.GOOGLE_MAPS_API_KEY),places:Boolean(env.GOOGLE_MAPS_API_KEY)},routing:'country-switch',retryProfiles:true},200,origin);
    if(request.method==='POST'&&url.pathname==='/route/walking') return walkingRoute(request,env,origin);
    if(request.method==='POST'&&url.pathname==='/poi/nearby') return nearbySearch(request,env,origin);
    return json({error:'Not found'},404,origin);
  }
};
