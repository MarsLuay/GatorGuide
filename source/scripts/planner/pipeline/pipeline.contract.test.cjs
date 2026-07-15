const assert = require("node:assert/strict");
const test = require("node:test");
const {
  refreshPlannerData,
  PIPELINE_STAGES,
  createStageRegistry,
} = require("./index.cjs");

test("P02-A pipeline exposes ordered stages", () => {
  assert.deepEqual([...PIPELINE_STAGES], [
    "acquisition",
    "parsing",
    "reconciliation",
    "validation",
    "compilation",
    "reporting",
    "publication",
  ]);
});

test("P02-A refreshPlannerData runs strangler noops by default", async () => {
  const result = await refreshPlannerData({ dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.results.length, PIPELINE_STAGES.length);
  assert.ok(result.results.every((r) => r.status === "noop"));
});

test("P02-A adapters can override a single stage", async () => {
  let saw = false;
  const result = await refreshPlannerData({
    stages: ["validation"],
    adapters: {
      validation: async () => {
        saw = true;
        return { stage: "validation", status: "ok" };
      },
    },
  });
  assert.equal(saw, true);
  assert.equal(result.ok, true);
  assert.equal(result.results[0].status, "ok");
});

test("P02-A createStageRegistry covers every stage", () => {
  const registry = createStageRegistry();
  for (const stage of PIPELINE_STAGES) {
    assert.equal(typeof registry[stage], "function");
  }
});
