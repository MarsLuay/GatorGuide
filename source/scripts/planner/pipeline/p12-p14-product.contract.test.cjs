"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createCourseInstanceId,
  applyLock,
  moveCourse,
} = require("./runtime/move-lock.cjs");

test("P12 move/lock uses stable instance ids and respects locks", () => {
  const id = createCourseInstanceId({
    code: "MATH& 151",
    quarterKey: "2026-fall",
  });
  assert.equal(id, "MATH&151@2026-fall#0");
  let plan = {
    quarters: [
      {
        key: "2026-fall",
        courses: [{ code: "MATH&151", instanceId: id }],
      },
    ],
    locks: [],
  };
  const moved = moveCourse(plan, id, "2027-winter");
  assert.equal(moved.ok, true);
  plan = applyLock(moved.plan, moved.plan.quarters[1].courses[0].instanceId);
  const blocked = moveCourse(
    plan,
    plan.quarters[1].courses[0].instanceId,
    "2027-spring"
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.conflict, "locked");
});

test("P14 removal inventory report exists for deferred delete", () => {
  const report = path.join(
    __dirname,
    "../../../.tmp/reports/p00-c-removed-feature-inventory.md"
  );
  assert.ok(
    fs.existsSync(report),
    "P00-C inventory required before P14 deletion wave"
  );
  const inventory = fs.readFileSync(report, "utf8");
  const readiness = fs.readFileSync(
    path.join(__dirname, "../../../.tmp/reports/p14-removal-readiness.md"),
    "utf8"
  );
  for (const requiredCategory of [
    "Saved Colleges",
    "Compare",
    "Cost Calculator",
    "AI Stack",
    "Roadmap Generation",
    "Vercel Analytics",
  ]) {
    assert.ok(
      inventory.includes(requiredCategory) || readiness.includes(requiredCategory),
      `P14 inventory must list ${requiredCategory}`
    );
  }
});
