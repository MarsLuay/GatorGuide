/**
 * P01-A characterization lock: ensure the trusted planner behavior suite
 * still covers the campus/scenario surface required before refactor.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SCHEDULER_SUITE = path.join(
  __dirname,
  "transfer-planner.scheduler.test.ts"
);

test("P01-A scheduler characterization suite covers required campuses and scenarios", () => {
  const source = fs.readFileSync(SCHEDULER_SUITE, "utf8");
  for (const needle of [
    "Seattle",
    "Bothell",
    "Tacoma",
    "current-course",
    "completed",
    "track",
  ]) {
    assert.match(
      source,
      new RegExp(needle, "i"),
      `scheduler suite must mention ${needle}`
    );
  }
  const testCount = (source.match(/^test\(/gm) || []).length;
  assert.ok(testCount >= 40, `expected dense scheduler suite, found ${testCount}`);
});
