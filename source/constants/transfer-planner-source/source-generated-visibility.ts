export const TRANSFER_PLANNER_STANDALONE_INVENTORY_SUPPRESSED_PLAN_IDS = new Set([
  "uw-seattle-italian",
  "uw-bothell-interactive-media-design",
  "uw-bothell-society-ethics-and-human-behavior",
  "uw-bothell-chemistry-biochemistry",
  "uw-tacoma-computer-science-and-systems-ba",
  "uw-tacoma-computer-science-and-systems-bs",
  "uw-tacoma-interdisciplinary-arts-and-sciences-individually-designed",
]);

export function isTransferPlannerStandaloneInventorySuppressedPlanId(planId: string) {
  return TRANSFER_PLANNER_STANDALONE_INVENTORY_SUPPRESSED_PLAN_IDS.has(planId);
}
