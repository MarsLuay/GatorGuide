const { execFile } = require("child_process");
const { promisify } = require("util");

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_HOST_COOLDOWN_MS = 750;
const DEFAULT_USER_AGENT = "GatorGuideTransferPlannerRequirementParser/1.0";
const DEFAULT_CURL_COMMAND = process.platform === "win32" ? "curl.exe" : "curl";
const SOURCE_DOWNLOAD_MAX_BUFFER_BYTES = 40 * 1024 * 1024;
const DEFAULT_CURL_ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7";

const defaultExecFileAsync = promisify(execFile);

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHostKey(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "unknown-host";
  }
}

function parseRetryAfterToMs(value, nowMs = Date.now()) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const retryAt = Date.parse(normalized);
  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - nowMs);
}

function isRetryableHttpStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function buildCurlErrorMessage(error, url) {
  const stderr = normalizeWhitespace(error?.stderr ?? "");
  const stdout = normalizeWhitespace(error?.stdout ?? "");
  const details = stderr || stdout || normalizeWhitespace(error?.message ?? "");
  return details ? `${details}` : `curl failed for ${url}`;
}

function createSourceDownloader(options = {}) {
  const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const hostCooldownMs = options.hostCooldownMs ?? DEFAULT_HOST_COOLDOWN_MS;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const curlCommand = options.curlCommand ?? DEFAULT_CURL_COMMAND;
  const curlAcceptHeader = options.curlAcceptHeader ?? DEFAULT_CURL_ACCEPT_HEADER;
  const maxBufferBytes = options.maxBufferBytes ?? SOURCE_DOWNLOAD_MAX_BUFFER_BYTES;
  const execFileAsync = options.execFileAsync ?? defaultExecFileAsync;
  const fetchImpl = options.fetch ?? fetch;
  const requestChainsByHost = new Map();
  const nextAllowedAtByHost = new Map();
  const downloadCache = new Map();

  function getRetryDelayMs(attempt, retryAfterHeader = null) {
    const retryAfterMs = parseRetryAfterToMs(retryAfterHeader);
    if (retryAfterMs !== null) {
      return Math.min(Math.max(retryAfterMs, hostCooldownMs), 8000);
    }

    return Math.min(hostCooldownMs * Math.pow(2, Math.max(0, attempt - 1)), 8000);
  }

  async function withHostThrottle(url, work) {
    const hostKey = getHostKey(url);
    const previous = requestChainsByHost.get(hostKey) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const waitMs = Math.max(0, (nextAllowedAtByHost.get(hostKey) ?? 0) - Date.now());
        if (waitMs > 0) {
          await sleep(waitMs);
        }

        try {
          return await work();
        } finally {
          nextAllowedAtByHost.set(hostKey, Date.now() + hostCooldownMs);
        }
      });

    requestChainsByHost.set(
      hostKey,
      run.then(
        () => undefined,
        () => undefined
      )
    );

    return run;
  }

  async function fetchWithTimeoutOnce(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchImpl(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": userAgent,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchWithRetries(url, timeoutMs) {
    let lastError = null;
    let lastResponse = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        const response = await withHostThrottle(url, () => fetchWithTimeoutOnce(url, timeoutMs));
        if (response.ok) {
          return response;
        }

        lastResponse = response;
        if (!isRetryableHttpStatus(response.status) || attempt >= retryAttempts) {
          return response;
        }

        await sleep(getRetryDelayMs(attempt, response.headers.get("retry-after")));
      } catch (error) {
        lastError = error;
        if (attempt >= retryAttempts) {
          break;
        }

        await sleep(getRetryDelayMs(attempt));
      }
    }

    if (lastResponse) {
      return lastResponse;
    }

    throw lastError ?? new Error(`Failed to fetch ${url}.`);
  }

  async function downloadWithCurl(url, timeoutMs, binary) {
    const args = [
      "--silent",
      "--show-error",
      "--location",
      "--fail",
      "--user-agent",
      userAgent,
      "--header",
      `Accept: ${curlAcceptHeader}`,
      "--max-time",
      String(Math.max(5, Math.ceil(timeoutMs / 1000))),
      url,
    ];

    try {
      const result = await withHostThrottle(url, () =>
        execFileAsync(curlCommand, args, {
          encoding: binary ? "buffer" : "utf8",
          maxBuffer: maxBufferBytes,
          windowsHide: true,
        })
      );

      return {
        body: binary ? Buffer.from(result.stdout) : String(result.stdout ?? ""),
        fetchMode: "curl",
      };
    } catch (error) {
      throw new Error(buildCurlErrorMessage(error, url));
    }
  }

  async function downloadSource(url, timeoutMs, { binary = false } = {}) {
    const cacheKey = `${binary ? "binary" : "text"}::${String(url ?? "")}`;
    const cached = downloadCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const downloadPromise = (async () => {
      let fetchResponse = null;
      let fetchError = null;

      try {
        fetchResponse = await fetchWithRetries(url, timeoutMs);
        if (fetchResponse.ok) {
          return {
            body: binary
              ? Buffer.from(await fetchResponse.arrayBuffer())
              : await fetchResponse.text(),
            fetchMode: "fetch",
          };
        }
      } catch (error) {
        fetchError = error;
      }

      try {
        return await downloadWithCurl(url, timeoutMs, binary);
      } catch (curlError) {
        if (fetchResponse && !fetchResponse.ok) {
          throw new Error(`HTTP ${fetchResponse.status} ${fetchResponse.statusText}`);
        }
        if (fetchError) {
          throw fetchError;
        }
        throw curlError;
      }
    })();

    downloadCache.set(cacheKey, downloadPromise);

    try {
      return await downloadPromise;
    } catch (error) {
      downloadCache.delete(cacheKey);
      throw error;
    }
  }

  return {
    downloadSource,
    fetchWithRetries,
    withHostThrottle,
  };
}

module.exports = {
  DEFAULT_CURL_ACCEPT_HEADER,
  DEFAULT_CURL_COMMAND,
  DEFAULT_HOST_COOLDOWN_MS,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_USER_AGENT,
  SOURCE_DOWNLOAD_MAX_BUFFER_BYTES,
  buildCurlErrorMessage,
  createSourceDownloader,
  isRetryableHttpStatus,
  parseRetryAfterToMs,
};
