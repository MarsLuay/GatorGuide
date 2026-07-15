"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("P13 intended-quarter coercion helper exists with Fall YYYY support", () => {
  const file = path.join(
    __dirname,
    "../../../services/planning/contracts/planner-v2-constraints.ts"
  );
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /coerceIntendedTransferQuarter/);
  assert.match(text, /coercePreferredLoad/);
  assert.match(text, /Fall|fall/);
});

test("P13 PlannerConstraintsCard is mounted from TransferPlannerPage", () => {
  const page = path.join(
    __dirname,
    "../../../components/pages/TransferPlannerPage.tsx"
  );
  const text = fs.readFileSync(page, "utf8");
  assert.match(text, /PlannerConstraintsCard/);
  assert.match(text, /handlePreferredLoadChange/);
});
