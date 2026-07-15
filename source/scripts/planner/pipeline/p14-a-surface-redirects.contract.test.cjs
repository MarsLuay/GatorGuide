"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const tabs = path.join(__dirname, "../../../app/(tabs)");

test("P14-A college tool routes redirect to Resources", () => {
  for (const rel of [
    "compare.tsx",
    "cost-calculator.tsx",
    "saved-colleges.tsx",
    "college/[collegeId].tsx",
  ]) {
    const text = fs.readFileSync(path.join(tabs, rel), "utf8");
    assert.match(text, /Redirect/);
    assert.match(text, /tabsResources/);
    assert.doesNotMatch(text, /from \"@\/components\/pages\/(Compare|CostCalculator|SavedColleges)/);
    assert.doesNotMatch(text, /CollegeDetailPage/);
  }
});

test("P14-A resource catalog no longer links retired college tools", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../../data/resource-catalog.json"),
      "utf8"
    )
  );
  const hrefs = [];
  for (const section of catalog) {
    for (const item of section.items || section.resources || []) {
      hrefs.push(String(item.href || item.url || ""));
    }
  }
  assert.equal(hrefs.includes("app://compare"), false);
  assert.equal(hrefs.includes("app://cost-calculator"), false);
  assert.equal(hrefs.includes("app://saved-colleges"), false);
});
