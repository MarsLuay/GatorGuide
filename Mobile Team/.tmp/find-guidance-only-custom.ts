import {
  TRANSFER_PLANNER_CAMPUSES,
  getTransferPlannerMajorsForCampus,
  getTransferPlannerPathwaysForPlan,
  resolveTransferPlannerMajorPlan,
  getTransferPlannerTrack,
} from "../constants/transfer-planner-source";

for (const campus of TRANSFER_PLANNER_CAMPUSES) {
  for (const major of getTransferPlannerMajorsForCampus(campus.id)) {
    const pathways = getTransferPlannerPathwaysForPlan(major);
    const pathwayIds = pathways.length ? pathways.map((p) => p.id) : [null];
    for (const pathwayId of pathwayIds) {
      const plan = resolveTransferPlannerMajorPlan(major, pathwayId);
      if (!plan) continue;
      const track = getTransferPlannerTrack(plan.bestTrackId ?? null);
      if (track) continue;
      const hasList = (plan.grcCourseList ?? []).length > 0;
      const hasGuidance = !!String(plan.grcCourseListGuidance ?? "").trim();
      if (!hasList && hasGuidance) {
        const p = plan.selectedPathwayLabel ? ` [${plan.selectedPathwayLabel}]` : "";
        console.log(`${campus.title}: ${plan.title}${p} | source=${plan.sourceType}`);
        console.log(`guidance=${plan.grcCourseListGuidance}`);
      }
    }
  }
}
