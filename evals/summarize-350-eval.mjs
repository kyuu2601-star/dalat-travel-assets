import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url)),reportsDir=path.join(here,'reports');
const load=async name=>JSON.parse(await readFile(path.join(reportsDir,name),'utf8'));
const [router,live,knowledge,chatTranslate]=await Promise.all([
  load('router-expanded-latest.json'),load('live-latest.json'),load('knowledge-100-latest.json'),load('chat-translate-100-latest.json')
]);
const suites=[
  {name:'120 router',summary:router.summary},{name:'30 live',summary:live.summary},{name:'100 knowledge',summary:knowledge.summary},{name:'100 chat + translate',summary:chatTranslate.summary}
];
const cases=suites.reduce((sum,item)=>sum+item.summary.cases,0),passed=suites.reduce((sum,item)=>sum+item.summary.passed,0);
const infra=suites.reduce((sum,item)=>sum+Number(item.summary.infra||item.summary.infraErrors||0),0),failed=cases-passed-infra,score=Math.round(passed/cases*1000)/10;
const report={generatedAt:new Date().toISOString(),summary:{cases,passed,failed,infra,score,gate:failed===0&&infra===0},suites};
const suiteInfra=item=>Number(item.summary.infra||item.summary.infraErrors||0);
const rows=suites.map(item=>`| ${item.name} | ${item.summary.cases} | ${item.summary.passed} | ${item.summary.failed??item.summary.cases-item.summary.passed-suiteInfra(item)} | ${suiteInfra(item)} | ${item.summary.score??item.summary.structuralScore}% |`).join('\n');
const categories=chatTranslate.categories||[],chat=categories.filter(item=>item.category.startsWith('chat-')).reduce((out,item)=>({cases:out.cases+item.cases,passed:out.passed+item.passed,failed:out.failed+item.failed,infra:out.infra+item.infra}),{cases:0,passed:0,failed:0,infra:0});
const viZh=categories.find(item=>item.category==='translate-vi-zh')||{cases:0,passed:0,failed:0,infra:0};
const zhVi=categories.find(item=>item.category==='translate-zh-vi')||{cases:0,passed:0,failed:0,infra:0};
const markdown=`# TravelOS combined eval — 350 case\n\n- Thời điểm: ${report.generatedAt}\n- Tổng: **${passed}/${cases} đạt (${score}%)**\n- Lỗi: **${failed}**\n- Infra: **${infra}**\n\n| Bộ eval | Case | Đạt | Lỗi | Infra | Điểm |\n|---|---:|---:|---:|---:|---:|\n${rows}\n| **Tổng** | **${cases}** | **${passed}** | **${failed}** | **${infra}** | **${score}%** |\n\n## 100 case mới nhất\n\n- Text Chat: **${chat.passed}/${chat.cases} đạt**, ${chat.failed} lỗi.\n- Voice Live Việt → Trung: **${viZh.passed}/${viZh.cases} đạt**, ${viZh.failed} lỗi nội dung, ${viZh.infra} lỗi hạ tầng.\n- Voice Live Trung → Việt: **${zhVi.passed}/${zhVi.cases} đạt**, ${zhVi.failed} lỗi nội dung, ${zhVi.infra} lỗi hạ tầng.\n\nCác lỗi Voice Live chủ yếu là transcript/bản dịch bị chốt khi câu chưa kết thúc. Các lỗi hạ tầng là phiên Live đã mở nhưng không trả transcript hoặc audio trong thời hạn kiểm thử.\n`;
await mkdir(reportsDir,{recursive:true});
await Promise.all([
  writeFile(path.join(reportsDir,'combined-350-latest.json'),`${JSON.stringify(report,null,2)}\n`),
  writeFile(path.join(reportsDir,'combined-350-latest.md'),markdown)
]);
console.log(`Combined 350 eval: ${passed}/${cases} pass · ${failed} fail · ${infra} infra · ${score}%`);
