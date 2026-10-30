import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function importWorker(path) {
  return import(`${new URL(path,import.meta.url).href}?test=${Date.now()}-${Math.random()}`);
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

test('Map Worker uses dish-specific text searches for food quality instead of generic nearby restaurants', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async (url,init={})=>{
    const body=JSON.parse(String(init.body||'{}'));requests.push({url:String(url),body});
    return new Response(JSON.stringify({places:[{id:'seafood-1',displayName:{text:'Hải Sản Gò Vấp'},formattedAddress:'Gò Vấp',location:{latitude:10.8351,longitude:106.67},primaryType:'seafood_restaurant',types:['restaurant','seafood_restaurant'],rating:4.6,userRatingCount:200}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.835,lng:106.67},country:'Việt Nam',query:'seafood restaurant',keyword:'seafood restaurant',queryVariants:['crab'],category:'restaurant',preferTextSearch:true,radius:3000,limit:10,candidateLimit:50})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'google-places-expanded-text-v1');
    assert.equal(data.pois[0].id,'seafood-1');
    assert.deepEqual(requests.map(item=>item.body.textQuery),['seafood restaurant','crab']);
    assert.ok(requests.every(item=>item.url.endsWith('places:searchText')));
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker ranks an exact named place above a closer partial match inside 50 km', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedBody=null;
  globalThis.fetch=async (url,init={})=>{
    requestedBody=JSON.parse(String(init.body||'{}'));
    return new Response(JSON.stringify({places:[
      {id:'near-partial',displayName:{text:'Bảo tàng Thành phố'},formattedAddress:'Cách 1 km',location:{latitude:10.78,longitude:106.69},rating:4.8,userRatingCount:900},
      {id:'exact-address-only',displayName:{text:'Bảo tàng Chứng tích Chiến tranh'},formattedAddress:'Cách 500 m',location:{latitude:10.774,longitude:106.69},primaryType:'premise',types:['premise']},
      {id:'exact',displayName:{text:'Bảo tàng Chứng tích Chiến tranh'},formattedAddress:'Cách 8 km',location:{latitude:10.84,longitude:106.69},rating:4.7,userRatingCount:12000,businessStatus:'OPERATIONAL',primaryType:'museum',types:['museum','tourist_attraction']},
      {id:'far-unrelated',displayName:{text:'War Coffee'},formattedAddress:'Cách 3 km',location:{latitude:10.80,longitude:106.69},rating:4.9,userRatingCount:100}
    ]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.77,lng:106.69},country:'Việt Nam',query:'Bảo tàng Chứng tích Chiến tranh',keyword:'Bảo tàng Chứng tích Chiến tranh',name:'Bảo tàng Chứng tích Chiến tranh',radius:50000,limit:5,candidateLimit:30,sortBy:'name_similarity'})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(requestedBody.textQuery,'Bảo tàng Chứng tích Chiến tranh');
    assert.ok(requestedBody.locationRestriction.rectangle);
    assert.equal(data.query.radius,50000);
    assert.equal(data.query.sortBy,'name_similarity');
    assert.equal(data.pois[0].id,'exact');
    assert.equal(data.pois[0].nameMatchScore,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker searches convenience-store categories with Google Nearby distance ranking', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;const requests=[];
  globalThis.fetch=async (url,init={})=>{
    const requestedUrl=String(url),requestedBody=JSON.parse(String(init.body||'{}'));requests.push({url:requestedUrl,body:requestedBody});
    const places=requestedBody.textQuery?[{id:'gs25-near',displayName:{text:'GS25 - Phan Văn Trị'},formattedAddress:'Ngay bên cạnh',location:{latitude:10.7701,longitude:106.69},primaryType:'store',types:['store']}]:[
      {id:'viettel',displayName:{text:'Viettel Store'},formattedAddress:'Điện thoại',location:{latitude:10.77005,longitude:106.69},primaryType:'electronics_store',types:['electronics_store','store','convenience_store']},
      {id:'the-gioi-di-dong',displayName:{text:'Thế Giới Di Động'},formattedAddress:'Điện thoại',location:{latitude:10.77006,longitude:106.69},primaryType:'cell_phone_store',types:['cell_phone_store','store']},
      {id:'store-far',displayName:{text:'Cửa hàng xa'},formattedAddress:'Xa hơn',location:{latitude:10.78,longitude:106.69},primaryType:'convenience_store',types:['convenience_store','store']}
    ];return new Response(JSON.stringify({places}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.77,lng:106.69},country:'Việt Nam',query:'CHTL',keyword:'CHTL',category:'convenience_store',radius:3000,limit:10,candidateLimit:40,sortBy:'distance'})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'google-places-multi-pass-v1');
    assert.equal(data.pois[0].id,'gs25-near');
    assert.deepEqual(data.pois.map(place=>place.id),['gs25-near','store-far']);
    assert.equal(requests.length,4);
    assert.equal(requests.filter(item=>item.url==='https://places.googleapis.com/v1/places:searchNearby').length,2);
    assert.deepEqual(requests.filter(item=>item.body.textQuery).map(item=>item.body.textQuery),['CHTL','convenience store']);
    assert.ok(requests.some(item=>item.body.locationRestriction?.circle?.radius===700));
    assert.ok(requests.filter(item=>item.body.includedTypes).every(item=>item.body.includedTypes[0]==='convenience_store'&&item.body.rankPreference==='DISTANCE'&&item.body.maxResultCount===20));
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker keeps Nearby category passes when the AI Worker adds search synonyms', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async (url,init={})=>{
    const body=JSON.parse(String(init.body||'{}'));requests.push({url:String(url),body});
    const places=body.includedTypes?[{id:'nearby-store',displayName:{text:'Cửa hàng tiện lợi cạnh nhà'},formattedAddress:'Gần đây',location:{latitude:10.7701,longitude:106.69},primaryType:'convenience_store',types:['convenience_store']}]:[{id:'far-text-store',displayName:{text:'Cửa hàng tiện lợi xa'},formattedAddress:'Xa hơn',location:{latitude:10.78,longitude:106.69},primaryType:'convenience_store',types:['convenience_store']}];
    return new Response(JSON.stringify({places}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.77,lng:106.69},country:'Việt Nam',query:'cửa hàng tiện lợi',keyword:'cửa hàng tiện lợi',queryVariants:['minimart'],category:'convenience_store',radius:3000,limit:10,candidateLimit:50})}),{GOOGLE_MAPS_API_KEY:'test'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'google-places-multi-pass-v1');
    assert.equal(data.pois[0].id,'nearby-store');
    assert.equal(requests.filter(item=>item.body.includedTypes?.[0]==='convenience_store').length,2);
    assert.ok(requests.some(item=>item.body.textQuery==='minimart'));
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker reads the next Google text page before selecting nearby places', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async (url,init={})=>{
    const body=JSON.parse(String(init.body||'{}'));requests.push({url:String(url),body});
    const second=body.textQuery==='cửa hàng tiện lợi'&&body.pageToken==='page-two';
    const data=second?{places:[{id:'shop-second-page',displayName:{text:'Cửa hàng tiện lợi cạnh nhà'},formattedAddress:'Gần đây',location:{latitude:10.7701,longitude:106.69},primaryType:'convenience_store',types:['convenience_store']}]}:body.textQuery==='cửa hàng tiện lợi'?{places:[],nextPageToken:'page-two'}:{places:[]};
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({center:{lat:10.77,lng:106.69},country:'Việt Nam',query:'cửa hàng tiện lợi',keyword:'cửa hàng tiện lợi',category:'convenience_store',radius:3000,limit:10,candidateLimit:50})}),{GOOGLE_MAPS_API_KEY:'test'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.pois[0].id,'shop-second-page');
    assert.ok(requests.some(item=>item.body.pageToken==='page-two'));
    assert.ok(requests.filter(item=>item.body.textQuery).every(item=>item.body.locationRestriction?.rectangle));
  }finally{globalThis.fetch=originalFetch;}
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
    assert.ok(data.query.keywords.includes('火锅'));
    assert.ok(data.query.keywords.includes('重庆火锅'));
    assert.equal(url.searchParams.get('show_fields'),'business,navi');
    assert.equal(data.pois[0].tag,'四川火锅;服务热情');
    assert.equal(data.pois[0].cost,'128');
    assert.equal(data.pois[0].rating,'4.8');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker translates and similarity-ranks a named China place with AMap', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requestedUrls=[];
  globalThis.fetch=async url=>{
    requestedUrls.push(String(url));
    const places=String(url).includes('/place/text')
      ?[{id:'exact-raffles',name:'重庆来福士广场',address:'接圣街8号',location:'106.586,29.566',cityname:'重庆市',type:'购物服务;商场;购物中心',business:{rating:'4.7',business_status:'营业中',opentime_today:'10:00-22:00'}}]
      :[{id:'near-other',name:'重庆来福士住宅',address:'接圣街8号',location:'106.585,29.565',cityname:'重庆市',type:'商务住宅;住宅区;住宅区',business:{rating:'4.6'}}];
    return new Response(JSON.stringify({status:'1',info:'OK',count:String(places.length),pois:places}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:29.563,lng:106.551},country:'Trung Quốc',query:'Raffles City Trùng Khánh',keyword:'Raffles City Trùng Khánh',name:'Raffles City Trùng Khánh',radius:50000,limit:5,sortBy:'name_similarity'})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),urls=requestedUrls.map(value=>new URL(value));
    assert.equal(response.status,200);
    assert.ok(urls.some(url=>/重庆来福士广场/.test(url.searchParams.get('keywords')||'')));
    assert.ok(urls.filter(url=>url.pathname.includes('/place/around')).every(url=>url.searchParams.get('radius')==='50000'));
    assert.ok(urls.some(url=>url.pathname.includes('/place/text')));
    assert.equal(data.query.sortBy,'name_similarity');
    assert.equal(data.pois[0].id,'exact-raffles');
    assert.equal(data.pois[0].openNow,true);
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker strips the Vietnamese hotel prefix and expands Yitel to its AMap Chinese names', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,requestedUrls=[];
  globalThis.fetch=async url=>{
    requestedUrls.push(String(url));
    return new Response(JSON.stringify({status:'1',info:'OK',infocode:'10000',count:'3',pois:[
      {id:'wrong-yitel-shop',name:'Yitel',address:'购物点',location:'106.578725,29.561525',type:'购物服务;服装鞋帽皮具店;服装鞋帽皮具店',business:{rating:'3.0'}},
      {id:'yitel-hongyadong',name:'和颐至尚酒店(重庆解放碑洪崖洞店)',address:'临江支路30号',location:'106.579100,29.559900',type:'住宿服务;宾馆酒店;宾馆酒店',business:{rating:'4.8',alias:'Yitel'}},
      {id:'yitel-nanping',name:'和颐酒店(重庆南坪万达广场轻轨站店)',address:'南坪惠工路186号',location:'106.571000,29.528000',type:'住宿服务;宾馆酒店;宾馆酒店',business:{rating:'4.7',alias:'Yitel'}},
      {id:'wrong-yitel-restaurant',name:'和颐酒店(重庆南坪步行街店)·餐厅',address:'南坪惠工路186号',location:'106.571100,29.528100',type:'餐饮服务;中餐厅;中餐厅',business:{rating:'5.0'}}
    ]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:29.5596,lng:106.5774},country:'Trung Quốc',provider:'amap',query:'khách sạn Yitel',name:'khách sạn Yitel',radius:50000,limit:5,sortBy:'name_similarity',language:'zh'})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),keywords=requestedUrls.map(value=>new URL(value).searchParams.get('keywords'));
    assert.equal(response.status,200);
    assert.ok(keywords.includes('Yitel'));
    assert.ok(keywords.includes('和颐酒店'));
    assert.ok(keywords.includes('和颐至尚酒店'));
    assert.ok(!keywords.slice(0,3).some(value=>/^khách sạn Yitel$/i.test(value)));
    assert.equal(data.pois[0].id,'yitel-hongyadong');
    assert.ok(!data.pois.some(item=>item.id==='wrong-yitel-shop'));
    assert.ok(!data.pois.some(item=>item.id==='wrong-yitel-restaurant'));
    assert.ok(data.pois[0].nameMatchScore>.8);
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker expands the Vietnamese People Auditorium name before querying AMap', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,keywords=[];
  globalThis.fetch=async url=>{
    const keyword=new URL(String(url)).searchParams.get('keywords');keywords.push(keyword);
    const pois=keyword==='重庆市人民大礼堂'?[{id:'cq-auditorium',name:'重庆市人民大礼堂',address:'人民路173号',location:'106.552800,29.564000',type:'科教文化服务;会展中心;会展中心',business:{rating:'4.7'}}]:[];
    return new Response(JSON.stringify({status:'1',info:'OK',infocode:'10000',count:String(pois.length),pois}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:29.563,lng:106.551},country:'Trung Quốc',provider:'amap',query:'Lễ Đường Nhân Dân',name:'Lễ Đường Nhân Dân',radius:50000,limit:5,sortBy:'name_similarity'})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.ok(keywords.includes('重庆市人民大礼堂'));
    assert.equal(data.pois[0].id,'cq-auditorium');
    assert.equal(data.pois[0].name,'重庆市人民大礼堂');
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
    assert.ok(['药店','药房','大药房'].includes(url.searchParams.get('keywords')));
    assert.doesNotMatch(url.searchParams.get('keywords'),/nhà thuốc/i);
    assert.equal(data.pois[0].name,'唐氏药房');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker maps nearby sightseeing intent to a native AMap attraction search', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedUrl='';
  globalThis.fetch=async url=>{requestedUrl=String(url);return new Response(JSON.stringify({status:'1',info:'OK',count:'1',pois:[{id:'cq-attraction',name:'马鞍山堂里',address:'渝中区',location:'106.552,29.563',type:'风景名胜;旅游景点',cityname:'重庆市',adname:'渝中区',business:{rating:'4.5'}}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({center:{lat:29.563,lng:106.551},country:'Trung Quốc',query:'điểm tham quan',keyword:'điểm tham quan',category:'tourist_attraction',radius:5000,limit:10})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),url=new URL(requestedUrl);
    assert.equal(response.status,200);
    assert.ok(['旅游景点','景区','名胜古迹','观景台'].includes(url.searchParams.get('keywords')));
    assert.doesNotMatch(url.searchParams.get('keywords'),/tham quan/i);
    assert.equal(data.pois[0].name,'马鞍山堂里');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker hard-locks Chongqing GPS to AMap even with a stale Google/Vietnam hint', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedUrl='';
  globalThis.fetch=async url=>{requestedUrl=String(url);return new Response(JSON.stringify({status:'1',info:'OK',count:'1',pois:[{id:'cq-store',name:'罗森便利店',address:'渝中区',location:'106.574,29.560',cityname:'重庆市',adname:'渝中区',business:{rating:'4.5'}}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/poi/nearby',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({provider:'google',country:'Việt Nam',center:{lat:29.56,lng:106.57,coordSystem:'wgs84'},query:'cửa hàng tiện lợi',category:'convenience_store',limit:10})}),{AMAP_WEB_KEY:'amap-test',GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),url=new URL(requestedUrl);
    assert.equal(response.status,200);
    assert.equal(url.hostname,'restapi.amap.com');
    assert.equal(url.pathname,'/v5/place/around');
    assert.equal(data.provider,'amap');
    assert.equal(data.pois[0].country,'Trung Quốc');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker resolves and reads China places only through AMap', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,paths=[];
  globalThis.fetch=async url=>{
    const parsed=new URL(String(url));paths.push(parsed.pathname);
    return new Response(JSON.stringify({status:'1',info:'OK',pois:[{id:'raffles-cq',name:'重庆来福士广场',address:'接圣街8号',location:'106.586,29.566',cityname:'重庆市',adname:'渝中区',business:{rating:'4.7'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const env={AMAP_WEB_KEY:'amap-test',GOOGLE_MAPS_API_KEY:'google-test',GEOAPIFY_API_KEY:'geo-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'};
    const resolved=await worker.fetch(new Request('https://travelos-map.test/place/resolve',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({provider:'google',country:'Trung Quốc',query:'Raffles City Trùng Khánh'})}),env);
    const details=await worker.fetch(new Request('https://travelos-map.test/poi/details',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({provider:'google',country:'China',placeId:'raffles-cq'})}),env);
    assert.equal((await resolved.json()).provider,'amap');
    assert.equal((await details.json()).provider,'amap');
    assert.deepEqual(paths,['/v5/place/text','/v5/place/detail']);
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker translates Vietnamese China aliases before AMap geocoding', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;let requestedUrl='';
  globalThis.fetch=async url=>{requestedUrl=String(url);return new Response(JSON.stringify({status:'1',info:'OK',geocodes:[{formatted_address:'重庆市',province:'重庆市',city:'重庆市',district:[],adcode:'500000',location:'106.551556,29.563009',level:'省'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const response=await worker.fetch(new Request('https://map.test/place/resolve',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({country:'Trung Quốc',query:'Trùng Khánh',resolveMode:'geocode',limit:3})}),{AMAP_WEB_KEY:'amap-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json(),url=new URL(requestedUrl);
    assert.equal(response.status,200);
    assert.equal(url.hostname,'restapi.amap.com');
    assert.equal(url.searchParams.get('address'),'重庆');
    assert.equal(data.meta.resolvedQuery,'重庆');
    assert.equal(data.places[0].name,'Trùng Khánh');
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker geocodes weather locations before Google Places POI search', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{
    urls.push(String(url));
    assert.match(String(url),/^https:\/\/api\.geoapify\.com\/v1\/geocode\/search/);
    return new Response(JSON.stringify({results:[{place_id:'dalat-city',name:'Đà Lạt',city:'Đà Lạt',state:'Lâm Đồng',country:'Việt Nam',formatted:'Đà Lạt, Lâm Đồng, Việt Nam',lat:11.9404,lon:108.4413,result_type:'city'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://map.test/place/resolve',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({query:'Đà Lạt',country:'Việt Nam',resolveMode:'geocode',limit:3})}),{GOOGLE_MAPS_API_KEY:'google-test',GEOAPIFY_API_KEY:'geo-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'geoapify-geocoding-v1');
    assert.equal(data.places[0].name,'Đà Lạt');
    assert.equal(data.places[0].resultType,'city');
    assert.equal(urls.length,1);
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
  const originalFetch=globalThis.fetch,requestedUrls=[];
  globalThis.fetch=async url=>{
    requestedUrls.push(String(url));
    if(String(url).includes('/forecast/hours:lookup'))return new Response(JSON.stringify({timeZone:{id:'Asia/Ho_Chi_Minh'},forecastHours:[{interval:{startTime:'2026-10-08T10:00:00Z'},weatherCondition:{type:'LIGHT_RAIN',description:{text:'Mưa nhẹ'}},temperature:{degrees:26.8},precipitation:{probability:{percent:60},qpf:{quantity:0.4}},wind:{speed:{value:9}}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    if(String(url).includes('/publicAlerts:lookup'))return new Response(JSON.stringify({regionCode:'GB',weatherAlerts:[{alertId:'alert-1',alertTitle:{text:'Cảnh báo mưa lớn'},eventType:'HEAVY_RAIN',areaName:'London',severity:'SEVERE',urgency:'IMMEDIATE',safetyRecommendations:[{directive:'Tránh khu vực ngập.'}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({currentTime:'2026-10-08T09:00:00Z',timeZone:{id:'Asia/Ho_Chi_Minh'},weatherCondition:{type:'PARTLY_CLOUDY',description:{text:'Có mây rải rác'}},temperature:{degrees:27.4},feelsLikeTemperature:{degrees:29.1},relativeHumidity:74,uvIndex:3,precipitation:{probability:{percent:25},qpf:{quantity:0}},wind:{speed:{value:8}}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/weather/current',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({location:{lat:10.8,lng:106.7},language:'vi'})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'google-weather-v1');
    assert.equal(data.weather.current.temperature,27.4);
    assert.equal(data.weather.current.condition,'Có mây rải rác');
    assert.equal(data.weather.hourly.precipitationProbability[0],60);
    assert.equal(data.weather.alerts[0].severity,'SEVERE');
    assert.ok(requestedUrls.some(url=>/weather\.googleapis\.com\/v1\/currentConditions:lookup/.test(url)));
    assert.ok(requestedUrls.some(url=>/weather\.googleapis\.com\/v1\/forecast\/hours:lookup/.test(url)));
    assert.ok(requestedUrls.some(url=>/weather\.googleapis\.com\/v1\/publicAlerts:lookup/.test(url)));
    assert.ok(requestedUrls.every(url=>/location\.latitude=10\.8/.test(url)));
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker skips unsupported Google Weather coverage in Vietnam', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{
    urls.push(String(url));
    if(String(url).includes('/publicAlerts:lookup'))return new Response(JSON.stringify({regionCode:'VN',weatherAlerts:[]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.match(String(url),/^https:\/\/api\.open-meteo\.com\/v1\/forecast/);
    return new Response(JSON.stringify({timezone:'Asia/Ho_Chi_Minh',current:{time:'2026-10-12T10:00',temperature_2m:23,apparent_temperature:24,precipitation:0,rain:0,weather_code:3,wind_speed_10m:7,relative_humidity_2m:75},hourly:{time:['2026-10-12T10:00'],temperature_2m:[23],precipitation_probability:[20],precipitation:[0],weather_code:[3],wind_speed_10m:[7]},daily:{}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/weather/current',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({location:{lat:11.94,lng:108.44,country:'Việt Nam'},country:'Việt Nam',language:'vi'})}),{GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'open-meteo+google-alerts');
    assert.equal(data.alertsSource,'google-weather-alerts-v1');
    assert.equal(data.googleError,'GOOGLE_WEATHER_UNSUPPORTED_COUNTRY');
    assert.equal(urls.length,2);
    assert.ok(urls.some(url=>url.includes('/publicAlerts:lookup')));
    assert.ok(urls.every(url=>!url.includes('/currentConditions:lookup')&&!url.includes('/forecast/hours:lookup')));
  }finally{globalThis.fetch=originalFetch;}
});

test('Map Worker uses AMap weather as truth in China and Open-Meteo only for hourly detail', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{
    const href=String(url);urls.push(href);
    if(href.includes('/v3/geocode/regeo'))return new Response(JSON.stringify({status:'1',info:'OK',regeocode:{formatted_address:'重庆市渝中区',addressComponent:{country:'中国',province:'重庆市',city:[],district:'渝中区',adcode:'500103'}}}),{status:200,headers:{'Content-Type':'application/json'}});
    if(href.includes('/v3/weather/weatherInfo')&&href.includes('extensions=base'))return new Response(JSON.stringify({status:'1',info:'OK',lives:[{province:'重庆',city:'渝中区',adcode:'500103',weather:'多云',temperature:'25',winddirection:'东北',windpower:'≤3',humidity:'68',reporttime:'2026-10-12 12:00:00'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    if(href.includes('/v3/weather/weatherInfo')&&href.includes('extensions=all'))return new Response(JSON.stringify({status:'1',info:'OK',forecasts:[{city:'渝中区',adcode:'500103',casts:[{date:'2026-10-12',dayweather:'多云',nightweather:'小雨',daytemp:'27',nighttemp:'20',daywind:'东北',nightwind:'北'}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.match(href,/^https:\/\/api\.open-meteo\.com\/v1\/forecast/);
    return new Response(JSON.stringify({timezone:'Asia/Shanghai',current:{time:'2026-10-12T12:00',temperature_2m:24,apparent_temperature:25,precipitation:0,rain:0,weather_code:2,wind_speed_10m:6,relative_humidity_2m:70},hourly:{time:['2026-10-12T12:00'],temperature_2m:[24],precipitation_probability:[20],precipitation:[0],weather_code:[2],wind_speed_10m:[6]},daily:{}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://travelos-map.test/weather/current',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({location:{lat:29.563,lng:106.551,country:'Trung Quốc',coordSystem:'wgs84'},country:'Trung Quốc',language:'vi'})}),{AMAP_WEB_KEY:'amap-test',GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.source,'amap-weather-v3+open-meteo-hourly');
    assert.equal(data.provider,'amap');
    assert.equal(data.meta.adcode,'500103');
    assert.equal(data.location.city,'重庆市');
    assert.equal(data.weather.current.temperature,25);
    assert.equal(data.weather.current.condition,'Có mây');
    assert.equal(data.weather.daily.conditionNight[0],'Mưa nhẹ');
    assert.equal(data.weather.hourly.precipitationProbability[0],20);
    assert.ok(urls.every(url=>!url.includes('googleapis.com')));
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

test('Map Worker keeps China electric-bike routing on AMap Route 2.0', async () => {
  const {default:worker}=await importWorker('../map-worker/src/index.js');
  const originalFetch=globalThis.fetch;
  let requestedUrl='';
  globalThis.fetch=async url=>{
    requestedUrl=String(url);
    return new Response(JSON.stringify({status:'1',info:'OK',route:{paths:[{
      distance:'1800',cost:{duration:'420'},steps:[{instruction:'向东骑行100米',orientation:'东',road_name:'测试路',step_distance:'100',cost:{duration:'30'},navi:{action:'直行'},polyline:'106.551000,29.562000;106.552000,29.563000'},{instruction:'到达目的地',orientation:'东',road_name:'',step_distance:'1700',cost:{duration:'390'},navi:{action:'到达'},polyline:'106.552000,29.563000;106.565000,29.575000'}]
    }]}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const response=await worker.fetch(new Request('https://travelos-map.test/route/directions',{
      method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
      body:JSON.stringify({provider:'google',country:'Trung Quốc',mode:'motorbike',origin:{lat:29.562,lng:106.551,coordSystem:'gcj02'},destination:{lat:29.575,lng:106.565,coordSystem:'gcj02'}})
    }),{AMAP_WEB_KEY:'amap-test',GOOGLE_MAPS_API_KEY:'google-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.provider,'amap');
    assert.equal(data.source,'amap-electrobike-v5');
    assert.equal(data.mode,'electrobike');
    assert.match(requestedUrl,/^https:\/\/restapi\.amap\.com\/v5\/direction\/electrobike\?/);
    assert.equal(new URL(requestedUrl).searchParams.get('alternative_route'),'3');
    assert.equal(data.routes[0].steps[0].instruction,'向东骑行100米');
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
  assert.match(chinaNavigation,/data-mode="walk"/);
  assert.match(chinaNavigation,/data-mode="electrobike"/);
  assert.match(chinaNavigation,/data-mode="drive"/);
  assert.match(chinaNavigation,/AMapRouteService\.routeWithFallback/);
  assert.doesNotMatch(chinaNavigation,/AI Route Notes/);
  assert.match(chinaNavigation,/LET'S GO PIPI · ĐIỀU HƯỚNG TRUNG QUỐC/);
  assert.match(chinaNavigation,/destination\?\.localizedName \|\| destination\?\.name/);
  assert.match(chinaNavigation,/planRoute\(state\.routeOrigin \|\| state\.origin,state\.routeDestination \|\| state\.destination,mode\)/);
  assert.match(app,/GeoapifyNavigation\.open\(\{ destination, mode: 'walk' \}\)/);
  assert.match(nearby,/GeoapifyNavigation\.open\(\{destination,mode:'walk',onBack:/);
  assert.doesNotMatch(nearby,/navigator\.geolocation\.watchPosition/);
  assert.match(nearby,/travelos:location-updated/);
  assert.match(nearby,/window\.travelosLocationAnchor/);
  assert.match(nearby,/Vị trí của bạn/);
  assert.match(nearby,/nearby-user-person/);
  assert.match(nearby,/tới điểm tìm/);
  assert.match(nearby,/nearby-pin-center/);
  assert.match(nearby,/class="nearby-chat-head" role="button" tabindex="0"/);
  assert.match(nearby,/mapWrap\?\.addEventListener\('click'/);
  assert.match(nearby,/poi\.localizedName\|\|poi\.name/);
  assert.match(nearby,/localizedName:poi\.localizedName\|\|''/);
  assert.match(nearby,/nearby-poi-note/);
  assert.match(nearby,/function coordinateSystemOf/);
  assert.match(nearby,/['"]gcj02['"]/);
  assert.match(nearby,/map\.__travelosProvider='geoapify'/);
  assert.match(nearby,/provider==='google'\?'geoapify':provider/);
  assert.match(nearby,/fullMountToken/);
  assert.match(nearby,/freshFullMapNode/);
  assert.match(provider,/attributionControl\?\.setPrefix/);
  assert.match(provider,/© <a href="https:\/\/www\.geoapify\.com\//);
  assert.match(nearbyCss,/nearby-mini-map \.leaflet-control-attribution/);
  assert.match(nearbyCss,/\.nearby-poi-note/);
  assert.doesNotMatch(navigation,/class="geo-back"/);
  assert.match(navigation,/function smartClose\(\)/);
  assert.match(navigation,/backToList/);
  assert.doesNotMatch(chinaNavigation,/class="tn-back"/);
  assert.match(chinaNavigation,/function smartClose\(\)/);
  assert.match(nearby,/aria-label="Đóng danh sách">×/);
  assert.match(await readFile(new URL('../geoapify-navigation/geoapify-navigation.css',import.meta.url),'utf8'),/leaflet-top\.leaflet-left\{left:auto;right:0\}/);
  assert.match(chinaNavigation,/backToList/);
  assert.doesNotMatch(index,/src="google-maps-provider\.js/);
  assert.doesNotMatch(index,/src="google-navigation\.js/);
});

test('AMap navigation falls back from a failed walking route to electric bike', async () => {
  const source=await readFile(new URL('../china-navigation/amap-route-service.js',import.meta.url),'utf8');
  const calls=[];
  const context={
    console,AbortController,Response,URL,setTimeout,clearTimeout,
    fetch:async url=>{
      const path=new URL(String(url)).pathname;calls.push(path);
      if(path==='/route/walking')return new Response(JSON.stringify({error:'AMap Route 2.0: REQUEST_TIMEOUT'}),{status:502,headers:{'Content-Type':'application/json'}});
      return new Response(JSON.stringify({ok:true,source:'amap-electrobike-v5',provider:'amap',mode:'electrobike',origin:{lat:29.56,lng:106.55},destination:{lat:29.57,lng:106.56},routes:[{routeIndex:0,distance:1200,duration:420,steps:[]}],meta:{count:1}}),{status:200,headers:{'Content-Type':'application/json'}});
    },
    window:{CONFIG:{MAP_WORKER_URL:'https://travelos-map.test'},AMapProvider:{toGcj:value=>value}}
  };
  vm.runInNewContext(source,context);
  const result=await context.window.AMapRouteService.routeWithFallback(
    {lat:29.56,lng:106.55,coordSystem:'gcj02'},
    {lat:29.57,lng:106.56,coordSystem:'gcj02',country:'Trung Quốc'},
    {mode:'walk'}
  );
  assert.deepEqual(calls,['/route/walking','/route/directions']);
  assert.equal(result.requestedMode,'walk');
  assert.equal(result.mode,'electrobike');
  assert.equal(result.meta.fallbackFrom,'walk');
  assert.match(result.meta.fallbackReason,/REQUEST_TIMEOUT/);
});

test('Pipi consistently self-identifies by name and calls the user bạn', async () => {
  const [chat,widget,worker,core,index,style,manifest,capacitor,androidStrings,buildScript]=await Promise.all([
    readFile(new URL('../chat.js',import.meta.url),'utf8'),
    readFile(new URL('../widget.js',import.meta.url),'utf8'),
    readFile(new URL('../worker/src/index.js',import.meta.url),'utf8'),
    readFile(new URL('../worker/src/bot/prompts/core.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../style.css',import.meta.url),'utf8'),
    readFile(new URL('../manifest.json',import.meta.url),'utf8'),
    readFile(new URL('../capacitor.config.json',import.meta.url),'utf8'),
    readFile(new URL('../android/app/src/main/res/values/strings.xml',import.meta.url),'utf8'),
    readFile(new URL('../scripts/build-web.mjs',import.meta.url),'utf8')
  ]);
  assert.match(chat,/Chào bạn! Pipi là trợ lý du lịch của Let's Go Pipi/);
  assert.match(chat,/Pipi đang làm việc/);
  assert.match(widget,/<h2>Pipi<\/h2>/);
  assert.match(widget,/Nhập câu hỏi cho Pipi/);
  assert.doesNotMatch(chat,/Lỗi kết nối rồi fen|Chào fen|Tui là/);
  assert.match(core,/Luôn tự xưng bằng tên "Pipi" và gọi user là "bạn"/);
  assert.match(worker,/Luôn tự xưng bằng tên "Pipi" và gọi người dùng là "bạn"/);
  assert.match(worker,/normalizePipiVoice/);
  assert.doesNotMatch(worker,/Fen thử|Fen cho|Tui chưa/);
  assert.match(index,/<title>Let's Go Pipi<\/title>/);
  assert.match(index,/class="brand-pipi-shadow" aria-hidden="true">PIPI<\/span><span class="brand-pipi-text">PIPI<\/span>/);
  assert.match(index,/chat\.js\?v=20261028-3/);
  assert.match(style,/font-family: "Lilita One"/);
  assert.match(style,/font-size: 1\.16em/);
  assert.match(style,/margin-left: 3px/);
  assert.match(style,/\.brand-pipi-shadow/);
  assert.match(style,/text-shadow:/);
  assert.match(manifest,/"name": "Let's Go Pipi"/);
  assert.match(capacitor,/"appName": "Let's Go Pipi"/);
  assert.match(androidStrings,/<string name="app_name">Let\\'s Go Pipi<\/string>/);
  assert.match(buildScript,/\['assets', 'china-navigation'/);
});

test('AI chat shows staged progress while backend tools are working', async () => {
  const [chat,style,index]=await Promise.all([
    readFile(new URL('../chat.js',import.meta.url),'utf8'),
    readFile(new URL('../style.css',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  for(const phase of ['Đang phân tích câu hỏi...','Đang tìm kiếm thông tin...','Đang phân tích khu vực xung quanh...','Đang soạn tin nhắn...'])assert.match(chat,new RegExp(phase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(chat,/startChatProgress\(loadingId\)/);
  assert.match(chat,/timers\.forEach\(timer => clearTimeout\(timer\)\)/);
  assert.match(style,/\.chat-progress-step\.is-active/);
  assert.match(style,/prefers-reduced-motion/);
  assert.match(index,/style\.css\?v=20261028-1/);
});

test('Current-location chat uses the GPS position already attached to the app', async () => {
  const [chat,app]=await Promise.all([
    readFile(new URL('../chat.js',import.meta.url),'utf8'),
    readFile(new URL('../app.js',import.meta.url),'utf8')
  ]);
  assert.match(chat,/const currentPos = window\.userPos \|\| null/);
  assert.match(chat,/const userLocation = getStructuredUserLocation\(\)/);
  assert.doesNotMatch(chat,/refreshCurrentPositionForChat/);
  assert.doesNotMatch(chat,/navigator\.geolocation/);
  assert.doesNotMatch(chat,/GPS_FRESH_REQUIRED/);
  assert.match(app,/navigator\.geolocation\.watchPosition/);
  assert.match(app,/shouldAttachGpsFix\(newPos\)/);
  assert.match(app,/progressiveMotionSamples/);
  assert.match(app,/GPS_RELOCATION_CONFIRMATIONS/);
  assert.match(app,/getCurrentPosition\(handleAppGpsPosition/);
  assert.match(app,/if \(shouldAttachGpsFix\(newPos\)\)/);
  assert.match(app,/function startAppGpsWatch\(\)/);
  assert.match(app,/setTimeout\(startAppGpsWatch, 3000\)/);
  assert.match(chat,/locationMismatch/);
  assert.match(chat,/window\.travelosLocationAnchor/);
  assert.doesNotMatch(chat,/getCurrentPosition/);
});

test('AI v3 rejects a China label mixed with stale Vietnam GPS for nearby search', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  let mapCalls=0;
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{
    method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
    body:JSON.stringify({
      userMessage:'quanh đây có cửa hàng tiện lợi nào không',
      userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:10.798,longitude:106.689,source:'app-gps'}
    })
  }),{
    ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',
    MAP_WORKER:{fetch:async()=>{mapCalls++;return new Response('{}',{status:500});}}
  });
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.error.code,'LOCATION_SYNCING');
  assert.match(data.text,/chưa trùng nhau/);
  assert.equal(mapCalls,0);
});

test('AI v3 switches Gemini models when the primary model is overloaded', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async (url,init={})=>{
    const href=String(url),payload=JSON.parse(String(init.body||'{}'));calls.push(href);
    if(href.includes('gemini-3.5-flash-lite'))return new Response(JSON.stringify({error:{message:'This model is currently experiencing high demand. Please try again later.'}}),{status:503,headers:{'Content-Type':'application/json'}});
    if(payload?.generationConfig?.responseMimeType==='application/json'){
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({goal:'Giải thích phép lịch sự địa phương',travelIntent:'LOCAL_GUIDE',responseMode:'DIRECT',needsClarification:false,clarificationQuestion:'',isItinerary:false,tools:[]})}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Bạn nên nói nhỏ ở nơi công cộng và xếp hàng theo hướng dẫn tại chỗ.'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Ở Trùng Khánh nên cư xử thế nào?',userLocation:{country:'Trung Quốc',city:'Trùng Khánh'}})}),{GEMINI_API_KEY:'test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.match(data.text,/nói nhỏ/);
    assert.deepEqual(calls.map(url=>new URL(url).pathname.match(/models\/([^:]+)/)?.[1]),['gemini-3.5-flash-lite','gemini-3.8-flash']);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 hides upstream overload details when every Gemini model is unavailable', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch,calls=[];
  const originalWarn=console.warn,originalError=console.error;
  globalThis.fetch=async url=>{calls.push(String(url));return new Response(JSON.stringify({error:{message:'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'}}),{status:503,headers:{'Content-Type':'application/json'}});};
  console.warn=()=>{};console.error=()=>{};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Kể tôi nghe vài phép lịch sự khi đi du lịch',userLocation:{country:'Việt Nam',city:'TP.HCM'}})}),{GEMINI_API_KEY:'test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.error.code,'AI_TEMPORARILY_UNAVAILABLE');
    assert.match(data.text,/hơi quá tải/);
    assert.doesNotMatch(data.text,/high demand|try again later|Gemini HTTP/i);
    assert.equal(calls.length,3);
    assert.deepEqual(calls.map(url=>new URL(url).pathname.match(/models\/([^:]+)/)?.[1]),['gemini-3.5-flash-lite','gemini-3.8-flash','gemini-3.1-flash-lite']);
  }finally{globalThis.fetch=originalFetch;console.warn=originalWarn;console.error=originalError;}
});

test('Chat history restores the nearby map card for 24 hours and exposes only a compact follow-up context', async () => {
  const source=await readFile(new URL('../chat.js',import.meta.url),'utf8');
  const store=new Map(),rendered=[],chatBox={children:[],scrollTop:0,scrollHeight:100,appendChild(node){this.children.push(node);}};
  const context={console,Date,AbortController,setTimeout,clearTimeout,localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},document:{getElementById:id=>id==='chat-box'?chatBox:null,createElement:()=>({className:'',innerHTML:'',textContent:''})},window:{TravelNearby:{render:(payload,node)=>rendered.push({payload,node})}}};
  vm.createContext(context);vm.runInContext(source,context);
  const nearby={source:'amap-place-v5',provider:'amap',query:'nhà thuốc',center:{lat:29.55,lng:106.57,country:'China',coordSystem:'wgs84'},pois:[{id:'poi-1',name:'药房',address:'重庆市',lat:29.551,lng:106.571,provider:'amap',distance:120,rating:4.7,reviews:[{text:'must not persist'}]}]};
  context.saveMessage('ai','Tôi tìm được một địa điểm.',{nearby});
  const saved=JSON.parse(store.get('travelos_chat_history'));
  assert.equal(saved.version,3);
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
  assert.match(source,/const conversationContext = latestStoredContext\?\.travelContext/);
  assert.match(source,/conversationContext: conversationContext \|\| undefined/);
  assert.match(source,/function compactTravelContext\(payload\)/);
});

test('App keeps onboarding visible until native voice, places and bot readiness settle', async () => {
  const [app,chat,index]=await Promise.all([
    readFile(new URL('../app.js',import.meta.url),'utf8'),
    readFile(new URL('../chat.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8')
  ]);
  assert.match(app,/Promise\.allSettled\(\[placesTask, botTask, voiceTask\]\)/);
  assert.match(app,/const voiceBoot = Boolean\(window\.TRAVELOS_NATIVE\)/);
  assert.match(app,/window\.PipiLocalVoice\.prepare\(progress =>/);
  assert.match(app,/DOMContentLoaded/);
  assert.match(app,/window\.isSystemLive = true/);
  assert.doesNotMatch(app,/GPS ERROR: PLEASE ENABLE LOCATION/);
  assert.match(chat,/\/api\/health/);
  assert.match(index,/Đang khởi động Let's Go Pipi/);
  assert.match(index,/app\.js\?v=20261028-3/);
  assert.match(chat,/const lat = hasAnchor \? anchorLat : rawLat/);
  assert.match(app,/travelos:location-updated/);
  assert.match(index,/id="loading-voice-track"/);
  assert.doesNotMatch(app,/localStorage\.setItem\(GEO_CACHE_KEY/);
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

test('Destination summary keeps aggregate rating when Google returns no review sample', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/weather/current')return new Response(JSON.stringify({ok:true,weather:{current:{temperature:30,condition:'Có mây'}}}),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',place:{id:'kfc',name:'KFC',address:'TP.HCM',lat:10.78,lng:106.69,rating:4.4,userRatingCount:691,reviews:[],provider:'google_places'}}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/destination-summary',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({destination:{name:'KFC',address:'TP.HCM',lat:10.78,lng:106.69,country:'Việt Nam'}})}),env);
  const data=await response.json();
  assert.equal(data.place.rating,4.4);
  assert.equal(data.place.userRatingCount,691);
  assert.equal(data.place.recentReviewCount,0);
  assert.match(data.reviewSummary,/được đánh giá 4\.4\/5/);
  assert.match(data.reviewSummary,/691 lượt/);
});

test('AI v3 uses current GPS for outdoor weather and still answers when Gemini is unavailable', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  let weatherBody;
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    assert.equal(new URL(request.url).pathname,'/weather/current');weatherBody=await request.json();
    return new Response(JSON.stringify({ok:true,source:'google-weather-v1',provider:'google_weather',weather:{coordinates:{lat:10.77,lng:106.69},timezone:'Asia/Ho_Chi_Minh',current:{time:'2026-10-12T10:00:00Z',temperature:29,apparentTemperature:32,precipitation:0,rain:0,weatherCode:'PARTLY_CLOUDY',condition:'Có mây rải rác',windSpeed:8},hourly:{time:['2026-10-12T10:00:00Z','2026-10-12T11:00:00Z','2026-10-12T12:00:00Z'],temperature:[29,30,31],precipitationProbability:[10,20,15],precipitation:[0,0,0],weatherCode:['PARTLY_CLOUDY','PARTLY_CLOUDY','MOSTLY_CLEAR'],windSpeed:[8,9,10]}}}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Thời tiết có tiện đi chơi không?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69,source:'gps'}})}),env);
    const data=await response.json();
    assert.equal(data.travelos.travelIntent,'WEATHER_OUTDOOR');
    assert.deepEqual(data.travelos.plan.tools.map(tool=>tool.name),['weather']);
    assert.equal(weatherBody.location.lat,10.77);
    assert.equal(weatherBody.location.lng,106.69);
    assert.equal(data.travelos.sources[0].source,'google-weather-v1');
    assert.match(data.text,/vị trí hiện tại/);
    assert.match(data.text,/tiện để đi chơi/);
    const around=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Thời tiết quanh đây có tiện đi chơi không?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69,source:'gps'}})}),env);
    const aroundData=await around.json();
    assert.deepEqual(aroundData.travelos.plan.tools.map(tool=>tool.name),['weather']);
    assert.equal(weatherBody.location.lat,10.77);
    assert.equal(weatherBody.location.lng,106.69);
    assert.match(aroundData.text,/vị trí hiện tại/);
  }finally{}
});

test('AI v3 resolves remote weather instead of searching for a POI named weather', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const mapCalls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();mapCalls.push({path,body});
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'amap-place-text-v5',places:[{id:'cq',name:'重庆市',localizedName:'Trùng Khánh',lat:29.563,lng:106.551,country:'Trung Quốc',provider:'amap',coordSystem:'gcj02'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(path,'/weather/current');
    return new Response(JSON.stringify({ok:true,source:'open-meteo-china',provider:'open_meteo',weather:{coordinates:{lat:29.563,lng:106.551},timezone:'Asia/Shanghai',current:{time:'2026-10-12T10:00',temperature:20,apparentTemperature:20,precipitation:0,rain:0,weatherCode:1,condition:'Chủ yếu quang',windSpeed:5},hourly:{time:['2026-10-12T10:00'],temperature:[20],precipitationProbability:[5],precipitation:[0],weatherCode:[1],windSpeed:[5]}}}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Thời tiết ở Trùng Khánh có tiện để đi chơi không?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69}})}),env);
  const data=await response.json();
  assert.equal(mapCalls.length,2);
  assert.equal(mapCalls[0].body.query,'Trùng Khánh');
  assert.equal(mapCalls[0].body.resolveMode,'geocode');
  assert.equal(mapCalls[1].path,'/weather/current');
  assert.equal(mapCalls[1].body.location.lat,29.563);
  assert.deepEqual(data.travelos.plan.tools.map(tool=>tool.name),['resolve_place','weather']);
  assert.equal(data.travelos.weather.coordinates.lat,29.563);
  assert.match(data.text,/Trùng Khánh/);
});

test('AI v3 ignores stale TP.HCM chat prose after resolving live weather for Đà Lạt', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch;let externalCalls=0;
  globalThis.fetch=async url=>{externalCalls++;throw new Error(`Weather flow must not call Gemini directly: ${url}`);};
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'geoapify-geocoding-v1',places:[{id:'dalat',name:'Đà Lạt',lat:11.9402,lng:108.4376,country:'Việt Nam',provider:'geoapify',coordSystem:'wgs84'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(path,'/weather/current');
    return new Response(JSON.stringify({ok:true,source:'google-weather-v1',provider:'google_weather',weather:{coordinates:{lat:11.9402,lng:108.4376},timezone:'Asia/Ho_Chi_Minh',current:{time:'2026-10-12T10:00:00Z',temperature:18,apparentTemperature:18,precipitation:0,weatherCode:'MOSTLY_CLOUDY',condition:'Nhiều mây',windSpeed:7},hourly:{time:['2026-10-12T10:00:00Z'],temperature:[18],precipitationProbability:[20],precipitation:[0],weatherCode:['MOSTLY_CLOUDY'],windSpeed:[7]}}}),{status:200,headers:{'Content-Type':'application/json'}});
  }},GEMINI_API_KEY:'configured-but-must-not-run'};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'thời tiết Đà Lạt',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69},chatHistory:[{role:'assistant',content:'Tôi chỉ có dữ liệu thời tiết TP.HCM và chưa có dữ liệu Đà Lạt.'}]})}),env);
    const data=await response.json();
    assert.equal(data.travelos.sources.find(source=>source.tool==='weather').source,'google-weather-v1');
    assert.match(data.text,/Ở Đà Lạt/);
    assert.match(data.text,/18°C/);
    assert.doesNotMatch(data.text,/TP\.HCM|chưa có dữ liệu/i);
    assert.equal(externalCalls,0);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 never falls back to current GPS when a requested weather location cannot be resolved', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>{throw new Error(`Weather must not run against current GPS: ${url}`);};
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    assert.equal(new URL(request.url).pathname,'/place/resolve');
    return new Response(JSON.stringify({error:'Không xác định được địa danh.'}),{status:404,headers:{'Content-Type':'application/json'}});
  }}};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Thời tiết ở một nơi không tồn tại có tiện đi chơi không?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69}})}),env);
    const data=await response.json();
    assert.equal(data.travelos.weather,undefined);
    assert.equal(data.travelos.sources.find(source=>source.tool==='weather').error,'GPS_OR_DESTINATION_REQUIRED');
    assert.doesNotMatch(data.text,/thời tiết (?:ở|tại) TP\.HCM/i);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 declares eight specialized travel intent profiles', async () => {
  const source=await readFile(new URL('../worker/src/bot/prompts/index.js',import.meta.url),'utf8');
  for(const intent of ['PLACE_DISCOVERY','WEATHER_OUTDOOR','ROUTE_MOBILITY','ITINERARY_PLANNING','VENUE_INTELLIGENCE','SAFETY_HEALTH','TRAVEL_UTILITY','LOCAL_GUIDE'])assert.match(source,new RegExp(`${intent}:`));
  for(const file of ['place-discovery','weather-outdoor','route-mobility','itinerary-planning','venue-intelligence','safety-health','travel-utility','local-guide']){
    const prompt=await readFile(new URL(`../worker/src/bot/prompts/${file}.js`,import.meta.url),'utf8');
    assert.ok(prompt.length>80,`${file} prompt must remain independent and non-empty`);
  }
  assert.match(source,/answerPromptFor/);
});

test('AI v3 semantic planner selects one answer prompt and does not duplicate backend tools', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch,geminiPrompts=[],mapCalls=[];
  let geminiCalls=0;
  globalThis.fetch=async (url,init={})=>{
    assert.match(String(url),/generativelanguage\.googleapis\.com/);
    const payload=JSON.parse(String(init.body||'{}'));
    geminiPrompts.push(payload.systemInstruction?.parts?.[0]?.text||'');
    geminiCalls++;
    if(payload.generationConfig?.responseMimeType==='application/json'){
      const plan={englishMeaning:'It is raining; find convenience stores near my current location and give walking directions.',primaryIntent:'PLACE_DISCOVERY',needs:[
        {kind:'WEATHER',query:'',target:'current_location',area:'',time:'hiện tại',travelMode:'',sourceText:'Trời đang mưa',required:true,confidence:.92},
        {kind:'PLACE_SEARCH',query:'cửa hàng tiện lợi',queryEn:'convenience store',target:'current_location',area:'',time:'',travelMode:'',sourceText:'tìm cửa hàng tiện lợi quanh đây',required:true,confidence:.96},
        {kind:'WALKING_ROUTE',query:'',target:'best_place_result',area:'',time:'',travelMode:'WALK',sourceText:'chỉ đường đi bộ',required:true,confidence:.94}
      ],answerContract:['Cho biết thời tiết hiện tại','Tìm cửa hàng tiện lợi gần nhất','Chỉ đường đi bộ tới kết quả tốt nhất'],clarificationQuestion:'',overallConfidence:.95,shouldUseLiveData:true};
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(plan)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Có một cửa hàng tiện lợi gần bạn và tôi đã chuẩn bị tuyến đi bộ.'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const env={
    GEMINI_API_KEY:'test',SEMANTIC_PLANNER_ENABLED:'true',SEMANTIC_PLANNER_MODE:'adaptive',
    ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
      const path=new URL(request.url).pathname,body=await request.json();mapCalls.push({path,body});
      if(path==='/weather/current')return new Response(JSON.stringify({ok:true,source:'google-weather-v1',provider:'google_weather',weather:{current:{time:'2026-10-26T12:00:00Z',temperature:27,condition:'Mưa nhẹ',precipitation:1,windSpeed:8},hourly:{time:['2026-10-26T12:00:00Z'],temperature:[27],precipitationProbability:[70],precipitation:[1],weatherCode:['LIGHT_RAIN'],windSpeed:[8]}}}),{status:200,headers:{'Content-Type':'application/json'}});
      if(path==='/poi/nearby')return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',query:{keyword:'cửa hàng tiện lợi'},center:body.center,pois:[{id:'store-1',name:'GS25 gần nhất',address:'123 Test',lat:10.771,lng:106.691,distance:150,provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
      if(path==='/route/walking')return new Response(JSON.stringify({ok:true,source:'google-routes-v2',provider:'google_routes',routes:[{routeIndex:0,distance:180,duration:150,steps:[{instruction:'Đi bộ tới điểm đến',distance:180,duration:150}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
      throw new Error(`Unexpected map path ${path}`);
    }}
  };
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Trời đang mưa, tìm cửa hàng tiện lợi quanh đây rồi chỉ đường đi bộ',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69,source:'gps'}})}),env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(geminiCalls,2);
    assert.deepEqual(mapCalls.map(item=>item.path),['/weather/current','/poi/nearby','/route/walking']);
    assert.equal(mapCalls.filter(item=>item.path==='/poi/nearby').length,1);
    assert.equal(data.travelos.plan.planner,'gemini-structured');
    assert.match(data.travelos.plan.englishMeaning,/current location/);
    assert.equal(mapCalls.find(item=>item.path==='/poi/nearby').body.keyword,'convenience store');
    assert.equal(mapCalls.find(item=>item.path==='/poi/nearby').body.category,'convenience_store');
    assert.deepEqual(data.travelos.plan.tools.map(item=>item.name),['weather','search_places','walking_route']);
    assert.match(geminiPrompts[0],/semantic planner/i);
    assert.match(geminiPrompts[1],/TÌM ĐỊA ĐIỂM/);
    assert.doesNotMatch(geminiPrompts[1],/LỊCH TRÌNH|AN TOÀN VÀ SỨC KHỎE|THỜI TIẾT VÀ HOẠT ĐỘNG NGOÀI TRỜI/);
  }finally{globalThis.fetch=originalFetch;}
});

test('English interpretation keeps Vietnamese source and never sends English to AMap', async () => {
  const {normalizeSemanticPlan}=await import('../worker/src/bot/planner/semantic-planner.js');
  const {compileSemanticNeeds}=await import('../worker/src/bot/library/api-registry.js');
  const raw={englishMeaning:'Find convenience stores near my current location',primaryIntent:'PLACE_DISCOVERY',needs:[
    {kind:'PLACE_SEARCH',query:'cửa hàng tiện lợi',queryEn:'convenience store',target:'current_location',area:'',time:'',travelMode:'NONE',sourceText:'cửa hàng tiện lợi quanh đây',required:true,confidence:.96}
  ],answerContract:['Tìm cửa hàng tiện lợi gần nhất'],clarificationQuestion:'',overallConfidence:.96,shouldUseLiveData:true};
  const plan=normalizeSemanticPlan(raw,'Tìm cửa hàng tiện lợi quanh đây');
  assert.equal(plan.needs[0].query,'cửa hàng tiện lợi');
  assert.equal(compileSemanticNeeds(plan,{language:'vi',hasGps:true}).tools[0].queryEn,'convenience store');
  assert.equal(compileSemanticNeeds(plan,{language:'zh',hasGps:true}).tools[0].queryEn,'');
  assert.equal(normalizeSemanticPlan({...raw,needs:[{...raw.needs[0],sourceText:'ở Đà Lạt'}]},'Tìm cửa hàng tiện lợi quanh đây').needs.length,0);
});

test('GPT handles planning and reply first; Gemini answers when GPT fails', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch;
  const request=()=>new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Chào Pipi',userLocation:{country:'Việt Nam',latitude:10.77,longitude:106.69}})});
  const env={OPENAI_API_KEY:'fake-openai',GEMINI_API_KEY:'fake-gemini',SEMANTIC_PLANNER_ENABLED:'true',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'};
  const calls=[];
  let failOpenAi=false;
  globalThis.fetch=async (url,init={})=>{
    if(String(url).includes('api.openai.com')){
      calls.push('openai');
      assert.equal(init.headers.Authorization,'Bearer fake-openai');
      const body=JSON.parse(init.body);
      assert.equal(body.store,false);
      assert.equal(typeof body.input,'string');
      if(body.text?.format?.type==='json_object')assert.match(body.input,/JSON/);
      if(failOpenAi)return new Response(JSON.stringify({error:{message:'unavailable'}}),{status:503});
      const text=body.text?.format?.type==='json_object'
        ?JSON.stringify({englishMeaning:'Greet Pipi',primaryIntent:'LOCAL_GUIDE',needs:[],answerContract:[],clarificationQuestion:'Chào bạn, mình giúp gì?',overallConfidence:.9,shouldUseLiveData:false})
        :'Chào bạn, Pipi đây!';
      return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]}),{status:200});
    }
    calls.push('gemini');
    const body=JSON.parse(init.body);
    const text=body.generationConfig?.responseMimeType==='application/json'
      ?JSON.stringify({primaryIntent:'LOCAL_GUIDE',needs:[],answerContract:[],clarificationQuestion:'',overallConfidence:.9,shouldUseLiveData:false})
      :'Chào bạn, Pipi đây!';
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200});
  };
  try{
    let response=await worker.fetch(request(),env),data=await response.json();
    assert.equal(response.status,200);
    assert.match(data.text,/Pipi/);
    assert.equal(data.travelos.plan.needsClarification,false);
    assert.deepEqual(calls,['openai','openai']);
    failOpenAi=true;calls.length=0;
    response=await worker.fetch(request(),env);data=await response.json();
    assert.equal(response.status,200);
    assert.match(data.text,/Pipi/);
    assert.deepEqual(calls,['openai','gemini','openai','gemini']);
  }finally{globalThis.fetch=originalFetch;}
});

test('OpenAI errors expose only safe diagnostic codes, not credentials', async () => {
  const {requestOpenAi}=await import('../worker/src/bot/openai-provider.js');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{code:'insufficient_quota',param:'text.format',message:'sensitive details'}}),{status:429});
  try{
    await assert.rejects(requestOpenAi('Say hello',[{role:'user',parts:[{text:'hello'}]}],{OPENAI_API_KEY:'secret-test'}),error=>{
      assert.equal(error.message,'OPENAI_HTTP_429_insufficient_quota_text.format');
      assert.doesNotMatch(error.message,/secret-test|sensitive details/);
      return true;
    });
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 reports provider suggestions for a live need that has no adapter', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch;let call=0;
  globalThis.fetch=async (url,init={})=>{
    assert.match(String(url),/generativelanguage\.googleapis\.com/);call++;
    const payload=JSON.parse(String(init.body||'{}'));
    if(payload.generationConfig?.responseMimeType==='application/json'){
      const plan={primaryIntent:'TRAVEL_UTILITY',needs:[{kind:'CURRENCY_RATE',query:'CNY sang VND',target:'',area:'',time:'hôm nay',travelMode:'',sourceText:'tỷ giá CNY sang VND hôm nay',required:true,confidence:.98}],answerContract:['Cho biết tỷ giá CNY sang VND hôm nay'],clarificationQuestion:'',overallConfidence:.97,shouldUseLiveData:true};
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(plan)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Tôi chưa có nguồn tỷ giá live đã xác minh.'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'tỷ giá CNY sang VND hôm nay',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69}})}),{GEMINI_API_KEY:'test',SEMANTIC_PLANNER_ENABLED:'true',SEMANTIC_PLANNER_MODE:'adaptive',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(call,0);
    assert.equal(data.text,'Pipi chưa thể hỗ trợ câu hỏi này.');
    assert.equal(data.travelos.missingApiSuggestions[0].need,'CURRENCY_RATE');
    assert.ok(data.travelos.missingApiSuggestions[0].suggestedProviders.includes('Frankfurter API'));
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 keeps unsupported live needs safe when Gemini rejects the Worker location', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    return new Response(JSON.stringify({error:{message:'User location is not supported for the API use.'}}),{status:400,headers:{'Content-Type':'application/json'}});
  };
  const originalWarn=console.warn;console.warn=()=>{};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'tỷ giá CNY sang VND hôm nay',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69}})}),{GEMINI_API_KEY:'test',SEMANTIC_PLANNER_ENABLED:'true',SEMANTIC_PLANNER_MODE:'adaptive',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.error,undefined);
    assert.equal(data.text,'Pipi chưa thể hỗ trợ câu hỏi này.');
    assert.equal(data.travelos.missingApiSuggestions[0].need,'CURRENCY_RATE');
    assert.equal(calls.length,0);
  }finally{globalThis.fetch=originalFetch;console.warn=originalWarn;}
});

test('AI v3 does not mistake a currency conversion for a China place name', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  let mapCalls=0;
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async()=>{mapCalls++;throw new Error('Map should not be called');}}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Đổi 100 tệ sang VND',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.565,longitude:106.587}})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.text,'Pipi chưa thể hỗ trợ câu hỏi này.');
  assert.equal(mapCalls,0);
});

test('AI v3 accepts compact lat/lng and plans tools deterministically on the backend', async () => {
  const { default: worker } = await importWorker('../worker/src/index.js');
  const originalFetch = globalThis.fetch;
  let geminiCalls = 0;const mapCalls=[];
  globalThis.fetch = async url => {
    if (!String(url).includes('generativelanguage.googleapis.com')) throw new Error(`Unexpected fetch ${url}`);
    geminiCalls++;
    const text = 'Pharmacity gần nhất cách bạn 120 m.';
    return new Response(JSON.stringify({ candidates:[{ content:{ parts:[{ text }] } }] }), { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  const env = {
    GEMINI_API_KEY:'test',
    ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',
    MAP_WORKER:{
      fetch:async request => {
        const path=new URL(request.url).pathname,body=await request.json();mapCalls.push({path,body});
        assert.equal(body.name,'Pharmacity');
        assert.equal(body.center.lat,10.77);
        assert.equal(body.center.lng,106.69);
        if(path==='/poi/nearby'){
          assert.equal(body.radius,50000);
          assert.equal(body.limit,5);
          assert.equal(body.sortBy,'name_similarity');
          return new Response(JSON.stringify({ ok:true, source:'google-places-text-v1', provider:'google_places', query:{name:'Pharmacity',sortBy:'name_similarity',radius:50000},center:body.center, pois:[{ id:'p1', name:'Nhà thuốc Pharmacity', address:'123 Test', lat:10.77, lng:106.69, distance:120, provider:'google_places' }] }), { status:200, headers:{ 'Content-Type':'application/json' } });
        }
        assert.equal(path,'/poi/details');
        assert.equal(body.placeId,'p1');
        return new Response(JSON.stringify({ok:true,source:'google-place-details-v1',provider:'google_places',place:{id:'p1',name:'Nhà thuốc Pharmacity',address:'123 Test',lat:10.77,lng:106.69,distance:120,rating:4.7,userRatingCount:250,openNow:true,openTime:'Hôm nay: 07:00–22:00',provider:'google_places'}}),{status:200,headers:{'Content-Type':'application/json'}});
      }
    }
  };
  try {
    const response=await worker.fetch(new Request('https://ai.test/ai-v3', {
      method:'POST', headers:{ Origin:'https://kyuu2601-star.github.io', 'Content-Type':'application/json' },
      body:JSON.stringify({ userMessage:'Pharmacity gần nhất?', userLocation:{ country:'Việt Nam', city:'TP.HCM', lat:10.77, lng:106.69, source:'gps' }, chatHistory:[] })
    }), env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.travelos.version,3);
    assert.equal(data.travelos.plan.tools[0].placeName,'Pharmacity');
    assert.equal(data.travelos.nearby.pois[0].name,'Nhà thuốc Pharmacity');
    assert.equal(data.travelos.nearby.query.radius,50000);
    assert.equal(data.travelos.placeDetails.openNow,true);
    assert.equal(data.travelos.reviewSummary,'Địa điểm được đánh giá 4.7/5 từ 250 lượt; Pipi chưa có nhận xét cụ thể để tóm tắt.');
    assert.deepEqual(mapCalls.map(call=>call.path),['/poi/nearby','/poi/details']);
    assert.equal(data.travelos.sources[0].source,'google-places-text-v1');
    assert.equal(geminiCalls,0);
    assert.match(data.text,/Nhà thuốc Pharmacity/);
  } finally {
    globalThis.fetch=originalFetch;
  }
});

test('AI v3 preserves an arbitrary venue name and returns verified details even without Gemini', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/poi/nearby'){
      assert.equal(body.name,'Bảo tàng Chứng tích Chiến tranh');
      assert.equal(body.query,'Bảo tàng Chứng tích Chiến tranh');
      assert.equal(body.radius,50000);
      assert.equal(body.limit,5);
      assert.equal(body.sortBy,'name_similarity');
      return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',query:{name:body.name,sortBy:'name_similarity',radius:50000},center:body.center,pois:[
        {id:'war-museum',name:'Bảo tàng Chứng tích Chiến tranh',address:'28 Võ Văn Tần, TP.HCM',lat:10.7795,lng:106.692,distance:1400,rating:4.5,userRatingCount:35000,provider:'google_places'},
        {id:'city-museum',name:'Bảo tàng Thành phố Hồ Chí Minh',address:'65 Lý Tự Trọng, TP.HCM',lat:10.776,lng:106.699,distance:1800,rating:4.3,userRatingCount:5000,provider:'google_places'}
      ]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.equal(path,'/poi/details');
    assert.equal(body.placeId,'war-museum');
    return new Response(JSON.stringify({ok:true,source:'google-place-details-v1',provider:'google_places',place:{id:'war-museum',name:'Bảo tàng Chứng tích Chiến tranh',address:'28 Võ Văn Tần, TP.HCM',lat:10.7795,lng:106.692,rating:4.5,userRatingCount:35000,openNow:true,openTime:'Hôm nay: 07:30–17:30',reviews:[{rating:5,text:'Nhiều tư liệu lịch sử, nên dành đủ thời gian tham quan.',publishTime:new Date().toISOString()}],provider:'google_places'}}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Tìm Bảo tàng Chứng tích Chiến tranh giúp tôi',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69},chatHistory:[]})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(calls.map(call=>call.path),['/poi/nearby','/poi/details']);
  assert.deepEqual(data.travelos.plan.tools.map(tool=>tool.name),['search_places','place_details','place_busyness']);
  assert.equal(data.travelos.nearby.pois[0].id,'war-museum');
  assert.equal(data.travelos.placeDetails.openNow,true);
  assert.match(data.travelos.reviewSummary,/Các đánh giá gần đây chấm trung bình 5\.0\/5/);
  assert.match(data.text,/28 Võ Văn Tần/);
  assert.match(data.text,/đang mở/);
  calls.length=0;
  const where=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Bảo tàng Chứng tích Chiến tranh ở đâu?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69}})}),env);
  const whereData=await where.json();
  assert.deepEqual(calls.map(call=>call.path),['/poi/nearby','/poi/details']);
  assert.equal(whereData.travelos.nearby.pois[0].id,'war-museum');
  assert.doesNotMatch(whereData.text,/AMap|Trung Quốc/);
});

test('AI v3 translates a Vietnamese China landmark name before AMap search', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/poi/nearby'){
      assert.equal(body.provider,'amap');
      assert.equal(body.query,'重庆市人民大礼堂');
      assert.ok(body.queryVariants.includes('重庆市人民大礼堂'));
      assert.ok(body.queryVariants.includes('人民大礼堂'));
      assert.equal(body.translationSource,'official-alias');
      return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',query:{name:body.name,keywords:body.queryVariants,radius:50000},center:body.center,pois:[
        {id:'B00170BPJJ',name:'重庆市人民大礼堂',address:'人民路173号',lat:29.564,lng:106.5528,distance:219,rating:'4.7',type:'科教文化服务;会展中心;会展中心',provider:'amap',country:'Trung Quốc'}
      ]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.equal(path,'/poi/details');
    assert.equal(body.placeId,'B00170BPJJ');
    return new Response(JSON.stringify({ok:true,source:'amap-place-detail-v5',provider:'amap',place:{id:'B00170BPJJ',name:'重庆市人民大礼堂',address:'人民路173号',lat:29.564,lng:106.5528,distance:219,rating:'4.7',type:'科教文化服务;会展中心;会展中心',provider:'amap',country:'Trung Quốc'}}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'vị trí Lễ Đường Nhân Dân',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551},chatHistory:[]})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(calls.map(call=>call.path),['/poi/nearby','/poi/details']);
  assert.equal(data.travelos.placeDetails.id,'B00170BPJJ');
  assert.equal(data.travelos.nearby.pois[0].id,'B00170BPJJ');
  assert.match(data.text,/重庆市人民大礼堂/);
});

test('AI v3 searches the venue named in a social-media closure rumor', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const venue={id:'raffles-cq',name:'重庆来福士广场',address:'接圣街8号',lat:29.566,lng:106.587,distance:250,rating:'4.6',provider:'amap',country:'Trung Quốc'};
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/poi/nearby')return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,pois:[venue]}),{headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({ok:true,source:'amap-place-detail-v5',provider:'amap',place:venue}),{headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'TikTok nói Raffles City Trùng Khánh đóng cửa, có thật không?',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.565,longitude:106.587}})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(calls[0].path,'/poi/nearby');
  assert.equal(calls[0].body.name,'Raffles City Trùng Khánh');
  assert.equal(data.travelos.placeDetails.id,'raffles-cq');
});

test('AI v3 keeps a named China hotel readable in chat and the map list without AI', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const hotel={id:'yitel-cq',name:'和颐至尚酒店(重庆解放碑洪崖洞店)',address:'临江支路30号',city:'重庆市',district:'渝中区',lat:29.5599,lng:106.5791,distance:450,rating:'4.4',provider:'amap',country:'Trung Quốc'};
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/poi/nearby')return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:{lat:29.563,lng:106.551},pois:[hotel]}),{headers:{'Content-Type':'application/json'}});
    assert.equal(path,'/poi/details');
    return new Response(JSON.stringify({ok:true,source:'amap-place-detail-v5',provider:'amap',place:hotel}),{headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'vị trí khách sạn Yitel',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551}})}),env);
  const data=await response.json(),poi=data.travelos.nearby.pois[0];
  assert.equal(poi.localizedName,'Khách sạn Yitel (和颐至尚酒店 · 重庆解放碑洪崖洞店)');
  assert.equal(poi.localizedAddress,'Quận Du Trung, Trùng Khánh (临江支路30号)');
  assert.equal(data.travelos.placeDetails.localizedName,poi.localizedName);
  assert.match(data.text,/Khách sạn Yitel \(和颐至尚酒店/);
  assert.doesNotMatch(data.text,/Khách sạn \(和颐至尚酒店/);
});

test('AI v3 uses structured AI translation for an unknown Vietnamese venue name, then lets AMap verify it', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch,translationPrompts=[];
  globalThis.fetch=async (_url,init={})=>{
    const payload=JSON.parse(String(init.body||'{}')),system=payload?.systemInstruction?.parts?.[0]?.text||'';
    if(system.includes('bộ chuyển tên địa điểm')){
      translationPrompts.push(system);
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({primary:'湖广会馆',variants:['重庆湖广会馆','湖广会馆古建筑群']})}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(system.includes('dịch tên và địa chỉ địa điểm Trung Quốc')){
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({items:[{id:'huguang',localizedName:'Hội quán Hồ Quảng (湖广会馆)',localizedAddress:'Trùng Khánh · địa chỉ gốc: 芭蕉园1号',note:'Di tích kiến trúc lịch sử.',confidence:'high'}]})}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Tôi đã xác minh được Hội quán Hồ Quảng trên AMap.'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const mapCalls=[],env={GEMINI_API_KEY:'test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();mapCalls.push({path,body});
    if(path==='/poi/nearby'){
      assert.equal(body.query,'湖广会馆');
      assert.ok(body.queryVariants.includes('重庆湖广会馆'));
      assert.equal(body.translationSource,'gemini-zh-query');
      return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',query:{name:body.name,keywords:body.queryVariants,radius:50000},center:body.center,pois:[{id:'huguang',name:'湖广会馆',address:'芭蕉园1号',lat:29.558,lng:106.581,distance:900,rating:'4.6',type:'风景名胜;人文景观;古迹',provider:'amap',country:'Trung Quốc'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({ok:true,source:'amap-place-detail-v5',provider:'amap',place:{id:'huguang',name:'湖广会馆',address:'芭蕉园1号',lat:29.558,lng:106.581,distance:900,rating:'4.6',type:'风景名胜;人文景观;古迹',provider:'amap',country:'Trung Quốc'}}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  try{
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'vị trí Hội quán Hồ Quảng',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551}})}),env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(translationPrompts.length,1);
    assert.equal(mapCalls[0].body.name,'Hội quán Hồ Quảng');
    assert.equal(data.travelos.placeDetails.id,'huguang');
    assert.equal(data.travelos.nearby.pois[0].localizedName,'Hội quán Hồ Quảng (湖广会馆)');
    assert.match(data.travelos.nearby.pois[0].localizedAddress,/^Trung Quốc \(芭蕉园1号\)$/);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 understands CHTL and deterministically searches nearest convenience stores', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  let mapCalls=0;
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    mapCalls++;
    assert.equal(new URL(request.url).pathname,'/poi/nearby');
    const body=await request.json();
    assert.equal(body.query,'cửa hàng tiện lợi');
    assert.equal(body.keyword,'cửa hàng tiện lợi');
    assert.equal(body.category,'convenience_store');
    assert.equal(body.sortBy,'distance');
    assert.equal(body.center.lat,10.77);
    assert.equal(body.center.lng,106.69);
    return new Response(JSON.stringify({ok:true,source:'google-places-nearby-v1',provider:'google_places',center:body.center,pois:[{id:'gs25-near',name:'GS25',address:'Ngay bên cạnh',lat:10.7701,lng:106.69,distance:11,provider:'google_places',primaryType:'convenience_store'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Quanh đây có CHTL nào k?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69,source:'gps'},chatHistory:[]})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(mapCalls,1);
  assert.equal(data.travelos.plan.tools[0].category,'convenience_store');
  assert.equal(data.travelos.nearby.pois[0].name,'GS25');
  assert.match(data.text,/GS25/);
});

test('AI v3 keeps a new around-here search on GPS despite a previous distant place', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const body=await request.json();
    assert.equal(body.center.lat,10.83);
    assert.equal(body.center.lng,106.68);
    assert.equal(body.category,'convenience_store');
    return new Response(JSON.stringify({ok:true,source:'google-places-nearby-v1',provider:'google_places',center:body.center,pois:[{id:'gs25-govap',name:'GS25 Gò Vấp',lat:10.8301,lng:106.68,distance:11,provider:'google_places',primaryType:'convenience_store'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const previous={placeDetails:{id:'long-thanh',name:'GS25 Long Thành',lat:10.77,lng:106.95,provider:'google_places'},nearby:{center:{lat:10.77,lng:106.95},query:{keyword:'cửa hàng tiện lợi',category:'convenience_store',radius:3000},pois:[{id:'long-thanh',name:'GS25 Long Thành',lat:10.77,lng:106.95,provider:'google_places'}]}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Cửa hàng tiện lợi quanh đây',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.83,longitude:106.68,source:'app-anchor'},conversationContext:previous})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.travelos.nearby.center.lat,10.83);
  assert.equal(data.travelos.nearby.pois[0].name,'GS25 Gò Vấp');
});

test('AI v3 selects the nearest eligible places from the full provider candidate pool', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const center={lat:10.83,lng:106.68,country:'Việt Nam'};
  const candidate=(id,name,lat,primaryType,types)=>({id,name,lat,lng:106.68,primaryType,types,provider:'google_places',country:'Việt Nam'});
  const candidates=[candidate('far','Cửa hàng xa',10.84,'convenience_store',['convenience_store']),candidate('phone','Viettel Store',10.83005,'electronics_store',['electronics_store','convenience_store']),candidate('near','Tiệm nhỏ đối diện',10.8301,'convenience_store',['convenience_store'])];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const body=await request.json();assert.equal(body.center.lat,center.lat);
    return new Response(JSON.stringify({ok:true,source:'google-places-multi-pass-v1',provider:'google_places',center,pois:[candidates[0]],candidates,meta:{total:3,coverageLimited:true}}),{headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'cửa hàng tiện lợi quanh đây',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:center.lat,longitude:center.lng}})}),env);
  const data=await response.json();
  assert.deepEqual(data.travelos.nearby.pois.map(place=>place.id),['near','far']);
  assert.equal(data.travelos.nearby.selectionMeta.candidateCount,3);
  assert.match(data.text,/có thể chưa tìm được hết mọi địa điểm quanh đây/);
});

test('AI v3 understands generic nearby sightseeing in Chongqing without relying on Gemini', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  let mapCalls=0;
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    mapCalls++;
    assert.equal(new URL(request.url).pathname,'/poi/nearby');
    const body=await request.json();
    assert.equal(body.provider,'amap');
    assert.equal(body.query,'điểm tham quan');
    assert.equal(body.category,'tourist_attraction');
    assert.equal(body.center.lat,29.563);
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,pois:[{id:'cq-view',name:'马鞍山堂里',address:'渝中区',lat:29.5631,lng:106.552,distance:58,provider:'amap',coordSystem:'gcj02',country:'Trung Quốc',city:'重庆市',district:'渝中区'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Có gì chơi quanh đây?',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551,source:'gps'},chatHistory:[]})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(mapCalls,1);
  assert.equal(data.travelos.plan.tools[0].category,'tourist_attraction');
  assert.equal(data.travelos.nearby.pois[0].name,'马鞍山堂里');
  assert.match(data.text,/马鞍山堂里/);
});

test('AI v3 treats a leading Chongqing location as a remote AMap search area', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const paths=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();paths.push(path);
    assert.equal(body.provider,'amap');
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'amap-place-text-v5',provider:'amap',places:[{id:'cq',name:'重庆',lat:29.563,lng:106.551,country:'Trung Quốc',provider:'amap',coordSystem:'gcj02'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(path,'/poi/nearby');
    assert.equal(body.category,'tourist_attraction');
    assert.equal(body.center.lat,29.563);
    assert.notEqual(body.center.lat,10.77);
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,pois:[{id:'cq-view',name:'马鞍山堂里',address:'渝中区',lat:29.5631,lng:106.552,distance:58,provider:'amap',coordSystem:'gcj02',country:'Trung Quốc'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Ở Trùng Khánh có gì chơi?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69,source:'gps'},chatHistory:[]})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(paths,['/place/resolve','/poi/nearby']);
  assert.equal(data.travelos.remoteSearch.requestedArea,'Trùng Khánh');
  assert.equal(data.travelos.nearby.pois[0].name,'马鞍山堂里');
});

test('AI v3 never turns a missing fresh GPS fix into an empty nearby result', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  let mapCalls=0;
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Quanh đây có cửa hàng tiện lợi nào không?',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',source:'selector'},chatHistory:[]})}),{ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async()=>{mapCalls++;throw new Error('Map Worker must not run without GPS');}}});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.error.code,'GPS_REQUIRED');
  assert.match(data.text,/chưa lấy được GPS hiện tại/);
  assert.equal(mapCalls,0);
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
      assert.equal(body.query,'Landmark 81');
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
    assert.match(data.text,/Pipi tìm được/);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 handles an explicit remote-area search even when Gemini is unavailable', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const paths=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();paths.push(path);
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'landmark-81',name:'Landmark 81',address:'Bình Thạnh, TP.HCM',lat:10.7951,lng:106.7221,country:'Việt Nam',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(body.query,'gà rán');
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
  assert.match(data.text,/Pipi tìm được 1 địa điểm/);
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

test('AI v3 localizes AMap places without leaking the China flow to Google', async () => {
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
    throw new Error(`Unexpected China flow call ${path}`);
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Tìm quán lẩu quanh Vương Phủ Tỉnh',userLocation:{country:'Trung Quốc',city:'Bắc Kinh'}})}),env);
  const data=await response.json(),poi=data.travelos.nearby.pois[0];
  assert.equal(response.status,200);
  assert.deepEqual(calls.map(call=>call.path),['/place/resolve','/poi/nearby']);
  assert.match(poi.localizedName,/海底捞火锅/);
  assert.match(poi.localizedAddress,/王府井大街88号/);
  assert.match(poi.note,/lẩu Tứ Xuyên/);
  assert.match(poi.note,/thịt bò/);
  assert.match(data.text,/海底捞火锅/);
});

test('AI v3 translates ordinary AMap POI names to Vietnamese with Workers AI', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const translated=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',AI:{run:async (model,input)=>{
    assert.equal(model,'@cf/google/gemma-4-26b-a4b-it');
    translated.push(input.messages[1].content);
    return {response:'Cửa hàng tiện lợi Lù Kè'};
  }},MAP_WORKER:{fetch:async request=>{
    assert.equal(new URL(request.url).pathname,'/poi/nearby');
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:{lat:29.563,lng:106.551,country:'Trung Quốc'},pois:[{id:'store-1',name:'路客便利店',address:'人和街67号',city:'重庆市',district:'渝中区',lat:29.564,lng:106.552,distance:160,provider:'amap',country:'Trung Quốc'}]}),{headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'cửa hàng tiện lợi quanh đây',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551}})}),env);
  const data=await response.json(),poi=data.travelos.nearby.pois[0];
  assert.deepEqual(translated,['路客便利店']);
  assert.equal(poi.localizedName,'Cửa hàng tiện lợi Lù Kè (路客便利店)');
  assert.equal(poi.localizedAddress,'Quận Du Trung, Trùng Khánh (人和街67号)');
  assert.match(data.text,/Cửa hàng tiện lợi Lù Kè \(路客便利店\)/);
});

test('AI v3 ranks food venues by recent meaningful review evidence instead of aggregate stars', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',places:[{id:'emart-pvt',name:'Emart Phan Văn Trị',address:'Gò Vấp, TP.HCM',lat:10.8273,lng:106.6785,country:'Việt Nam',provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    const venues=[
      {id:'old-rating',name:'Quán điểm tổng cao',address:'Gò Vấp, TP.HCM',lat:10.8275,lng:106.6787,distance:80,rating:4.9,userRatingCount:321,primaryType:'restaurant',provider:'google_places',reviews:[{rating:5,text:'Ngon và phục vụ rất tốt, gà rán nóng giòn thơm ngon.',publishTime:'2020-01-01T00:00:00Z'}]},
      {id:'recent-review',name:'Quán được khen gần đây',address:'Gò Vấp, TP.HCM',lat:10.8276,lng:106.6788,distance:110,rating:4.4,userRatingCount:81,primaryType:'restaurant',provider:'google_places',reviews:[{rating:5,text:'Gà rán nóng giòn, phần thịt mềm và sốt chấm rất hợp vị.',publishTime:new Date().toISOString()}]}
    ];
    return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',center:body.center,pois:venues,candidates:venues}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Có quán gà rán nào rating cao ở quanh khu vực Emart PVT k'})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(calls[0].path,'/place/resolve');
  assert.equal(calls[0].body.query,'Emart PVT');
  assert.equal(calls[1].path,'/poi/nearby');
  assert.equal(calls[1].body.query,'fast food restaurant');
  assert.ok(calls[1].body.queryVariants.includes('fried chicken'));
  assert.equal(calls[1].body.limit,10);
  assert.equal(calls[1].body.sortBy,'distance');
  assert.equal(calls[1].body.language,'en');
  assert.equal(data.travelos.nearby.query.sortBy,'review_quality');
  assert.equal(data.travelos.nearby.pois[0].id,'recent-review');
  assert.match(data.text,/Pipi đã tìm quanh.*có thể phù hợp với bạn/);
  assert.doesNotMatch(data.text,/API|30 ngày|dữ liệu|review/);
  assert.match(data.travelos.nearby.pois[0].note,/Có khách gần đây khen món gà rán/);
  assert.equal(data.travelos.remoteSearch.requestedArea,'Emart PVT');
});

test('AI v3 retries a dish-name search when broad food categories have no relevant venue', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const body=await request.json();calls.push(body);
    const dish=body.name==='bánh xèo';
    const pois=dish?[{id:'banh-xeo-1',name:'Bánh Xèo Miền Trung',address:'Gò Vấp',lat:10.85,lng:106.68,distance:2100,provider:'geoapify',country:'Việt Nam'},{id:'banh-xeo-duplicate',name:'Bánh Xèo Miền Trung',address:'Gò Vấp',lat:10.85001,lng:106.68001,distance:2101,provider:'geoapify',country:'Việt Nam'}]:[{id:'rice-1',name:'Cơm tấm',address:'Gò Vấp',lat:10.836,lng:106.67,distance:100,provider:'geoapify',country:'Việt Nam',primaryType:'restaurant'}];
    return new Response(JSON.stringify({ok:true,source:'geoapify-places-v2',provider:'geoapify',center:body.center,pois}),{headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Tìm quán bánh xèo ngon quanh đây',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.835,longitude:106.67}})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.ok(calls.some(call=>call.name==='bánh xèo'&&call.radius>=10000));
  assert.equal(data.travelos.nearby.pois[0].name,'Bánh Xèo Miền Trung');
  assert.equal(data.travelos.nearby.pois.length,1);
  assert.match(data.travelos.nearby.pois[0].note,/Tên quán ghi món bánh xèo/);
});

test('AI v3 strips trailing ranking words from a remote China area and forces AMap', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const calls=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve')return new Response(JSON.stringify({ok:true,source:'amap-place-text-v5',provider:'amap',places:[{id:'raffles-cq',name:'重庆来福士广场',lat:29.566,lng:106.586,country:'Trung Quốc',provider:'amap',coordSystem:'gcj02'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,pois:[{id:'store-1',name:'罗森便利店',address:'渝中区',lat:29.5661,lng:106.5861,distance:30,provider:'amap',country:'Trung Quốc',coordSystem:'gcj02'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Tìm cửa hàng tiện lợi quanh Raffles City Trùng Khánh gần nhất',userLocation:{country:'Việt Nam',city:'TP.HCM'}})}),env);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(calls[0].body.query,'Raffles City Trùng Khánh');
  assert.equal(calls[0].body.provider,'amap');
  assert.equal(calls[1].body.provider,'amap');
  assert.equal(calls[1].body.country,'Trung Quốc');
  assert.equal(data.travelos.nearby.provider,'amap');
});

