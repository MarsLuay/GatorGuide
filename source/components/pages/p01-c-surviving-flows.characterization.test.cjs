/**
 * P01-C characterization: surviving vs removal-bound routes as of Wave 1.
 * Does not edit app-rendered-flows.integration.test.cjs (user dirty).
 */
require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");

const { ROUTES } = require("@/constants/routes");

test("P01-C surviving planner-first surfaces remain addressable", () => {
  for (const key of [
    "tabs",
    "tabsResources",
    "tabsSettings",
    "profile",
    "calendar",
    "transferPlanner",
    "transferEquivalencies",
  ]) {
    assert.equal(typeof ROUTES[key], "string", `ROUTES.${key}`);
    assert.ok(String(ROUTES[key]).length > 0);
  }
});

test("P01-C removal-bound college-discovery routes still exist pre-P14 (inventory lock)", () => {
  for (const key of ["compare", "costCalculator", "savedColleges"]) {
    assert.equal(typeof ROUTES[key], "string", `ROUTES.${key} should exist until removal`);
    assert.ok(String(ROUTES[key]).length > 0);
  }
});
