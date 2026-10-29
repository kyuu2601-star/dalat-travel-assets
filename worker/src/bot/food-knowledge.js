// Curated search knowledge. D1 rows override this starter set after migration.
// Category and brand links indicate search candidates, never proof of a current menu.
export const categories = [
  {id:'seafood',vi:'Quán hải sản',en:['seafood restaurant'],zh:['海鲜餐厅','海鲜'],aliases:['hải sản','seafood','海鲜']},
  {id:'seafood_buffet',vi:'Buffet hải sản',en:['seafood buffet'],zh:['海鲜自助餐'],aliases:['buffet hải sản','seafood buffet','海鲜自助餐']},
  {id:'snail',vi:'Quán ốc',en:['snail restaurant'],zh:['海螺店'],aliases:['quán ốc','ốc','sea snail','海螺']},
  {id:'fast_food',vi:'Đồ ăn nhanh',en:['fast food restaurant'],zh:['快餐店'],aliases:['đồ ăn nhanh','fast food','快餐']},
  {id:'hotpot',vi:'Quán lẩu',en:['hotpot restaurant'],zh:['火锅店','火锅'],aliases:['lẩu','hotpot','火锅']},
  {id:'barbecue',vi:'Quán nướng',en:['barbecue restaurant'],zh:['烧烤店','烤肉'],aliases:['đồ nướng','bbq','barbecue','烧烤']},
  {id:'noodles',vi:'Quán mì, bún, phở',en:['noodle restaurant'],zh:['面馆','米粉店'],aliases:['phở','bún','mì','noodles','面馆']},
  {id:'vietnamese',vi:'Quán món Việt',en:['Vietnamese restaurant'],zh:['越南餐厅'],aliases:['món Việt','quán Việt','Vietnamese restaurant','越南餐厅']},
  {id:'japanese',vi:'Quán Nhật',en:['Japanese restaurant'],zh:['日本料理'],aliases:['món Nhật','Japanese restaurant','日本料理']},
  {id:'dessert',vi:'Quán tráng miệng',en:['dessert shop'],zh:['甜品店'],aliases:['tráng miệng','dessert','甜品']},
  {id:'cafe',vi:'Quán cà phê',en:['coffee shop'],zh:['咖啡店'],aliases:['cà phê','cafe','coffee','咖啡']},
  {id:'convenience_store',vi:'Cửa hàng tiện lợi',en:['convenience store'],zh:['便利店'],aliases:['cửa hàng tiện lợi','minimart','convenience store','便利店']}
];

export const dishes = [
  {id:'ghe',vi:'ghẹ',aliases:['ghẹ'],en:'crab',zh:'梭子蟹',category:'seafood'},
  {id:'cua',vi:'cua',aliases:['cua','cua biển'],en:'crab',zh:'螃蟹',category:'seafood'},
  {id:'oc',vi:'ốc',aliases:['ốc','ốc biển'],en:'sea snails',zh:'海螺',category:'snail'},
  {id:'tom',vi:'tôm',aliases:['tôm'],en:'shrimp',zh:'虾',category:'seafood'},
  {id:'muc',vi:'mực',aliases:['mực'],en:'squid',zh:'鱿鱼',category:'seafood'},
  {id:'hau',vi:'hàu',aliases:['hàu'],en:'oyster',zh:'生蚝',category:'seafood'},
  {id:'banh_xeo',vi:'bánh xèo',aliases:['bánh xèo'],en:'banh xeo',zh:'越南煎饼',category:'vietnamese'},
  {id:'ga_ran',vi:'gà rán',aliases:['gà rán','fried chicken'],en:'fried chicken',zh:'炸鸡',category:'fast_food'},
  {id:'khoai_tay_chien',vi:'khoai tây chiên',aliases:['khoai tây chiên','french fries'],en:'french fries',zh:'薯条',category:'fast_food'},
  {id:'lau',vi:'lẩu',aliases:['lẩu','hotpot'],en:'hotpot',zh:'火锅',category:'hotpot'},
  {id:'do_nuong',vi:'đồ nướng',aliases:['đồ nướng','bbq','barbecue'],en:'barbecue',zh:'烧烤',category:'barbecue'},
  {id:'pho',vi:'phở',aliases:['phở'],en:'pho',zh:'越南河粉',category:'noodles'},
  {id:'bun_bo',vi:'bún bò',aliases:['bún bò','bún bò Huế'],en:'bun bo Hue',zh:'顺化牛肉米粉',category:'noodles'},
  {id:'ramen',vi:'ramen',aliases:['ramen'],en:'ramen',zh:'拉面',category:'japanese'},
  {id:'sushi',vi:'sushi',aliases:['sushi'],en:'sushi',zh:'寿司',category:'japanese'},
  {id:'pizza',vi:'pizza',aliases:['pizza'],en:'pizza',zh:'披萨',category:'fast_food'},
  {id:'tra_sua',vi:'trà sữa',aliases:['trà sữa','milk tea'],en:'milk tea',zh:'奶茶',category:'dessert'},
  {id:'ca_phe',vi:'cà phê',aliases:['cà phê','cafe','coffee'],en:'coffee',zh:'咖啡',category:'cafe'}
];