test('AI v3 gives Gemini only the structured previous place list for follow-up wording', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const originalFetch=globalThis.fetch,prompts=[];
  globalThis.fetch=async (url,init={})=>{
    assert.match(String(url),/generativelanguage\.googleapis\.com/);
    const payload=JSON.parse(String(init.body||'{}'));prompts.push(payload);
    const text='Trong danh sách vừa rồi, Quán B có rating cao nhất: 4,9/5.';
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const nearby={provider:'amap',query:'quán ăn quanh Raffles City',center:{lat:29.566,lng:106.586,country:'Trung Quốc',coordSystem:'gcj02'},pois:[
      {id:'a',name:'店A',localizedName:'Quán A (店A)',address:'地址A',lat:29.5661,lng:106.5861,distance:30,rating:4.4,provider:'amap',country:'Trung Quốc',coordSystem:'gcj02'},
      {id:'b',name:'店B',localizedName:'Quán B (店B)',address:'地址B',lat:29.5662,lng:106.5862,distance:50,rating:4.9,provider:'amap',country:'Trung Quốc',coordSystem:'gcj02'}
    ]};
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Trong danh sách vừa rồi, chỗ nào rating cao nhất?',chatHistory:[],conversationContext:{nearby},userLocation:{country:'Trung Quốc',city:'Trùng Khánh'}})}),{GEMINI_API_KEY:'test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(prompts.length,1);
    const answerText=prompts[0].contents.at(-1).parts[0].text;
    assert.match(answerText,/"rating":4\.9/);
    assert.match(data.text,/Quán B/);
  }finally{globalThis.fetch=originalFetch;}
});

