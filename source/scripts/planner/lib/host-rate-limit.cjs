const DEFAULT_HOST_MIN_DELAY_MS = 900;
const DEFAULT_SCOPE_MIN_DELAY_MS = 1500;
const DEFAULT_RETRY_BASE_DELAY_MS = 5000;
const DEFAULT_MAX_RETRY_DELAY_MS = 60000;
const DEFAULT_JITTER_RATIO = 0.2;

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

/**
 * Group related hosts that share institutional / CDN rate limits.
 * Different department vhosts (music.washington.edu, geography.washington.edu)
 * still stampede the same WAF when throttled only per hostname.
 */
function getRateLimitScopeKey(urlOrHost) {
  const host = String(urlOrHost ?? "").includes("://")
    ? getHostKey(urlOrHost)
    : String(urlOrHost ?? "").toLowerCase();

  if (!host || host === "unknown-host") {
    return "scope:unknown-host";
  }

  if (host === "washington.edu" || host.endsWith(".washington.edu")) {
    return "scope:washington.edu";
  }

  if (
    host === "uw.edu" ||
    host.endsWith(".uw.edu") ||
    host === "uwb.edu" ||
    host.endsWith(".uwb.edu")
  ) {
    return "scope:uw.edu";
  }

  if (host === "greenriver.edu" || host.endsWith(".greenriver.edu")) {
    return "scope:greenriver.edu";
  }

  return `host:${host}`;
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

function applyJitter(delayMs, jitterRatio = DEFAULT_JITTER_RATIO, randomFn = Math.random) {
  const base = Math.max(0, Number(delayMs) || 0);
  const ratio = Math.max(0, Number(jitterRatio) || 0);
  if (base <= 0 || ratio <= 0) {
    return base;
  }

  const jitterSpan = base * ratio;
  return Math.max(0, Math.round(base - jitterSpan / 2 + randomFn() * jitterSpan));
}

function computeBackoffDelayMs(options = {}) {
  const attemptIndex = Math.max(0, Number(options.attemptIndex) || 0);
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  const minDelayMs = options.minDelayMs ?? DEFAULT_HOST_MIN_DELAY_MS;
  const retryAfterMs = options.retryAfterMs;
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const randomFn = options.randomFn ?? Math.random;

  const exponential = Math.min(
    maxDelayMs,
    Math.max(baseDelayMs * 2 ** attemptIndex, minDelayMs * Math.max(2, attemptIndex + 2))
  );
  const withRetryAfter = Math.min(
    maxDelayMs,
    Math.max(exponential, Number.isFinite(retryAfterMs) ? retryAfterMs : 0)
  );

  return applyJitter(withRetryAfter, jitterRatio, randomFn);
}

function createHostRateLimiter(options = {}) {
  const defaultMinDelayMs = options.minDelayMs ?? DEFAULT_HOST_MIN_DELAY_MS;
  const scopeMinDelayMs = options.scopeMinDelayMs ?? DEFAULT_SCOPE_MIN_DELAY_MS;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  const sleepFn = options.sleep ?? sleep;
  const nowFn = options.now ?? Date.now;
  const requestChainsByScope = new Map();
  const nextAllowedAtByScope = new Map();
  const penaltyMsByScope = new Map();

  function resolveMinDelayMs(scopeKey) {
    const penalty = penaltyMsByScope.get(scopeKey) ?? 0;
    const scopedFloor = scopeKey.startsWith("scope:") ? scopeMinDelayMs : defaultMinDelayMs;
    return Math.max(defaultMinDelayMs, scopedFloor, penalty);
  }

  function extendCooldown(scopeKey, delayMs) {
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      return;
    }

    const nextAllowedAt = nowFn() + delayMs;
    nextAllowedAtByScope.set(
      scopeKey,
      Math.max(nextAllowedAtByScope.get(scopeKey) ?? 0, nextAllowedAt)
    );
  }

  function noteRateLimit(url, delayMs) {
    const scopeKey = getRateLimitScopeKey(url);
    const boundedDelay = Math.min(maxRetryDelayMs, Math.max(0, Number(delayMs) || 0));
    extendCooldown(scopeKey, boundedDelay);

    const nextPenalty = Math.min(
      maxRetryDelayMs,
      Math.max(resolveMinDelayMs(scopeKey) * 2, boundedDelay)
    );
    penaltyMsByScope.set(scopeKey, nextPenalty);
    return nextPenalty;
  }

  function clearRateLimitPenalty(url) {
    penaltyMsByScope.delete(getRateLimitScopeKey(url));
  }

  async function withThrottle(url, work) {
    const scopeKey = getRateLimitScopeKey(url);
    const previous = requestChainsByScope.get(scopeKey) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const waitMs = Math.max(0, (nextAllowedAtByScope.get(scopeKey) ?? 0) - nowFn());
        if (waitMs > 0) {
          await sleepFn(waitMs);
        }

        try {
          return await work(scopeKey);
        } finally {
          extendCooldown(scopeKey, resolveMinDelayMs(scopeKey));
        }
      });

    requestChainsByScope.set(
      scopeKey,
      run.then(
        () => undefined,
        () => undefined
      )
    );

    return run;
  }

  return {
    clearRateLimitPenalty,
    extendCooldown,
    getMinDelayMs: (url) => resolveMinDelayMs(getRateLimitScopeKey(url)),
    getScopeKey: getRateLimitScopeKey,
    noteRateLimit,
    withThrottle,
  };
}

module.exports = {
  DEFAULT_HOST_MIN_DELAY_MS,
  DEFAULT_JITTER_RATIO,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_SCOPE_MIN_DELAY_MS,
  applyJitter,
  computeBackoffDelayMs,
  createHostRateLimiter,
  getHostKey,
  getRateLimitScopeKey,
  parseRetryAfterToMs,
  sleep,
};
