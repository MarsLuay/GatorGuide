require('ts-node').register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' }
});
const { TRANSFER_PLANNER_ALL_MAJOR_PLANS } = require('../constants/transfer-planner-data');
const rows = [];
for (const plan of TRANSFER_PLANNER_ALL_MAJOR_PLANS) {
  for (const [sectionName, items] of [['beforeEnrollmentChecklist', plan.beforeEnrollmentChecklist || []], ['stayAtGrcChecklist', plan.stayAtGrcChecklist || []]]) {
    for (const item of items) {
      if (!String(item.note || '').trim()) {
        rows.push({
          planId: plan.id,
          title: plan.title,
          section: sectionName,
          itemId: item.id,
          itemTitle: item.title,
          grcCourses: item.grcCourses,
        });
      }
    }
  }
}
console.log(JSON.stringify(rows, null, 2));
