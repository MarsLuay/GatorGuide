const assert = require("node:assert/strict");
const test = require("node:test");
const {
  functionsPath,
  isFetchContractInSync,
  sourcePath,
} = require("./sync-fetch-contract.cjs");

test("Functions fetch contract copy matches the shared app/script source", () => {
  assert.equal(
    isFetchContractInSync(),
    true,
    `${functionsPath} must be regenerated from ${sourcePath}`
  );
});
