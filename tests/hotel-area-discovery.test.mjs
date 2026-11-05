import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
import {parseHotelAreaRequest} from '../worker/src/bot/hotel-area-discovery.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const origin='https://kyuu2601-star.github.io';
const hotel={id:'yitel-hongyadong',name:'和颐至尚酒店(重庆解放碑洪崖洞店)',address:'临江支路30号',city:'重庆市',lat:29.561,lng:106.58,provider:'amap',country:'Trung Quốc',type:'住宿服务;宾馆酒店'};
const other={id:'yitel-nanping',name:'和颐酒店(重庆南坪店)',address:'南坪',city:'重庆市',lat:29.53,lng:106.57,provider:'amap',country:'Trung Quốc',type:'住宿服务;宾馆酒店'};
const post=(message,conversationContext)=>new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({userMessage:message,conversationContext,userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.8,longitude:106.68}})});

test('Hotel question resolves the named hotel and waits for confirmation before finding attractions',async()=>{
  const calls=[];
  const env={ALLOWED_ORIGINS:origin,MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve'){
      const landmark=String(body.query).includes('洪崖洞');
      return Response.json({ok:true,provider:'amap',places:[landmark?{id:'hongyadong',name:'洪崖洞',lat:29.562,lng:106.58}:{id:'city',name:'重庆市',lat:29.563,lng:106.551}]});
    }
    if(body.name)return Response.json({ok:true,provider:'amap',pois:[other,hotel]});
    if(body.category==='restaurant')return Response.json({ok:true,provider:'amap',pois:[{id:'food',name:'重庆老火锅',lat:29.5615,lng:106.581,city:'重庆市',provider:'amap',country:'Trung Quốc'}]});
    if(body.category==='tourist_attraction')return Response.json({ok:true,provider:'amap',pois:[{id:'night',name:'洪崖洞',lat:29.562,lng:106.58,city:'重庆市',provider:'amap',country:'Trung Quốc'},{id:'far',name:'远方',lat:29.7,lng:106.8,provider:'amap'}]});
    throw new Error('Unexpected request');
  }}};
  const question='Quanh khách sạn của mình (Yitel Hotel Trùng Khánh nằm sau Hồng Nhai Động) có chỗ nào ăn chơi buổi tối?';
  const first=await (await worker.fetch(post(question),env)).json();
  assert.equal(first.travelos.hotelArea.status,'awaiting_confirmation');
  assert.equal(first.travelos.hotelArea.candidates[0].id,'yitel-hongyadong');
  assert.equal(first.travelos.nearby,undefined);
  assert.match(first.text,/đúng chỗ bạn nói không/i);
  assert.equal(calls.filter(call=>call.path==='/poi/nearby').length,1);
  assert.equal(calls.find(call=>call.body.name)?.body.searchArea,'Trùng Khánh');
  const wrong=await (await worker.fetch(post('Không đúng',first.travelos),env)).json();
  assert.equal(wrong.travelos.hotelArea.status,'awaiting_description');
  assert.match(wrong.text,/link bản đồ/i);
  assert.equal(calls.filter(call=>call.path==='/poi/nearby').length,1,'rejecting the candidate does not search food or activities');
  const described=await (await worker.fetch(post('Nó gần Hồng Nhai Động',wrong.travelos),env)).json();
  assert.equal(described.travelos.hotelArea.status,'awaiting_confirmation');
  assert.equal(described.travelos.hotelArea.candidates[0].id,hotel.id);
  assert.equal(calls.filter(call=>call.path==='/poi/nearby').length,1,'a landmark correction still waits for approval');
  const confirmed=await (await worker.fetch(post('Đúng rồi',first.travelos),env)).json();
  assert.deepEqual(calls.filter(call=>call.body.category&&call.body.category!=='hotel').map(call=>call.body.category),['restaurant','tourist_attraction']);
  assert.equal(calls.filter(call=>call.body.category==='restaurant')[0].body.center.lat,hotel.lat);
  assert.equal(confirmed.travelos.placeDetails.id,hotel.id);
  assert.deepEqual(confirmed.travelos.nearby.pois.map(place=>place.id),['night','food']);
  assert.match(confirmed.text,/buổi tối|giờ hoạt động/i);
});

test('Hotel parser keeps the branch name separate from the requested activity',()=>{
  const parsed=parseHotelAreaRequest('Quanh khách sạn Yitel Hotel có gì chơi?',{city:'Trùng Khánh'});
  assert.equal(parsed.hotelName,'Yitel Hotel');
  assert.equal(parsed.interests[0].category,'tourist_attraction');
});

test('Hotel confirmation does not label unrelated Chinese hotels only as Chongqing',async()=>{
  const env={ALLOWED_ORIGINS:origin,MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/place/resolve')return Response.json({ok:true,places:[{name:'重庆市',lat:29.563,lng:106.551}]});
    return Response.json({ok:true,pois:[{id:'guest-hotel',name:'重庆观邸轻奢酒店',address:'人民路238-1号',city:'重庆市',lat:29.568,lng:106.554,provider:'amap',country:'Trung Quốc'}]});
  }}};
  const result=await (await worker.fetch(post('Quanh khách sạn Trùng Khánh có gì chơi?',null),env)).json();
  assert.match(result.text,/Khách sạn \(重庆观邸轻奢酒店\)/);
  assert.doesNotMatch(result.text,/khách sạn này: \*\*Trùng Khánh \(/i);
});

test('Chat keeps pending hotel confirmation even before a nearby map exists',async()=>{
  const source=await readFile(new URL('../chat.js',import.meta.url),'utf8');
  const store=new Map(),context={console,Date,AbortController,setTimeout,clearTimeout,
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
    document:{getElementById:()=>null,createElement:()=>({})},window:{}};
  vm.createContext(context);vm.runInContext(source,context);
  const pending={status:'awaiting_confirmation',hotelName:'Yitel Hotel',city:'Trùng Khánh',landmark:'Hồng Nhai Động',request:'Quanh khách sạn Yitel Hotel có gì chơi?',candidates:[hotel]};
  context.saveMessage('ai','Đây có đúng khách sạn không?',{travelContext:{hotelArea:pending}});
  const saved=JSON.parse(store.get('travelos_chat_history'));
  assert.equal(saved.messages[0].travelContext.hotelArea.candidates[0].id,hotel.id);
  assert.equal(saved.messages[0].travelContext.nearby,null);
});
