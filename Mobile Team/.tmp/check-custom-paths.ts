import {
  TRANSFER_PLANNER_CAMPUSES,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  resolveTransferPlannerMajorPlan,
  getTransferPlannerTrack,
} from "../constants/transfer-planner-source";

type Row = {
  campus: string;
  major: string;
  pathway: string | null;
  sourceType: string;
  bestTrackId: string | null;
  hasTrackMatch: boolean;
  hasGrcCourseList: boolean;
  hasGrcGuidance: boolean;
};

const rows: Row[] = [];

for (const campus of TRANSFER_PLANNER_CAMPUSES) {
  for (const major of getTransferPlannerMajorsForCampus(campus.id)) {
    const pathways = getTransferPlannerPathwaysForPlan(major);
    const pathwayIds = pathways.length ? pathways.map((p) => p.id) : [null];

    for (const pathwayId of pathwayIds) {
      const plan = resolveTransferPlannerMajorPlan(major, pathwayId);
      if (!plan) continue;
      const track = getTransferPlannerTrack(plan.bestTrackId ?? null);
      rows.push({
        campus: campus.title,
        major: plan.title,
        pathway: plan.selectedPathwayLabel ?? null,
        sourceType: plan.sourceType,
        bestTrackId: plan.bestTrackId ?? null,
        hasTrackMatch: !!track,
        hasGrcCourseList: (plan.grcCourseList ?? []).length > 0,
        hasGrcGuidance: !!String(plan.grcCourseListGuidance ?? "").trim(),
      });
    }
  }
}

const custom = rows.filter((r) => !r.hasTrackMatch);
const customWithList = custom.filter((r) => r.hasGrcCourseList);
const customGuidanceOnly = custom.filter((r) => !r.hasGrcCourseList && r.hasGrcGuidance);
const customNeither = custom.filter((r) => !r.hasGrcCourseList && !r.hasGrcGuidance);

console.log(`TOTAL_PLANS=${rows.length}`);
console.log(`CUSTOM_TRACK_DISPLAY=${custom.length}`);
console.log(`CUSTOM_WITH_DIRECT_GRC_LIST=${customWithList.length}`);
console.log(`CUSTOM_GUIDANCE_ONLY=${customGuidanceOnly.length}`);
console.log(`CUSTOM_NEITHER=${customNeither.length}`);

const sample = customWithList.slice(0, 20);
console.log("\nSAMPLE_CUSTOM_WITH_DIRECT_GRC_LIST:");
for (const row of sample) {
  const p = row.pathway ? ` [${row.pathway}]` : "";
  console.log(`- ${row.campus}: ${row.major}${p} | source=${row.sourceType} | bestTrackId=${row.bestTrackId}`);
}

const byCampus = new Map<string, { total: number; withList: number; guidanceOnly: number }>();
for (const row of custom) {
  const current = byCampus.get(row.campus) ?? { total: 0, withList: 0, guidanceOnly: 0 };
  current.total += 1;
  if (row.hasGrcCourseList) current.withList += 1;
  if (!row.hasGrcCourseList && row.hasGrcGuidance) current.guidanceOnly += 1;
  byCampus.set(row.campus, current);
}

console.log("\nCUSTOM_BY_CAMPUS:");
for (const [campus, stats] of byCampus) {
  console.log(`- ${campus}: total=${stats.total}, withDirectList=${stats.withList}, guidanceOnly=${stats.guidanceOnly}`);
}
