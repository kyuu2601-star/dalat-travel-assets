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
const retryInfra=has('--retry-infra'),useExistingTranslate=has('--use-existing-translate');
const selectedIds=new Set(String(arg('--cases')||'').split(',').map(value=>value.trim()).filter(Boolean));
const chatCases=selectedIds.size?TEXT_CHAT_EVAL_CASES.filter(item=>selectedIds.has(item.id)):TEXT_CHAT_EVAL_CASES;
const reportName=String(arg('--report-name')||'chat-translate-100-latest').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,80);
const reportPath=path.join(here,'reports',`${reportName}.json`);
const previousReport=(retryInfra||useExistingTranslate)?JSON.parse(await readFile(reportPath,'utf8')):null;
const retryIds=new Set(retryInfra?(previousReport?.results||[]).filter(item=>item.kind==='translate'&&item.status==='INFRA').map(item=>item.id):[]);
const translateCases=(selectedIds.size?TRANSLATE_EVAL_CASES.filter(item=>selectedIds.has(item.id)):TRANSLATE_EVAL_CASES)
  .filter(item=>!retryInfra||retryIds.has(item.id));
const LIVE_MODEL='gemini-3.5-live-translate-preview';
const LIVE_WS='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const LIVE_TARGETS=['vi','zh-Hans'],SILENCE_FRAME=Buffer.alloc(3200);
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
  for(const evalCase of chatCases){
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

async function requestLiveToken(target){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),started=Date.now();
  try{
    const response=await fetch(`${baseUrl}/voice-live-token`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'TravelOS-Live-Translate-Eval/1.0'},body:JSON.stringify({targetLanguageCode:target}),signal:controller.signal});
    const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{throw new Error(`INVALID_JSON_HTTP_${response.status}`);}
    if(!response.ok)throw new Error(`HTTP_${response.status}:${clean(data?.error||raw).slice(0,180)}`);
    if(!data.token)throw new Error('LIVE_TOKEN_MISSING');
    return {token:data.token,latencyMs:Date.now()-started};
  }finally{clearTimeout(timer);}
}

const decodeMessage=async data=>{
  if(typeof data==='string')return data;
  if(data instanceof Blob)return data.text();
  if(data instanceof ArrayBuffer)return new TextDecoder().decode(data);
  if(ArrayBuffer.isView(data))return new TextDecoder().decode(data);
  return String(data??'');
};

async function openLiveSession(target){
  const token=await requestLiveToken(target),socket=new WebSocket(`${LIVE_WS}?access_token=${encodeURIComponent(token.token)}`);
  const state={target,sourceText:'',translatedText:'',sourceLanguage:'',audioBytes:0,complete:false,cancelled:false,lastTextAt:0,tokenLatencyMs:token.latencyMs};
  let resolveDone,rejectDone;
  const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  done.catch(()=>{});
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('LIVE_SETUP_TIMEOUT')),10000);
    socket.addEventListener('open',()=>socket.send(JSON.stringify({setup:{
      model:`models/${LIVE_MODEL}`,inputAudioTranscription:{},outputAudioTranscription:{},
      generationConfig:{responseModalities:['AUDIO'],translationConfig:{targetLanguageCode:target,echoTargetLanguage:false}}
    }})));
    socket.addEventListener('message',async event=>{
      let message;try{message=JSON.parse(await decodeMessage(event.data));}catch{return;}
      if(message.setupComplete){clearTimeout(timer);resolve();return;}
      const content=message.serverContent;if(!content)return;
      const input=content.inputTranscription;
      if(input?.text){state.sourceText+=input.text;state.lastTextAt=Date.now();}
      const language=clean(input?.languageCode,30).toLowerCase();
      if(language.startsWith('zh'))state.sourceLanguage='zh-Hans';else if(language.startsWith('vi'))state.sourceLanguage='vi';
      if(content.outputTranscription?.text){state.translatedText+=content.outputTranscription.text;state.lastTextAt=Date.now();}
      for(const part of content.modelTurn?.parts||[])if(part.inlineData?.data)state.audioBytes+=Buffer.from(part.inlineData.data,'base64').length;
      if(content.generationComplete||content.turnComplete){state.complete=true;resolveDone(state);}
    });
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('LIVE_SOCKET_ERROR'));rejectDone(new Error('LIVE_SOCKET_ERROR'));});
    socket.addEventListener('close',event=>{
      if(state.cancelled||state.complete)return;
      if(state.sourceText.trim()&&state.translatedText.trim()){state.complete=true;resolveDone(state);}
      else rejectDone(new Error(`LIVE_SOCKET_CLOSED_${event.code}`));
    });
  });
  await ready;
  return {socket,state,done};
}

