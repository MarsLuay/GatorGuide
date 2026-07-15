/**
 * Planner V2 constraint helpers.
 */
require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: { "@/*": ["./*"] },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  coerceIntendedTransferQuarter,
  formatIntendedTransferQuarterLabel,
  clampPreferredLoad,
  buildIntendedTransferQuarterId,
} = require("./planner-v2-constraints.ts");

test("coerceIntendedTransferQuarter maps Fall 2027 and ISO dates to season ids", () => {
  assert.equal(coerceIntendedTransferQuarter("Fall 2027"), "2027-fall");
  assert.equal(coerceIntendedTransferQuarter("2027-fall"), "2027-fall");
  assert.equal(coerceIntendedTransferQuarter("2027-09-15"), "2027-fall");
  assert.equal(coerceIntendedTransferQuarter("autumn 2026"), "2026-fall");
});

test("formatIntendedTransferQuarterLabel renders human quarter labels", () => {
  assert.equal(formatIntendedTransferQuarterLabel("2027-fall"), "Fall 2027");
  assert.equal(formatIntendedTransferQuarterLabel("2026-winter"), "Winter 2026");
});

test("clampPreferredLoad stays in 1-4", () => {
  assert.equal(clampPreferredLoad(null), 3);
  assert.equal(clampPreferredLoad(1), 1);
  assert.equal(clampPreferredLoad(9), 4);
});

test("buildIntendedTransferQuarterId builds stable ids", () => {
  assert.equal(buildIntendedTransferQuarterId(2027, "fall"), "2027-fall");
});
