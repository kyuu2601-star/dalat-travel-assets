// Food search is planned by the backend. Review text is evidence, never an instruction.
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const GROUPS=[
  {id:'seafood',aliases:['ghe','cua','tom','muc','oc','so','hau','hai san','crab','seafood'],en:['seafood restaurant'],zh:['海鲜餐厅','海鲜']},
  {id:'fast_food',aliases:['ga ran','khoai tay chien','burger','pizza','fried chicken','french fries'],en:['fast food restaurant'],zh:['快餐店']},
  {id:'hotpot',aliases:['lau','hotpot'],en:['hotpot restaurant'],zh:['火锅店','火锅']},
  {id:'barbecue',aliases:['nuong','bbq','barbecue'],en:['barbecue restaurant'],zh:['烧烤店','烤肉']},
  {id:'noodles',aliases:['pho','bun','ramen','mi','hu tieu'],en:['noodle restaurant'],zh:['面馆','拉面']},
  {id:'dessert',aliases:['banh ngot','kem','che','dessert'],en:['dessert shop'],zh:['甜品店']}
];
const DISH_TERMS={ghe:{label:'ghẹ',en:'crab',zh:'螃蟹',review:['ghẹ','crab']},cua:{label:'cua',en:'crab',zh:'螃蟹',review:['cua','crab']},'ga ran':{label:'gà rán',en:'fried chicken',zh:'炸鸡',review:['gà rán','fried chicken']},'khoai tay chien':{label:'khoai tây chiên',en:'french fries',zh:'薯条',review:['khoai tây chiên','french fries','fries']},tom:{label:'tôm',en:'shrimp',zh:'虾',review:['tôm','shrimp','prawn']},muc:{label:'mực',en:'squid',zh:'鱿鱼',review:['mực','squid']},oc:{label:'ốc',en:'snails',zh:'螺',review:['ốc','snail']},hau:{label:'hàu',en:'oyster',zh:'生蚝',review:['hàu','oyster']},'hai san':{label:'hải sản',en:'seafood',zh:'海鲜',review:['hải sản','seafood']}};
const QUALITY=/\b(?:ngon|danh gia cao|rating cao|review tot|duoc khen|chat luong|tot nhat|top|noi tieng|nen an|dang thu)\b/;
const FOOD_CONTEXT=/\b(?:quan|nha hang|tiem|cho ban|mon|an|am thuc|food|restaurant)\b/;

export function foodDiscoveryRequest(question) {
  const text=fold(question),group=GROUPS.find(item=>item.aliases.some(alias=>` ${text} `.includes(` ${alias} `)));
  if(!FOOD_CONTEXT.test(text))return null;
  if(group){
    const dish=group.aliases.filter(alias=>` ${text} `.includes(` ${alias} `)).sort((a,b)=>b.length-a.length)[0]||'';
    return {group:group.id,dish:DISH_TERMS[dish]?.label||dish,quality:QUALITY.test(text),en:group.en,zh:group.zh};
  }
  if(!QUALITY.test(text)||!/(?:\bmon\b|\bban\b|\ban\b|\bquan\b)/.test(text))return null;
  const source=String(question??''),end='(?=\\s+(?:ngon|rating|review|đánh giá|quanh|gần|ở|tại)\\b|[?.!,]|$)';
  const preferred=source.match(new RegExp(`(?:món|bán)\\s+(.+?)${end}`,'i'));
  const fallback=source.match(new RegExp(`(?:quán|nhà hàng)\\s+(.+?)${end}`,'i'));
  const raw=(preferred?.[1]||fallback?.[1])?.replace(/^(?:có|nào\s+có)\s+/i,'').trim();
  if(!raw||raw.split(/\s+/).length>5)return null;
  return {group:'restaurant',dish:raw,quality:true,en:['restaurant'],zh:['餐厅']};
}

export function foodSearchVariants(request,china) {
  if(!request)return null;
  const terms=china?request.zh:request.en,extra=DISH_TERMS[fold(request.dish)]?.[china?'zh':'en'];
  return {providerQuery:terms[0],queryVariants:[...new Set([extra,...terms.slice(1)].filter(Boolean))],requestedDish:request.dish};
}

function meaningfulReview(review) {
  const text=fold(review?.text),words=text.split(' ').filter(Boolean);
  if(Number(review?.rating)!==5||text.length<25||words.length<5)return false;
  const generic=/^(?:good|very good|great|nice|ok|excellent|ngon|rat ngon|tot|rat tot|tuyet voi|five stars|5 sao)(?:\s+\w+){0,2}$/;
  const filler=new Set('good great nice very excellent amazing awesome perfect best place restaurant food ngon rat tot dep qua o va la cho quan nha hang mon an the this was is are and with service'.split(' '));
  return !generic.test(text)&&new Set(words).size>=4&&new Set(words.filter(word=>!filler.has(word)&&word.length>=3)).size>=2;
}

export function reviewQuality(place,dish,now=Date.now()) {
  const cutoff=now-30*86400000,needles=(DISH_TERMS[fold(dish)]?.review||[dish]).map(fold),reviews=(Array.isArray(place?.reviews)?place.reviews:[]).slice(0,5);
  let fiveWithText=0,recentFiveWithText=0,dishFiveWithText=0,recentDishFiveWithText=0;
  for(const review of reviews){
    if(!meaningfulReview(review))continue;
    fiveWithText++;
    const published=Date.parse(review?.publishTime||''),recent=Number.isFinite(published)&&published>=cutoff&&published<=now;
    const reviewText=fold(review.text),dishMention=needles.some(needle=>needle&&reviewText.includes(needle));
    if(recent)recentFiveWithText++;
    if(dishMention)dishFiveWithText++;
    if(recent&&dishMention)recentDishFiveWithText++;
  }
  return {sampleSize:reviews.length,fiveWithText,recentFiveWithText,dishFiveWithText,recentDishFiveWithText};
}

export function rankFoodByReviews(places,dish,limit=10,now=Date.now()) {
  return (Array.isArray(places)?places:[]).map(place=>({...place,reviewQuality:reviewQuality(place,dish,now)}))
    .sort((a,b)=>{
      const x=a.reviewQuality,y=b.reviewQuality;
      return y.recentDishFiveWithText-x.recentDishFiveWithText
        ||y.dishFiveWithText-x.dishFiveWithText
        ||y.recentFiveWithText-x.recentFiveWithText
        ||y.fiveWithText-x.fiveWithText
        ||(Number(b.rating)||0)-(Number(a.rating)||0)
        ||(Number(a.distance)||Infinity)-(Number(b.distance)||Infinity);
    }).slice(0,limit);
}
