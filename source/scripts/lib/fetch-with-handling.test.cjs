const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ScriptFetchError,
  fetchArrayBufferWithHandling,
  fetchTextWithHandling,
  fetchWithHandling,
  sanitizeFetchBody,
} = require("./fetch-with-handling.cjs");
const {
  registerFetchContractTests,
} = require("./fetch-contract-test-matrix.cjs");

registerFetchContractTests(test, {
  ErrorClass: ScriptFetchError,
  fetchWithContract: (url, options, fetchImpl) =>
    fetchWithHandling(url, {
      ...options,
      fetchImpl,
    }),
  name: "script fetch helper",
  sanitizeBody: sanitizeFetchBody,
});

test("fetchWithHandling can return non-ok responses for source audits", async () => {
  const response = {
    ok: false,
    status: 404,
    statusText: "Not Found",
    text: async () => "missing",
  };

  const result = await fetchWithHandling("https://example.edu/missing", {
    fetchImpl: async () => response,
    throwOnHttpError: false,
  });

  assert.equal(result, response);
});

test("fetchWithHandling throws sanitized retryable HTTP errors by default", async () => {
  await assert.rejects(
    () =>
      fetchWithHandling("https://example.edu/error", {
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          statusText: "Unavailable",
          text: async () => "<!doctype html><title>nope</title>",
        }),
        retries: 0,
      }),
    (error) => {
      assert.ok(error instanceof ScriptFetchError);
      assert.equal(error.status, 503);
      assert.equal(error.bodyText, "[html-error-body]");
      assert.equal(error.isRetryable, true);
      return true;
    }
  );
});

test("fetch text and array buffer helpers read successful bodies", async () => {
  const text = await fetchTextWithHandling("https://example.edu/text", {
    fetchImpl: async () => ({
      ok: true,
      text: async () => "hello",
    }),
  });
  const arrayBuffer = await fetchArrayBufferWithHandling("https://example.edu/binary", {
    fetchImpl: async () => ({
      ok: true,
      arrayBuffer: async () => Buffer.from("bytes"),
    }),
  });

  assert.equal(text, "hello");
  assert.equal(Buffer.from(arrayBuffer).toString("utf8"), "bytes");
  assert.equal(sanitizeFetchBody("<html><body>bad</body></html>"), "[html-error-body]");
});
