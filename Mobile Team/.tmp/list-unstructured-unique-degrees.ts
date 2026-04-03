import {
  TRANSFER_PLANNER_CAMPUSES,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  resolveTransferPlannerMajorPlan,
} from "../constants/transfer-planner-source";

type Row = { campusId: string; campusTitle: string; majorId: string; majorTitle: string };
const triggeringRows: Row[] = [];

for (const campus of TRANSFER_PLANNER_CAMPUSES) {
  const majors = getTransferPlannerMajorsForCampus(campus.id);
  for (const major of majors) {
    const pathways = getTransferPlannerPathwaysForPlan(major);
    const pathwayIds = pathways.length ? pathways.map((p) => p.id) : [null];

    for (const pathwayId of pathwayIds) {
      const plan = resolveTransferPlannerMajorPlan(major, pathwayId);
      if (!plan) continue;

      const hasStructured =
        (plan.applicationChecklist?.length ?? 0) > 0 ||
        (plan.beforeEnrollmentChecklist?.length ?? 0) > 0 ||
        (plan.stayAtGrcChecklist?.length ?? 0) > 0;

      if (!hasStructured) {
        triggeringRows.push({
          campusId: campus.id,
          campusTitle: campus.title,
          majorId: plan.id,
          majorTitle: plan.title,
        });
      }
    }
  }
}

const byCampus = new Map<string, Map<string, string>>();
for (const row of triggeringRows) {
  const campusKey = `${row.campusId} (${row.campusTitle})`;
  if (!byCampus.has(campusKey)) byCampus.set(campusKey, new Map<string, string>());
  byCampus.get(campusKey)!.set(row.majorId, row.majorTitle);
}

const totalUnique = [...byCampus.values()].reduce((sum, m) => sum + m.size, 0);
console.log(`TOTAL_UNIQUE_DEGREES=${totalUnique}`);
for (const [campusKey, majorsMap] of byCampus) {
  const majors = [...majorsMap.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
  console.log(`\\n${campusKey}: ${majors.length}`);
  for (const major of majors) {
    console.log(`- ${major.title} | majorId=${major.id}`);
  }
}
