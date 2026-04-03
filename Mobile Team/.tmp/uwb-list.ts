import { getTransferPlannerMajorsForCampus } from "@/constants/transfer-planner-source";
const plans = getTransferPlannerMajorsForCampus("uw-bothell");
for (const plan of plans) console.log(plan.id + ' | ' + plan.title + ' | ' + plan.coverage);
console.log('count', plans.length);
