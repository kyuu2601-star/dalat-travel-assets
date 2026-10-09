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
    assert.ok(requestedBody.locationRestriction.rectangle.low);
    assert.ok(requestedBody.locationRestriction.rectangle.high);
    assert.equal(requestedBody.locationBias,undefined);
  } finally { globalThis.fetch=originalFetch; }
});

test('Map Worker expands fried-chicken intent to brands and excludes results outside the requested radius', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async (url,init={})=>{
    const body=JSON.parse(String(init.body||'{}'));requests.push({url:String(url),body});
    const places=body.textQuery==='gà rán'?[
      {id:'local',displayName:{text:'Gà Rán Test'},formattedAddress:'Tân Phú, TP.HCM',location:{latitude:10.8005,longitude:106.63},rating:4.9,userRatingCount:120},
      {id:'too-far',displayName:{text:'Gà Rán Xa'},formattedAddress:'Quá xa',location:{latitude:10.86,longitude:106.63},rating:5,userRatingCount:500}
    ]:[
      {id:'kfc',displayName:{text:'KFC'},formattedAddress:'Gần đây',location:{latitude:10.801,longitude:106.63},rating:4.8,userRatingCount:1200,primaryType:'fast_food_restaurant',types:['fast_food_restaurant','restaurant']},
      {id:'jollibee',displayName:{text:'Jollibee'},formattedAddress:'Gần đây',location:{latitude:10.802,longitude:106.63},rating:4.6,userRatingCount:900},
      {id:'chicken-plus',displayName:{text:'Chicken Plus'},formattedAddress:'Gần đây',location:{latitude:10.803,longitude:106.63},rating:4.5,userRatingCount:500}
    ];
    return new Response(JSON.stringify({places}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.8,lng:106.63},country:'Việt Nam',query:'gà rán',keyword:'gà rán',category:'restaurant',limit:6})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'google-places-expanded-text-v1');
    assert.deepEqual(requests.map(item=>item.body.textQuery),['gà rán','fried chicken KFC Jollibee Chicken Plus Lotteria Popeyes Texas Chicken']);
    assert.ok(requests.every(item=>item.url==='https://places.googleapis.com/v1/places:searchText'));
    assert.ok(requests.every(item=>item.body.locationRestriction?.rectangle));
    assert.ok(requests.every(item=>!item.body.locationBias));
    assert.deepEqual(new Set(data.pois.map(item=>item.id)),new Set(['local','kfc','jollibee','chicken-plus']));
    assert.ok(!data.pois.some(item=>item.id==='too-far'));
    assert.equal(data.pois.find(item=>item.id==='kfc').primaryType,'fast_food_restaurant');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker ranks Google Place candidates by rating when requested', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({places:[
    {id:'near-low',displayName:{text:'Gà gần'},formattedAddress:'100 m',location:{latitude:10.8005,longitude:106.63},rating:4.2,userRatingCount:900},
    {id:'far-high',displayName:{text:'Gà rating cao'},formattedAddress:'500 m',location:{latitude:10.8045,longitude:106.63},rating:4.9,userRatingCount:120},
    {id:'perfect-low-confidence',displayName:{text:'Gà mới mở'},formattedAddress:'200 m',location:{latitude:10.8015,longitude:106.63},rating:5,userRatingCount:2}
  ]}),{status:200,headers:{'Content-Type':'application/json'}});
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.8,lng:106.63},country:'Việt Nam',query:'gà rán',limit:10,candidateLimit:20,sortBy:'rating'})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.pois[0].id,'far-high');
    assert.equal(data.pois[1].id,'near-low');
    assert.equal(data.pois[2].id,'perfect-low-confidence');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker sends translated dish variants to AMap and keeps food evidence', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedUrl='';
  globalThis.fetch=async url=>{
    requestedUrl=String(url);
    return new Response(JSON.stringify({status:'1',info:'OK',count:'1',pois:[{id:'amap-hotpot',name:'海底捞火锅',address:'王府井大街88号',location:'116.411,39.914',type:'餐饮服务;中餐厅;火锅店',typecode:'050117',cityname:'北京市',adname:'东城区',business:{tag:'四川火锅;服务热情',rating:'4.8',cost:'128',business_area:'王府井',opentime_today:'10:00-24:00'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:39.914,lng:116.411},country:'Trung Quốc',query:'火锅',keyword:'火锅',queryVariants:['重庆火锅'],category:'restaurant',radius:3000,limit:10})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),url=new URL(requestedUrl);
    assert.equal(response.status,200);
    assert.equal(url.hostname,'restapi.amap.com');
    assert.equal(url.searchParams.get('keywords'),'火锅|重庆火锅');
    assert.equal(url.searchParams.get('show_fields'),'business,navi');
    assert.equal(data.pois[0].tag,'四川火锅;服务热情');
    assert.equal(data.pois[0].cost,'128');
    assert.equal(data.pois[0].rating,'4.8');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker replaces a Vietnamese pharmacy category with the native AMap keyword', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedUrl='';
  globalThis.fetch=async url=>{
    requestedUrl=String(url);
    return new Response(JSON.stringify({status:'1',info:'OK',count:'1',pois:[{id:'amap-pharmacy',name:'唐氏药房',address:'人民路158号',location:'106.551,29.566',cityname:'重庆市',adname:'渝中区',business:{rating:'4.6'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:29.5657,lng:106.5512},country:'Trung Quốc',query:'nhà thuốc',keyword:'nhà thuốc',category:'pharmacy',radius:3000,limit:10})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),url=new URL(requestedUrl);
    assert.equal(response.status,200);
    assert.equal(url.searchParams.get('keywords'),'药店');
    assert.doesNotMatch(url.searchParams.get('keywords'),/nhà thuốc/i);
    assert.equal(data.pois[0].name,'唐氏药房');
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
  const [navigation,chinaNavigation,provider,nearbyCss,app,nearby,index]=await Promise.all([
    readFile(new URL('../geoapify-navigation/geoapify-navigation.js',import.meta.url),'utf8'),
    readFile(new URL('../china-navigation/travel-navigation.js',import.meta.url),'utf8'),
    readFile(new URL('../geoapify-navigation/geoapify-provider.js',import.meta.url),'utf8'),
    readFile(new URL('../nearby-search.css',import.meta.url),'utf8'),
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
  assert.match(nearby,/nearby-user-person/);
  assert.match(nearby,/tới điểm tìm/);
  assert.match(nearby,/nearby-pin-center/);
  assert.match(nearby,/class="nearby-chat-head" role="button" tabindex="0"/);
  assert.match(nearby,/mapWrap\?\.addEventListener\('click'/);
  assert.match(nearby,/poi\.localizedName\|\|poi\.name/);
  assert.match(nearby,/nearby-poi-note/);
  assert.match(nearby,/function coordinateSystemOf/);
  assert.match(nearby,/['"]gcj02['"]/);
  assert.match(provider,/attributionControl\?\.setPrefix/);
  assert.match(provider,/© <a href="https:\/\/www\.geoapify\.com\//);
  assert.match(nearbyCss,/nearby-mini-map \.leaflet-control-attribution/);
  assert.match(nearbyCss,/\.nearby-poi-note/);
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
  assert.match(index,/chat\.js\?v=20261009-2/);
});

test('Chat history restores the nearby map card for 24 hours without sending map payloads back to Gemini', async () => {
  const source=await readFile(new URL('../chat.js',import.meta.url),'utf8');
  const store=new Map(),rendered=[],chatBox={children:[],scrollTop:0,scrollHeight:100,appendChild(node){this.children.push(node);}};
  const context={console,Date,AbortController,setTimeout,clearTimeout,localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},document:{getElementById:id=>id==='chat-box'?chatBox:null,createElement:()=>({className:'',innerHTML:'',textContent:''})},window:{TravelNearby:{render:(payload,node)=>rendered.push({payload,node})}}};
  vm.createContext(context);vm.runInContext(source,context);
  const nearby={source:'amap-place-v5',provider:'amap',query:'nhà thuốc',center:{lat:29.55,lng:106.57,country:'China',coordSystem:'wgs84'},pois:[{id:'poi-1',name:'药房',address:'重庆市',lat:29.551,lng:106.571,provider:'amap',distance:120,rating:4.7,reviews:[{text:'must not persist'}]}]};
  context.saveMessage('ai','Tôi tìm được một địa điểm.',{nearby});
  const saved=JSON.parse(store.get('travelos_chat_history'));
  assert.equal(saved.version,2);
  assert.equal(saved.messages[0].nearby.pois[0].name,'药房');
  assert.equal(saved.messages[0].nearby.pois[0].coordSystem,'gcj02');
  assert.equal(saved.messages[0].nearby.pois[0].reviews,undefined);
  chatBox.children.length=0;
  context.loadChatHistory();
  assert.equal(chatBox.children.length,1);
  assert.equal(rendered.length,1);
  assert.equal(rendered[0].payload.pois[0].poiId,'poi-1');
  assert.equal(rendered[0].node,chatBox.children[0]);
  assert.match(source,/chatHistoryArray = chatHistoryArray\.map\(message => \(\{ role:message\.role, content:message\.content \}\)\)/);
});

test('App keeps onboarding visible until places and bot readiness settle', async () => {
  const [app,chat,index]=await Promise.all([
    readFile(new URL('../app.js',import.meta.url),'utf8'),
    readFile(new URL('../chat.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(app,/Promise\.allSettled\(\[placesTask, botTask\]\)/);
  assert.match(app,/DOMContentLoaded/);
  assert.match(app,/window\.isSystemLive = true/);
  assert.doesNotMatch(app,/GPS ERROR: PLEASE ENABLE LOCATION/);
  assert.match(chat,/\/api\/health/);
  assert.match(index,/Đang khởi động TravelOS/);
  assert.match(index,/app\.js\?v=20261008-4/);
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
        assert.equal(body.limit,10);
        assert.equal(body.sortBy,'distance');
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
    assert.equal(body.limit,10);
    assert.equal(body.sortBy,'distance');
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
    assert.equal(body.limit,10);
    assert.equal(body.sortBy,'distance');
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

test('AI v3 translates a China dish query and returns Vietnamese AMap notes', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async (url,init={})=>{
    if(!String(url).includes('generativelanguage.googleapis.com'))throw new Error(`Unexpected fetch ${url}`);
    const payload=JSON.parse(String(init.body||'{}')),prompt=payload.systemInstruction?.parts?.[0]?.text||'';
    const text=prompt.includes('chuẩn hóa truy vấn')
      ? JSON.stringify({providerQuery:'火锅',queryVariants:['重庆火锅','四川火锅'],requestedDish:'lẩu'})
      : JSON.stringify({items:[{id:'amap-hotpot',localizedName:'Haidilao Hot Pot (海底捞火锅)',localizedAddress:'88 phố Vương Phủ Tỉnh, Bắc Kinh',note:'Nổi bật với lẩu Tứ Xuyên và dịch vụ nhiệt tình.',confidence:'confirmed'}]});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const env={GEMINI_API_KEY:'test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'wangfujing',name:'王府井',address:'北京市东城区',lat:39.914,lng:116.411,country:'Trung Quốc',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(body.query,'火锅');
    assert.deepEqual(body.queryVariants,['重庆火锅','四川火锅']);
    assert.equal(body.language,'zh');
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,pois:[{id:'amap-hotpot',name:'海底捞火锅',address:'王府井大街88号',lat:39.9142,lng:116.4112,coordSystem:'gcj02',distance:40,rating:'4.8',tag:'四川火锅;服务热情',cost:'128',provider:'amap',country:'Trung Quốc'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Tìm quán lẩu quanh Vương Phủ Tỉnh',userLocation:{country:'Trung Quốc',city:'Bắc Kinh'}})}),env);
    const data=await response.json(),poi=data.travelos.nearby.pois[0];
    assert.equal(response.status,200);
    assert.deepEqual(calls.map(call=>call.path),['/place/resolve','/poi/nearby']);
    assert.equal(calls[1].body.center.coordSystem,'wgs84');
    assert.equal(poi.coordSystem,'gcj02');
    assert.equal(poi.poiId,'amap-hotpot');
    assert.equal(poi.localizedName,'Haidilao Hot Pot (海底捞火锅)');
    assert.equal(poi.localizedAddress,'88 phố Vương Phủ Tỉnh, Bắc Kinh');
    assert.equal(poi.note,'Nổi bật với lẩu Tứ Xuyên và dịch vụ nhiệt tình.');
    assert.equal(poi.noteConfidence,'confirmed');
    assert.match(data.text,/Haidilao Hot Pot/);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 localizes AMap places and translates food tags without a Gemini key', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve'&&body.query==='Vương Phủ Tỉnh')return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'wangfujing',name:'王府井大街',address:'北京市东城区',lat:39.914,lng:116.411,country:'Trung Quốc',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    if(path==='/poi/nearby'){
      assert.equal(body.query,'火锅');
      assert.equal(body.language,'zh');
      return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,pois:[{id:'amap-hotpot',name:'海底捞火锅',address:'王府井大街88号',lat:39.9142,lng:116.4112,distance:40,rating:'4.8',tag:'四川火锅;牛肉;服务热情',cost:'128',provider:'amap',country:'Trung Quốc'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.equal(path,'/place/resolve');
    assert.match(body.query,/海底捞火锅/);
    assert.equal(body.language,'vi');
    return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'google-hotpot',name:'Haidilao Hot Pot',address:'88 Wangfujing Street, Bắc Kinh, Trung Quốc',lat:39.91421,lng:116.41121,country:'Trung Quốc',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Tìm quán lẩu quanh Vương Phủ Tỉnh',userLocation:{country:'Trung Quốc',city:'Bắc Kinh'}})}),env);
  const data=await response.json(),poi=data.travelos.nearby.pois[0];
  assert.equal(response.status,200);
  assert.deepEqual(calls.map(call=>call.path),['/place/resolve','/poi/nearby','/place/resolve']);
  assert.equal(poi.localizedName,'Haidilao Hot Pot');
  assert.equal(poi.localizedAddress,'88 Wangfujing Street, Bắc Kinh, Trung Quốc');
  assert.match(poi.note,/lẩu Tứ Xuyên/);
  assert.match(poi.note,/thịt bò/);
  assert.match(data.text,/Haidilao Hot Pot/);
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

test('AMap walking retries without a mismatched POI ID so the path reaches the requested marker', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requested=[];
  globalThis.fetch=async url=>{
    const parsed=new URL(String(url));requested.push(parsed);
    const usesPoiId=parsed.searchParams.has('destination_id');
    const polyline=usesPoiId
      ? '106.574310,29.556984;106.579588,29.554878'
      : '106.574310,29.556984;106.577287,29.554965';
    return new Response(JSON.stringify({status:'1',info:'OK',infocode:'10000',route:{paths:[{distance:usesPoiId?'685':'364',cost:{duration:'300'},steps:[{instruction:'Đi bộ tới điểm đến',polyline}]}]}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/route/walking',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({country:'China',provider:'amap',origin:{lat:29.5569256,lng:106.5742115,coordSystem:'gcj02'},destination:{lat:29.555101,lng:106.577417,coordSystem:'gcj02',poiId:'WRONG-BUT-VALID-POI'},alternativeRoute:3,isIndoor:true})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),last=data.routes[0].steps[0].path.at(-1);
    assert.equal(response.status,200);
    assert.equal(requested.length,2);
    assert.equal(requested[0].searchParams.get('destination_id'),'WRONG-BUT-VALID-POI');
    assert.equal(requested[1].searchParams.has('destination_id'),false);
    assert.equal(data.meta.endpointFallback,'coordinate-only');
    assert.equal(data.meta.profile,'indoor-multi-coordinates');
    assert.deepEqual(last,{lng:106.577287,lat:29.554965});
    assert.ok(data.meta.attempts[0].endpointValidation.routes[0].endGap>120);
    assert.ok(data.meta.attempts[1].endpointValidation.routes[0].endGap<120);
  }finally{globalThis.fetch=originalFetch;}
});

test('AMap walking retries Route 2.0 with coordinates when its POI request is out of service', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requested=[];
  globalThis.fetch=async url=>{
    const parsed=new URL(String(url));requested.push(parsed);
    assert.match(parsed.pathname,/\/v5\/direction\/walking/);
    if(parsed.searchParams.has('destination_id'))return new Response(JSON.stringify({status:'0',info:'OUT_OF_SERVICE',infocode:'20800'}),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({status:'1',info:'OK',infocode:'10000',route:{paths:[{distance:'364',cost:{duration:'300'},steps:[{instruction:'沿电梯步行至目的地',step_distance:'364',cost:{duration:'300'},navi:{walk_type:'9'},polyline:'106.574310,29.556984;106.577287,29.554965'}]}]}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/route/walking',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({country:'China',provider:'amap',origin:{lat:29.5569256,lng:106.5742115,coordSystem:'gcj02'},destination:{lat:29.555101,lng:106.577417,coordSystem:'gcj02',poiId:'B0IR0CUPS1'},alternativeRoute:3,isIndoor:true})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(requested.length,2);
    assert.equal(requested[0].searchParams.get('destination_id'),'B0IR0CUPS1');
    assert.equal(requested[1].searchParams.has('destination_id'),false);
    assert.equal(data.source,'amap-route-v2');
    assert.equal(data.meta.endpointFallback,'coordinate-only');
    assert.equal(data.meta.profile,'indoor-multi-coordinates');
    assert.equal(data.routes[0].distance,364);
    assert.equal(data.routes[0].steps[0].walkType,'9');
  }finally{globalThis.fetch=originalFetch;}
});

test('AMap walking never falls back outside Route 2.0', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requested=[];
  globalThis.fetch=async url=>{
    const target=String(url);requested.push(target);
    assert.match(target,/\/v5\/direction\/walking/);
    return new Response(JSON.stringify({status:'0',info:'OUT_OF_SERVICE',infocode:'20800'}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/route/walking',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({country:'China',provider:'amap',origin:{lat:29.5569256,lng:106.5742115,coordSystem:'gcj02'},destination:{lat:29.555101,lng:106.577417,coordSystem:'gcj02'},alternativeRoute:3,isIndoor:true})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,502);
    assert.ok(requested.length>=2);
    assert.ok(requested.every(target=>target.includes('/v5/direction/walking')));
    assert.match(data.error,/AMap Route 2\.0: OUT_OF_SERVICE/);
  }finally{globalThis.fetch=originalFetch;}
});

test('AMap provider clears a stale canvas and falls back to 2D when 3D never finishes rendering', async () => {
  const source=await readFile(new URL('../china-navigation/amap-provider.js',import.meta.url),'utf8');
  const instances=[];
  const container={clears:0,replaceChildren(){this.clears++;},querySelector(){return null;}};
  class FakeMap{
    constructor(node,options){this.node=node;this.options=options;this.destroyed=false;instances.push(this);}
    once(event,callback){if(event==='complete'&&this.options.viewMode==='2D')queueMicrotask(callback);}
    resize(){}
    setCenter(){}
    clearMap(){}
    destroy(){this.destroyed=true;}
  }
  const context={console,URL,Promise,queueMicrotask,requestAnimationFrame:callback=>callback(),setTimeout:callback=>setImmediate(callback),clearTimeout:handle=>clearImmediate(handle),document:{getElementById:id=>id==='tn-map'?container:null,querySelector:()=>null,createElement:()=>({}),head:{appendChild(){}}},window:{AMap:{Map:FakeMap,Walking:function(){}},CHINA_NAV_CONFIG:{},GCJ02:{wgs84ToGcj02:(lat,lng)=>({lat,lng})}}};
  vm.runInNewContext(source,context);
  const map=await context.window.AMapProvider.createMap('tn-map',{lat:29.55,lng:106.57,coordSystem:'gcj02',country:'China'});
  assert.equal(instances.length,2);
  assert.equal(instances[0].options.viewMode,'3D');
  assert.equal(instances[0].destroyed,true);
  assert.equal(instances[1].options.viewMode,'2D');
  assert.equal(map.__travelosFallback2D,true);
  assert.equal(container.clears,2);
});
