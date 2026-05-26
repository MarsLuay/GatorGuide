const assert = require("node:assert/strict");

function createResponse({ ok, status = 200, statusText = "OK", text = "" }) {
  return {
    ok,
    status,
    statusText,
    text: async () => text,
  };
}

function createAbortError() {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

function getHeaderValue(headers, name) {
  const normalizedName = String(name).toLowerCase();

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name);
  }

  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => String(key).toLowerCase() === normalizedName);
    return entry ? entry[1] : undefined;
  }

  return headers?.[name] ?? headers?.[normalizedName];
}

function registerFetchContractTests(test, contract) {
  const {
    ErrorClass,
    fetchWithContract,
    name,
    sanitizeBody,
  } = contract;

  test(`${name}: fetch contract forwards headers and a timeout signal`, async () => {
    let captured = null;
    const response = createResponse({ ok: true });

    const result = await fetchWithContract(
      "https://example.edu/api",
      {
        headers: { accept: "application/json" },
        timeoutMs: 1000,
        userAgent: "GatorGuideFetchContractTest/1.0",
      },
      async (input, init) => {
        captured = { input, init };
        return response;
      }
    );

    assert.equal(result, response);
    assert.equal(captured.input, "https://example.edu/api");
    assert.equal(getHeaderValue(captured.init.headers, "accept"), "application/json");
    assert.equal(
      getHeaderValue(captured.init.headers, "user-agent"),
      "GatorGuideFetchContractTest/1.0"
    );
    assert.equal(typeof captured.init.signal?.aborted, "boolean");
  });

  test(`${name}: fetch contract normalizes sanitized HTTP errors`, async () => {
    await assert.rejects(
      () =>
        fetchWithContract(
          "https://example.edu/error",
          {
            operation: "Contract HTTP request",
            retries: 0,
            throwOnHttpError: true,
            timeoutMs: 1000,
          },
          async () =>
            createResponse({
              ok: false,
              status: 503,
              statusText: "Service Unavailable",
              text: "<!doctype html><title>temporarily down</title>",
            })
        ),
      (error) => {
        assert.ok(error instanceof ErrorClass);
        assert.equal(error.status, 503);
        assert.equal(error.statusText, "Service Unavailable");
        assert.equal(error.bodyText, "[html-error-body]");
        assert.equal(error.isRetryable, true);
        assert.equal(error.isTimeout, false);
        assert.equal(error.attempts, 1);
        assert.equal(error.operation, "Contract HTTP request");
        assert.equal(error.url, "https://example.edu/error");
        return true;
      }
    );
  });

  test(`${name}: fetch contract classifies timeouts`, async () => {
    await assert.rejects(
      () =>
        fetchWithContract(
          "https://example.edu/hangs",
          {
            operation: "Contract timeout request",
            retries: 0,
            timeoutMs: 5,
          },
          async (_input, init) =>
            new Promise((_resolve, reject) => {
              init.signal.addEventListener("abort", () => reject(createAbortError()));
            })
        ),
      (error) => {
        assert.ok(error instanceof ErrorClass);
        assert.equal(error.isTimeout, true);
        assert.equal(error.isRetryable, true);
        assert.equal(error.attempts, 1);
        assert.equal(error.operation, "Contract timeout request");
        assert.equal(error.url, "https://example.edu/hangs");
        return true;
      }
    );
  });

  test(`${name}: fetch contract retries retryable HTTP failures`, async () => {
    let calls = 0;
    const response = await fetchWithContract(
      "https://example.edu/retry",
      {
        operation: "Contract retry request",
        retries: 1,
        retryDelayMs: 0,
        throwOnHttpError: true,
        timeoutMs: 1000,
      },
      async () => {
        calls += 1;
        if (calls === 1) {
          return createResponse({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            text: "temporary",
          });
        }
        return createResponse({ ok: true });
      }
    );

    assert.equal(calls, 2);
    assert.equal(response.ok, true);
  });

  test(`${name}: fetch contract uses the shared body sanitizer rule`, () => {
    assert.equal(sanitizeBody("<html><body>bad</body></html>"), "[html-error-body]");
    assert.equal(sanitizeBody(" plain error "), "plain error");
  });
}

module.exports = {
  createResponse,
  registerFetchContractTests,
};
