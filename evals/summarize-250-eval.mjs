import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url)),reportsDir=path.join(here,'reports');
const load=async name=>JSON.parse(await readFile(path.join(reportsDir,name),'utf8'));
const [router,live,knowledge]=await Promise.all([
  load('router-expanded-latest.json'),load('live-latest.json'),load('knowledge-100-latest.json')
]);
const oldCases=router.summary.cases+live.summary.cases;
const oldPassed=router.summary.passed+live.summary.passed;
const oldFailed=oldCases-oldPassed;
const totalCases=oldCases+knowledge.summary.cases,totalPassed=oldPassed+knowledge.summary.passed,totalFailed=totalCases-totalPassed;
const score=Math.round(totalPassed/totalCases*1000)/10;
const report={generatedAt:new Date().toISOString(),deployment:'https://ai-test.kyuu2601.workers.dev',workerVersion:'10874878-61eb-430e-afcb-270e04de6543',summary:{cases:totalCases,passed:totalPassed,failed:totalFailed,score},existing150:{cases:oldCases,passed:oldPassed,failed:oldFailed,router:router.summary,live:live.summary},new100:knowledge.summary,flowChangeRequired:[
  'Safety symptoms combined with an explicit nearby doctor/clinic search can be captured by the existing nearby-place branch before SAFETY_HEALTH.',
  'Changing these remaining failures requires execution-priority changes, which were intentionally excluded from this database-only update.'
]};
const markdown=`# TravelOS combined eval — 250 case\n\n- Thời điểm: ${report.generatedAt}\n- Bản public: ${report.deployment}\n- Worker version: ${report.workerVersion}\n- Tổng: **${totalPassed}/${totalCases} đạt (${score}%)**\n\n| Bộ eval | Case | Đạt | Lỗi | Điểm |\n|---|---:|---:|---:|---:|\n| 120 router cũ | ${router.summary.cases} | ${router.summary.passed} | ${router.summary.failed} | ${router.summary.score}% |\n| 30 live cũ | ${live.summary.cases} | ${live.summary.passed} | ${live.summary.failed} | ${live.summary.structuralScore}% structural |\n| 100 knowledge mới | ${knowledge.summary.cases} | ${knowledge.summary.passed} | ${knowledge.summary.failed} | ${knowledge.summary.score}% |\n| **Tổng** | **${totalCases}** | **${totalPassed}** | **${totalFailed}** | **${score}%** |\n\n## Phạm vi giữ nguyên\n\n- Không đổi thứ tự xử lý request.\n- Không đổi API bản đồ, tool, model fallback, prompt trả lời hoặc UI.\n- Router vẫn ở chế độ shadow, không điều khiển luồng thật.\n\n## Lỗi còn lại cần đổi luồng mới xử lý được\n\nMột số câu triệu chứng có kèm yêu cầu “bác sĩ/phòng khám gần…” bị nhánh tìm địa điểm hiện tại bắt trước nhánh SAFETY_HEALTH. Các lỗi này được giữ nguyên và báo thẳng vì yêu cầu lần này chỉ cho phép bổ sung database nhận diện.\n`;
await mkdir(reportsDir,{recursive:true});
await Promise.all([
  writeFile(path.join(reportsDir,'combined-250-latest.json'),`${JSON.stringify(report,null,2)}\n`),
  writeFile(path.join(reportsDir,'combined-250-latest.md'),markdown)
]);
console.log(`Combined eval: ${totalPassed}/${totalCases} pass · ${totalFailed} fail · ${score}%`);
