import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LIVE_EVAL_CASES } from './live-cases.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const arg=value=>{const index=args.indexOf(value);return index>=0?args[index+1]:'';};
const baseUrl=String(arg('--base-url')||process.env.TRAVELOS_EVAL_BASE_URL||'https://ai-test.kyuu2601.workers.dev').replace(/\/+$/,'');
const origin=String(arg('--origin')||process.env.TRAVELOS_EVAL_ORIGIN||'https://kyuu2601-star.github.io');
const timeoutMs=Math.max(5000,Number(arg('--timeout-ms')||process.env.TRAVELOS_EVAL_TIMEOUT_MS)||45000);
const reportName=cleanReportName(arg('--report-name')||'live-latest');
const selectedIds=new Set(String(arg('--cases')||'').split(',').map(value=>value.trim()).filter(Boolean));
const cases=selectedIds.size?LIVE_EVAL_CASES.filter(item=>selectedIds.has(item.id)):LIVE_EVAL_CASES;

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const toolsOf=data=>(data?.travelos?.plan?.tools||[]).map(tool=>tool?.name).filter(Boolean);
const sourcesOf=data=>Array.isArray(data?.travelos?.sources)?data.travelos.sources:[];
const errorCodeOf=data=>data?.error?.code||data?.travelos?.nearbyError?.code||'';
const point=value=>{const lat=Number(value?.lat??value?.latitude),lng=Number(value?.lng??value?.lon??value?.longitude);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null;};
const haversineKm=(a,b)=>{const p1=point(a),p2=point(b);if(!p1||!p2)return Infinity;const r=6371,dLat=(p2.lat-p1.lat)*Math.PI/180,dLng=(p2.lng-p1.lng)*Math.PI/180,lat1=p1.lat*Math.PI/180,lat2=p2.lat*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return r*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const sameArray=(left,right)=>left.length===right.length&&left.every((value,index)=>value===right[index]);
const regexTest=(pattern,value)=>pattern instanceof RegExp?pattern.test(String(value||'')):String(value||'').includes(String(pattern));
const markdownCell=value=>clean(value).replaceAll('|','\\|').slice(0,500);
function cleanReportName(value){return String(value||'live-latest').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'live-latest';}

function evaluate(data,expect={},caseCritical=false){
  const checks=[];
  const add=(name,pass,details='',critical=caseCritical)=>checks.push({name,pass:Boolean(pass),critical:Boolean(critical),details:clean(details)});
  const tools=toolsOf(data),sources=sourcesOf(data),sourceText=sources.map(source=>`${source.tool}:${source.source}`).join(' '),text=clean(data?.text);
  if(expect.intent)add('intent',data?.travelos?.travelIntent===expect.intent,`${data?.travelos?.travelIntent||'missing'} vs ${expect.intent}`);
  if(expect.toolsExact)add('tools exact',sameArray(tools,expect.toolsExact),`${tools.join(' → ')||'none'} vs ${expect.toolsExact.join(' → ')||'none'}`);
  if(expect.toolsContain)add('tools contain',expect.toolsContain.every(name=>tools.includes(name)),`${tools.join(' → ')||'none'}; need ${expect.toolsContain.join(', ')}`);
  if(expect.source)add('source allowed',regexTest(expect.source,sourceText),sourceText||'none');
  if(expect.forbiddenSource)add('source forbidden',!regexTest(expect.forbiddenSource,sourceText),sourceText||'none');
  if(expect.sourceToolsOk)add('required sources ok',expect.sourceToolsOk.every(tool=>sources.some(source=>source.tool===tool&&source.ok===true)),JSON.stringify(sources));
  if(expect.noSuccessfulSources)add('no successful live source',!sources.some(source=>source.ok===true),JSON.stringify(sources));
  if(expect.errorCode)add('error code',errorCodeOf(data)===expect.errorCode,`${errorCodeOf(data)||'missing'} vs ${expect.errorCode}`);
  if(expect.traceIdRequired)add('trace id present',/^tr_[a-zA-Z0-9_.:-]+$/.test(String(data?.traceId||'')),data?.traceId||'missing');
  if(expect.sourceDurations)add('source durations present',sources.length>0&&sources.every(source=>Number.isFinite(Number(source?.durationMs))&&Number(source.durationMs)>=0),JSON.stringify(sources));
  if(expect.noNearby)add('no nearby result',!data?.travelos?.nearby,'nearby present');
  if(expect.missingApiNeed)add('missing API declared',(data?.travelos?.missingApiSuggestions||[]).some(item=>item?.need===expect.missingApiNeed),JSON.stringify(data?.travelos?.missingApiSuggestions||[]));
  if(expect.textMinLength)add('answer present',text.length>=expect.textMinLength,`${text.length} chars`);
  if(expect.textMatches)add(`text matches ${expect.textMatches}`,regexTest(expect.textMatches,text),text.slice(0,300));
  for(const pattern of expect.textExcludes||[])add(`text excludes ${pattern}`,!regexTest(pattern,text),text.slice(0,300));
  if(expect.weatherCenterNear){const actual=point(data?.travelos?.weather?.coordinates),distance=haversineKm(actual,expect.weatherCenterNear);add('weather target coordinates',distance<=expect.weatherCenterNear.toleranceKm,`${actual?`${actual.lat},${actual.lng}`:'missing'}; ${Number.isFinite(distance)?distance.toFixed(1):'∞'} km away`);}
  if(expect.routesMin!=null)add('route returned',(data?.travelos?.routes||[]).length>=expect.routesMin,`${(data?.travelos?.routes||[]).length} routes`);
  if(expect.placeDetailsRequired)add('place details returned',Boolean(data?.travelos?.placeDetails?.name),data?.travelos?.placeDetails?.name||'missing');
  if(expect.curatedMin!=null)add('curated places returned',(data?.travelos?.curated?.places||[]).length>=expect.curatedMin,`${(data?.travelos?.curated?.places||[]).length} places`);
  if(expect.hotelAreaStatus)add('hotel confirmation state',data?.travelos?.hotelArea?.status===expect.hotelAreaStatus,`${data?.travelos?.hotelArea?.status||'missing'} vs ${expect.hotelAreaStatus}`);
  if(expect.nearby){
    const nearby=data?.travelos?.nearby,pois=Array.isArray(nearby?.pois)?nearby.pois:[];
    if(expect.nearby.minPois!=null)add('nearby POIs returned',pois.length>=expect.nearby.minPois,`${pois.length} POIs`);
    if(expect.nearby.provider)add('nearby provider',regexTest(expect.nearby.provider,nearby?.provider),nearby?.provider||'missing');
    if(expect.nearby.providerNot)add('nearby provider excluded',!regexTest(expect.nearby.providerNot,nearby?.provider),nearby?.provider||'missing');
    if(expect.nearby.centerNear){const distance=haversineKm(nearby?.center,expect.nearby.centerNear);add('nearby center',distance<=expect.nearby.centerNear.toleranceKm,`${point(nearby?.center)?`${nearby.center.lat},${nearby.center.lng}`:'missing'}; ${Number.isFinite(distance)?distance.toFixed(2):'∞'} km away`);}
    if(expect.nearby.sortedByDistance){const distances=pois.map(item=>Number(item?.distance)).filter(Number.isFinite);add('distance ordering',distances.length===pois.length&&distances.every((value,index)=>index===0||value>=distances[index-1]),distances.slice(0,12).join(', '));}
    if(expect.nearby.withinPlannedRadius){const radius=Number(nearby?.query?.radius),distances=pois.map(item=>Number(item?.distance)).filter(Number.isFinite);add('results inside radius',Number.isFinite(radius)&&distances.length===pois.length&&distances.every(value=>value<=radius+25),`radius ${radius}; max ${distances.length?Math.max(...distances):'missing'}`);}
    if(expect.nearby.everyPoiMatches){
      const invalid=pois.filter(item=>!regexTest(expect.nearby.everyPoiMatches,[item?.name,item?.localizedName,item?.primaryType,item?.type,...(item?.types||[]),item?.tag].filter(Boolean).join(' ')));
      add('all POIs match requested category',pois.length>0&&!invalid.length,invalid.map(item=>item?.localizedName||item?.name||item?.id).join(', ')||`${pois.length} valid POIs`);
    }
  }
  return checks;
}

async function requestStep(body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),started=Date.now();
  try{
    const response=await fetch(`${baseUrl}/ai-v3`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'TravelOS-Eval/1.0'},body:JSON.stringify(body),signal:controller.signal});
    const raw=await response.text();let data;
    try{data=JSON.parse(raw);}catch{throw new Error(`INVALID_JSON_HTTP_${response.status}: ${raw.slice(0,160)}`);}
    if(!response.ok)throw new Error(`HTTP_${response.status}: ${clean(data?.error||raw).slice(0,160)}`);
    return {data,latencyMs:Date.now()-started};
  }finally{clearTimeout(timer);}
}

