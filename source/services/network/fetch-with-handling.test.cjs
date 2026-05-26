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

const {
  AppFetchError,
  fetchJsonWithHandling,
  fetchWithHandling,
  sanitizeFetchErrorBody,
} = require("@/services/network/fetch-with-handling");
const {
  registerFetchContractTests,
} = require("../../scripts/lib/fetch-contract-test-matrix.cjs");

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

registerFetchContractTests(test, {
  ErrorClass: AppFetchError,
  fetchWithContract: (url, options, fetchImpl) =>
    fetchWithHandling(url, {
      ...options,
      fetchImpl,
    }),
  name: "app fetch helper",
  sanitizeBody: sanitizeFetchErrorBody,
});

test("fetchJsonWithHandling retries transient HTTP responses", async () => {
  const calls = [];
  global.fetch = async (input, init) => {
    calls.push({ input, init });
    if (calls.length === 1) {
      return new Response("temporary", {
        status: 503,
        statusText: "Service Unavailable",
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const data = await fetchJsonWithHandling("https://example.edu/data.json", {
    operation: "Test JSON fetch",
    retries: 1,
    retryDelayMs: 0,
    timeoutMs: 500,
  });

  assert.deepEqual(data, { ok: true });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.init?.signal));
});

test("fetchWithHandling rejects timeout aborts as AppFetchError", async () => {
  global.fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  await assert.rejects(
    () =>
      fetchWithHandling("https://example.edu/hangs", {
        operation: "Hanging request",
        timeoutMs: 10,
      }),
    (error) =>
      error instanceof AppFetchError &&
      error.isTimeout &&
      error.message === "Hanging request timed out."
  );
});

test("fetchWithHandling sanitizes HTML error bodies", async () => {
  global.fetch = async () =>
    new Response("<!doctype html><html><body>nope</body></html>", {
      status: 500,
      statusText: "Internal Server Error",
    });

  await assert.rejects(
    () =>
      fetchWithHandling("https://example.edu/error", {
        operation: "HTML error request",
      }),
    (error) =>
      error instanceof AppFetchError &&
      error.status === 500 &&
      error.bodyText === "[html-error-body]"
  );
});
