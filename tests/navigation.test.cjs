const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const load = (ctx, file) => vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);

test('POI survives normalization, link extraction, coordinate resolution and request', async () => {
  const handlers = {};
  let destination, sent;
  const place = { name:'Haidilao', country:'Trung Quốc', city:'Trùng Khánh', latitude:29.567247, longitude:106.58494, map_link:'https://www.amap.com/place/B0HDPZK1VQ?utm_source=test' };
  const window = { CONFIG:{ MAP_WORKER_URL:'https://map.example' }, TravelNavigation:{open: async opts => { destination=opts.destination; }}, addEventListener(){} };
  const document = { addEventListener:(type, fn)=>{handlers[type]=fn;}, querySelector:()=>({}), getElementById:()=>({value:''}), head:{appendChild(){} } };
  const ctx = vm.createContext({window,document,URL,console,setTimeout,clearTimeout,setInterval:()=>1,AbortController,fetch:async (url,opts)=>{sent=JSON.parse(opts.body);return {ok:true,json:async()=>({routes:[{steps:[]}]})};}});
  load(ctx,'data-service.js');
  const normalized=window.TravelData.normalizePlace(place);
  assert.equal(window.TravelData.normalizePlace({...place,amap_poi_id:'B123'}).amap_poi_id,'B123');
  load(ctx,'china-navigation/china-loader.js');
  await window.ChinaNavigation.openPlace(normalized);
  assert.equal(destination.poiId,'B0HDPZK1VQ');
  load(ctx,'china-navigation/amap-provider.js');
  const resolved=await window.AMapProvider.resolveDestination(destination);
  assert.equal(resolved.poiId,'B0HDPZK1VQ');
  load(ctx,'china-navigation/amap-route-service.js');
  await window.AMapRouteService.walkingRoute({lat:29,lng:106},resolved);
  assert.equal(sent.destination.poiId,'B0HDPZK1VQ');
  assert.equal(sent.alternativeRoute,3);
  assert.equal(sent.isIndoor,true);
});

test('route choice updates geometry, stairs and pitch; late AI result cannot replace selected route', async () => {
  const elements=new Map();
  const make=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelectorAll(){return [];}});
  const get=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
  get('#tn-routes').querySelectorAll=()=>[0,1].map(index=>({dataset:{route:String(index)},addEventListener:(type,fn)=>{get('#tn-routes')['click'+index]=fn;}}));
  let drawn, pitch;
  const pending=[];
  const step=type=>({walkType:type,instruction:'Walk',distance:50,path:[{lat:29,lng:106},{lat:29.001,lng:106.001}]});
  const routes=[{routeIndex:0,distance:1328,duration:1062,steps:[step('0')]},{routeIndex:1,distance:1582,duration:1266,steps:[step('20'),step('20')]}];
  const map={setPitch:p=>{pitch=p;},setRotation(){},destroy(){}};
  const window={CHINA_NAV_CONFIG:{ai:{enabled:true,endpoint:'https://ai.example'},chongqingAliases:['Trùng Khánh']},AMapProvider:{resolveDestination:async x=>x,createMap:async()=>map,drawRoute:(m,r)=>{drawn=r;}},AMapRouteService:{configured:()=>true,walkingRoute:async()=>({routes,origin:{lat:29,lng:106},destination:{lat:29.1,lng:106.1},source:'amap-route-v2'})}};
  const document={querySelector:get,querySelectorAll:()=>[],getElementById:()=>({value:''}),body:{classList:{add(){},remove(){}}}};
  const ctx=vm.createContext({window,document,console,AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},fetch:()=>new Promise(resolve=>pending.push(resolve))});
  load(ctx,'china-navigation/chongqing-route.js');
  load(ctx,'china-navigation/travel-navigation.js');
  await window.TravelNavigation.open({origin:{lat:29,lng:106},destination:{city:'Trùng Khánh'}});
  assert.equal(drawn.routeIndex,0);
  assert.match(get('#tn-routes').innerHTML,/2 đoạn cầu thang/);
  get('#tn-routes').click1();
  assert.equal(drawn.routeIndex,1);
  assert.equal(pitch,45);
  assert.match(get('#tn-special').innerHTML,/2 đoạn cầu thang/);
  const before=get('#tn-steps').innerHTML;
  pending[0]({json:async()=>({text:JSON.stringify({steps:[{i:1,vi:'STALE'}]})})});
  await new Promise(setImmediate);
  assert.equal(get('#tn-steps').innerHTML,before);
  window.TravelNavigation.close();
  pending[1]({json:async()=>({text:JSON.stringify({steps:[{i:1,vi:'CLOSED'}]})})});
  await new Promise(setImmediate);
  assert.equal(get('#tn-steps').innerHTML,before);
});

test('POI routing error retries coordinates once and retains Route 2.0; auth errors do not retry', async () => {
  for (const code of ['20003','10001']) {
    const calls=[];
    const ctx=vm.createContext({window:{CONFIG:{MAP_WORKER_URL:'https://map.example'}},AbortController,setTimeout,clearTimeout,fetch:async(url,opts)=>{
      calls.push(JSON.parse(opts.body));
      return calls.length===1
        ? {ok:false,status:502,json:async()=>({error:code==='20003'?'AMap Route 2.0: UNKNOWN_ERROR':'INVALID_USER_KEY',infocode:code})}
        : {ok:true,json:async()=>({routes:[{steps:[{walkType:'20'}]}]})};
    }});
    load(ctx,'china-navigation/amap-route-service.js');
    const run=()=>ctx.window.AMapRouteService.walkingRoute({lat:29,lng:106},{lat:29.1,lng:106.1,poiId:'B0HDPZK1VQ'});
    if(code==='20003') {
      const result=await run();
      assert.equal(calls.length,2);
      assert.equal(calls[0].destination.poiId,'B0HDPZK1VQ');
      assert.equal(calls[1].destination.poiId,undefined);
      assert.equal(calls[1].isIndoor,true);
      assert.equal(result.source,'amap-route-v2');
      assert.equal(result.meta.poiFallback,true);
    } else {
      await assert.rejects(run,/INVALID_USER_KEY/);
      assert.equal(calls.length,1);
    }
  }
});
