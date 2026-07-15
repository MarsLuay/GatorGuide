"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("P11/P13 transcript course feed + summer unavailable helpers exist", () => {
  const file = path.join(
    __dirname,
    "../../../services/planning/contracts/planner-v2-course-feed.ts"
  );
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /courseCodesFromTranscriptCourses/);
  assert.match(text, /buildUnavailableQuartersFromPrefs/);
  assert.match(text, /allowSummerClasses/);
});

test("P13 plannerV2 state includes normalizedCourseIds", () => {
  const file = path.join(
    __dirname,
    "../../../services/planning/contracts/app-data-v2.ts"
  );
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /normalizedCourseIds/);
});