export const affinities = [
  ['ghe','seafood',0.7],['ghe','seafood_buffet',0.6],['ghe','snail',0.1],
  ['cua','seafood',0.7],['cua','seafood_buffet',0.6],['cua','snail',0.15],
  ['oc','snail',0.85],['oc','seafood',0.55],['oc','seafood_buffet',0.35],
  ['tom','seafood',0.7],['tom','seafood_buffet',0.6],['tom','snail',0.3],
  ['muc','seafood',0.7],['muc','seafood_buffet',0.6],['muc','snail',0.3],
  ['hau','seafood',0.7],['hau','seafood_buffet',0.6],['hau','snail',0.3],
  ['banh_xeo','vietnamese',0.6],['ga_ran','fast_food',0.75],
  ['khoai_tay_chien','fast_food',0.65],['lau','hotpot',0.85],
  ['do_nuong','barbecue',0.85],['pho','noodles',0.75],['bun_bo','noodles',0.75],
  ['ramen','japanese',0.7],['ramen','noodles',0.7],['sushi','japanese',0.75],
  ['pizza','fast_food',0.65],['tra_sua','dessert',0.65],['ca_phe','cafe',0.8]
];

export const brands = [
  {id:'poseidon',name:'Poseidon',category:'seafood_buffet',aliases:['Poseidon Buffet','Poseidon'],countries:['VN']},
  {id:'cuu_van_long',name:'Cửu Vân Long',category:'seafood_buffet',aliases:['Cửu Vân Long','九云龙'],countries:['VN']},
  {id:'d_maris',name:'D Maris',category:'seafood_buffet',aliases:['D Maris','D Maris Buffet'],countries:['VN']},
  {id:'kfc',name:'KFC',category:'fast_food',aliases:['KFC','Kentucky Fried Chicken','肯德基'],countries:[]},
  {id:'jollibee',name:'Jollibee',category:'fast_food',aliases:['Jollibee'],countries:['VN']},
  {id:'lotteria',name:'Lotteria',category:'fast_food',aliases:['Lotteria'],countries:['VN']},
  {id:'popeyes',name:'Popeyes',category:'fast_food',aliases:['Popeyes'],countries:['VN']},
  {id:'chicken_plus',name:'Chicken Plus',category:'fast_food',aliases:['Chicken Plus'],countries:['VN']},
  {id:'texas_chicken',name:'Texas Chicken',category:'fast_food',aliases:['Texas Chicken'],countries:['VN']},
  {id:'haidilao',name:'Haidilao',category:'hotpot',aliases:['Haidilao','海底捞'],countries:[]},
  {id:'king_bbq',name:'King BBQ',category:'barbecue',aliases:['King BBQ'],countries:['VN']},
  {id:'gs25',name:'GS25',category:'convenience_store',aliases:['GS25','GS 25'],countries:['VN']},
  {id:'circle_k',name:'Circle K',category:'convenience_store',aliases:['Circle K'],countries:[]},
  {id:'seven_eleven',name:'7-Eleven',category:'convenience_store',aliases:['7-Eleven','Seven Eleven','7 Eleven','7-11','7 11','柒拾壹'],countries:[]},
  {id:'familymart',name:'FamilyMart',category:'convenience_store',aliases:['FamilyMart','Family Mart','全家'],countries:[]},
  {id:'ministop',name:'MINISTOP',category:'convenience_store',aliases:['MINISTOP','Mini Stop'],countries:['VN']},
  {id:'lawson',name:'Lawson',category:'convenience_store',aliases:['Lawson','罗森'],countries:['CN']},
  {id:'winmart_plus',name:'WinMart+',category:'convenience_store',aliases:['WinMart+','VinMart+'],countries:['VN']},
  {id:'coop_smile',name:'Co.op Smile',category:'convenience_store',aliases:['Co.op Smile','Coop Smile'],countries:['VN']},
  {id:'meiyijia',name:'Meiyijia',category:'convenience_store',aliases:['美宜佳','Meiyijia'],countries:['CN']},
  {id:'bianlifeng',name:'Bianlifeng',category:'convenience_store',aliases:['便利蜂','Bianlifeng'],countries:['CN']}
];

const safeArray=value=>Array.isArray(value)?value:[];
const parseArray=value=>{try{return safeArray(JSON.parse(value));}catch{return [];}};
export const starterKnowledge={categories,dishes,affinities,brands};

export async function loadFoodKnowledge(env) {
  if(!env?.DB?.prepare)return starterKnowledge;
  try{
    const [c,d,a,b]=await Promise.all([
      env.DB.prepare('SELECT id, label_vi, query_en, query_zh, aliases FROM food_categories').all(),
      env.DB.prepare('SELECT id, category_id, label_vi, aliases, query_en, query_zh FROM food_dishes').all(),
      env.DB.prepare('SELECT dish_id, category_id, confidence FROM food_affinities').all(),
      env.DB.prepare('SELECT id, name, category_id, aliases, countries FROM venue_brands').all()
    ]);
    if(!c.results?.length||!d.results?.length)return starterKnowledge;
    return {
      categories:c.results.map(x=>({id:x.id,vi:x.label_vi,en:parseArray(x.query_en),zh:parseArray(x.query_zh),aliases:parseArray(x.aliases)})),
      dishes:d.results.map(x=>({id:x.id,category:x.category_id,vi:x.label_vi,aliases:parseArray(x.aliases),en:x.query_en,zh:x.query_zh})),
      affinities:a.results.map(x=>[x.dish_id,x.category_id,Number(x.confidence)]),
      brands:b.results.map(x=>({id:x.id,name:x.name,category:x.category_id,aliases:parseArray(x.aliases),countries:parseArray(x.countries)}))
    };
  }catch{return starterKnowledge;}
}
