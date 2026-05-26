const DEFAULT_FETCH_RETRY_STATUSES = Object.freeze([408, 429, 500, 502, 503, 504]);

function createFetchErrorClass(name, defaultOperation) {
  return class FetchContractError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = name;
      this.attempts = options.attempts ?? 1;
      this.bodyText = options.bodyText ?? "";
      this.cause = options.cause;
      this.isRetryable = !!options.isRetryable;
      this.isTimeout = !!options.isTimeout;
      this.method = options.method ?? "GET";
      this.operation = options.operation ?? defaultOperation;
      this.status = options.status ?? null;
      this.statusText = options.statusText ?? "";
      this.url = options.url ?? "";
    }
  };
}

function sanitizeFetchBody(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  if (/<!doctype html/i.test(raw) || /<html[\s>]/i.test(raw)) {
    return "[html-error-body]";
  }
  return raw.slice(0, 500);
}

function isAbortError(error) {
  return String(error?.name ?? "") === "AbortError";
}

function getInputUrl(input) {
  if (typeof input === "string") return input;
  if (typeof URL !== "undefined" && input instanceof URL) return input.toString();
  const maybeUrl = input?.url;
  return typeof maybeUrl === "string" ? maybeUrl : String(input ?? "");
}

function getFetchMethod(options) {
  return String(options?.method ?? "GET").toUpperCase();
}

function toRetryStatusSet(retryOnStatuses) {
  if (retryOnStatuses instanceof Set) return retryOnStatuses;
  return new Set(retryOnStatuses ?? DEFAULT_FETCH_RETRY_STATUSES);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(retryDelayMs, attempt, error) {
  if (typeof retryDelayMs === "function") {
    return Math.max(0, retryDelayMs(attempt, error));
  }
  return Math.max(0, retryDelayMs ?? 0);
}

function withUserAgentHeader(headers, userAgent) {
  if (!userAgent) return headers ?? {};

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const nextHeaders = new Headers(headers);
    if (!nextHeaders.has("user-agent")) {
      nextHeaders.set("user-agent", userAgent);
    }
    return nextHeaders;
  }

  if (Array.isArray(headers)) {
    const hasUserAgent = headers.some(([key]) => String(key).toLowerCase() === "user-agent");
    return hasUserAgent ? headers : [["user-agent", userAgent], ...headers];
  }

  return {
    "user-agent": userAgent,
    ...(headers ?? {}),
  };
}

function createAbortController(sourceSignal, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromSource = () => controller.abort();

  if (sourceSignal?.aborted) {
    controller.abort();
  } else {
    sourceSignal?.addEventListener?.("abort", abortFromSource, { once: true });
  }

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timeoutId);
      sourceSignal?.removeEventListener?.("abort", abortFromSource);
    },
  };
}

function defaultHttpErrorMessage({ bodyText, operation, status, statusText }) {
  return `${operation} failed: ${status} ${statusText}${bodyText ? ` ${bodyText}` : ""}`.trim();
}

function defaultNetworkErrorMessage({ isTimeout, operation }) {
  return isTimeout ? `${operation} timed out.` : `${operation} failed.`;
}

function defaultMissingFetchMessage({ operation }) {
  return `${operation} failed: fetch is not available.`;
}

function resolveFetchImpl(fetchImpl, defaultFetchImpl) {
  if (typeof fetchImpl === "function") return fetchImpl;
  if (typeof defaultFetchImpl === "function") {
    const resolved = defaultFetchImpl();
    if (typeof resolved === "function") return resolved;
  }
  return globalThis.fetch;
}

