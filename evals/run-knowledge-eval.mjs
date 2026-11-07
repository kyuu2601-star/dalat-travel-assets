import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {KNOWLEDGE_EVAL_CASES} from './knowledge-cases.mjs';
import {planRequestV3ForEval} from '../worker/src/index.js';
import {compareShadowRoute,shadowRouteTravelRequest} from '../worker/src/bot/request-router.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const sameArray=(left,right)=>left.length===right.length&&left.every((value,index)=>value===right[index]);
const toolsOf=plan=>(plan?.tools||[]).map(tool=>tool?.name).filter(Boolean);

function checksFor(evalCase,router,plan){
  const expected=evalCase.expected,tools=toolsOf(plan),checks=[];
  const add=(name,pass,details)=>checks.push({name,pass:Boolean(pass),details:String(details??'')});
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

const results=[];
for(const evalCase of KNOWLEDGE_EVAL_CASES){
  const predicted=shadowRouteTravelRequest({userMessage:evalCase.userMessage,location:evalCase.userLocation});
  const plan=await planRequestV3ForEval(evalCase.userMessage,[],evalCase.userLocation,null,{});
  const router=compareShadowRoute(predicted,plan),checks=checksFor(evalCase,router,plan),failed=checks.filter(check=>!check.pass);
  results.push({id:evalCase.id,category:evalCase.category,status:failed.length?'FAIL':'PASS',message:evalCase.userMessage,router,plan:{travelIntent:plan.travelIntent,tools:toolsOf(plan),planner:plan.planner},checks});
}

const categories=[...new Set(results.map(item=>item.category))].map(category=>{
  const group=results.filter(item=>item.category===category),passed=group.filter(item=>item.status==='PASS').length;
  return {category,cases:group.length,passed,failed:group.length-passed,score:Math.round(passed/group.length*1000)/10};
});
const passed=results.filter(item=>item.status==='PASS').length,failed=results.length-passed,score=Math.round(passed/results.length*1000)/10;
const report={generatedAt:new Date().toISOString(),summary:{cases:results.length,passed,failed,score,gate:failed===0},categories,results};
const rows=categories.map(item=>`| ${item.category} | ${item.cases} | ${item.passed} | ${item.failed} | ${item.score}% |`).join('\n');
const failures=results.filter(item=>item.status==='FAIL').map(item=>`### ${item.id} — ${item.category}\n\n- Câu: ${item.message}\n- Router: ${item.router.decision} / ${item.router.intentHint} / GPS=${item.router.requiresFreshGps}\n- Planner: ${item.plan.travelIntent} / ${item.plan.tools.join(' → ')||'none'}\n- Lỗi: ${item.checks.filter(check=>!check.pass).map(check=>`${check.name}: ${check.details}`).join('; ')}`).join('\n\n');
const markdown=`# TravelOS bot knowledge eval — 100 case mới\n\n- Thời điểm: ${report.generatedAt}\n- Tổng case: **${results.length}**\n- Đạt: **${passed}**\n- Lỗi: **${failed}**\n- Điểm: **${score}%**\n- Gate: **${report.summary.gate?'PASS':'FAIL'}**\n\n| Nhóm | Case | Đạt | Lỗi | Điểm |\n|---|---:|---:|---:|---:|\n${rows}\n\n## Case lỗi\n\n${failures||'Không có.'}\n`;
const reportsDir=path.join(here,'reports');await mkdir(reportsDir,{recursive:true});
await Promise.all([
  writeFile(path.join(reportsDir,'knowledge-100-latest.json'),`${JSON.stringify(report,null,2)}\n`),
  writeFile(path.join(reportsDir,'knowledge-100-latest.md'),markdown)
]);
console.log(`Knowledge eval: ${passed}/${results.length} pass · ${failed} fail · ${score}% · gate ${report.summary.gate?'PASS':'FAIL'}`);
for(const item of categories)console.log(`${item.category}: ${item.passed}/${item.cases} (${item.score}%)`);
console.log(`Report: ${path.join(reportsDir,'knowledge-100-latest.md')}`);
if(failed)process.exitCode=1;
