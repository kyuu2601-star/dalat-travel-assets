import {execFile} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import path from 'node:path';
import {TEXT_CHAT_EVAL_CASES,TRANSLATE_EVAL_CASES} from './chat-translate-cases.mjs';
import {planRequestV3ForEval} from '../worker/src/index.js';
import {compareShadowRoute,shadowRouteTravelRequest} from '../worker/src/bot/request-router.js';

const runFile=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),has=value=>args.includes(value),arg=value=>{const index=args.indexOf(value);return index>=0?args[index+1]:'';};
const baseUrl=String(arg('--base-url')||process.env.TRAVELOS_EVAL_BASE_URL||'https://ai-test.kyuu2601.workers.dev').replace(/\/+$/,'');
const origin=String(arg('--origin')||process.env.TRAVELOS_EVAL_ORIGIN||'https://kyuu2601-star.github.io');
const timeoutMs=Math.max(5000,Number(arg('--timeout-ms'))||30000),skipTranslate=has('--skip-translate'),translateOnly=has('--translate-only'),regrade=has('--regrade');
const sameArray=(left,right)=>left.length===right.length&&left.every((value,index)=>value===right[index]);
const toolsOf=plan=>(plan?.tools||[]).map(tool=>tool?.name).filter(Boolean);
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const fold=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g,' ').trim();

function chatChecks(evalCase,router,plan){
  const expected=evalCase.expected,tools=toolsOf(plan),checks=[];
  const add=(name,pass,details)=>checks.push({name,pass:Boolean(pass),details:clean(details)});
  add('router decision',router.decision===expected.decision,`${router.decision} vs ${expected.decision}`);
  add('router intent',router.intentHint===expected.intentHint,`${router.intentHint} vs ${expected.intentHint}`);
  add('fresh GPS policy',router.requiresFreshGps===expected.requiresFreshGps,`${router.requiresFreshGps} vs ${expected.requiresFreshGps}`);
  add('planner intent',plan.travelIntent===expected.planIntent,`${plan.travelIntent} vs ${expected.planIntent}`);
  if(expected.toolsContain)add('planner tools',expected.toolsContain.every(name=>tools.includes(name)),`${tools.join(' → ')||'none'}; need ${expected.toolsContain.join(', ')}`);
  if(expected.toolsExact)add('planner tools exact',sameArray(tools,expected.toolsExact),`${tools.join(' → ')||'none'} vs ${expected.toolsExact.join(' → ')||'none'}`);
  add('shadow agreement',router.matched===expected.matched,`${router.matched} vs ${expected.matched}; actual ${router.actualDecision}`);
  add('shadow remains disabled',router.applied===false,`applied=${router.applied}`);
  return checks;
}

async function runChatCases(){
  const results=[];
  for(const evalCase of TEXT_CHAT_EVAL_CASES){
    const predicted=shadowRouteTravelRequest({userMessage:evalCase.userMessage,location:evalCase.userLocation});
    const plan=await planRequestV3ForEval(evalCase.userMessage,[],evalCase.userLocation,null,{}),router=compareShadowRoute(predicted,plan);
    const checks=chatChecks(evalCase,router,plan),failed=checks.filter(check=>!check.pass);
    results.push({id:evalCase.id,kind:'text-chat',category:evalCase.category,status:failed.length?'FAIL':'PASS',message:evalCase.userMessage,
      router,plan:{travelIntent:plan.travelIntent,tools:toolsOf(plan),planner:plan.planner},checks});
  }
  return results;
}

function units(value,language){
  const normalized=fold(value);
  if(language==='zh-Hans')return [...normalized.replace(/\s+/g,'')];
  return normalized.split(/\s+/).filter(Boolean);
}

function diceScore(left,right,language){
  const a=units(left,language),b=units(right,language);
  if(!a.length||!b.length)return 0;
  const counts=new Map();for(const token of a)counts.set(token,(counts.get(token)||0)+1);
  let overlap=0;for(const token of b){const count=counts.get(token)||0;if(count){overlap++;counts.set(token,count-1);}}
  return 2*overlap/(a.length+b.length);
}

