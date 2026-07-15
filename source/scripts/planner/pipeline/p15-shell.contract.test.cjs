"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const routesPath = path.join(__dirname, "../../../constants/routes.ts");
const layoutPath = path.join(__dirname, "../../../app/(tabs)/_layout.tsx");
const indexPath = path.join(__dirname, "../../../app/(tabs)/index.tsx");

test("P15-A routes expose planner-first primary tabs", () => {
  const text = fs.readFileSync(routesPath, "utf8");
  const primaryBlock = text.match(
    /export const PRIMARY_TAB_ROUTE_NAMES = \[([\s\S]*?)\] as const/
  );
  assert.ok(primaryBlock, "PRIMARY_TAB_ROUTE_NAMES block missing");
  const block = primaryBlock[1];
  assert.match(block, /transferPlanner/);
  assert.match(block, /resources/);
  assert.match(block, /calendar/);
  assert.match(block, /profile/);
  assert.doesNotMatch(block, /\.home\b/);
  assert.doesNotMatch(block, /\.settings\b/);
  assert.match(text, /transferPlanner:\s*"resources\/transfer-planner"/);
  assert.match(text, /calendar:\s*"calendar"/);
});

test("P15-A/B tab layout shows planner/resources/calendar/profile; Home redirects", () => {
  const layout = fs.readFileSync(layoutPath, "utf8");
  assert.match(layout, /name="resources\/transfer-planner"/);
  assert.match(layout, /name="resources\/index"/);
  assert.match(layout, /name="calendar"/);
  assert.match(layout, /name="profile"/);
  assert.doesNotMatch(layout, /name="index"\s*\n\s*options=\{buildTabOptions\(titles\.home/);
  assert.doesNotMatch(layout, /name="settings"\s*\n\s*options=\{buildTabOptions\(titles\.settings/);

  const index = fs.readFileSync(indexPath, "utf8");
  assert.match(index, /Redirect/);
  assert.match(index, /ROUTES\.transferPlanner/);
  assert.doesNotMatch(index, /HomePage/);
});
