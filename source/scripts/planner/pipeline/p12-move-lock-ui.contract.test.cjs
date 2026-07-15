"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("P12 move/lock TS helpers and PlanPlacementCard exist", () => {
  const moveLock = path.join(
    __dirname,
    "../../../services/planning/contracts/move-lock.ts"
  );
  const card = path.join(
    __dirname,
    "../../../components/transfer-planner/PlanPlacementCard.tsx"
  );
  const page = path.join(
    __dirname,
    "../../../components/pages/TransferPlannerPage.tsx"
  );
  assert.ok(fs.existsSync(moveLock));
  assert.ok(fs.existsSync(card));
  const moveText = fs.readFileSync(moveLock, "utf8");
  assert.match(moveText, /toggleLockOverride/);
  assert.match(moveText, /moveCourseOverride/);
  assert.match(fs.readFileSync(page, "utf8"), /PlanPlacementCard/);
});
