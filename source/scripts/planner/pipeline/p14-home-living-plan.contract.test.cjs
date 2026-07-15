"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("P14 Home skips roadmap bootstrap when Living Plan preferred", () => {
  const file = path.join(__dirname, "../../../components/pages/HomePage.tsx");
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /preferLivingPlanHome/);
  assert.match(text, /setDesktopRoadmap\(null\)/);
  assert.doesNotMatch(text, /roadmapService\.getUserRoadmap/);
  assert.doesNotMatch(text, /roadmapService\.ensureUserRoadmap/);
  assert.doesNotMatch(text, /roadmapService\.createInitialRoadmap/);
});

test("P14 profile setup roadmap bootstrap is soft no-op", () => {
  const file = path.join(
    __dirname,
    "../../../components/pages/profile/profile-document-workflow.ts"
  );
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /Soft P14/);
  assert.match(text, /export async function ensureProfileSetupRoadmap/);
  assert.match(text, /return;\s*\}/);
  assert.doesNotMatch(text, /ensureUserRoadmap/);
  assert.doesNotMatch(text, /createInitialRoadmap/);
  assert.doesNotMatch(text, /getUserRoadmap/);
});
