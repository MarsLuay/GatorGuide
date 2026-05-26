const {
  DEFAULT_FETCH_RETRY_STATUSES,
  createFetchErrorClass,
  createFetchHelper,
  sanitizeFetchBody,
} = require("../../services/network/fetch-contract.cjs");

const DEFAULT_TIMEOUT_MS = 30000;

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
  return runFetchWithHandling(url, options);
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