function summarizeResponse(data){
  const nearby=data?.travelos?.nearby,weather=data?.travelos?.weather;
  return {
    text:clean(data?.text).slice(0,700),traceId:data?.traceId||'',intent:data?.travelos?.travelIntent||'',tools:toolsOf(data),sources:sourcesOf(data),errorCode:errorCodeOf(data),
    nearby:nearby?{provider:nearby.provider||'',center:point(nearby.center),count:(nearby.pois||[]).length,names:(nearby.pois||[]).slice(0,5).map(item=>item.localizedName||item.name)}:null,
    weather:weather?{coordinates:point(weather.coordinates),timezone:weather.timezone||'',condition:weather.current?.condition||''}:null,
    routes:(data?.travelos?.routes||[]).length,hotelAreaStatus:data?.travelos?.hotelArea?.status||'',place:data?.travelos?.placeDetails?.localizedName||data?.travelos?.placeDetails?.name||'',
    curatedCount:(data?.travelos?.curated?.places||[]).length,missingApiNeeds:(data?.travelos?.missingApiSuggestions||[]).map(item=>item.need)
  };
}

const results=[];
for(const evalCase of cases){
  let previous=null,infraError='',latencyMs=0;const stepResults=[];
  process.stdout.write(`Running ${evalCase.id} ${evalCase.title} ... `);
  for(let index=0;index<evalCase.steps.length;index++){
    const step=evalCase.steps[index],body={...step.body};
    if(step.usePreviousContext)body.conversationContext=previous?.travelos;
    try{
      const response=await requestStep(body);latencyMs+=response.latencyMs;previous=response.data;
      stepResults.push({step:index+1,latencyMs:response.latencyMs,checks:evaluate(response.data,step.expect,evalCase.critical),response:summarizeResponse(response.data)});
    }catch(error){infraError=clean(error?.name==='AbortError'?`TIMEOUT_${timeoutMs}MS`:error?.message||error);break;}
  }
  const checks=stepResults.flatMap(step=>step.checks),failed=checks.filter(check=>!check.pass),status=infraError?'INFRA':failed.length?'FAIL':'PASS';
  results.push({id:evalCase.id,title:evalCase.title,category:evalCase.category,critical:evalCase.critical,status,latencyMs,infraError,checks,steps:stepResults,manualRubric:evalCase.manualRubric||[]});
  process.stdout.write(`${status}${failed.length?` (${failed.map(item=>item.name).join(', ')})`:''} · ${latencyMs} ms\n`);
}

