import { getTransferPlannerMajorsForCampus } from "@/constants/transfer-planner-source";
for (const campus of ["uw-seattle", "uw-bothell", "uw-tacoma"] as const) {
  const plans = getTransferPlannerMajorsForCampus(campus);
  const detailed = plans.filter((plan) => plan.coverage === "detailed").length;
  const partial = plans.filter((plan) => plan.coverage === "partial").length;
  console.log(`${campus} ${detailed} ${partial} ${plans.length}`);
}
