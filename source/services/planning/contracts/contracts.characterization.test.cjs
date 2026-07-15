const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const DIR = __dirname;
const REQUIRED = [
  "planner-catalog.ts",
  "living-plan-engine.ts",
  "student-record.ts",
  "personalized-timeline.ts",
  "opportunity-catalog.ts",
  "index.ts",
];

test("P02-B runtime contract files exist", () => {
  for (const file of REQUIRED) {
    assert.ok(fs.existsSync(path.join(DIR, file)), file);
  }
});

test("P02-B ports name Living Transfer Plan domains", () => {
  const index = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");
  for (const needle of [
    "PlannerCatalog",
    "LivingPlanEngine",
    "StudentRecordRepository",
    "PersonalizedTimeline",
    "OpportunityCatalog",
  ]) {
    assert.match(index, new RegExp(needle));
  }
});