test('AI v3 resolves a venue and distinguishes live BestTime busyness from forecast', async () => {
  const { default: worker } = await importWorker('../worker/src/index.js');
  const originalFetch = globalThis.fetch;
  let geminiCalls=0,bestTimeCalls=0;
  globalThis.fetch=async (url,init={}) => {
    const target=String(url);
    if(target.includes('generativelanguage.googleapis.com')) {
      geminiCalls++;
      const text='Cafe Test hiện đang khá đông.';
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
      const path=new URL(request.url).pathname,body=await request.json();
      assert.equal(body.query,'Cafe Test');
      if(path==='/poi/nearby'){
        assert.equal(body.radius,50000);
        assert.equal(body.sortBy,'name_similarity');
        return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',query:{name:'Cafe Test',sortBy:'name_similarity',radius:50000},center:body.center,pois:[{id:'google-place-test',name:'Cafe Test',address:'123 Test, TP.HCM',lat:10.77,lng:106.69,distance:50,provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
      }
      assert.equal(path,'/poi/details');
      return new Response(JSON.stringify({ok:true,source:'google-place-details-v1',provider:'google_places',place:{id:'google-place-test',name:'Cafe Test',address:'123 Test, TP.HCM',lat:10.77,lng:106.69,rating:4.6,userRatingCount:120,openNow:true,provider:'google_places'}}),{status:200,headers:{'Content-Type':'application/json'}});
    }}
  };
  try {
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Giờ Cafe Test có đông không?',userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.77,longitude:106.69},chatHistory:[]})}),env);
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(bestTimeCalls,1);
    assert.equal(geminiCalls,0);
    assert.equal(data.travelos.busyness.basis,'live');
    assert.equal(data.travelos.busyness.score,72);
    assert.equal(data.travelos.busyness.label,'khá đông');
    assert.match(data.text,/khá đông/);
    assert.equal(data.travelos.sources.find(source=>source.tool==='place_busyness').source,'besttime-live');
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
      const text='Cafe Test thường khá đông vào giờ này.';
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    assert.equal(init.method,'POST');bestTimeCalls++;
    if(target.includes('/forecasts/live')) return new Response(JSON.stringify({status:'Error',message:'No live data available for this venue at this moment.'}),{status:400,headers:{'Content-Type':'application/json'}});
    assert.match(target,/besttime\.app\/api\/v1\/forecasts\/now\/raw/);
    return new Response(JSON.stringify({status:'OK',analysis:{hour_analysis:{hour:19,intensity_nr:2,intensity_txt:'Above average'},hour_raw:68},venue_info:{venue_id:'ven-test',venue_name:'Cafe Test',venue_current_localtime_iso:'Thursday 07:20PM'}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'Giờ Cafe Test có đông không?',userLocation:{country:'Việt Nam',city:'TP.HCM'},chatHistory:[]})}),{GEMINI_API_KEY:'test',BESTTIME_PRIVATE_KEY:'besttime-test',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
      assert.equal(new URL(request.url).pathname,'/place/resolve');
      return new Response(JSON.stringify({ok:true,source:'google-places-text-v1',provider:'google_places',places:[{id:'cafe-test',name:'Cafe Test',address:'123 Test, TP.HCM',lat:10.77,lng:106.69,provider:'google_places'}]}),{status:200,headers:{'Content-Type':'application/json'}});
    }}});
    const data=await response.json();
    assert.equal(response.status,200);assert.equal(geminiCalls,1);assert.equal(bestTimeCalls,2);
    assert.equal(data.travelos.busyness.basis,'forecast');
    assert.equal(data.travelos.busyness.score,68);
    assert.equal(data.travelos.sources.find(source=>source.tool==='place_busyness').source,'besttime-forecast');
  } finally {globalThis.fetch=originalFetch;}
});

