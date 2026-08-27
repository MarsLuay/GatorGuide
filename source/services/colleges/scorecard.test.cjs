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
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function loadWithMocks(request, parent, isMain) {
  // Mock out error-logging.service to avoid importing deep expo/react-native deps that cause node tests to fail on type-stripping
  if (request === "@/services/logging/error-logging.service") {
    return { errorLoggingService: {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Defer importing to after the module mock is set up
const { buildScorecardUrl } = require("@/services/colleges/scorecard");
const { API_CONFIG } = require("@/services/app/config");

test.describe("buildScorecardUrl", () => {
  let originalBaseUrl;
  let originalApiKey;

  test.beforeEach(() => {
    originalBaseUrl = API_CONFIG.collegeScorecard.baseUrl;
    originalApiKey = API_CONFIG.collegeScorecard.apiKey;
  });

  test.afterEach(() => {
    API_CONFIG.collegeScorecard.baseUrl = originalBaseUrl;
    API_CONFIG.collegeScorecard.apiKey = originalApiKey;
  });

  test.it("should build URL with basic parameters and keys_nested=true", () => {
    API_CONFIG.collegeScorecard.baseUrl = "https://api.example.com/";
    API_CONFIG.collegeScorecard.apiKey = "test_key";

    const url = buildScorecardUrl({ page: "1", limit: "10" });
    assert.ok(url.startsWith("https://api.example.com/schools?"));

    const urlObj = new URL(url);
    assert.strictEqual(urlObj.searchParams.get("page"), "1");
    assert.strictEqual(urlObj.searchParams.get("limit"), "10");
    assert.strictEqual(urlObj.searchParams.get("keys_nested"), "true");
  });

  test.it("should append api_key when present in API_CONFIG", () => {
    API_CONFIG.collegeScorecard.baseUrl = "https://api.example.com";
    API_CONFIG.collegeScorecard.apiKey = "test_key";

    const url = buildScorecardUrl({ param: "value" });
    const urlObj = new URL(url);
    assert.strictEqual(urlObj.searchParams.get("api_key"), "test_key");
  });

  test.it("should omit api_key when key is empty or not present", () => {
    API_CONFIG.collegeScorecard.baseUrl = "https://api.example.com";
    API_CONFIG.collegeScorecard.apiKey = ""; // hasCollegeScorecardApiKey() returns false for this

    const url = buildScorecardUrl({ param: "value" });
    const urlObj = new URL(url);
    assert.strictEqual(urlObj.searchParams.get("api_key"), null);
  });

  test.it("should handle baseUrl with or without trailing slash", () => {
    API_CONFIG.collegeScorecard.baseUrl = "https://api.example.com/test/";
    API_CONFIG.collegeScorecard.apiKey = "";

    const url = buildScorecardUrl({ param: "value" });
    assert.ok(url.startsWith("https://api.example.com/test/schools?"));
  });
});