function wavPcm(base64){
  const bytes=Buffer.from(base64,'base64');
  for(let index=12;index+8<=bytes.length;){
    const id=bytes.toString('ascii',index,index+4),size=bytes.readUInt32LE(index+4);
    if(id==='data')return bytes.subarray(index+8,index+8+size);
    index+=8+size+(size%2);
  }
  throw new Error('WAV_DATA_CHUNK_MISSING');
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForStableTranslation(session,started){
  while(Date.now()-started<timeoutMs){
    const state=session.state;
    // Live Translate is a continuous interpreter stream and may not emit a
    // turnComplete marker. Once both transcripts stop changing, that spoken
    // segment is complete enough to grade without waiting for the socket.
    if(state.sourceText.trim()&&state.translatedText.trim()&&Date.now()-state.lastTextAt>=3500)return state;
    await sleep(250);
  }
  const snapshots=JSON.stringify({target:session.state.target,sourceText:clean(session.state.sourceText),translatedText:clean(session.state.translatedText),audioBytes:session.state.audioBytes,complete:session.state.complete});
  throw new Error(`LIVE_TRANSLATION_TIMEOUT:${snapshots}`);
}

async function requestLiveTranslation(audio,evalCase){
  const started=Date.now(),sessions=await Promise.all(LIVE_TARGETS.map(openLiveSession));
  try{
    const send=frame=>{const packet=JSON.stringify({realtimeInput:{audio:{data:frame.toString('base64'),mimeType:'audio/pcm;rate=16000'}}});for(const session of sessions)session.socket.send(packet);};
    for(let index=0;index<3;index++){send(SILENCE_FRAME);await sleep(45);}
    const pcm=wavPcm(audio);
    for(let offset=0;offset<pcm.length;offset+=3200){send(pcm.subarray(offset,Math.min(offset+3200,pcm.length)));await sleep(100);}
    for(let index=0;index<5;index++){send(SILENCE_FRAME);await sleep(100);}
    for(const session of sessions)session.socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));
    const chosen=sessions.find(session=>session.state.target===evalCase.targetLanguage);
    const state=await Promise.race([chosen.done,waitForStableTranslation(chosen,started)]);
    const sourceLanguage=state.sourceLanguage||(/[\u3400-\u9fff]/u.test(state.sourceText)?'zh-Hans':'vi');
    return {data:{live:true,sourceLanguage,targetLanguage:state.target,sourceText:clean(state.sourceText),translatedText:clean(state.translatedText),audioBytes:state.audioBytes},latencyMs:Date.now()-started};
  }finally{for(const session of sessions)try{session.state.cancelled=true;session.socket.close();}catch{}}
}

function translationChecks(evalCase,data){
  const checks=[],add=(name,pass,details)=>checks.push({name,pass:Boolean(pass),details:clean(details)});
  const sourceScore=diceScore(data?.sourceText,evalCase.sourceText,evalCase.sourceLanguage);
  const translationScore=diceScore(data?.translatedText,evalCase.reference,evalCase.targetLanguage);
  add('source language',data?.sourceLanguage===evalCase.sourceLanguage,`${data?.sourceLanguage||'missing'} vs ${evalCase.sourceLanguage}`);
  add('target language',data?.targetLanguage===evalCase.targetLanguage,`${data?.targetLanguage||'missing'} vs ${evalCase.targetLanguage}`);
  add('live streaming path',data?.live===true,'live='+String(data?.live));
  add('translated audio returned',Number(data?.audioBytes)>0,`${Number(data?.audioBytes)||0} bytes`);
  add('transcript fidelity',sourceScore>=.58,`${Math.round(sourceScore*100)}% · ${data?.sourceText||'missing'}`);
  add('translation similarity',translationScore>=.32,`${Math.round(translationScore*100)}% · ${data?.translatedText||'missing'}`);
  for(const [index,group] of evalCase.requiredGroups.entries())add(`required meaning ${index+1}`,group.some(term=>includesTerm(data?.translatedText,term)),`${group.join(' | ')} · ${data?.translatedText||'missing'}`);
  return checks;
}

