"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("P16-D personalized timeline calendar bridge exists with planner/personal targets", () => {
  const file = path.join(
    __dirname,
    "../../../services/deadlines/personalized-timeline-calendar.ts"
  );
  assert.ok(fs.existsSync(file));
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /timelineEntriesToCalendarEntries/);
  assert.match(text, /type: \"planner\"/);
  assert.match(text, /type: \"personal\"/);
  assert.match(text, /if \(entry\.sourceType === \"opportunity\"\) continue/);
});