test('AI v3 has no Gemini planner and retries nearby radii in backend code', async () => {
  const source=await readFile(new URL('../worker/src/index.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/V3_PLANNER_PROMPT|V3_PLANNER_SCHEMA/);
  const {default:worker}=await importWorker('../worker/src/index.js');
  const radii=[];
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'tìm tạp hóa xung quanh',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551,source:'gps'}})}),{ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const body=await request.json();radii.push(body.radius);
    const pois=body.radius===10000?[{id:'store',name:'罗森便利店',address:'渝中区',lat:29.564,lng:106.552,distance:140,provider:'amap',coordSystem:'gcj02',country:'Trung Quốc'}]:[];
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,query:{keyword:body.keyword,category:body.category,radius:body.radius},pois}),{status:200,headers:{'Content-Type':'application/json'}});
  }}});
  const data=await response.json();
  assert.deepEqual(radii,[3000,5000,10000]);
  assert.deepEqual(data.travelos.nearby.attemptedRadii,[3000,5000,10000]);
  assert.equal(data.travelos.nearby.pois[0].name,'罗森便利店');
});

test('Voice Mode streams progress, a short spoken answer, and detail from one API search', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const radii=[];
  const response=await worker.fetch(new Request('https://ai.test/voice-v1',{
    method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},
    body:JSON.stringify({userMessage:'tìm tạp hóa xung quanh',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551,source:'gps'}})
  }),{ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const body=await request.json();radii.push(body.radius);
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,query:{keyword:body.keyword,category:body.category,radius:body.radius},pois:[{id:'store',name:'罗森便利店',localizedName:'Lawson',address:'渝中区',lat:29.564,lng:106.552,distance:140,provider:'amap',coordSystem:'gcj02',country:'Trung Quốc'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}});
  const events=(await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/application\/x-ndjson/);
  assert.deepEqual(radii,[3000]);
  assert.deepEqual(events.filter(event=>event.type==='phase').map(event=>event.phase),['planning','searching','analyzing','writing']);
  assert.match(events.find(event=>event.type==='spoken').text,/Chi tiết ở bên dưới/);
  assert.doesNotMatch(events.find(event=>event.type==='spoken').text,/Lawson/);
  assert.equal(events.find(event=>event.type==='detail').travelos.nearby.pois[0].name,'罗森便利店');
  assert.equal(events.at(-1).type,'done');
});

