const REQUEST_TRACES=new WeakMap();

const clean=(value,max=160)=>String(value??'').trim().replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,max);

function newTraceId() {
  try{return `tr_${crypto.randomUUID()}`;}catch{return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;}
}
export function beginTravelTrace(request, options={}) {
  const supplied=clean(request?.headers?.get?.('X-Trace-Id'),100);
  const trace={id:supplied||newTraceId(),startedAt:Date.now(),timings:{},completed:false,logging:options.logging===true};
  REQUEST_TRACES.set(request,trace);
  return trace.id;
}

export function updateTravelTrace(request, patch={}) {
  const trace=REQUEST_TRACES.get(request);
  if(!trace)return;
  const timings=patch.timings?{...trace.timings,...patch.timings}:trace.timings;
  Object.assign(trace,patch,{timings});
}

export function travelTraceId(request) {
  return REQUEST_TRACES.get(request)?.id||'';
}

export function completeTravelTrace(request, payload, status=200) {
  const trace=REQUEST_TRACES.get(request);
  if(!trace||trace.completed)return trace?.id||'';
  trace.completed=true;
  const travelos=payload?.travelos||{},sources=Array.isArray(travelos.sources)?travelos.sources:[];
  const tools=sources.slice(0,12).map(source=>({
    name:clean(source?.tool,80),provider:clean(source?.source,100),ok:source?.ok===true,
    durationMs:Math.max(0,Math.round(Number(source?.durationMs)||0)),error:clean(source?.error,100)
  }));
  const record={
    event:'travel_request_complete',traceId:trace.id,status,durationMs:Date.now()-trace.startedAt,
    intent:clean(travelos.travelIntent||travelos.plan?.travelIntent||trace.intent,80),
    planner:clean(travelos.plan?.planner||trace.planner,80),fallback:clean(trace.fallback,100),
    errorCode:clean(payload?.error?.code||travelos?.nearbyError?.code,100),timings:trace.timings,tools
  };
  if(trace.logging)console.info('TRAVELOS_TRACE',JSON.stringify(record));
  return trace.id;
}
