import { describe, it } from "node:test";
import assert from "node:assert";
import { getMatchScoreTier } from "./match-color";

describe("getMatchScoreTier", () => {
  it("returns 'unknown' for invalid inputs", () => {
    assert.strictEqual(getMatchScoreTier(null), "unknown");
    assert.strictEqual(getMatchScoreTier(undefined), "unknown");
    assert.strictEqual(getMatchScoreTier(NaN), "unknown");
    assert.strictEqual(getMatchScoreTier(Infinity), "unknown");
    assert.strictEqual(getMatchScoreTier(-Infinity), "unknown");
  });

  it("returns 'high' for scores >= 70", () => {
    assert.strictEqual(getMatchScoreTier(70), "high");
    assert.strictEqual(getMatchScoreTier(85), "high");
    assert.strictEqual(getMatchScoreTier(100), "high");
    assert.strictEqual(getMatchScoreTier(150), "high"); // normalized to 100
  });

  it("returns 'medium' for scores between 40 and 69", () => {
    assert.strictEqual(getMatchScoreTier(40), "medium");
    assert.strictEqual(getMatchScoreTier(55), "medium");
    assert.strictEqual(getMatchScoreTier(69.9), "medium");
  });

  it("returns 'low' for scores < 40", () => {
    assert.strictEqual(getMatchScoreTier(0), "low");
    assert.strictEqual(getMatchScoreTier(20), "low");
    assert.strictEqual(getMatchScoreTier(39.9), "low");
    assert.strictEqual(getMatchScoreTier(-10), "low"); // normalized to 0
  });
});