test('Natural voice endpoint keeps the Gemini key server-side and returns WAV audio', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const previousFetch=globalThis.fetch;
  const wav=Uint8Array.from([82,73,70,70,...Array(40).fill(0)]);
  let requestBody=null;
  globalThis.fetch=async (url,init={})=>{
    assert.equal(String(url),'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(init.headers['x-goog-api-key'],'server-secret');
    requestBody=JSON.parse(init.body);
    return new Response(JSON.stringify({steps:[{type:'model_output',content:[{type:'audio',data:Buffer.from(wav).toString('base64')}]}]}),{status:200});
  };
  try{
    const response=await worker.fetch(new Request('https://ai.test/voice-tts',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({text:'Pipi tìm được quán gần bạn.'})}),{GEMINI_API_KEY:'server-secret',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'audio/wav');
    assert.equal((await response.arrayBuffer()).byteLength,44);
    assert.equal(requestBody.model,'gemini-3.8-flash-tts');
    assert.equal(requestBody.generation_config.speech_config[0].voice,'Sadachbia');
    assert.equal(requestBody.input[0].content[0].text,'Pipi tìm được quán gần bạn.');
  }finally{globalThis.fetch=previousFetch;}
});

test('Natural voice endpoint forwards streaming audio without waiting for a complete WAV', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const previousFetch=globalThis.fetch;
  let requestBody=null;
  globalThis.fetch=async (_url,init={})=>{
    requestBody=JSON.parse(init.body);
    const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('data: {"event_type":"step.delta"}\n\n'));controller.close();}});
    return new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream'}});
  };
  try{
    const response=await worker.fetch(new Request('https://ai.test/voice-tts',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({text:'Pipi đang trả lời bạn.',stream:true})}),{GEMINI_API_KEY:'server-secret',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/text\/event-stream/);
    assert.equal(requestBody.stream,true);
    assert.match(await response.text(),/step\.delta/);
  }finally{globalThis.fetch=previousFetch;}
});

