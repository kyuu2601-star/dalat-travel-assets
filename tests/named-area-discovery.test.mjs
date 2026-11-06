import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
import {parseNamedAreaRequest,namedAreaMatchScore} from '../worker/src/bot/named-area-discovery.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const origin='https://kyuu2601-star.github.io';
const post=(message,context=null)=>new Request('https://ai.test/ai-v3',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({userMessage:message,conversationContext:context,userLocation:{country:'Việt Nam',city:'TP.HCM',latitude:10.8,longitude:106.68}})});

test('Named landmarks in any city require confirmation while city-only searches do not',()=>{
  for(const area of ['hồ Xuân Hương Đà Lạt','công viên Bách Thảo Hà Nội','chợ Bến Thành TP.HCM','Raffles City Trùng Khánh','Hồng Nhai Động','Times City'])
    assert.equal(parseNamedAreaRequest('',{area,query:'quán ăn'})?.area,area);
  assert.equal(parseNamedAreaRequest('',{area:'Đà Lạt',query:'quán ăn'}),null);
  assert.ok(namedAreaMatchScore('hồ Xuân Hương Đà Lạt',{name:'Hồ Xuân Hương',address:'Đà Lạt'})>80);
  assert.equal(namedAreaMatchScore('hồ Xuân Hương Đà Lạt',{name:'Hồ Tuyền Lâm',address:'Đà Lạt'}),0);
});

test('Xuân Hương search rejects Tuyền Lâm and searches only after the user confirms',async()=>{
  const calls=[];
  const lake={id:'xuan-huong',name:'Hồ Xuân Hương',address:'Phường Xuân Hương, Đà Lạt',city:'Đà Lạt',country:'Việt Nam',lat:11.942,lng:108.442,provider:'google_places'};
  const wrong={id:'tuyen-lam',name:'Hồ Tuyền Lâm',address:'Đà Lạt',country:'Việt Nam',lat:11.9,lng:108.43,provider:'google_places'};
  const env={ALLOWED_ORIGINS:origin,MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve')return Response.json({ok:true,places:[wrong,lake]});
    if(path==='/poi/nearby')return Response.json({ok:true,provider:'google_places',pois:[
      {id:'food-1',name:'Quán ăn cạnh hồ',lat:11.9425,lng:108.4423,provider:'google_places',primaryType:'restaurant',rating:4.6},
      {id:'food-far',name:'Quán xa',lat:11.99,lng:108.50,provider:'google_places',primaryType:'restaurant'}]});
    throw new Error(path);
  }}};
  const first=await (await worker.fetch(post('Tìm quán ăn ngon quanh hồ Xuân Hương Đà Lạt'),env)).json();
  assert.equal(first.travelos.namedArea.status,'awaiting_confirmation');
  assert.deepEqual(first.travelos.namedArea.candidates.map(item=>item.id),['xuan-huong']);
  assert.equal(calls.filter(item=>item.path==='/poi/nearby').length,0);
  const second=await (await worker.fetch(post('Đúng số 1',first.travelos),env)).json();
  const nearbyCall=calls.find(item=>item.path==='/poi/nearby');
  assert.equal(nearbyCall.body.center.lat,lake.lat);
  assert.equal(nearbyCall.body.center.lng,lake.lng);
  assert.equal(second.travelos.topicAnchor.name,'Hồ Xuân Hương');
  assert.deepEqual(second.travelos.nearby.pois.map(item=>item.id),['food-1']);
});

test('A wrong named place asks for a link or nearby landmark instead of searching',async()=>{
  let searched=false;
  const env={ALLOWED_ORIGINS:origin,MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/poi/nearby')searched=true;
    return Response.json({ok:true,places:[{id:'wrong',name:'Hồ Tuyền Lâm',lat:11.9,lng:108.43}]});
  }}};
  const result=await (await worker.fetch(post('Tìm quán ăn quanh hồ Xuân Hương Đà Lạt'),env)).json();
  assert.equal(result.travelos.namedArea.status,'awaiting_description');
  assert.match(result.text,/link|mô tả/i);
  assert.equal(searched,false);
});

test('Chinese landmark names are resolved with AMap and confirmed before nearby search',async()=>{
  const calls=[];
  const env={ALLOWED_ORIGINS:origin,MAP_WORKER:{fetch:async request=>{
    const path=new URL(request.url).pathname,body=await request.json();calls.push({path,body});
    if(path==='/place/resolve')return Response.json({ok:true,places:[{id:'hongyadong',name:'洪崖洞民俗风貌区',address:'重庆市渝中区',lat:29.562,lng:106.58,provider:'amap',country:'Trung Quốc',coordSystem:'gcj02'}]});
    return Response.json({ok:true,provider:'amap',pois:[{id:'snack',name:'重庆小吃店',lat:29.5621,lng:106.5801,provider:'amap',type:'餐饮服务;小吃快餐店',country:'Trung Quốc',coordSystem:'gcj02'}]});
  }}};
  const first=await (await worker.fetch(post('Tìm quán ăn quanh Hồng Nhai Động'),env)).json();
  assert.equal(calls[0].body.provider,'amap');
  assert.equal(first.travelos.namedArea.candidates[0].id,'hongyadong');
  assert.equal(calls.filter(item=>item.path==='/poi/nearby').length,0);
  const second=await (await worker.fetch(post('Đúng rồi',first.travelos),env)).json();
  assert.equal(calls.find(item=>item.path==='/poi/nearby').body.provider,'amap');
  assert.equal(second.travelos.topicAnchor.lat,29.562);
});

test('Chat saves named-place choices and renders the selection after reopening',async()=>{
  const source=await readFile(new URL('../chat.js',import.meta.url),'utf8');
  const store=new Map();
  const createElement=tag=>({tag,children:[],handlers:{},classList:{add(){}},setAttribute(){},append(...nodes){this.children.push(...nodes);},appendChild(node){this.children.push(node);},replaceChildren(){this.children=[];},addEventListener(event,handler){this.handlers[event]=handler;}});
  const context={console,Date,AbortController,setTimeout,clearTimeout,
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
    document:{getElementById:()=>null,createElement},window:{},clicked:[]};
  vm.createContext(context);vm.runInContext(source,context);
  vm.runInContext('handleChat = value => clicked.push(value)',context);
  const pending={status:'awaiting_confirmation',area:'Hồ Xuân Hương Đà Lạt',query:'quán ăn ngon',radius:3000,
    candidates:[{id:'lake',name:'Hồ Xuân Hương',address:'Đà Lạt',lat:11.942,lng:108.442}]};
  context.saveMessage('ai','Đúng hồ này không?',{travelContext:{namedArea:pending}});
  const saved=JSON.parse(store.get('travelos_chat_sessions')).sessions[0].messages[0].travelContext;
  assert.equal(saved.namedArea.candidates[0].id,'lake');
  const message=createElement('div');
  assert.equal(context.renderPlaceChoices(message,saved.namedArea,'place'),true);
  message.children[1].children[0].handlers.click();
  assert.deepEqual(context.clicked,['Đúng số 1']);
});
