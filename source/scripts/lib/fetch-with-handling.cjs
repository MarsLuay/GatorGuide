const {
  DEFAULT_FETCH_RETRY_STATUSES,
  createFetchErrorClass,
  createFetchHelper,
  sanitizeFetchBody,
} = require("../../services/network/fetch-contract.cjs");
const { createHostRateLimiter } = require("../planner/lib/host-rate-limit.cjs");

const DEFAULT_TIMEOUT_MS = 30000;
const defaultHostRateLimiter = createHostRateLimiter({
  scopeMinDelayMs: 1500,
});

const ScriptFetchError = createFetchErrorClass("ScriptFetchError", "Fetch");
const runFetchWithHandling = createFetchHelper({
  ErrorClass: ScriptFetchError,
  defaultFetchImpl: () => globalThis.fetch,
  defaultFetchOptions: { redirect: "follow" },
  defaultOperation: "Fetch",
  defaultRetries: 1,
  defaultRetryDelayMs: 500,
  defaultRetryStatuses: DEFAULT_FETCH_RETRY_STATUSES,
  defaultThrowOnHttpError: true,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  formatHttpErrorMessage: ({ bodyText, operation, status, statusText, url }) =>
    `${operation} failed for ${url}: ${status} ${statusText}${bodyText ? ` ${bodyText}` : ""}`.trim(),
  formatNetworkErrorMessage: ({ isTimeout, operation, url }) =>
    isTimeout ? `${operation} timed out for ${url}.` : `${operation} failed for ${url}.`,
});

async function fetchWithHandling(url, options = {}) {
  const { rateLimiter = defaultHostRateLimiter, skipHostRateLimit = false, ...fetchOptions } =
    options;
  if (skipHostRateLimit || !rateLimiter?.withThrottle) {
    return runFetchWithHandling(url, fetchOptions);
  }
  return rateLimiter.withThrottle(url, () => runFetchWithHandling(url, fetchOptions));
}

async function fetchTextWithHandling(url, options = {}) {
  const response = await fetchWithHandling(url, options);
  return response.text();
}

async function fetchJsonWithHandling(url, options = {}) {
  const response = await fetchWithHandling(url, options);
  return response.json();
}

async function fetchArrayBufferWithHandling(url, options = {}) {
  const response = await fetchWithHandling(url, options);
  return response.arrayBuffer();
}

module.exports = {
  ScriptFetchError,
  fetchArrayBufferWithHandling,
  fetchJsonWithHandling,
  fetchTextWithHandling,
  fetchWithHandling,
  sanitizeFetchBody,
};
