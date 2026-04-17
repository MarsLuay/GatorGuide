import { getTransferPlannerStudentRuntimeMajorPlan, getTransferPlannerTrack } from '../constants/transfer-planner-source';
const runtimePlan = getTransferPlannerStudentRuntimeMajorPlan('uw-seattle-american-ethnic-studies');
console.log(JSON.stringify({
  bestTrackId: runtimePlan?.bestTrackId ?? null,
  track: runtimePlan?.bestTrackId ? getTransferPlannerTrack(runtimePlan.bestTrackId) : null,
}, null, 2));
