import test from 'node:test';
import assert from 'node:assert/strict';
import {INTENT_PROMPTS,answerPromptFor} from '../worker/src/bot/prompts/index.js';
import {PROMPT_GATE_PROFILES,PromptGateError,assertPromptGateAnswer,guardedAnswerPrompt,inspectPromptGateInput,validatePromptGateAnswer} from '../worker/src/bot/prompt-gate.js';

const evidence=(tool,data={})=>[{id:'tool-1',tool,ok:true,source:'test-provider',data}];
const plan=(intent,tools=[])=>({travelIntent:intent,tools:tools.map(name=>({name}))});

test('prompt gate covers the same eight intents without modifying prompt files',()=>{
  assert.deepEqual(Object.keys(PROMPT_GATE_PROFILES),Object.keys(INTENT_PROMPTS));
  for(const intent of Object.keys(INTENT_PROMPTS)){
    const base=answerPromptFor(intent),p=plan(intent),wrapped=guardedAnswerPrompt({intent,basePrompt:base,plan:p,evidence:[]});
    assert.equal(wrapped.gate.ok,true);
    assert.ok(wrapped.systemPrompt.includes(base));
    assert.ok(wrapped.systemPrompt.includes(`Intent đã khóa: ${intent}`));
  }
});

test('each intent accepts only its system-level tool envelope',()=>{
  const cases=[
    ['PLACE_DISCOVERY',['resolve_place','search_places']],['WEATHER_OUTDOOR',['resolve_place','weather']],
    ['ROUTE_MOBILITY',['resolve_place','walking_route']],['ITINERARY_PLANNING',['curated_places']],
    ['VENUE_INTELLIGENCE',['resolve_place','place_details','place_busyness']],['SAFETY_HEALTH',['search_places']],
    ['TRAVEL_UTILITY',['search_places']],['LOCAL_GUIDE',[]]
  ];
  for(const [intent,tools] of cases){
    const ev=tools.map((tool,index)=>({id:`tool-${index+1}`,tool,ok:true,source:'test',data:{value:true}}));
    assert.equal(inspectPromptGateInput({intent,plan:plan(intent,tools),evidence:ev}).ok,true,intent);
  }
});

test('gate rejects intent drift, out-of-scope tools and unplanned evidence',()=>{
  assert.deepEqual(inspectPromptGateInput({intent:'WEATHER_OUTDOOR',plan:plan('PLACE_DISCOVERY',['search_places']),evidence:[]}).reasons,['INTENT_NOT_LOCKED','TOOL_OUTSIDE_INTENT']);
  assert.ok(inspectPromptGateInput({intent:'ROUTE_MOBILITY',plan:plan('ROUTE_MOBILITY',['weather']),evidence:[]}).reasons.includes('TOOL_OUTSIDE_INTENT'));
  assert.ok(inspectPromptGateInput({intent:'PLACE_DISCOVERY',plan:plan('PLACE_DISCOVERY',[]),evidence:evidence('search_places')}).reasons.includes('UNPLANNED_EVIDENCE'));
});

test('gate rejects internal-process leaks and ungrounded URLs',()=>{
  const p=plan('PLACE_DISCOVERY',['search_places']),ev=evidence('search_places',{pois:[{name:'Quán A'}]});
  const leaked=validatePromptGateAnswer({intent:'PLACE_DISCOVERY',answer:'Theo EVIDENCE JSON và planner, Quán A phù hợp.',plan:p,evidence:ev});
  assert.equal(leaked.ok,false);assert.ok(leaked.reasons.includes('INTERNAL_PROCESS_MENTION'));
  const url=validatePromptGateAnswer({intent:'PLACE_DISCOVERY',answer:'Pipi đề xuất Quán A: https://fake.example',plan:p,evidence:ev});
  assert.equal(url.ok,false);assert.ok(url.reasons.includes('UNGROUNDED_URL'));
});

test('entity-based prompts must mention a verified place when evidence contains one',()=>{
  const p=plan('ITINERARY_PLANNING',['curated_places']),ev=evidence('curated_places',{places:[{name:'Hồ Xuân Hương'}]});
  assert.equal(validatePromptGateAnswer({intent:'ITINERARY_PLANNING',answer:'Pipi sẽ xếp một lịch trình thật đẹp.',plan:p,evidence:ev}).ok,false);
  assert.equal(validatePromptGateAnswer({intent:'ITINERARY_PLANNING',answer:'Buổi sáng, Pipi gợi ý bạn ghé Hồ Xuân Hương.',plan:p,evidence:ev}).ok,true);
});

test('safety gate rejects diagnosis and dosage instructions',()=>{
  const p=plan('SAFETY_HEALTH',['search_places']),ev=evidence('search_places',{pois:[{name:'Phòng khám A'}]});
  const diagnosis=validatePromptGateAnswer({intent:'SAFETY_HEALTH',answer:'Chẩn đoán là bạn bị viêm dạ dày.',plan:p,evidence:ev});
  const dosage=validatePromptGateAnswer({intent:'SAFETY_HEALTH',answer:'Bạn nên uống thuốc 500 mg hai lần.',plan:p,evidence:ev});
  assert.ok(diagnosis.reasons.includes('MEDICAL_DIAGNOSIS'));
  assert.ok(dosage.reasons.includes('MEDICATION_INSTRUCTION'));
  assert.equal(validatePromptGateAnswer({intent:'SAFETY_HEALTH',answer:'Pipi không chẩn đoán. Bạn có thể tới Phòng khám A để được hỗ trợ.',plan:p,evidence:ev}).ok,true);
});

test('local-guide gate requires a redirect to search or directions',()=>{
  const p=plan('LOCAL_GUIDE');
  assert.equal(validatePromptGateAnswer({intent:'LOCAL_GUIDE',answer:'Phong tục địa phương rất thú vị.',plan:p,evidence:[]}).ok,false);
  assert.equal(validatePromptGateAnswer({intent:'LOCAL_GUIDE',answer:'Pipi hiện tập trung tìm địa điểm và chỉ đường. Bạn cần tìm gì?',plan:p,evidence:[]}).ok,true);
});

test('assertion throws a typed error so existing deterministic fallback can take over',()=>{
  const p=plan('PLACE_DISCOVERY',['search_places']),ev=evidence('search_places',{pois:[{name:'Quán A'}]});
  assert.throws(()=>assertPromptGateAnswer({intent:'PLACE_DISCOVERY',answer:'Không nêu địa điểm nào.',plan:p,evidence:ev}),PromptGateError);
});