function includesTerm(text,term){return fold(text).includes(fold(term));}

async function synthesizeAudio(evalCase,tempDir){
  const stem=evalCase.id.toLowerCase(),aiff=path.join(tempDir,`${stem}.aiff`),wav=path.join(tempDir,`${stem}.wav`);
  const voice=evalCase.sourceLanguage==='vi'?'Linh':'Tingting',rate=evalCase.sourceLanguage==='vi'?'185':'170';
  await runFile('/usr/bin/say',['-v',voice,'-r',rate,'-o',aiff,evalCase.sourceText],{timeout:20000});
  await runFile('/usr/bin/afconvert',['-f','WAVE','-d','LEI16@16000',aiff,wav],{timeout:20000});
  return (await readFile(wav)).toString('base64');
}

async function requestTranslation(audio){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),started=Date.now();
  try{
    const response=await fetch(`${baseUrl}/voice-translate-fallback`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'TravelOS-Translate-Eval/1.0'},body:JSON.stringify({audio}),signal:controller.signal});
    const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{throw new Error(`INVALID_JSON_HTTP_${response.status}`);}
    if(!response.ok)throw new Error(`HTTP_${response.status}:${clean(data?.error||raw).slice(0,180)}`);
    return {data,latencyMs:Date.now()-started};
  }finally{clearTimeout(timer);}
}

function translationChecks(evalCase,data){
  const checks=[],add=(name,pass,details)=>checks.push({name,pass:Boolean(pass),details:clean(details)});
  const sourceScore=diceScore(data?.sourceText,evalCase.sourceText,evalCase.sourceLanguage);
  const translationScore=diceScore(data?.translatedText,evalCase.reference,evalCase.targetLanguage);
  add('source language',data?.sourceLanguage===evalCase.sourceLanguage,`${data?.sourceLanguage||'missing'} vs ${evalCase.sourceLanguage}`);
  add('target language',data?.targetLanguage===evalCase.targetLanguage,`${data?.targetLanguage||'missing'} vs ${evalCase.targetLanguage}`);
  add('transcript fidelity',sourceScore>=.58,`${Math.round(sourceScore*100)}% · ${data?.sourceText||'missing'}`);
  add('translation similarity',translationScore>=.32,`${Math.round(translationScore*100)}% · ${data?.translatedText||'missing'}`);
  for(const [index,group] of evalCase.requiredGroups.entries())add(`required meaning ${index+1}`,group.some(term=>includesTerm(data?.translatedText,term)),`${group.join(' | ')} · ${data?.translatedText||'missing'}`);
  return checks;
}

