const INTENTS=['PLACE_DISCOVERY','WEATHER_OUTDOOR','ROUTE_MOBILITY','ITINERARY_PLANNING','VENUE_INTELLIGENCE','SAFETY_HEALTH','TRAVEL_UTILITY','LOCAL_GUIDE'];
const NEEDS=['PLACE_SEARCH','PLACE_DETAILS','WEATHER','BUSYNESS','WALKING_ROUTE','DRIVING_ROUTE','ITINERARY','SAFETY_GUIDANCE','TRAVEL_UTILITY','LOCAL_KNOWLEDGE','TRANSIT_SCHEDULE','TICKET_PRICE','FACT_CHECK','CURRENCY_RATE','PAYMENT_CONNECTIVITY'];

export const SEMANTIC_PLANNER_PROMPT = `Bạn là semantic planner của TravelOS.
Nhiệm vụ duy nhất: bóc tách câu hỏi user thành nhu cầu có cấu trúc để backend quyết định API.

QUY TẮC:
- Không trả lời user, không tư vấn và không gọi API.
- Chỉ tạo nhu cầu được user nói trực tiếp hoặc cần thiết tất yếu để trả lời câu hỏi.
- Mỗi need phải có sourceText là một đoạn nguyên văn ngắn xuất hiện trong câu user.
- Không tự thêm ăn uống, thời tiết, chỉ đường, rating, vé hoặc địa điểm nếu user không yêu cầu.
- Tối đa 4 needs, xếp theo thứ tự phụ thuộc dữ liệu.
- target dùng "current_location", "selected_place", tên riêng user nói, hoặc chuỗi rỗng.
- area là khu vực/thành phố user chỉ định; để trống nếu dùng vị trí app.
- query giữ nguyên tên riêng/món/loại địa điểm quan trọng, không dịch và không mở rộng keyword.
- travelMode dùng NONE khi nhu cầu không liên quan tới di chuyển.
- Nếu thiếu thông tin làm thay đổi địa điểm hoặc API cần gọi, đặt clarificationQuestion đúng một câu.
- confidence phản ánh độ chắc chắn về chính need đó; overallConfidence phản ánh toàn plan.
- answerContract chỉ liệt kê các ý user thực sự cần được trả lời.`;

export const SEMANTIC_PLAN_SCHEMA={
  type:'OBJECT',
  properties:{
    primaryIntent:{type:'STRING',enum:INTENTS},
    needs:{type:'ARRAY',maxItems:4,items:{type:'OBJECT',properties:{
      kind:{type:'STRING',enum:NEEDS},query:{type:'STRING'},target:{type:'STRING'},area:{type:'STRING'},time:{type:'STRING'},
      travelMode:{type:'STRING',enum:['NONE','WALK','DRIVE','MOTORBIKE','TRANSIT']},sourceText:{type:'STRING'},required:{type:'BOOLEAN'},confidence:{type:'NUMBER'}
    },required:['kind','query','target','area','time','travelMode','sourceText','required','confidence']}},
    answerContract:{type:'ARRAY',maxItems:6,items:{type:'STRING'}},
    clarificationQuestion:{type:'STRING'},overallConfidence:{type:'NUMBER'},shouldUseLiveData:{type:'BOOLEAN'}
  },
  required:['primaryIntent','needs','answerContract','clarificationQuestion','overallConfidence','shouldUseLiveData']
};

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const fold=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,' ').trim();
const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));

export function normalizeSemanticPlan(raw,userMessage) {
  const messageKey=fold(userMessage),seen=new Set(),needs=[];
  for(const item of Array.isArray(raw?.needs)?raw.needs:[]){
    const kind=clean(item?.kind,60),sourceText=clean(item?.sourceText,240),sourceKey=fold(sourceText);
    if(!NEEDS.includes(kind)||!sourceKey||!messageKey.includes(sourceKey))continue;
    const normalized={
      kind,query:clean(item?.query,300),target:clean(item?.target,300),area:clean(item?.area,300),time:clean(item?.time,120),
      travelMode:['WALK','DRIVE','MOTORBIKE','TRANSIT'].includes(item?.travelMode)?item.travelMode:'',sourceText,
      required:item?.required!==false,confidence:clamp01(item?.confidence)
    };
    const key=[normalized.kind,fold(normalized.query),fold(normalized.target),fold(normalized.area)].join('|');
    if(seen.has(key))continue;seen.add(key);needs.push(normalized);
    if(needs.length>=4)break;
  }
  const primaryIntent=INTENTS.includes(raw?.primaryIntent)?raw.primaryIntent:'LOCAL_GUIDE';
  return {
    primaryIntent,needs,answerContract:(Array.isArray(raw?.answerContract)?raw.answerContract:[]).map(value=>clean(value,220)).filter(Boolean).slice(0,6),
    clarificationQuestion:clean(raw?.clarificationQuestion,400),overallConfidence:clamp01(raw?.overallConfidence),shouldUseLiveData:raw?.shouldUseLiveData===true
  };
}

export function semanticPlannerPayload(userMessage,location,previousContext,history=[]) {
  const recent=(Array.isArray(history)?history:[]).slice(-4).map(item=>({role:item?.role==='model'?'model':'user',text:clean(item?.parts?.[0]?.text||item?.text,500)}));
  return {
    userMessage:clean(userMessage,2000),location:{country:clean(location?.country,120),city:clean(location?.city,160),area:clean(location?.area,160),hasCurrentCoordinates:Number.isFinite(Number(location?.latitude))&&Number.isFinite(Number(location?.longitude))},
    previousContext:previousContext?{selectedPlace:clean(previousContext?.placeDetails?.localizedName||previousContext?.placeDetails?.name,240),nearbyNames:(previousContext?.nearby?.pois||[]).slice(0,5).map(item=>clean(item?.localizedName||item?.name,180)).filter(Boolean)}:null,
    recentConversation:recent
  };
}

