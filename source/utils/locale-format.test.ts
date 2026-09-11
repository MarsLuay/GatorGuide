import { describe, it } from "node:test";
import * as assert from "node:assert";
import { normalizeRateValue } from "./locale-format";

describe("normalizeRateValue", () => {
  it("returns null for invalid inputs", () => {
    assert.strictEqual(normalizeRateValue(null), null);
    assert.strictEqual(normalizeRateValue(undefined), null);
    assert.strictEqual(normalizeRateValue(NaN), null);
    assert.strictEqual(normalizeRateValue("50" as any), null);
  });

  it("returns decimals as-is (e.g., 0.5 -> 0.5)", () => {
    assert.strictEqual(normalizeRateValue(0.5), 0.5);
    assert.strictEqual(normalizeRateValue(0.75), 0.75);
    assert.strictEqual(normalizeRateValue(1), 1);
  });

  it("scales down >1 values (e.g., 50 -> 0.5)", () => {
    assert.strictEqual(normalizeRateValue(50), 0.5);
    assert.strictEqual(normalizeRateValue(100), 1);
    assert.strictEqual(normalizeRateValue(1.5), 0.015);
  });

  it("heals double-normalized values (e.g., 0.005 -> 0.5)", () => {
    assert.strictEqual(normalizeRateValue(0.005), 0.5);
    // Floating point math check
    assert.ok(Math.abs(normalizeRateValue(0.009)! - 0.9) < 0.000001);
  });

  it("clamps values between 0 and 1", () => {
    assert.strictEqual(normalizeRateValue(-10), 0);
    assert.strictEqual(normalizeRateValue(150), 1);
  });
});
