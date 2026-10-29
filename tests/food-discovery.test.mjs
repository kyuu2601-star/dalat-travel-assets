import test from 'node:test';
import assert from 'node:assert/strict';
import { foodDiscoveryRequest, foodSearchVariants, rankFoodByReviews } from '../worker/src/bot/food-discovery.js';
import { loadFoodKnowledge, starterKnowledge } from '../worker/src/bot/food-knowledge.js';

test('food search groups dishes but keeps ordinary searches distance based', () => {
  const crab=foodDiscoveryRequest('Tìm quán có ghẹ ngon quanh đây');
  assert.deepEqual({group:crab.group,dish:crab.dish,quality:crab.quality},{group:'seafood',dish:'ghẹ',quality:true});
  assert.ok(foodSearchVariants(crab,false).queryVariants.includes('crab'));
  assert.ok(foodSearchVariants(crab,false).queryVariants.includes('Poseidon'));
  assert.equal(foodSearchVariants(crab,true).providerQuery,'海鲜餐厅');
  assert.equal(foodDiscoveryRequest('Tìm quán gà rán quanh đây').quality,false);
  assert.ok(foodSearchVariants(foodDiscoveryRequest('Tìm quán khoai tây chiên ngon'),false).queryVariants.includes('french fries'));
  assert.deepEqual({group:foodDiscoveryRequest('Tìm quán có bán bánh xèo ngon')?.group,dish:foodDiscoveryRequest('Tìm quán có bán bánh xèo ngon')?.dish},{group:'vietnamese',dish:'bánh xèo'});
});

test('recent detailed five-star review outranks an old aggregate rating', () => {
  const now=Date.parse('2026-10-29T12:00:00Z');
  const old={id:'old',name:'Quán gà rán cũ',primaryType:'fast_food_restaurant',rating:4.9,distance:80,reviews:[{rating:5,text:'Gà rán nóng giòn, phần thịt mềm và nước chấm rất ngon.',publishTime:'2025-10-01T12:00:00Z'}]};
  const recent={id:'recent',name:'Quán gà rán mới',primaryType:'fast_food_restaurant',rating:4.3,distance:250,reviews:[{rating:5,text:'Fried chicken is crispy outside, juicy inside and freshly cooked.',publishTime:'2026-10-27T12:00:00Z'}]};
  const ranked=rankFoodByReviews([old,recent],'gà rán',10,now,'fast_food');
  assert.equal(ranked[0].id,'recent');
  assert.equal(ranked[0].reviewQuality.recentDishFiveWithText,1);
  assert.equal(ranked[1].reviewQuality.recentFiveWithText,0);
});

test('empty and vague five-star reviews do not count as meaningful evidence', () => {
  const ranked=rankFoodByReviews([{id:'vague',name:'Hải Sản A',primaryType:'seafood_restaurant',reviews:[{rating:5,text:''},{rating:5,text:'Great!'}]},{id:'specific',name:'Hải Sản B',primaryType:'seafood_restaurant',reviews:[{rating:5,text:'Ghẹ hấp tươi, thịt chắc và nước chấm đậm vị.',publishTime:new Date().toISOString()}]}],'ghẹ',10,Date.now(),'seafood');
  assert.equal(ranked[0].id,'specific');
  assert.equal(ranked[1].reviewQuality.fiveWithText,0);
});

test('irrelevant cafes and wholesale crab shops are excluded when finding seafood restaurants', () => {
  const places=[
    {id:'cafe',name:'Ryo Kafé',primaryType:'cafe',rating:5,userRatingCount:1},
    {id:'wholesale',name:'Cua Chú Mười Một',primaryType:'wholesaler',rating:5,userRatingCount:18},
    {id:'mislabeled',name:'Quán Phở Hà Nội',primaryType:'restaurant',types:['seafood_restaurant'],rating:4.9,userRatingCount:300},
    {id:'seafood',name:'Hải Sản Miền Trung',primaryType:'restaurant',rating:4.5,userRatingCount:180}
  ];
  assert.deepEqual(rankFoodByReviews(places,'ghẹ',10,Date.now(),'seafood').map(place=>place.id),['seafood']);
});

test('a seafood buffet is a crab candidate but a snail shop is not proof of crab', () => {
  const places=[
    {id:'snail',name:'Ốc Vui',primaryType:'restaurant',rating:5,userRatingCount:100},
    {id:'buffet',name:'Poseidon Buffet',primaryType:'restaurant',rating:4.3,userRatingCount:200},
    {id:'seafood',name:'Hải Sản Bờ Biển',primaryType:'restaurant',rating:4.1,userRatingCount:80}
  ];
  assert.deepEqual(rankFoodByReviews(places,'ghẹ',10,Date.now(),'seafood').map(p=>p.id),['buffet','seafood']);
});

test('a named bánh xèo shop outranks unrelated restaurant ratings', () => {
  const places=[
    {id:'thai',name:'Thai Market Restaurant',primaryType:'restaurant',rating:4.9,userRatingCount:2000},
    {id:'banh',name:'Bánh xèo miền Trung Phú Ông',primaryType:'restaurant',rating:4.4,userRatingCount:90}
  ];
  assert.deepEqual(rankFoodByReviews(places,'bánh xèo',10,Date.now(),'vietnamese').map(p=>p.id),['banh']);
});

test('D1 knowledge rows can add a dish without changing the parser code', async () => {
  const rows={
    food_categories:[{id:'dessert',label_vi:'Tráng miệng',aliases:'["tráng miệng"]',query_en:'["dessert shop"]',query_zh:'["甜品店"]'}],
    food_dishes:[{id:'pudding',category_id:'dessert',label_vi:'pudding',aliases:'["pudding"]',query_en:'pudding',query_zh:'布丁'}],
    food_affinities:[{dish_id:'pudding',category_id:'dessert',confidence:0.8}],
    venue_brands:[]
  };
  const env={DB:{prepare(sql){const table=sql.match(/FROM (\w+)/)?.[1];return {all:async()=>({results:rows[table]})};}}};
  const knowledge=await loadFoodKnowledge(env);
  assert.notEqual(knowledge,starterKnowledge);
  assert.equal(foodDiscoveryRequest('Tìm quán pudding ngon',knowledge).dish,'pudding');
});