const scored=results.filter(item=>item.status!=='INFRA'),allChecks=scored.flatMap(item=>item.checks),passedWeight=allChecks.filter(item=>item.pass).reduce((sum,item)=>sum+(item.critical?3:1),0),totalWeight=allChecks.reduce((sum,item)=>sum+(item.critical?3:1),0);
const structuralScore=totalWeight?Math.round(passedWeight/totalWeight*1000)/10:0;
const criticalFailures=results.filter(item=>item.critical&&item.status==='FAIL');
const infraErrors=results.filter(item=>item.status==='INFRA');
const latencies=results.filter(item=>item.latencyMs>0).map(item=>item.latencyMs).sort((a,b)=>a-b),p95=latencies.length?latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*.95)-1)]:0;
const gate=structuralScore>=90&&criticalFailures.length===0&&infraErrors.length===0;
const report={generatedAt:new Date().toISOString(),baseUrl,origin,timeoutMs,summary:{cases:results.length,passed:results.filter(item=>item.status==='PASS').length,failed:results.filter(item=>item.status==='FAIL').length,infraErrors:infraErrors.length,structuralScore,criticalFailures:criticalFailures.map(item=>item.id),p95LatencyMs:p95,manualReviewCases:results.filter(item=>item.manualRubric.length).map(item=>item.id),gate},results};
const rows=results.map(item=>`| ${item.id} | ${item.status} | ${item.critical?'Có':'Không'} | ${item.latencyMs} ms | ${markdownCell(item.infraError||item.checks.filter(check=>!check.pass).map(check=>`${check.name}: ${check.details}`).join('; ')||'—')} |`).join('\n');
const markdown=`# TravelOS live eval\n\n- Thời điểm: ${report.generatedAt}\n- Endpoint: ${baseUrl}\n- Điểm structural: **${structuralScore}%**\n- Critical failures: **${report.summary.criticalFailures.join(', ')||'0'}**\n- Infra errors: **${infraErrors.length}**\n- p95 latency: **${p95} ms**\n- Gate: **${gate?'PASS':'FAIL'}**\n\n| Case | Kết quả | Critical | Latency | Lỗi |\n|---|---|---:|---:|---|\n${rows}\n\n## Manual review còn lại\n\n${results.filter(item=>item.manualRubric.length).map(item=>`### ${item.id} — ${item.title}\n${item.manualRubric.map(value=>`- [ ] ${value}`).join('\n')}\n\nTrả lời: ${item.steps.map(step=>step.response.text).filter(Boolean).join(' / ').slice(0,1200)}`).join('\n\n')||'Không có.'}\n`;
const reportsDir=path.join(here,'reports');await mkdir(reportsDir,{recursive:true});
await Promise.all([writeFile(path.join(reportsDir,`${reportName}.json`),`${JSON.stringify(report,null,2)}\n`),writeFile(path.join(reportsDir,`${reportName}.md`),markdown)]);
console.log(`\nStructural score: ${structuralScore}% · critical failures: ${report.summary.criticalFailures.join(', ')||'0'} · infra: ${infraErrors.length} · gate: ${gate?'PASS':'FAIL'}`);
console.log(`Reports: ${path.join(reportsDir,`${reportName}.md`)}`);
if(!gate)process.exitCode=1;

