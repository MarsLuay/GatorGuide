import { test, describe } from "node:test";
import assert from "node:assert";
import { normalizeMatchScore } from "./match-color";

describe("normalizeMatchScore", () => {
  test("returns null for null or undefined", () => {
    assert.strictEqual(normalizeMatchScore(null), null);
    assert.strictEqual(normalizeMatchScore(undefined), null);
  });

  test("returns null for non-finite numbers", () => {
    assert.strictEqual(normalizeMatchScore(NaN), null);
    assert.strictEqual(normalizeMatchScore(Infinity), null);
    assert.strictEqual(normalizeMatchScore(-Infinity), null);
  });

  test("clamps values between 0 and 100", () => {
    assert.strictEqual(normalizeMatchScore(-10), 0);
    assert.strictEqual(normalizeMatchScore(0), 0);
    assert.strictEqual(normalizeMatchScore(50), 50);
    assert.strictEqual(normalizeMatchScore(100), 100);
    assert.strictEqual(normalizeMatchScore(110), 100);
  });

  test("handles floating point numbers", () => {
    assert.strictEqual(normalizeMatchScore(42.5), 42.5);
    assert.strictEqual(normalizeMatchScore(-0.1), 0);
    assert.strictEqual(normalizeMatchScore(100.1), 100);
  });
});
