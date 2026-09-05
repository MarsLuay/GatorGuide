import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getMatchColorClass } from "./match-color";

describe("getMatchColorClass", () => {
  it("returns text-emerald-600 for high scores (70-100)", () => {
    assert.equal(getMatchColorClass(70), "text-emerald-600");
    assert.equal(getMatchColorClass(85), "text-emerald-600");
    assert.equal(getMatchColorClass(100), "text-emerald-600");
  });

  it("returns text-emerald-600 for medium scores (40-69)", () => {
    assert.equal(getMatchColorClass(40), "text-emerald-600");
    assert.equal(getMatchColorClass(55), "text-emerald-600");
    assert.equal(getMatchColorClass(69), "text-emerald-600");
  });

  it("returns text-red-600 for low scores (0-39)", () => {
    assert.equal(getMatchColorClass(0), "text-red-600");
    assert.equal(getMatchColorClass(20), "text-red-600");
    assert.equal(getMatchColorClass(39), "text-red-600");
  });

  it("returns text-gray-500 for missing or invalid scores", () => {
    assert.equal(getMatchColorClass(null), "text-gray-500");
    assert.equal(getMatchColorClass(undefined), "text-gray-500");
    assert.equal(getMatchColorClass(NaN), "text-gray-500");
  });
});
