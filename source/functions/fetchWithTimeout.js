const {
  DEFAULT_FETCH_RETRY_STATUSES,
  createFetchErrorClass,
  createFetchHelper,
  sanitizeFetchBody,
} = require("./fetch-contract.cjs");

const DEFAULT_TIMEOUT_MS = 15000;

const FunctionFetchError = createFetchErrorClass("FunctionFetchError", "Function fetch");
const runFetchWithTimeout = createFetchHelper({
  ErrorClass: FunctionFetchError,
  defaultFetchImpl: () => globalThis.fetch,
  defaultOperation: "Function fetch",
  defaultRetries: 0,
  defaultRetryDelayMs: 0,
  defaultRetryStatuses: DEFAULT_FETCH_RETRY_STATUSES,
  defaultThrowOnHttpError: false,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
});

async function fetchWithTimeout(input, options = {}) {
  const { timeoutErrorFactory, ...fetchOptions } = options;

  try {
    return await runFetchWithTimeout(input, fetchOptions);
  } catch (error) {
    if (isFunctionFetchTimeout(error) && typeof timeoutErrorFactory === "function") {
      throw timeoutErrorFactory(error);
    }
    throw error;
  }
}

function isFunctionFetchTimeout(error) {
  return error instanceof FunctionFetchError && error.isTimeout;
}

module.exports = {
  FunctionFetchError,
  fetchWithTimeout,
  isFunctionFetchTimeout,
  sanitizeFetchBody,
};
