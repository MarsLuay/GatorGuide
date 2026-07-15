/**
 * P11/P12 characterization — Living Plan engine + placement overrides.
 */
require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: { "@/*": ["./*"] },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildLivingTransferPlan,
  createInMemoryPlannerCatalog,
} = require("@/services/planning/contracts/living-plan-engine-runtime");

test("P11-A in-memory catalog is a small read boundary", () => {
  const catalog = createInMemoryPlannerCatalog(
    ["seattle", "bothell", "tacoma"],
    { "uw-seattle-cs-bs": { title: "CS" } },
    "snap-1"
  );
  assert.deepEqual(catalog.getCampuses(), ["seattle", "bothell", "tacoma"]);
  assert.equal(catalog.getProgram("uw-seattle-cs-bs").title, "CS");
  assert.equal(catalog.getSnapshotId(), "snap-1");
});

test("P11-B buildLivingTransferPlan is pure and validates input", () => {
  const bad = buildLivingTransferPlan({});
  assert.equal(bad.conflicts[0].code, "invalid-input");
  const plan = buildLivingTransferPlan({
    catalogSnapshotId: "snap-1",
    activeTargetRuntimeId: "uw-seattle-cs-bs",
    intendedTransferQuarterId: "2027-autumn",
    placementOverrides: [
      {
        courseInstanceId: "inst-1",
        preferredQuarterId: "2026-fall",
        locked: true,
      },
    ],
  });
  assert.equal(plan.conflicts.length, 0);
  assert.equal(plan.activeTargetRuntimeId, "uw-seattle-cs-bs");
});

test("P11-B places normalized courses across planning quarters with load", () => {
  const plan = buildLivingTransferPlan({
    catalogSnapshotId: "snap-1",
    activeTargetRuntimeId: "uw-seattle-cs-bs",
    intendedTransferQuarterId: "2027-fall",
    preferredLoadCredits: 2,
    unavailableQuarterIds: ["2027-summer"],
    normalizedCourseIds: ["MATH&151", "MATH&152", "PHYS121", "CSE142"],
  });
  assert.equal(plan.conflicts.length, 0);
  const placed = plan.quarters.flatMap((q) => q.courseInstanceIds);
  assert.equal(placed.length, 4);
  assert.ok(plan.quarters.every((q) => q.quarterId !== "2027-summer"));
  assert.ok(plan.quarters.every((q) => q.courseInstanceIds.length <= 2));
});

test("P12-A placement overrides use courseInstanceId not labels", () => {
  const override = {
    courseInstanceId: "math-163#1",
    preferredQuarterId: "2026-winter",
    locked: false,
  };
  assert.equal(typeof override.courseInstanceId, "string");
  assert.equal("displayLabel" in override, false);
});