async function runTranslateCases(){
  if(regrade){
    const previous=JSON.parse(await readFile(path.join(here,'reports','chat-translate-100-latest.json'),'utf8'));
    return TRANSLATE_EVAL_CASES.map(evalCase=>{
      const saved=previous.results.find(item=>item.id===evalCase.id),data=saved?.actual,checks=data?translationChecks(evalCase,data):[];
      const infraError=data?'':'MISSING_PREVIOUS_TRANSLATION',failed=checks.filter(check=>!check.pass),status=infraError?'INFRA':failed.length?'FAIL':'PASS';
      return {id:evalCase.id,kind:'translate',category:evalCase.category,status,sourceLanguage:evalCase.sourceLanguage,targetLanguage:evalCase.targetLanguage,
        sourceText:evalCase.sourceText,reference:evalCase.reference,actual:data||null,latencyMs:saved?.latencyMs||0,infraError,checks};
    });
  }
  const results=[],tempDir=await mkdtemp(path.join(tmpdir(),'travelos-translate-eval-'));
  try{
    for(const evalCase of TRANSLATE_EVAL_CASES){
      process.stdout.write(`Running ${evalCase.id} ${evalCase.direction} ... `);
      let infraError='',latencyMs=0,data=null,checks=[];
      try{
        const audio=await synthesizeAudio(evalCase,tempDir),response=await requestTranslation(audio);data=response.data;latencyMs=response.latencyMs;
        checks=translationChecks(evalCase,data);
      }catch(error){infraError=clean(error?.name==='AbortError'?`TIMEOUT_${timeoutMs}MS`:error?.message||error);}
      const failed=checks.filter(check=>!check.pass),status=infraError?'INFRA':failed.length?'FAIL':'PASS';
      results.push({id:evalCase.id,kind:'translate',category:evalCase.category,status,sourceLanguage:evalCase.sourceLanguage,targetLanguage:evalCase.targetLanguage,
        sourceText:evalCase.sourceText,reference:evalCase.reference,actual:data?{sourceLanguage:data.sourceLanguage,targetLanguage:data.targetLanguage,sourceText:data.sourceText,translatedText:data.translatedText}:null,
        latencyMs,infraError,checks});
      process.stdout.write(`${status}${failed.length?` (${failed.map(item=>item.name).join(', ')})`:''} · ${latencyMs} ms\n`);
      await new Promise(resolve=>setTimeout(resolve,150));
    }
  }finally{await rm(tempDir,{recursive:true,force:true});}
  return results;
}

const results=[];
if(!translateOnly)results.push(...await runChatCases());
if(!skipTranslate)results.push(...await runTranslateCases());
const categories=[...new Set(results.map(item=>item.category))].map(category=>{
  const group=results.filter(item=>item.category===category),passed=group.filter(item=>item.status==='PASS').length,infra=group.filter(item=>item.status==='INFRA').length;
  return {category,cases:group.length,passed,failed:group.length-passed-infra,infra,score:Math.round(passed/group.length*1000)/10};
});
const passed=results.filter(item=>item.status==='PASS').length,infra=results.filter(item=>item.status==='INFRA').length,failed=results.length-passed-infra,score=results.length?Math.round(passed/results.length*1000)/10:0;
const report={generatedAt:new Date().toISOString(),baseUrl,summary:{cases:results.length,passed,failed,infra,score,gate:failed===0&&infra===0},categories,results};
const rows=categories.map(item=>`| ${item.category} | ${item.cases} | ${item.passed} | ${item.failed} | ${item.infra} | ${item.score}% |`).join('\n');
const failures=results.filter(item=>item.status!=='PASS').map(item=>`### ${item.id} — ${item.category}\n\n- Input: ${item.sourceText||item.message}\n- Kết quả: ${item.status}\n- Lỗi: ${item.infraError||item.checks.filter(check=>!check.pass).map(check=>`${check.name}: ${check.details}`).join('; ')}${item.actual?`\n- Bản dịch thực tế: ${item.actual.translatedText}`:''}`).join('\n\n');
const markdown=`# TravelOS text chat + translate eval — 100 case mới\n\n- Thời điểm: ${report.generatedAt}\n- Tổng: **${results.length}**\n- Đạt: **${passed}**\n- Lỗi: **${failed}**\n- Infra: **${infra}**\n- Điểm: **${score}%**\n- Gate: **${report.summary.gate?'PASS':'FAIL'}**\n\n| Nhóm | Case | Đạt | Lỗi | Infra | Điểm |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\n## Case chưa đạt\n\n${failures||'Không có.'}\n`;
const reportsDir=path.join(here,'reports');await mkdir(reportsDir,{recursive:true});
await Promise.all([
  writeFile(path.join(reportsDir,'chat-translate-100-latest.json'),`${JSON.stringify(report,null,2)}\n`),
  writeFile(path.join(reportsDir,'chat-translate-100-latest.md'),markdown)
]);
console.log(`\nChat + translate eval: ${passed}/${results.length} pass · ${failed} fail · ${infra} infra · ${score}%`);
console.log(`Report: ${path.join(reportsDir,'chat-translate-100-latest.md')}`);
if(failed||infra)process.exitCode=1;
