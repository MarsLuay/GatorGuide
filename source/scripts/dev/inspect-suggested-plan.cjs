/* Inspect suggested quarter plan for a specific GRC track (AAA Accounting)
 * Usage: node scripts/dev/inspect-suggested-plan.cjs
 */

const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "Node16",
  moduleResolution: "node16",
  jsx: "react-jsx",
  baseUrl: ".",
  paths: { "@/*": ["./*"] },
});

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const { buildSuggestedQuarterPlan } = require("../../services/planning/transfer-planner.service");
const { TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS } = require("../../constants/transfer-planner-source/grc-associate-tracks.generated");

const trackId = "grc-associate-business-entrepreneurship-accounting-aaa";
const track = TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS.find((t) => t.id === trackId);
if (!track) {
  console.error("Track not found:", trackId);
  process.exit(2);
}

const plans = buildSuggestedQuarterPlan({
  plan: null,
  applicationStatuses: [],
  beforeEnrollmentStatuses: [],
  stayAtGrcStatuses: [],
  completedCourses: [],
  track,
  referenceDate: new Date("2026-05-01"),
  includeStayAtGrcCourses: true,
});

console.log(JSON.stringify(plans, null, 2));
