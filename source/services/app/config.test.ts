import assert from "node:assert/strict";
import { test, describe, beforeEach, afterEach } from "node:test";
import { API_CONFIG, isStubMode, hasCollegeScorecardApiKey } from "./config";

describe("config", () => {
  let originalConfig: { useStubData: boolean; collegeScorecardApiKey: string | undefined };

  beforeEach(() => {
    // Save original state of API_CONFIG properties we modify
    originalConfig = {
      useStubData: API_CONFIG.useStubData,
      collegeScorecardApiKey: API_CONFIG.collegeScorecard.apiKey,
    };
  });

  afterEach(() => {
    // Restore original state
    API_CONFIG.useStubData = originalConfig.useStubData;
    API_CONFIG.collegeScorecard.apiKey = originalConfig.collegeScorecardApiKey;
  });

  describe("isStubMode", () => {
    test("returns true when useStubData is true", () => {
      API_CONFIG.useStubData = true;
      assert.equal(isStubMode(), true);
    });

    test("returns false when useStubData is false", () => {
      API_CONFIG.useStubData = false;
      assert.equal(isStubMode(), false);
    });
  });

  describe("hasCollegeScorecardApiKey", () => {
    test("returns false when apiKey is empty", () => {
      API_CONFIG.collegeScorecard.apiKey = "";
      assert.equal(hasCollegeScorecardApiKey(), false);
    });

    test("returns false when apiKey is only whitespace", () => {
      API_CONFIG.collegeScorecard.apiKey = "   ";
      assert.equal(hasCollegeScorecardApiKey(), false);
    });

    test("returns false when apiKey is undefined", () => {
      API_CONFIG.collegeScorecard.apiKey = undefined as any;
      assert.equal(hasCollegeScorecardApiKey(), false);
    });

    test("returns false when apiKey is null", () => {
      API_CONFIG.collegeScorecard.apiKey = null as any;
      assert.equal(hasCollegeScorecardApiKey(), false);
    });

    test("returns false when apiKey is exactly 'STUB'", () => {
      API_CONFIG.collegeScorecard.apiKey = "STUB";
      assert.equal(hasCollegeScorecardApiKey(), false);
    });

    test("returns false when apiKey is 'stub' (case-insensitive)", () => {
      API_CONFIG.collegeScorecard.apiKey = "stub";
      assert.equal(hasCollegeScorecardApiKey(), false);
    });

    test("returns true when apiKey is a valid string", () => {
      API_CONFIG.collegeScorecard.apiKey = "valid-api-key";
      assert.equal(hasCollegeScorecardApiKey(), true);
    });

    test("returns true when apiKey has surrounding whitespace but is valid", () => {
      API_CONFIG.collegeScorecard.apiKey = "  valid-api-key  ";
      assert.equal(hasCollegeScorecardApiKey(), true);
    });
  });
});