test('Natural voice endpoint distinguishes quota errors without exposing provider details', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',message:'private provider detail'}}),{status:429});
  try{
    const response=await worker.fetch(new Request('https://ai.test/voice-tts',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({text:'Pipi chào bạn.',stream:true})}),{GEMINI_API_KEY:'server-secret',ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
    assert.equal(response.status,429);
    const data=await response.json();
    assert.equal(data.code,'TTS_RATE_LIMITED');
    assert.doesNotMatch(JSON.stringify(data),/private provider detail|server-secret/);
  }finally{globalThis.fetch=previousFetch;}
});

test('AI v3 preserves empty API evidence and expands the same backend search', async () => {
  const {default:worker}=await importWorker('../worker/src/index.js');
  const initialRadii=[];
  const env={ALLOWED_ORIGINS:'https://kyuu2601-star.github.io',MAP_WORKER:{fetch:async request=>{
    const body=await request.json();initialRadii.push(body.radius);
    return new Response(JSON.stringify({ok:true,source:'amap-place-v5',provider:'amap',center:body.center,query:{keyword:body.keyword,category:body.category,radius:body.radius},pois:[]}),{status:200,headers:{'Content-Type':'application/json'}});
  }}};
  const first=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'tìm tạp hóa xung quanh',userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551,source:'gps'}})}),env);
  const firstData=await first.json();
  assert.deepEqual(initialRadii,[3000,5000,10000]);
  assert.equal(firstData.travelos.nearby.pois.length,0);
  assert.match(firstData.text,/API bản đồ chưa trả kết quả/);
  assert.doesNotMatch(firstData.text,/không có cửa hàng|chắc chắn không có/i);

  initialRadii.length=0;
  const second=await worker.fetch(new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:'https://kyuu2601-star.github.io','Content-Type':'application/json'},body:JSON.stringify({userMessage:'mở rộng phạm vi tìm kiếm',conversationContext:{nearby:firstData.travelos.nearby},userLocation:{country:'Trung Quốc',city:'Trùng Khánh',latitude:29.563,longitude:106.551,source:'gps'}})}),env);
  const secondData=await second.json();
  assert.deepEqual(initialRadii,[15000]);
  assert.equal(secondData.travelos.plan.tools[0].category,'grocery_store');
  assert.equal(secondData.travelos.plan.tools[0].radius,15000);
});

