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
const { mock } = require("node:test");
const Module = require("node:module");

// Need to mock expo and react-native before any imports happen
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === "expo-constants") {
    return { default: { expoConfig: { version: "1.0.0" } } };
  }
  if (request === "expo-modules-core" || request === "react-native") {
    return {
      Platform: { OS: 'web' },
      EventEmitter: class {}
    };
  }
  return originalRequire.apply(this, arguments);
};

const {
  buildScorecardUrl,
  fetchScorecardUrl,
  clearScorecardCache,
} = require("@/services/colleges/scorecard");

const { API_CONFIG } = require("@/services/app/config");
const { errorLoggingService } = require("@/services/logging/error-logging.service");

// Mocking dependencies
test.beforeEach(() => {
  clearScorecardCache();

  // Mock error logging service
  mock.method(errorLoggingService, "captureException", async () => {
    return { status: "dropped", destination: "dropped", entryId: "mock-id" };
  });
});

test.afterEach(() => {
  mock.restoreAll();
});

test("Initialization", () => {
  assert.ok(buildScorecardUrl);
});

test("buildScorecardUrl sets up the API base, parameters, and keys_nested", () => {
  const urlString = buildScorecardUrl({ "school.name": "University of Washington" });
  const url = new URL(urlString);
  assert.equal(url.origin + url.pathname, API_CONFIG.collegeScorecard.baseUrl + "/schools");
  assert.equal(url.searchParams.get("school.name"), "University of Washington");
  assert.equal(url.searchParams.get("keys_nested"), "true");
});

test("buildScorecardUrl includes api_key if configured", () => {
  const originalKey = API_CONFIG.collegeScorecard.apiKey;
  API_CONFIG.collegeScorecard.apiKey = "real_key";

  const urlString = buildScorecardUrl({ "school.name": "UW" });
  const url = new URL(urlString);
  assert.equal(url.searchParams.get("api_key"), "real_key");

  API_CONFIG.collegeScorecard.apiKey = originalKey;
});

test("buildScorecardUrl omits api_key if missing or STUB", () => {
  const originalKey = API_CONFIG.collegeScorecard.apiKey;

  API_CONFIG.collegeScorecard.apiKey = "STUB";
  let urlString = buildScorecardUrl({ "school.name": "UW" });
  let url = new URL(urlString);
  assert.equal(url.searchParams.has("api_key"), false);

  API_CONFIG.collegeScorecard.apiKey = "";
  urlString = buildScorecardUrl({ "school.name": "UW" });
  url = new URL(urlString);
  assert.equal(url.searchParams.has("api_key"), false);

  API_CONFIG.collegeScorecard.apiKey = originalKey;
});

const { AppFetchError } = require("@/services/network/fetch-with-handling");

test("fetchScorecardUrl successfully fetches scorecard data", async () => {
  mock.method(global, "fetch", async (url) => {
    return new Response(JSON.stringify({ results: [{ school: { name: "Test U" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });

  const data = await fetchScorecardUrl("https://example.edu/data.json");
  assert.deepEqual(data, { results: [{ school: { name: "Test U" } }] });
});

test("fetchScorecardUrl uses in-memory cache for consecutive requests", async () => {
  let fetchCount = 0;
  mock.method(global, "fetch", async (url) => {
    fetchCount++;
    return new Response(JSON.stringify({ results: [{ id: fetchCount }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });

  const data1 = await fetchScorecardUrl("https://example.edu/cache_test.json");
  assert.equal(data1.results[0].id, 1);
  assert.equal(fetchCount, 1);

  const data2 = await fetchScorecardUrl("https://example.edu/cache_test.json");
  assert.equal(data2.results[0].id, 1);
  assert.equal(fetchCount, 1); // Fetch shouldn't be called again

  clearScorecardCache();

  const data3 = await fetchScorecardUrl("https://example.edu/cache_test.json");
  assert.equal(data3.results[0].id, 2);
  assert.equal(fetchCount, 2); // Fetch should be called after clearing cache
});

test("fetchScorecardUrl captures exception on error and adds status", async () => {
  mock.method(global, "fetch", async () => {
    return new Response("Not Found", {
      status: 404,
      statusText: "Not Found"
    });
  });

  await assert.rejects(
    () => fetchScorecardUrl("https://example.edu/error.json", 1000),
    (err) => {
      assert.equal(err.message, "Scorecard API error: 404 Not Found Not Found");
      assert.equal(err.status, 404);
      return true;
    }
  );

  assert.equal(errorLoggingService.captureException.mock.calls.length, 1);
  const logArgs = errorLoggingService.captureException.mock.calls[0].arguments;
  assert.equal(logArgs[1].operation, "college-scorecard-fetch");
});

test("fetchScorecardUrl translates transient status codes into temporary errors", async () => {
  mock.method(global, "fetch", async () => {
    return new Response("Gateway Timeout", { status: 504 });
  });

  await assert.rejects(
    () => fetchScorecardUrl("https://example.edu/504.json", 100),
    (err) => {
      assert.equal(err.message, "Scorecard API temporary error (504). Please try again shortly.");
      assert.equal(err.status, 504);
      return true;
    }
  );
});

test("fetchScorecardUrl detects timeout and throws user-friendly message", async () => {
  mock.method(global, "fetch", async (_input, init) => {
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  });

  await assert.rejects(
    () => fetchScorecardUrl("https://example.edu/hang.json", 10),
    (err) => {
      assert.equal(err.message, "Scorecard API request timed out");
      return true;
    }
  );
});

test("fetchScorecardUrl checks for invalid API keys in error response", async () => {
  mock.method(global, "fetch", async () => {
    return new Response(JSON.stringify({ error: { code: "API_KEY_INVALID" } }), { status: 403 });
  });

  await assert.rejects(
    () => fetchScorecardUrl("https://example.edu/auth_error.json", 100),
    (err) => {
      assert.ok(err.message.includes("College Scorecard API key is missing or invalid"));
      return true;
    }
  );
});

test("fetchScorecardUrl matches plaintext invalid api key error using regex", async () => {
  mock.method(global, "fetch", async () => {
    return new Response("Invalid API_KEY", { status: 403, headers: { "content-type": "text/plain" } });
  });

  await assert.rejects(
    () => fetchScorecardUrl("https://example.edu/plain_error.json", 100),
    (err) => {
      assert.ok(err.message.includes("College Scorecard API key is missing or invalid"));
      return true;
    }
  );
});

test("fetchScorecardUrl handles generic non-json error safely", async () => {
  mock.method(global, "fetch", async () => {
    return new Response("<html><body>Some other html error</body></html>", { status: 403 });
  });

  await assert.rejects(
    () => fetchScorecardUrl("https://example.edu/generic_error.json", 100),
    (err) => {
      // With html sanitized out, it throws a standard error with the [html-error-body] placeholder
      assert.ok(err.message.includes("Scorecard API error"));
      return true;
    }
  );
});

test("fetchScorecardUrl redacts API key from logged url", async () => {
  mock.method(global, "fetch", async () => {
    return new Response("Error", { status: 500 });
  });

  await assert.rejects(
    () => fetchScorecardUrl("https://example.edu/test?api_key=SECRET123&param=val", 100)
  );

  assert.equal(errorLoggingService.captureException.mock.calls.length, 1);
  const logMetadata = errorLoggingService.captureException.mock.calls[0].arguments[1].metadata;
  assert.equal(logMetadata.url, "https://example.edu/test?api_key=[redacted]&param=val");
});
