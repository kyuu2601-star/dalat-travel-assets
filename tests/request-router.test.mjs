import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
import { compareShadowRoute, ROUTER_DECISIONS, shadowRouteTravelRequest } from '../worker/src/bot/request-router.js';

const gps={country:'Việt Nam',city:'TP.HCM',latitude:10.7769,longitude:106.7009};

test('shadow router sends current-origin directions to API tools and requires fresh GPS',()=>{
  const route=shadowRouteTravelRequest({userMessage:'Chỉ đường từ vị trí hiện tại đến Dinh Độc Lập',location:gps});
  assert.equal(route.decision,ROUTER_DECISIONS.API_TOOLS);
  assert.equal(route.intentHint,'ROUTE_MOBILITY');
  assert.equal(route.requiresFreshGps,true);
  assert.equal(route.applied,false);
});

test('shadow router does not require current GPS for an explicit two-point route',()=>{
  const route=shadowRouteTravelRequest({userMessage:'Chỉ đường từ Chợ Bến Thành tới Dinh Độc Lập'});
  assert.equal(route.decision,ROUTER_DECISIONS.API_TOOLS);
  assert.equal(route.requiresFreshGps,false);
});

test('shadow router distinguishes nearby and remote place discovery',()=>{
  const nearby=shadowRouteTravelRequest({userMessage:'Tìm cửa hàng tiện lợi quanh đây',location:gps});
  const remote=shadowRouteTravelRequest({userMessage:'Tìm quán cà phê ở Đà Lạt',location:gps});
  assert.equal(nearby.intentHint,'PLACE_DISCOVERY');
  assert.equal(nearby.requiresFreshGps,true);
  assert.equal(remote.intentHint,'PLACE_DISCOVERY');
  assert.equal(remote.requiresFreshGps,false);
});

test('shadow router sends itinerary requests to the planner lane',()=>{
  const route=shadowRouteTravelRequest({userMessage:'Lập lịch trình đi Đà Lạt 3 ngày, chia sáng trưa chiều tối'});
  assert.equal(route.decision,ROUTER_DECISIONS.PLANNER_MODEL);
  assert.equal(route.intentHint,'ITINERARY_PLANNING');
});

test('shadow router keeps casual culture chat in the guided lane',()=>{
  const route=shadowRouteTravelRequest({userMessage:'Ở Trùng Khánh nên cư xử thế nào trong quán ăn?'});
  assert.equal(route.decision,ROUTER_DECISIONS.GUIDED_CHAT);
  assert.equal(route.intentHint,'LOCAL_GUIDE');
});

test('shadow router routes weather and safety searches to live APIs',()=>{
  const weather=shadowRouteTravelRequest({userMessage:'Thời tiết ở Đà Lạt hôm nay thế nào?',location:gps});
  const safety=shadowRouteTravelRequest({userMessage:'Tôi bị đau bụng, tìm nơi trợ giúp quanh đây',location:gps});
  const pharmacy=shadowRouteTravelRequest({userMessage:'Tìm nhà thuốc quanh đây',location:gps});
  assert.equal(weather.decision,ROUTER_DECISIONS.API_TOOLS);
  assert.equal(weather.requiresFreshGps,false);
  assert.equal(safety.intentHint,'SAFETY_HEALTH');
  assert.equal(safety.requiresFreshGps,true);
  assert.equal(pharmacy.intentHint,'PLACE_DISCOVERY');
  assert.equal(pharmacy.requiresFreshGps,true);
});

test('shadow router output never contains user text or coordinates',()=>{
  const route=shadowRouteTravelRequest({userMessage:'Tìm nhà hàng bí mật ở đây',location:{latitude:1.234567,longitude:9.876543}});
  const serialized=JSON.stringify(route);
  assert.doesNotMatch(serialized,/bí mật|bi mat|1\.234567|9\.876543/);
});

test('router comparison observes the existing plan without applying itself',()=>{
  const route=shadowRouteTravelRequest({userMessage:'Tìm quán ăn quanh đây',location:gps});
  const observed=compareShadowRoute(route,{travelIntent:'PLACE_DISCOVERY',tools:[{name:'search_places'}]});
  assert.equal(observed.actualDecision,ROUTER_DECISIONS.API_TOOLS);
  assert.equal(observed.matched,true);
  assert.equal(observed.applied,false);
});

test('AI v3 exposes shadow comparison but preserves the existing guided response flow',async()=>{
  const response=await worker.fetch(new Request('https://ai.test/ai-v3',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({userMessage:'Ở Trùng Khánh nên cư xử thế nào khi vào quán ăn địa phương?',userLocation:gps})
  }),{ALLOWED_ORIGINS:'https://kyuu2601-star.github.io'});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.travelos.plan.planner,'scope-redirect');
  assert.equal(data.travelos.plan.shadowRouter.applied,false);
  assert.equal(data.travelos.plan.shadowRouter.actualDecision,ROUTER_DECISIONS.GUIDED_CHAT);
  assert.equal(data.travelos.plan.shadowRouter.matched,true);
  assert.match(data.text,/chỉ đường|địa điểm|gần nhất/i);
});