test('Browser stores empty nearby context but only renders maps with POIs', async () => {
  const source=await readFile(new URL('../chat.js',import.meta.url),'utf8');
  assert.match(source,/if \(!payload \|\| !Array\.isArray\(payload\.pois\)\) return null/);
  assert.match(source,/nearby\?\.pois\?\.length && window\.TravelNearby\?\.render/g);
  assert.match(source,/attemptedRadii/);
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

test('AMap provider restores 3D buildings and pitch for China navigation', async () => {
  const source=await readFile(new URL('../china-navigation/amap-provider.js',import.meta.url),'utf8');
  const instances=[];
  const container={clears:0,replaceChildren(){this.clears++;},querySelector(){return null;}};
  class FakeMap{
    constructor(node,options){this.node=node;this.options=options;this.destroyed=false;instances.push(this);}
    resize(){}
    setCenter(){}
    clearMap(){}
    destroy(){this.destroyed=true;}
  }
  const context={console,URL,Promise,queueMicrotask,requestAnimationFrame:callback=>callback(),setTimeout:callback=>setImmediate(callback),clearTimeout:handle=>clearImmediate(handle),document:{getElementById:id=>id==='tn-map'?container:null,querySelector:()=>null,createElement:()=>({}),head:{appendChild(){}}},window:{AMap:{Map:FakeMap,Walking:function(){}},CHINA_NAV_CONFIG:{},GCJ02:{wgs84ToGcj02:(lat,lng)=>({lat,lng})}}};
  vm.runInNewContext(source,context);
  const map=await context.window.AMapProvider.createMap('tn-map',{lat:29.55,lng:106.57,coordSystem:'gcj02',country:'China'});
  assert.equal(instances.length,1);
  assert.equal(instances[0].options.viewMode,'3D');
  assert.equal(instances[0].options.pitch,45);
  assert.equal(instances[0].options.pitchEnable,true);
  assert.equal(instances[0].options.showBuildingBlock,true);
  assert.equal(map.__travelosFallback2D,false);
  assert.equal(container.clears,1);
});
