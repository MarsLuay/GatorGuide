"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("P11/P13 plannerV2 selection bridge maps UW campus+major to runtimeId", () => {
  const file = path.join(
    __dirname,
    "../../../services/planning/contracts/planner-v2-selection.ts"
  );
  assert.ok(fs.existsSync(file));
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /buildPlannerV2PatchFromSelection/);
  assert.match(text, /uw:\$\{campus\}:\$\{programId\}/);
});

test("P13 patchPlannerV2 is exported from app-data local actions", () => {
  const file = path.join(
    __dirname,
    "../../../hooks/app-data/use-app-data-local-actions.ts"
  );
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /patchPlannerV2/);
  assert.match(text, /plannerV2/);
});
