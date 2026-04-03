import {
  TRANSFER_PLANNER_CAMPUSES,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  resolveTransferPlannerMajorPlan,
} from "../constants/transfer-planner-source";

type Row = {
  campusId: string;
  campusTitle: string;
  majorId: string;
  majorTitle: string;
  pathwayId: string | null;
  pathwayLabel: string | null;
  sourceType: string;
};

const rows: Row[] = [];

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
        rows.push({
          campusId: campus.id,
          campusTitle: campus.title,
          majorId: plan.id,
          majorTitle: plan.title,
          pathwayId,
          pathwayLabel: plan.selectedPathwayLabel ?? null,
          sourceType: plan.sourceType,
        });
      }
    }
  }
}

const byCampus = new Map<string, Row[]>();
for (const row of rows) {
  const key = `${row.campusId} (${row.campusTitle})`;
  const list = byCampus.get(key) ?? [];
  list.push(row);
  byCampus.set(key, list);
}

console.log(`TOTAL_UNSTRUCTURED=${rows.length}`);
for (const [campusKey, list] of byCampus) {
  console.log(`\\n${campusKey}: ${list.length}`);
  for (const row of list.sort((a, b) => a.majorTitle.localeCompare(b.majorTitle) || String(a.pathwayLabel).localeCompare(String(b.pathwayLabel)))) {
    const pathwayText = row.pathwayLabel ? ` [pathway: ${row.pathwayLabel}]` : "";
    console.log(`- ${row.majorTitle}${pathwayText} | majorId=${row.majorId} | sourceType=${row.sourceType}`);
  }
}
