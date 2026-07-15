"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCoverageInventory,
  assertCountDomainsSeparated,
} = require("./coverage/inventory.cjs");
const {
  createPlannerCatalogPort,
  buildLivingTransferPlan,
} = require("./runtime/planner-runtime.cjs");

test("P10-A coverage inventory keeps count domains separate", () => {
  const inventory = buildCoverageInventory({
    majorPlans: [
      { id: "a", campus: "seattle", primarySource: "https://example.edu/a" },
      { id: "b", campus: "bothell", primarySource: "https://example.edu/b" },
    ],
    pathways: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    primaryOwners: [{ id: "o1" }, { id: "o2" }],
    sourceOwnerBlocks: [
      { ownerId: "o1" },
      { ownerId: "o1" },
      { ownerId: "o2" },
      { ownerId: "o3" },
    ],
  });
  assert.equal(inventory.counts.majorPlans, 2);
  assert.equal(inventory.counts.pathways, 3);
  assert.equal(inventory.counts.primaryOwners, 2);
  assert.equal(inventory.counts.sourceOwnerBlocks, 4);
  assert.equal(inventory.counts.distinctBlockOwners, 3);
  assert.equal(assertCountDomainsSeparated(inventory), true);
  assert.deepEqual(inventory.duplicateRuntimeIds, []);
});

test("P11 catalog port and living plan engine facade", () => {
  const catalog = createPlannerCatalogPort({
    snapshotId: "snap-1",
    catalogYear: "2025",
    campuses: ["seattle"],
    programs: [{ id: "cs", campus: "seattle" }],
    pathways: [{ id: "main", programId: "cs" }],
    requirements: { cs: { allOf: [] } },
    courses: { "MATH&151": { credits: 5 } },
  });
  assert.equal(catalog.getSnapshotId(), "snap-1");
  assert.equal(catalog.getPrograms("seattle").length, 1);
  assert.equal(catalog.getCourse("MATH&151").credits, 5);

  const plan = buildLivingTransferPlan({
    catalogSnapshotId: "snap-1",
    activeTarget: { campus: "seattle", programId: "cs" },
  });
  assert.equal(plan.kind, "living-transfer-plan");
  assert.equal(plan.status, "noop-strangler");
  assert.throws(() => buildLivingTransferPlan({}));
});
