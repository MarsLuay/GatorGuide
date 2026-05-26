const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FunctionFetchError,
  fetchWithTimeout,
  isFunctionFetchTimeout,
  sanitizeFetchBody,
} = require("./fetchWithTimeout");
const {
  registerFetchContractTests,
} = require("../scripts/lib/fetch-contract-test-matrix.cjs");

registerFetchContractTests(test, {
  ErrorClass: FunctionFetchError,
  fetchWithContract: (url, options, fetchImpl) =>
    fetchWithTimeout(url, {
      ...options,
      fetchImpl,
    }),
  name: "functions fetch helper",
  sanitizeBody: sanitizeFetchBody,
});

test("fetchWithTimeout passes timeout signal and user agent", async () => {
  let captured = null;
  const response = { ok: true };

  const result = await fetchWithTimeout("https://example.edu/api", {
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response;
    },
    headers: { accept: "application/json" },
    timeoutMs: 1000,
    userAgent: "GatorGuideFunctionsTest/1.0",
  });

  assert.equal(result, response);
  assert.equal(captured.url, "https://example.edu/api");
  assert.equal(captured.options.headers.accept, "application/json");
  assert.equal(captured.options.headers["user-agent"], "GatorGuideFunctionsTest/1.0");
  assert.equal(typeof captured.options.signal?.aborted, "boolean");
});

test("fetchWithTimeout classifies aborts as timeout errors", async () => {
  await assert.rejects(
    () =>
      fetchWithTimeout("https://example.edu/hangs", {
        fetchImpl: async (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
        operation: "Test request",
        timeoutMs: 5,
      }),
    (error) => {
      assert.ok(error instanceof FunctionFetchError);
      assert.equal(isFunctionFetchTimeout(error), true);
      assert.equal(error.operation, "Test request");
      return true;
    }
  );
});

test("fetchWithTimeout can translate timeout errors at the Functions adapter boundary", async () => {
  await assert.rejects(
    () =>
      fetchWithTimeout("https://example.edu/hangs", {
        fetchImpl: async (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
        operation: "Callable upstream request",
        timeoutErrorFactory: (error) => {
          const timeoutError = new Error("Callable request timed out.");
          timeoutError.status = 504;
          timeoutError.cause = error;
          return timeoutError;
        },
        timeoutMs: 5,
      }),
    (error) => {
      assert.equal(error.message, "Callable request timed out.");
      assert.equal(error.status, 504);
      assert.ok(error.cause instanceof FunctionFetchError);
      assert.equal(isFunctionFetchTimeout(error.cause), true);
      return true;
    }
  );
});