function createFetchHelper(config) {
  const {
    ErrorClass,
    defaultFetchImpl,
    defaultFetchOptions = {},
    defaultOperation,
    defaultRetries = 0,
    defaultRetryDelayMs = 0,
    defaultRetryStatuses = DEFAULT_FETCH_RETRY_STATUSES,
    defaultThrowOnHttpError = true,
    defaultTimeoutMs,
    formatHttpErrorMessage = defaultHttpErrorMessage,
    formatMissingFetchMessage = defaultMissingFetchMessage,
    formatNetworkErrorMessage = defaultNetworkErrorMessage,
  } = config;

  async function fetchOnce(input, options, attemptIndex, timeoutMs) {
    const {
      fetchImpl,
      operation = defaultOperation,
      retries: _retries,
      retryDelayMs: _retryDelayMs,
      retryOnStatuses = defaultRetryStatuses,
      retryTimeoutMs: _retryTimeoutMs,
      scrubbedUrl,
      throwOnHttpError = defaultThrowOnHttpError,
      timeoutMs: _timeoutMs,
      userAgent,
      ...fetchOptions
    } = options;
    const retryStatusSet = toRetryStatusSet(retryOnStatuses);
    const displayUrl = scrubbedUrl ?? getInputUrl(input);
    const method = getFetchMethod(fetchOptions);
    const resolvedFetch = resolveFetchImpl(fetchImpl, defaultFetchImpl);

    if (typeof resolvedFetch !== "function") {
      throw new ErrorClass(formatMissingFetchMessage({ operation, url: displayUrl }), {
        attempts: attemptIndex + 1,
        method,
        operation,
        url: displayUrl,
      });
    }

    const mergedFetchOptions = {
      ...defaultFetchOptions,
      ...fetchOptions,
    };
    const sourceSignal = mergedFetchOptions.signal;
    const timeoutController = createAbortController(sourceSignal, timeoutMs);

    try {
      const response = await resolvedFetch(input, {
        ...mergedFetchOptions,
        signal: timeoutController.signal,
        headers: withUserAgentHeader(mergedFetchOptions.headers, userAgent),
      });

      if (response.ok || !throwOnHttpError) return response;

      const bodyText = sanitizeFetchBody(await response.text().catch(() => ""));
      const isRetryable = retryStatusSet.has(response.status);
      throw new ErrorClass(
        formatHttpErrorMessage({
          bodyText,
          operation,
          status: response.status,
          statusText: response.statusText,
          url: displayUrl,
        }),
        {
          attempts: attemptIndex + 1,
          bodyText,
          isRetryable,
          method,
          operation,
          status: response.status,
          statusText: response.statusText,
          url: displayUrl,
        }
      );
    } catch (error) {
      if (error instanceof ErrorClass) throw error;
      const isTimeout = isAbortError(error);
      throw new ErrorClass(
        formatNetworkErrorMessage({
          cause: error,
          isTimeout,
          operation,
          url: displayUrl,
        }),
        {
          attempts: attemptIndex + 1,
          cause: error,
          isRetryable: isTimeout || error instanceof TypeError,
          isTimeout,
          method,
          operation,
          url: displayUrl,
        }
      );
    } finally {
      timeoutController.clear();
    }
  }

  return async function fetchWithContract(input, options = {}) {
    const retries = Math.max(0, options.retries ?? defaultRetries);
    const retryDelayMs = options.retryDelayMs ?? defaultRetryDelayMs;
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const retryTimeoutMs = options.retryTimeoutMs;
    let lastError = null;

    for (let attemptIndex = 0; attemptIndex <= retries; attemptIndex += 1) {
      try {
        return await fetchOnce(
          input,
          options,
          attemptIndex,
          attemptIndex > 0 && retryTimeoutMs ? retryTimeoutMs : timeoutMs
        );
      } catch (error) {
        lastError = error;
        if (attemptIndex >= retries || !error.isRetryable) {
          throw error;
        }
        await sleep(getRetryDelayMs(retryDelayMs, attemptIndex + 1, error));
      }
    }

    throw lastError;
  };
}

module.exports = {
  DEFAULT_FETCH_RETRY_STATUSES,
  createFetchErrorClass,
  createFetchHelper,
  getFetchMethod,
  getInputUrl,
  isAbortError,
  sanitizeFetchBody,
};
