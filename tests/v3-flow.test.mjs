import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function importWorker(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Date.now()}-${Math.random()}`);
}

test('Map Worker keeps pharmacy category coverage and brand name', async () => {
  const { default: worker } = await importWorker('../map-worker/src/index.js');
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async url => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      features:[{
        properties:{ place_id:'pharmacity-1', name:'Nhà thuốc Pharmacity', formatted:'123 Test', lat:10.77, lon:106.69, distance:120, categories:['commercial.health_and_beauty.pharmacy'] },
        geometry:{ coordinates:[106.69,10.77] }
      }]
    }), { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  try {
    const response = await worker.fetch(new Request('https://travelos-map.test/poi/nearby', {
      method:'POST', headers:{ Origin:'https://kyuu2601-star.github.io', 'Content-Type':'application/json' },
      body:JSON.stringify({ center:{ lat:10.77, lng:106.69 }, country:'Việt Nam', category:'pharmacy', keyword:'nhà thuốc', name:'Pharmacity', limit:6 })
    }), { GEOAPIFY_API_KEY:'test', ALLOWED_ORIGINS:'https://kyuu2601-star.github.io' });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.pois[0].name, 'Nhà thuốc Pharmacity');
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get('name'), 'Pharmacity');
    assert.match(url.searchParams.get('categories'), /healthcare\.pharmacy/);
    assert.match(url.searchParams.get('categories'), /commercial\.health_and_beauty\.pharmacy/);
    assert.match(url.searchParams.get('categories'), /commercial\.chemist/);
    assert.equal(url.searchParams.get('limit'), '24');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Map Worker uses Google Places as primary for a Pharmacity brand search', async () => {
  const { default: worker } = await importWorker('../map-worker/src/index.js');
  const originalFetch = globalThis.fetch;
  const vietnamToday=new Date(Date.now()+420*60000).getUTCDay();
  let requestedUrl = '', requestedBody = null;
  globalThis.fetch = async (url, init={}) => {
    requestedUrl=String(url);requestedBody=JSON.parse(String(init.body||'{}'));
    return new Response(JSON.stringify({places:[
      {id:'far',displayName:{text:'Nhà thuốc Pharmacity B'},formattedAddress:'500 m',location:{latitude:10.774,longitude:106.69},rating:4.5,userRatingCount:20},
      {id:'near',displayName:{text:'Nhà thuốc Pharmacity A'},formattedAddress:'100 m',location:{latitude:10.7705,longitude:106.69},rating:4.7,userRatingCount:50,utcOffsetMinutes:420,currentOpeningHours:{openNow:true,weekdayDescriptions:['Không được hiển thị cả tuần'],periods:[{open:{day:vietnamToday,hour:6,minute:0},close:{day:vietnamToday,hour:23,minute:30}}]}}
    ]}), {status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{
      method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
      body:JSON.stringify({center:{lat:10.77,lng:106.69},country:'Việt Nam',category:'pharmacy',keyword:'nhà thuốc',name:'Pharmacity',limit:6})
    }),{GOOGLE_MAPS_API_KEY:'google-test',GEOAPIFY_API_KEY:'geo-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.provider,'google_places');
    assert.equal(data.source,'google-places-text-v1');
    assert.equal(data.pois[0].id,'near');
    assert.equal(data.pois[0].openTime,'Hôm nay: 06:00–23:30');
    assert.equal(requestedUrl,'https://places.googleapis.com/v1/places:searchText');
    assert.equal(requestedBody.textQuery,'Pharmacity');
    assert.equal(requestedBody.locationBias.circle.radius,3000);
  } finally { globalThis.fetch=originalFetch; }
});

test('Map Worker preserves a specific food query instead of widening it to every restaurant', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedBody=null,requestedUrl='';
  globalThis.fetch=async (url,init={})=>{requestedUrl=String(url);requestedBody=JSON.parse(String(init.body||'{}'));return new Response(JSON.stringify({places:[{id:'chicken-1',displayName:{text:'Gà Rán Test'},formattedAddress:'Tân Phú, TP.HCM',location:{latitude:10.8,longitude:106.63},rating:4.6,userRatingCount:120}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.8,lng:106.63},country:'Việt Nam',query:'gà rán',keyword:'gà rán',category:'restaurant',limit:6})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(requestedUrl,'https://places.googleapis.com/v1/places:searchText');
    assert.equal(requestedBody.textQuery,'gà rán');
    assert.equal(data.pois[0].name,'Gà Rán Test');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker ranks Google Place candidates by rating when requested', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({places:[
    {id:'near-low',displayName:{text:'Gà gần'},formattedAddress:'100 m',location:{latitude:10.8005,longitude:106.63},rating:4.2,userRatingCount:900},
    {id:'far-high',displayName:{text:'Gà rating cao'},formattedAddress:'500 m',location:{latitude:10.8045,longitude:106.63},rating:4.9,userRatingCount:120}
  ]}),{status:200,headers:{'Content-Type':'application/json'}});
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.8,lng:106.63},country:'Việt Nam',query:'gà rán',limit:10,candidateLimit:20,sortBy:'rating'})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.pois[0].id,'far-high');
    assert.equal(data.pois[1].id,'near-low');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker enriches place details by exact Google Place ID for review text', async () => {
  const { default: worker } = await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedUrl='',fieldMask='';
  globalThis.fetch=async (url,init={})=>{
    requestedUrl=String(url);fieldMask=init.headers['X-Goog-FieldMask'];
    return new Response(JSON.stringify({id:'ChIJ-test',displayName:{text:'Khu du lịch Thác Datanla'},formattedAddress:'Đà Lạt',location:{latitude:11.9,longitude:108.45},rating:4.4,userRatingCount:25407,reviews:[{rating:5,text:{text:'Cảnh đẹp và trải nghiệm thú vị.'},relativePublishTimeDescription:'1 tuần trước',publishTime:'2026-10-01T00:00:00Z'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/details',{
      method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
      body:JSON.stringify({placeId:'ChIJ-test',name:'Thác Datanla',center:{lat:11.9,lng:108.45},country:'Việt Nam'})
    }),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'google-place-details-v1');
    assert.equal(data.place.reviews[0].text,'Cảnh đẹp và trải nghiệm thú vị.');
    assert.equal(data.place.reviews[0].publishTime,'2026-10-01T00:00:00Z');
    assert.match(requestedUrl,/places\/ChIJ-test\?languageCode=vi/);
    assert.match(fieldMask,/(^|,)reviews(,|$)/);
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker returns normalized Google Weather current conditions', async () => {
  const { default: worker } = await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedUrl='';
  globalThis.fetch=async url=>{requestedUrl=String(url);return new Response(JSON.stringify({currentTime:'2026-10-08T09:00:00Z',timeZone:{id:'Asia/Ho_Chi_Minh'},weatherCondition:{type:'PARTLY_CLOUDY',description:{text:'Có mây rải rác'}},temperature:{degrees:27.4},feelsLikeTemperature:{degrees:29.1},relativeHumidity:74,uvIndex:3,precipitation:{probability:{percent:25},qpf:{quantity:0}},wind:{speed:{value:8}}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/weather/current',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({location:{lat:10.8,lng:106.7},language:'vi'})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'google-weather-v1');
    assert.equal(data.weather.current.temperature,27.4);
    assert.equal(data.weather.current.condition,'Có mây rải rác');
    assert.match(requestedUrl,/weather\.googleapis\.com\/v1\/currentConditions:lookup/);
    assert.match(requestedUrl,/location\.latitude=10\.8/);
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker uses Google Routes for walking and returns drawable paths', async () => {
  const { default: worker } = await importWorker('../map-worker/src/index.js');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url,init={}) => {
    assert.equal(String(url),'https://routes.googleapis.com/directions/v2:computeRoutes');
    const requestBody=JSON.parse(String(init.body||'{}'));
    assert.equal(requestBody.travelMode,'WALK');
    assert.equal(requestBody.computeAlternativeRoutes,false);
    const fieldMask=init.headers['X-Goog-FieldMask'];
    assert.match(fieldMask,/routes\.legs\.steps\.navigationInstruction\.instructions/);
    assert.match(fieldMask,/routes\.legs\.steps\.navigationInstruction\.maneuver/);
    assert.match(fieldMask,/routes\.legs\.steps\.staticDuration/);
    assert.doesNotMatch(fieldMask,/(^|,)routes\.legs\.steps\.duration(,|$)/);
    assert.doesNotMatch(fieldMask,/(^|,)routes\.legs\.steps\.navigationInstruction(,|$)/);
    return new Response(JSON.stringify({routes:[{
      distanceMeters:1200,duration:'900s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},warnings:['Walking route beta'],
      legs:[{steps:[{distanceMeters:300,staticDuration:'180s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC'},navigationInstruction:{instructions:'Đi thẳng',maneuver:'STRAIGHT'}}]}]
    }]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const response=await worker.fetch(new Request('https://travelos-map.test/route/walking',{
      method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
      body:JSON.stringify({provider:'google',country:'Việt Nam',origin:{lat:10.77,lng:106.69},destination:{lat:10.78,lng:106.70}})
    }),{GOOGLE_MAPS_API_KEY:'google-test',GEOAPIFY_API_KEY:'geo-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.provider,'google_routes');
    assert.equal(data.routes[0].distance,1200);
    assert.ok(data.routes[0].path.length>=2);
    assert.equal(data.routes[0].steps[0].instruction,'Đi thẳng');
    assert.equal(data.routes[0].steps[0].duration,180);
  } finally { globalThis.fetch=originalFetch; }
});

test('Map Worker returns traffic-aware driving geometry and turn-by-turn steps', async () => {
  const { default: worker } = await importWorker('../map-worker/src/index.js');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url,init={}) => {
    assert.equal(String(url),'https://routes.googleapis.com/directions/v2:computeRoutes');
    const requestBody=JSON.parse(String(init.body||'{}'));
    assert.equal(requestBody.travelMode,'DRIVE');
    assert.equal(requestBody.routingPreference,'TRAFFIC_AWARE');
    assert.equal(requestBody.computeAlternativeRoutes,true);
    const fieldMask=init.headers['X-Goog-FieldMask'];
    assert.match(fieldMask,/routes\.legs\.steps\.navigationInstruction\.instructions/);
    assert.match(fieldMask,/routes\.legs\.steps\.navigationInstruction\.maneuver/);
    assert.match(fieldMask,/routes\.legs\.steps\.staticDuration/);
    assert.doesNotMatch(fieldMask,/(^|,)routes\.legs\.steps\.duration(,|$)/);
    assert.doesNotMatch(fieldMask,/(^|,)routes\.legs\.steps\.navigationInstruction(,|$)/);
    return new Response(JSON.stringify({routes:[{
      distanceMeters:8200,duration:'1020s',staticDuration:'900s',description:'QL20',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},
      legs:[{steps:[{distanceMeters:500,staticDuration:'80s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC'},navigationInstruction:{instructions:'Rẽ phải vào QL20',maneuver:'TURN_RIGHT'}}]}]
    }]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const response=await worker.fetch(new Request('https://travelos-map.test/route/directions',{
      method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
      body:JSON.stringify({provider:'google',mode:'drive',country:'Việt Nam',origin:{lat:10.77,lng:106.69},destination:{lat:10.80,lng:106.75}})
    }),{GOOGLE_MAPS_API_KEY:'google-test',GEOAPIFY_API_KEY:'geo-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.mode,'drive');
    assert.equal(data.meta.trafficAware,true);
    assert.equal(data.routes[0].staticDuration,900);
    assert.ok(data.routes[0].path.length>=2);
    assert.equal(data.routes[0].steps[0].instruction,'Rẽ phải vào QL20');
    assert.equal(data.routes[0].steps[0].duration,80);
  } finally { globalThis.fetch=originalFetch; }
});

test('Browser route service falls back to Geoapify when Worker has no route secrets', async () => {
  const source=await readFile(new URL('../route-service.js',import.meta.url),'utf8');
  const calls=[];
  const context={URLSearchParams,Response,console,window:{CONFIG:{MAP_WORKER_URL:'https://worker.test',GEOAPIFY_BROWSER_KEY:'geo-browser-test'}},fetch:async url=>{
    calls.push(String(url));
    if(String(url).startsWith('https://worker.test'))return new Response(JSON.stringify({error:'Worker chưa có secret GEOAPIFY_API_KEY.'}),{status:500,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({features:[{properties:{distance:1800,time:360,legs:[{steps:[{distance:300,time:60,from_index:0,to_index:1,instruction:{text:'Rẽ phải',streets:['QL20']}}]}]},geometry:{coordinates:[[[106.69,10.77],[106.70,10.78]]]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }};
  vm.runInNewContext(source,context);
  const data=await context.window.TravelDirections.request({provider:'google',mode:'drive',origin:{lat:10.77,lng:106.69},destination:{lat:10.78,lng:106.70},language:'vi'});
  assert.equal(calls.length,2);
  assert.match(calls[1],/api\.geoapify\.com\/v1\/routing/);
  assert.match(calls[1],/mode=drive/);
  assert.equal(data.provider,'geoapify');
  assert.equal(data.meta.browserFallback,true);
  assert.equal(data.routes[0].steps[0].instruction,'Rẽ phải');
});

test('Browser route service prefers Google Directions before Geoapify fallback', async () => {
  const source=await readFile(new URL('../route-service.js',import.meta.url),'utf8');
  const latLng=(lat,lng)=>({lat:()=>lat,lng:()=>lng});
  const calls=[];
  class DirectionsService {
    route(request,callback){
      assert.equal(request.travelMode,'DRIVING');
      assert.ok(request.drivingOptions.departureTime);
      callback({routes:[{summary:'QL20',overview_path:[latLng(10.77,106.69),latLng(10.78,106.70)],legs:[{distance:{value:1800},duration:{value:420},duration_in_traffic:{value:480},steps:[{instructions:'Rẽ phải vào <b>QL20</b>',distance:{value:300},duration:{value:60},maneuver:'turn-right',path:[latLng(10.77,106.69),latLng(10.78,106.70)]}]}]}]},'OK');
    }
  }
  const context={URLSearchParams,Response,console,Date,window:{CONFIG:{MAP_WORKER_URL:'https://worker.test',GEOAPIFY_BROWSER_KEY:'geo-browser-test'},google:{maps:{DirectionsService,TravelMode:{DRIVING:'DRIVING',WALKING:'WALKING'},UnitSystem:{METRIC:0},TrafficModel:{BEST_GUESS:'bestguess'}}}},fetch:async url=>{
    calls.push(String(url));
    return new Response(JSON.stringify({error:'Worker chưa có GOOGLE_MAPS_API_KEY.'}),{status:500,headers:{'Content-Type':'application/json'}});
  }};
  vm.runInNewContext(source,context);
  const data=await context.window.TravelDirections.request({provider:'google',mode:'drive',origin:{lat:10.77,lng:106.69},destination:{lat:10.78,lng:106.70}});
  assert.equal(calls.length,1);
  assert.equal(data.provider,'google_directions_js');
  assert.equal(data.routes[0].duration,480);
  assert.equal(data.routes[0].staticDuration,420);
  assert.equal(data.routes[0].steps[0].instruction,'Rẽ phải vào QL20');
});

test('Google map provider rejects the rendered authorization error screen', async () => {
  const source=await readFile(new URL('../google-maps-provider.js',import.meta.url),'utf8');
  const observers=[];
  class FakeMutationObserver {
    constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}
    observe(){}
    disconnect(){this.disconnected=true;}
  }
  class FakeMap {}
  const browserWindow=new EventTarget();
  browserWindow.google={maps:{Map:FakeMap,event:{addListenerOnce:()=>({remove(){}}),clearInstanceListeners(){}},RenderingType:{VECTOR:'VECTOR'}}};
  const context={
    window:browserWindow,document:{},MutationObserver:FakeMutationObserver,Event,
    setTimeout,clearTimeout,requestAnimationFrame:callback=>callback(),console
  };
  vm.runInNewContext(source,context);
  const container={style:{},authError:false,querySelector(){return this.authError?{}:null;}};
  const pending=browserWindow.GoogleMapProvider.createMap(container,{lat:10.77,lng:106.69},false);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(observers.length,1);
  container.authError=true;
  observers[0].callback();
  await assert.rejects(pending,error=>error?.code==='GOOGLE_MAP_AUTH_FAILED');
  assert.equal(observers[0].disconnected,true);
});

test('Geoapify map provider follows live user positions', async () => {
  const source=await readFile(new URL('../geoapify-navigation/geoapify-provider.js',import.meta.url),'utf8');
  const marker={positions:[],addTo(){return this;},setLatLng(point){this.positions.push(point);}};
  const map={pans:[],panTo(point,options){this.pans.push({point,options});},removeLayer(){}};
  const context={window:{CONFIG:{GEOAPIFY_BROWSER_KEY:'geo-test'},L:{Browser:{retina:false},divIcon:options=>options,marker:()=>marker}},setTimeout,console};
  vm.runInNewContext(source,context);
  const first=context.window.GeoapifyMapProvider.updateNavigationPosition(map,{lat:10.77,lng:106.69},true);
  const second=context.window.GeoapifyMapProvider.updateNavigationPosition(map,{lat:10.78,lng:106.70},true);
  assert.equal(first,marker);
  assert.equal(second,marker);
  assert.deepEqual(JSON.parse(JSON.stringify(marker.positions)),[[10.78,106.7]]);
  assert.equal(map.pans.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(map.pans[1].point)),[10.78,106.7]);
});

test('Global navigation renders Geoapify, requests Google walking, and tracks GPS', async () => {
  const [navigation,chinaNavigation,app,nearby,index]=await Promise.all([
    readFile(new URL('../geoapify-navigation/geoapify-navigation.js',import.meta.url),'utf8'),
    readFile(new URL('../china-navigation/travel-navigation.js',import.meta.url),'utf8'),
    readFile(new URL('../app.js',import.meta.url),'utf8'),
    readFile(new URL('../nearby-search.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(navigation,/provider:'google',mode:'walk'/);
  assert.match(navigation,/navigator\.geolocation\.watchPosition/);
  assert.match(navigation,/dir_action:'navigate'/);
  assert.match(navigation,/data-mode="motorbike"/);
  assert.match(navigation,/openGoogleDirections\('two-wheeler'\)/);
  assert.match(navigation,/openGoogleDirections\('driving'\)/);
  assert.match(navigation,/destination-summary/);
  assert.doesNotMatch(navigation,/Google tính tuyến và hướng dẫn/);
  assert.match(app,/GeoapifyNavigation\.open\(\{ destination, mode: 'walk' \}\)/);
  assert.match(nearby,/GeoapifyNavigation\.open\(\{destination,mode:'walk',onBack:/);
  assert.match(nearby,/navigator\.geolocation\.watchPosition/);
  assert.match(nearby,/Vị trí của bạn/);
  assert.match(navigation,/class="geo-back"/);
  assert.match(navigation,/backToList/);
  assert.match(chinaNavigation,/class="tn-back"/);
  assert.match(chinaNavigation,/backToList/);
  assert.doesNotMatch(index,/src="google-maps-provider\.js/);
  assert.doesNotMatch(index,/src="google-navigation\.js/);
});

test('AI chat consistently uses tôi and bạn instead of tui and fen', async () => {
  const [chat,worker,index]=await Promise.all([
    readFile(new URL('../chat.js',import.meta.url),'utf8'),
    readFile(new URL('../worker/src/index.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(chat,/Chào bạn! Tôi là Thổ Địa/);
  assert.doesNotMatch(chat,/Lỗi kết nối rồi fen|Chào fen|Tui là/);
  assert.match(worker,/Luôn tự xưng là "tôi" và gọi (người dùng|user) là "bạn"/);
  assert.doesNotMatch(worker,/Fen thử|Fen cho|Tui chưa/);
  assert.match(index,/chat\.js\?v=20261008-1/);
});

test('Destination summary combines Google reviews, weather, BestTime and AI copy', async () => {
  const { default: worker } = await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch;
  const external=[];
  globalThis.fetch=async (url,init={})=>{
    external.push(String(url));
    if(String(url).startsWith('https://api.open-meteo.com/')) return new Response(JSON.stringify({
      timezone:'Asia/Ho_Chi_Minh',current:{temperature_2m:26.2,apparent_temperature:27,precipitation:0,rain:0,weather_code:1,wind_speed_10m:8},current_units:{temperature_2m:'°C'},hourly:{},daily:{}
    }),{status:200,headers:{'Content-Type':'application/json'}});
    if(String(url).startsWith('https://besttime.app/')) return new Response(JSON.stringify({
      status:'OK',analysis:{venue_live_busyness_available:true,venue_live_busyness:68,venue_forecast_busyness_available:true,venue_forecasted_busyness:55,hour_start:16,hour_end:17},venue_info:{venue_name:'Bếp Nhà Tully',venue_address:'Đà Lạt'}
    }),{status:200,headers:{'Content-Type':'application/json'}});
    if(String(url).startsWith('https://generativelanguage.googleapis.com/')) return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Khách thường khen món ăn ngon và nhân viên thân thiện.'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    throw new Error(`Unexpected fetch ${url} ${init.method||'GET'}`);
  };
  const env={
    ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',BESTTIME_PRIVATE_KEY:'private-test',GEMINI_API_KEY:'gemini-test',
    MAP_WORKER:{fetch:async request=>{
      const path=new URL(request.url).pathname;
      if(path==='/weather/current')return new Response(JSON.stringify({ok:true,source:'google-weather-v1',weather:{coordinates:{lat:11.94,lng:108.44},timezone:'Asia/Ho_Chi_Minh',current:{temperature:26.2,condition:'Có mây'}}}),{status:200,headers:{'Content-Type':'application/json'}});
      assert.equal(path,'/poi/details');
      return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',place:{
        id:'place-1',name:'Bếp Nhà Tully',address:'Đà Lạt',lat:11.94,lng:108.44,rating:4.7,userRatingCount:321,
        reviews:[{rating:5,text:'Món ngon, nhân viên rất thân thiện.',publishTime:new Date().toISOString()},{rating:4,text:'Không gian đẹp và phục vụ tốt.',publishTime:new Date().toISOString()}],provider:'google_places'
      }}),{status:200,headers:{'Content-Type':'application/json'}});
    }}
  };
  try{
    const response=await worker.fetch(new Request('https://ai-test.test/destination-summary',{
      method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
      body:JSON.stringify({destination:{name:'Bếp Nhà Tully',address:'Đà Lạt',lat:11.94,lng:108.44,country:'Việt Nam'}})
    }),env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.ok,true);
    assert.equal(data.place.rating,4.7);
    assert.equal(data.place.recentReviewCount,2);
    assert.equal(data.place.recentRating,4.5);
    assert.equal(data.weather.current.temperature,26.2);
    assert.equal(data.busyness.label,'khá đông');
    assert.match(data.reviewSummary,/món ăn ngon/i);
    assert.ok(external.some(url=>url.startsWith('https://besttime.app/')));
    assert.ok(external.some(url=>url.startsWith('https://generativelanguage.googleapis.com/')));
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 plans tools server-side and returns structured nearby evidence', async () => {
  const { default: worker } = await importWorker('../worker/src/index.js');
  const originalFetch = globalThis.fetch;
  let geminiCalls = 0;
  globalThis.fetch = async url => {
    if (!String(url).includes('generativelanguage.googleapis.com')) throw new Error(`Unexpected fetch ${url}`);
    geminiCalls++;
    const text = geminiCalls === 1
      ? JSON.stringify({ goal:'find nearest Pharmacity', responseMode:'LIVE', needsClarification:false, clarificationQuestion:'', isItinerary:false, tools:[{ name:'search_places', category:'pharmacy', placeName:'Pharmacity', radius:3000, limit:6, language:'vi' }] })
      : 'Pharmacity gần nhất cách bạn 120 m.';
    return new Response(JSON.stringify({ candidates:[{ content:{ parts:[{ text }] } }] }), { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  const env = {
    GEMINI_API_KEY:'test',
    ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',
    MAP_WORKER:{
      fetch:async request => {
        const body=await request.json();
        assert.equal(body.name,'Pharmacity');
        assert.equal(body.category,'pharmacy');
        assert.equal(body.center.lat,10.77);
        assert.equal(body.center.lng,106.69);
        return new Response(JSON.stringify({ ok:true, source:'geoapify-places-v2', provider:'geoapify', center:body.center, pois:[{ id:'p1', name:'Nhà thuốc Pharmacity', address:'123 Test', lat:10.77, lng:106.69, distance:120, provider:'geoapify' }] }), { status:200, headers:{ 'Content-Type':'application/json' } });
      }
    }
  };
  try {
    const response=await worker.fetch(new Request('https://ai.test/ai-v3', {
      method:'POST', headers:{ Origin:'https://kyuu2601-star.github.io', 'Content-Type':'application/json' },
      body:JSON.stringify({ userMessage:'Pharmacity gần nhất?', userLocation:{ country:'Việt Nam', city:'TP.HCM', latitude:10.77, longitude:106.69, source:'gps' }, chatHistory:[] })
    }), env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.travelos.version,3);
    assert.equal(data.travelos.plan.tools[0].placeName,'Pharmacity');
    assert.equal(data.travelos.nearby.pois[0].name,'Nhà thuốc Pharmacity');
    assert.equal(data.travelos.sources[0].source,'geoapify-places-v2');
    assert.equal(geminiCalls,2);
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test('AI v3 resolves a remote area before searching there instead of using current GPS', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch;let geminiCalls=0;const mapPaths=[];
  globalThis.fetch=async url=>{
    if(!String(url).includes('generativelanguage.googleapis.com'))throw new Error(`Unexpected fetch ${url}`);
    geminiCalls++;
    const text=geminiCalls===1
      ? JSON.stringify({goal:'tìm gà rán quanh Landmark 81',responseMode:'LIVE',needsClarification:false,clarificationQuestion:'',isItinerary:false,tools:[{name:'resolve_place',query:'Landmark 81, TP.HCM',language:'vi',limit:3},{name:'search_places',query:'gà rán',category:'restaurant',radius:2500,limit:6,language:'vi'}]})
      : 'Tôi tìm được các quán gà rán quanh Landmark 81 cho bạn.';
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const env={GEMINI_API_KEY:'test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();mapPaths.push(path);
    if(path==='/place/resolve'){
      assert.equal(body.query,'Landmark 81, TP.HCM');
      assert.equal(body.center,null);
      return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'landmark-81',name:'Landmark 81',address:'Bình Thạnh, TP.HCM',lat:10.7948,lng:106.7218,country:'Việt Nam',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.equal(path,'/poi/nearby');
    assert.equal(body.query,'gà rán');
    assert.equal(body.center.lat,10.7948);
    assert.equal(body.center.lng,106.7218);
    assert.notEqual(body.center.lat,16.0544);
    return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',center:body.center,pois:[{id:'chicken-1',name:'Gà Rán Test',address:'Bình Thạnh, TP.HCM',lat:10.795,lng:106.722,distance:80,provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Khu vực mục tiêu là Landmark 81; hãy tìm giúp tôi các nơi bán gà rán',userLocation:{country:'Việt Nam',city:'Đà Nẵng',latitude:16.0544,longitude:108.2022,source:'gps'},chatHistory:[]})}),env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.deepEqual(mapPaths,['/place/resolve','/poi/nearby']);
    assert.equal(data.travelos.nearby.pois[0].name,'Gà Rán Test');
    assert.match(data.text,/Tôi tìm được/);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 handles an explicit remote-area search even when Gemini is unavailable', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const paths=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();paths.push(path);
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'landmark-81',name:'Landmark 81',address:'Bình Thạnh, TP.HCM',lat:10.7951,lng:106.7221,country:'Việt Nam',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(body.query,'quán gà rán');
    assert.equal(body.center.lat,10.7951);
    assert.equal(body.center.lng,106.7221);
    return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',center:body.center,pois:[{id:'chicken-1',name:'Haeduri Chicken',address:'Bình Thạnh, TP.HCM',lat:10.7952,lng:106.7222,distance:344,provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Tìm quán gà rán quanh Landmark 81 giúp tôi nhé',userLocation:{country:'Việt Nam',city:'Đà Nẵng',latitude:16.0544,longitude:108.2022}})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(paths,['/place/resolve','/poi/nearby']);
  assert.equal(data.travelos.remoteSearch.resolvedArea.name,'Landmark 81');
  assert.equal(data.travelos.nearby.pois[0].name,'Haeduri Chicken');
  assert.match(data.text,/Tôi hiểu khu vực cần tìm/);
});

test('AI v3 cleans casual remote-area wording and requests ten highest-rated places', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'emart-pvt',name:'Emart Phan Văn Trị',address:'Gò Vấp, TP.HCM',lat:10.8273,lng:106.6785,country:'Việt Nam',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',center:body.center,pois:[{id:'top-rated',name:'Gà Rán Rating Cao',address:'Gò Vấp, TP.HCM',lat:10.8275,lng:106.6787,distance:80,rating:4.9,userRatingCount:321,provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Có quán gà rán nào rating cao ở quanh khu vực Emart PVT k'})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(calls[0].path,'/place/resolve');
  assert.equal(calls[0].body.query,'Emart PVT');
  assert.equal(calls[1].path,'/poi/nearby');
  assert.equal(calls[1].body.query,'quán gà rán');
  assert.equal(calls[1].body.limit,10);
  assert.equal(calls[1].body.sortBy,'rating');
  assert.match(data.text,/⭐ 4\.9/);
  assert.equal(data.travelos.remoteSearch.requestedArea,'Emart PVT');
});

test('AI v3 resolves a venue and distinguishes live BestTime busyness from forecast', async () => {
  const { default: worker } = await importWorker('../worker/src/index.js');
  const originalFetch = globalThis.fetch;
  let geminiCalls=0,bestTimeCalls=0;
  globalThis.fetch=async (url,init={}) => {
    const target=String(url);
    if(target.includes('generativelanguage.googleapis.com')) {
      geminiCalls++;
      const text=geminiCalls===1
        ? JSON.stringify({goal:'check live venue busyness',responseMode:'LIVE',needsClarification:false,clarificationQuestion:'',isItinerary:false,tools:[{name:'resolve_place',query:'Cafe Test',placeName:'Cafe Test',language:'vi'},{name:'place_busyness',placeName:'Cafe Test',language:'vi'}]})
        : 'Cafe Test hiện đang khá đông.';
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.match(target,/besttime\.app\/api\/v1\/forecasts\/live/);
    assert.equal(init.method,'POST');
    bestTimeCalls++;
    const parsed=new URL(target);
    assert.equal(parsed.searchParams.get('venue_name'),'Cafe Test');
    assert.equal(parsed.searchParams.get('venue_address'),'123 Test, TP.HCM');
    assert.equal(parsed.searchParams.get('api_key_private'),'besttime-test');
    return new Response(JSON.stringify({status:'OK',analysis:{venue_forecasted_busyness:58,venue_forecast_busyness_available:true,venue_live_busyness:72,venue_live_busyness_available:true,venue_live_forecasted_delta:14,hour_start:11,hour_end:12},venue_info:{venue_id:'ven-test',venue_name:'Cafe Test',venue_address:'123 Test, TP.HCM',venue_open:'Open',venue_current_localtime:'Thursday 11:20AM',venue_lat:10.77,venue_lon:106.69,venue_dwell_time_min:30,venue_dwell_time_max:60,venue_dwell_time_avg:45}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const env={
    GEMINI_API_KEY:'test',BESTTIME_PRIVATE_KEY:'besttime-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',
    MAP_WORKER:{fetch:async request=>{
      const body=await request.json();
      assert.equal(body.query,'Cafe Test');
      return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',places:[{id:'google-place-test',name:'Cafe Test',address:'123 Test, TP.HCM',lat:10.77,lng:106.69,provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }}
  };
  try {
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Giờ Cafe Test có đông không?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69},chatHistory:[]})}),env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(bestTimeCalls,1);
    assert.equal(geminiCalls,2);
    assert.equal(data.travelos.busyness.basis,'live');
    assert.equal(data.travelos.busyness.score,72);
    assert.equal(data.travelos.busyness.label,'khá đông');
    assert.equal(data.travelos.sources[1].source,'besttime-live');
  } finally { globalThis.fetch=originalFetch; }
});

test('AI v3 falls back to current-hour BestTime forecast when live busyness is unavailable', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch;
  let geminiCalls=0,bestTimeCalls=0;
  globalThis.fetch=async (url,init={})=>{
    const target=String(url);
    if(target.includes('generativelanguage.googleapis.com')) {
      geminiCalls++;
      const text=geminiCalls===1
        ? JSON.stringify({goal:'forecast venue busyness',responseMode:'LIVE',needsClarification:false,clarificationQuestion:'',isItinerary:false,tools:[{name:'place_busyness',placeName:'Cafe Test',address:'123 Test, TP.HCM',language:'vi'}]})
        : 'Cafe Test thường khá đông vào giờ này.';
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.equal(init.method,'POST');bestTimeCalls++;
    if(target.includes('/forecasts/live')) return new Response(JSON.stringify({status:'Error',message:'No live data available for this venue at this moment.'}),{status:400,headers:{'Content-Type':'application/json'}});
    assert.match(target,/besttime\.app\/api\/v1\/forecasts\/now\/raw/);
    return new Response(JSON.stringify({status:'OK',analysis:{hour_analysis:{hour:19,intensity_nr:2,intensity_txt:'Above average'},hour_raw:68},venue_info:{venue_id:'ven-test',venue_name:'Cafe Test',venue_current_localtime_iso:'Thursday 07:20PM'}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Giờ Cafe Test có đông không?',userLocation:{country:'Việt Nam',city:'TP.HCM'},chatHistory:[]})}),{GEMINI_API_KEY:'test',BESTTIME_PRIVATE_KEY:'besttime-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);assert.equal(geminiCalls,2);assert.equal(bestTimeCalls,2);
    assert.equal(data.travelos.busyness.basis,'forecast');
    assert.equal(data.travelos.busyness.score,68);
    assert.equal(data.travelos.sources[0].source,'besttime-forecast');
  } finally {globalThis.fetch=originalFetch;}
});