async function runTranslateCases(){
  if(regrade){
    const previous=JSON.parse(await readFile(path.join(here,'reports','chat-translate-100-latest.json'),'utf8'));
    return translateCases.map(evalCase=>{
      const saved=previous.results.find(item=>item.id===evalCase.id),data=saved?.actual,checks=data?translationChecks(evalCase,data):[];
      const infraError=data?'':'MISSING_PREVIOUS_TRANSLATION',failed=checks.filter(check=>!check.pass),status=infraError?'INFRA':failed.length?'FAIL':'PASS';
      return {id:evalCase.id,kind:'translate',category:evalCase.category,status,sourceLanguage:evalCase.sourceLanguage,targetLanguage:evalCase.targetLanguage,
        sourceText:evalCase.sourceText,reference:evalCase.reference,actual:data||null,latencyMs:saved?.latencyMs||0,infraError,checks};
    });
  }
  const results=[],tempDir=await mkdtemp(path.join(tmpdir(),'travelos-translate-eval-'));
  try{
    for(const evalCase of translateCases){
      process.stdout.write(`Running ${evalCase.id} ${evalCase.direction} ... `);
      let infraError='',latencyMs=0,data=null,checks=[];
      try{
        const audio=await synthesizeAudio(evalCase,tempDir),response=await requestLiveTranslation(audio,evalCase);data=response.data;latencyMs=response.latencyMs;
        checks=translationChecks(evalCase,data);
      }catch(error){infraError=clean(error?.name==='AbortError'?`TIMEOUT_${timeoutMs}MS`:error?.message||error);}
      const failed=checks.filter(check=>!check.pass),status=infraError?'INFRA':failed.length?'FAIL':'PASS';
      results.push({id:evalCase.id,kind:'translate',category:evalCase.category,status,sourceLanguage:evalCase.sourceLanguage,targetLanguage:evalCase.targetLanguage,
        sourceText:evalCase.sourceText,reference:evalCase.reference,actual:data?{live:data.live,sourceLanguage:data.sourceLanguage,targetLanguage:data.targetLanguage,sourceText:data.sourceText,translatedText:data.translatedText,audioBytes:data.audioBytes}:null,
        latencyMs,infraError,checks});
      process.stdout.write(`${status}${failed.length?` (${failed.map(item=>item.name).join(', ')})`:''} · ${latencyMs} ms\n`);
      await new Promise(resolve=>setTimeout(resolve,150));
    }
  }finally{await rm(tempDir,{recursive:true,force:true});}
  return results;
}

let results=[];
if(!translateOnly)results.push(...await runChatCases());
if(useExistingTranslate){
  results.push(...(previousReport?.results||[]).filter(item=>item.kind==='translate'));
}else if(!skipTranslate){
  const translated=await runTranslateCases();
  if(retryInfra){
    const replacements=new Map(translated.map(item=>[item.id,item]));
    results=(previousReport?.results||[]).map(item=>replacements.get(item.id)||item);
  }else results.push(...translated);
}
results.sort((left,right)=>left.id.localeCompare(right.id,undefined,{numeric:true}));
const categories=[...new Set(results.map(item=>item.category))].map(category=>{
  const group=results.filter(item=>item.category===category),passed=group.filter(item=>item.status==='PASS').length,infra=group.filter(item=>item.status==='INFRA').length;
  return {category,cases:group.length,passed,failed:group.length-passed-infra,infra,score:Math.round(passed/group.length*1000)/10};
});
const passed=results.filter(item=>item.status==='PASS').length,infra=results.filter(item=>item.status==='INFRA').length,failed=results.length-passed-infra,score=results.length?Math.round(passed/results.length*1000)/10:0;
const report={generatedAt:new Date().toISOString(),baseUrl,summary:{cases:results.length,passed,failed,infra,score,gate:failed===0&&infra===0},categories,results};
const rows=categories.map(item=>`| ${item.category} | ${item.cases} | ${item.passed} | ${item.failed} | ${item.infra} | ${item.score}% |`).join('\n');
const failures=results.filter(item=>item.status!=='PASS').map(item=>`### ${item.id} — ${item.category}\n\n- Input: ${item.sourceText||item.message}\n- Kết quả: ${item.status}\n- Lỗi: ${item.infraError||item.checks.filter(check=>!check.pass).map(check=>`${check.name}: ${check.details}`).join('; ')}${item.actual?`\n- Bản dịch thực tế: ${item.actual.translatedText}`:''}`).join('\n\n');
const markdown=`# TravelOS text chat + Voice Live Translate eval\n\n- Thời điểm: ${report.generatedAt}\n- Translate path: **Gemini Voice Live streaming**\n- Tổng: **${results.length}**\n- Đạt: **${passed}**\n- Lỗi: **${failed}**\n- Infra: **${infra}**\n- Điểm: **${score}%**\n- Gate: **${report.summary.gate?'PASS':'FAIL'}**\n\n| Nhóm | Case | Đạt | Lỗi | Infra | Điểm |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\n## Case chưa đạt\n\n${failures||'Không có.'}\n`;
const reportsDir=path.join(here,'reports');await mkdir(reportsDir,{recursive:true});
await Promise.all([
  writeFile(path.join(reportsDir,`${reportName}.json`),`${JSON.stringify(report,null,2)}\n`),
  writeFile(path.join(reportsDir,`${reportName}.md`),markdown)
]);
console.log(`\nChat + translate eval: ${passed}/${results.length} pass · ${failed} fail · ${infra} infra · ${score}%`);
console.log(`Report: ${path.join(reportsDir,`${reportName}.md`)}`);
if(failed||infra)process.exitCode=1;
