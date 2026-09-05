import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MATCH_SCORE_THRESHOLDS,
  normalizeMatchScore,
  formatMatchScore,
  getMatchScoreTier,
  getMatchColorClass,
  getMatchBadgeClass,
} from "./match-color";

describe("match-color utility", () => {
  describe("MATCH_SCORE_THRESHOLDS", () => {
    it("should have correct threshold values", () => {
      assert.equal(MATCH_SCORE_THRESHOLDS.high, 70);
      assert.equal(MATCH_SCORE_THRESHOLDS.medium, 40);
    });

    it("should be frozen", () => {
      assert.ok(Object.isFrozen(MATCH_SCORE_THRESHOLDS));
    });
  });

  describe("normalizeMatchScore", () => {
    it("should handle null and undefined", () => {
      assert.equal(normalizeMatchScore(null), null);
      assert.equal(normalizeMatchScore(undefined), null);
    });

    it("should handle non-finite numbers", () => {
      assert.equal(normalizeMatchScore(NaN), null);
      assert.equal(normalizeMatchScore(Infinity), null);
      assert.equal(normalizeMatchScore(-Infinity), null);
    });

    it("should clamp values below 0 to 0", () => {
      assert.equal(normalizeMatchScore(-10), 0);
      assert.equal(normalizeMatchScore(-0.1), 0);
    });

    it("should clamp values above 100 to 100", () => {
      assert.equal(normalizeMatchScore(105), 100);
      assert.equal(normalizeMatchScore(100.1), 100);
    });

    it("should return valid numbers within range", () => {
      assert.equal(normalizeMatchScore(0), 0);
      assert.equal(normalizeMatchScore(50), 50);
      assert.equal(normalizeMatchScore(100), 100);
      assert.equal(normalizeMatchScore(75.5), 75.5);
    });
  });

  describe("formatMatchScore", () => {
    it("should handle invalid inputs", () => {
      assert.equal(formatMatchScore(null), null);
      assert.equal(formatMatchScore(undefined), null);
      assert.equal(formatMatchScore(NaN), null);
    });

    it("should format and round valid scores", () => {
      assert.equal(formatMatchScore(0), "0%");
      assert.equal(formatMatchScore(50), "50%");
      assert.equal(formatMatchScore(100), "100%");
      assert.equal(formatMatchScore(75.4), "75%");
      assert.equal(formatMatchScore(75.5), "76%");
      assert.equal(formatMatchScore(75.6), "76%");
    });

    it("should format clamped values", () => {
      assert.equal(formatMatchScore(-10), "0%");
      assert.equal(formatMatchScore(110), "100%");
    });
  });

  describe("getMatchScoreTier", () => {
    it("should return unknown for invalid scores", () => {
      assert.equal(getMatchScoreTier(null), "unknown");
      assert.equal(getMatchScoreTier(undefined), "unknown");
      assert.equal(getMatchScoreTier(NaN), "unknown");
    });

    it("should return low for scores below medium threshold", () => {
      assert.equal(getMatchScoreTier(0), "low");
      assert.equal(getMatchScoreTier(39), "low");
      assert.equal(getMatchScoreTier(39.9), "low");
    });

    it("should return medium for scores between medium and high thresholds", () => {
      assert.equal(getMatchScoreTier(40), "medium");
      assert.equal(getMatchScoreTier(55), "medium");
      assert.equal(getMatchScoreTier(69.9), "medium");
    });

    it("should return high for scores above high threshold", () => {
      assert.equal(getMatchScoreTier(70), "high");
      assert.equal(getMatchScoreTier(85), "high");
      assert.equal(getMatchScoreTier(100), "high");
    });
  });

  describe("getMatchColorClass", () => {
    it("should return gray text for unknown tier", () => {
      assert.equal(getMatchColorClass(null), "text-gray-500");
    });

    it("should return red text for low tier", () => {
      assert.equal(getMatchColorClass(39), "text-red-600");
    });

    it("should return emerald text for medium tier", () => {
      assert.equal(getMatchColorClass(50), "text-emerald-600");
    });

    it("should return emerald text for high tier", () => {
      assert.equal(getMatchColorClass(80), "text-emerald-600");
    });
  });

  describe("getMatchBadgeClass", () => {
    it("should return gray badge for unknown tier", () => {
      assert.equal(getMatchBadgeClass(null), "border-gray-400/30 bg-gray-500/10");
    });

    it("should return red badge for low tier", () => {
      assert.equal(getMatchBadgeClass(20), "border-red-400/40 bg-red-500/10");
    });

    it("should return medium emerald badge for medium tier", () => {
      assert.equal(getMatchBadgeClass(50), "border-emerald-300/40 bg-emerald-500/10");
    });

    it("should return strong emerald badge for high tier", () => {
      assert.equal(getMatchBadgeClass(80), "border-emerald-400/40 bg-emerald-500/10");
    });
  });
});
