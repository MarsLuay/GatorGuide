import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeMatchScore,
  formatMatchScore,
  getMatchScoreTier,
  getMatchColorClass,
  getMatchBadgeClass
} from './match-color.ts';

describe('match-color utilities', () => {
  describe('normalizeMatchScore', () => {
    it('returns null for null, undefined, and non-finite numbers', () => {
      assert.strictEqual(normalizeMatchScore(null), null);
      assert.strictEqual(normalizeMatchScore(undefined), null);
      assert.strictEqual(normalizeMatchScore(NaN), null);
      assert.strictEqual(normalizeMatchScore(Infinity), null);
      assert.strictEqual(normalizeMatchScore(-Infinity), null);
    });

    it('clamps scores between 0 and 100', () => {
      assert.strictEqual(normalizeMatchScore(-10), 0);
      assert.strictEqual(normalizeMatchScore(0), 0);
      assert.strictEqual(normalizeMatchScore(50), 50);
      assert.strictEqual(normalizeMatchScore(100), 100);
      assert.strictEqual(normalizeMatchScore(110), 100);
    });
  });

  describe('formatMatchScore', () => {
    it('returns null for invalid inputs', () => {
      assert.strictEqual(formatMatchScore(null), null);
      assert.strictEqual(formatMatchScore(undefined), null);
    });

    it('formats valid scores as percentages with rounding', () => {
      assert.strictEqual(formatMatchScore(0), '0%');
      assert.strictEqual(formatMatchScore(50), '50%');
      assert.strictEqual(formatMatchScore(100), '100%');
      assert.strictEqual(formatMatchScore(50.4), '50%');
      assert.strictEqual(formatMatchScore(50.5), '51%');
      assert.strictEqual(formatMatchScore(-10), '0%');
      assert.strictEqual(formatMatchScore(150), '100%');
    });
  });

  describe('getMatchScoreTier', () => {
    it('returns "unknown" for invalid inputs', () => {
      assert.strictEqual(getMatchScoreTier(null), 'unknown');
      assert.strictEqual(getMatchScoreTier(undefined), 'unknown');
      assert.strictEqual(getMatchScoreTier(NaN), 'unknown');
    });

    it('returns correct tiers based on thresholds', () => {
      assert.strictEqual(getMatchScoreTier(70), 'high');
      assert.strictEqual(getMatchScoreTier(100), 'high');
      assert.strictEqual(getMatchScoreTier(40), 'medium');
      assert.strictEqual(getMatchScoreTier(69), 'medium');
      assert.strictEqual(getMatchScoreTier(39), 'low');
      assert.strictEqual(getMatchScoreTier(0), 'low');
    });
  });

  describe('getMatchColorClass', () => {
    it('returns default class for unknown tiers', () => {
      assert.strictEqual(getMatchColorClass(null), 'text-gray-500');
    });

    it('returns correct color class based on score', () => {
      assert.strictEqual(getMatchColorClass(70), 'text-emerald-600');
      assert.strictEqual(getMatchColorClass(40), 'text-emerald-600');
      assert.strictEqual(getMatchColorClass(39), 'text-red-600');
    });
  });

  describe('getMatchBadgeClass', () => {
    it('returns default class for unknown tiers', () => {
      assert.strictEqual(getMatchBadgeClass(null), 'border-gray-400/30 bg-gray-500/10');
    });

    it('returns correct badge class based on score', () => {
      assert.strictEqual(getMatchBadgeClass(70), 'border-emerald-400/40 bg-emerald-500/10');
      assert.strictEqual(getMatchBadgeClass(40), 'border-emerald-300/40 bg-emerald-500/10');
      assert.strictEqual(getMatchBadgeClass(39), 'border-red-400/40 bg-red-500/10');
    });
  });
});
