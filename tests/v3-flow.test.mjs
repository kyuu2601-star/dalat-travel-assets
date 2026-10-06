import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
  let requestedUrl = '', requestedBody = null;
  globalThis.fetch = async (url, init={}) => {
    requestedUrl=String(url);requestedBody=JSON.parse(String(init.body||'{}'));
    return new Response(JSON.stringify({places:[
      {id:'far',displayName:{text:'Nhà thuốc Pharmacity B'},formattedAddress:'500 m',location:{latitude:10.774,longitude:106.69},rating:4.5,userRatingCount:20},
      {id:'near',displayName:{text:'Nhà thuốc Pharmacity A'},formattedAddress:'100 m',location:{latitude:10.7705,longitude:106.69},rating:4.7,userRatingCount:50}
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
    assert.equal(requestedUrl,'https://places.googleapis.com/v1/places:searchText');
    assert.equal(requestedBody.textQuery,'Pharmacity');
    assert.equal(requestedBody.locationBias.circle.radius,3000);
  } finally { globalThis.fetch=originalFetch; }
});

test('Map Worker uses Google Routes for walking and returns drawable paths', async () => {
  const { default: worker } = await importWorker('../map-worker/src/index.js');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url,init={}) => {
    assert.equal(String(url),'https://routes.googleapis.com/directions/v2:computeRoutes');
    const requestBody=JSON.parse(String(init.body||'{}'));
    assert.equal(requestBody.travelMode,'WALK');
    assert.equal(requestBody.computeAlternativeRoutes,false);
    return new Response(JSON.stringify({routes:[{
      distanceMeters:1200,duration:'900s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},warnings:['Walking route beta'],
      legs:[{steps:[{distanceMeters:300,duration:'180s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC'},navigationInstruction:{instructions:'Đi thẳng',maneuver:'STRAIGHT'}}]}]
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
  } finally { globalThis.fetch=originalFetch; }
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
