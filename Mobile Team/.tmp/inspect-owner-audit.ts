const source = require("./constants/transfer-planner-source");
const plans = source.TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS;
const bad = [];
for (const plan of plans) {
  const planEntries = source.getTransferPlannerSourceManifestEntriesForPlan(plan.id, null);
  const planPrimary = source.getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, null);
  if (planEntries.length && !planPrimary) {
    bad.push({
      ownerId: plan.id,
      title: plan.title,
      links: planEntries.map((e) => ({ label: e.label, url: e.url, role: e.role })),
    });
  }

  for (const pathway of plan.pathways ?? []) {
    const entries = source.getTransferPlannerSourceManifestEntriesForPlan(plan.id, pathway.id);
    const primary = source.getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, pathway.id);
    if (entries.length && !primary) {
      bad.push({
        ownerId: `${plan.id}:pathway:${pathway.id}`,
        title: `${plan.title} - ${pathway.label}`,
        links: entries.map((e) => ({ label: e.label, url: e.url, role: e.role })),
      });
    }
  }
}

console.log(JSON.stringify(bad, null, 2));
