// OpenAI is an optional primary text provider. Keep the API key on the Worker.
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);

export function hasTextModel(env={}) {
  return Boolean(env.OPENAI_API_KEY||env.GEMINI_API_KEY);
}

export function openAiInput(contents=[]) {
  return (Array.isArray(contents)?contents:[]).map(item=>({
    role:item?.role==='model'?'assistant':'user',
    content:(Array.isArray(item?.parts)?item.parts:[]).map(part=>clean(part?.text,10000)).filter(Boolean).join('\n')
  })).filter(item=>item.content);
}

export function openAiText(response) {
  const text=(Array.isArray(response?.output)?response.output:[])
    .filter(item=>item?.type==='message')
    .flatMap(item=>Array.isArray(item?.content)?item.content:[])
    .filter(item=>item?.type==='output_text')
    .map(item=>item.text||'').join('\n').trim();
  return text||clean(response?.output_text,20000);
}

export async function requestOpenAi(systemPrompt,contents,env,{json=false,purpose='default'}={}) {
  if(!env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  const planner=purpose==='planner'||purpose==='place-category';
  const model=clean(planner?env.OPENAI_PLANNER_MODEL||env.OPENAI_MODEL:env.OPENAI_MODEL,120)||'gpt-6-luna';
  const timeout=purpose==='place-category'?4000:Math.min(20000,Math.max(4000,Number(env.OPENAI_TIMEOUT_MS)||12000));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  const body={model,instructions:String(systemPrompt||'')+(json?'\nReturn one valid JSON object and no other text.':''),input:openAiInput(contents),store:false};
  if(json)body.text={format:{type:'json_object'}};
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.OPENAI_API_KEY}`},
      body:JSON.stringify(body),signal:controller.signal
    });
    if(!response.ok)throw new Error(`OPENAI_HTTP_${response.status}`);
    const data=await response.json();
    if(data?.status==='incomplete'||data?.status==='failed')throw new Error('OPENAI_INCOMPLETE');
    const text=openAiText(data);
    if(!text)throw new Error('OPENAI_EMPTY_OUTPUT');
    if(!json)return {text};
    try{return JSON.parse(text);}catch{throw new Error('OPENAI_INVALID_JSON');}
  }finally{clearTimeout(timer);}
}
