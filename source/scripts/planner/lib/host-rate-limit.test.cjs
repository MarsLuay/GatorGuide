const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyJitter,
  computeBackoffDelayMs,
  createHostRateLimiter,
  getHostKey,
  getRateLimitScopeKey,
  parseRetryAfterToMs,
} = require("./host-rate-limit.cjs");
const { createSourceDownloader, parseRetryAfterToMs: parseFromDownloader } = require("./source-fetching.cjs");

test("rate-limit scope groups UW department vhosts together", () => {
  assert.equal(getHostKey("https://Music.Washington.edu/path"), "music.washington.edu");
  assert.equal(
    getRateLimitScopeKey("https://music.washington.edu/a"),
    getRateLimitScopeKey("https://frenchitalian.washington.edu/b")
  );
  assert.equal(getRateLimitScopeKey("https://ischool.uw.edu/x"), "scope:uw.edu");
  assert.equal(getRateLimitScopeKey("https://www.uwb.edu/y"), "scope:uw.edu");
  assert.equal(getRateLimitScopeKey("https://www.greenriver.edu/z"), "scope:greenriver.edu");
  assert.equal(getRateLimitScopeKey("https://example.edu/z"), "host:example.edu");
});

test("parseRetryAfterToMs supports delta-seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterToMs("2", 1000), 2000);
  assert.equal(parseRetryAfterToMs("bad-date", 1000), null);
  assert.equal(parseFromDownloader("15", 0), 15000);
  assert.equal(
    parseRetryAfterToMs("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("Wed, 21 Oct 2015 07:28:00 GMT") - 5000),
    5000
  );
});

test("computeBackoffDelayMs respects Retry-After above exponential floor", () => {
  const delay = computeBackoffDelayMs({
    attemptIndex: 0,
    baseDelayMs: 5000,
    maxDelayMs: 60000,
    minDelayMs: 900,
    retryAfterMs: 45000,
    jitterRatio: 0,
  });
  assert.equal(delay, 45000);
});

test("applyJitter stays within configured span", () => {
  assert.equal(applyJitter(1000, 0, () => 0.5), 1000);
  assert.equal(applyJitter(1000, 0.2, () => 0), 900);
  assert.equal(applyJitter(1000, 0.2, () => 1), 1100);
});

test("host rate limiter serializes one scope and extends cooldown after 429", async () => {
  const timeline = [];
  let now = 1_000_000;
  const limiter = createHostRateLimiter({
    minDelayMs: 100,
    scopeMinDelayMs: 100,
    maxRetryDelayMs: 60_000,
    now: () => now,
    sleep: async (ms) => {
      timeline.push(`sleep:${ms}`);
      now += ms;
    },
  });

  const first = limiter.withThrottle("https://music.washington.edu/a", async () => {
    timeline.push("music");
    limiter.noteRateLimit("https://music.washington.edu/a", 5000);
    return "music";
  });
  const second = limiter.withThrottle("https://frenchitalian.washington.edu/b", async () => {
    timeline.push("french");
    return "french";
  });
  const third = limiter.withThrottle("https://example.edu/c", async () => {
    timeline.push("example");
    return "example";
  });

  assert.deepEqual(await Promise.all([first, second, third]), ["music", "french", "example"]);
  assert.equal(timeline.filter((entry) => entry === "music").length, 1);
  assert.equal(timeline.filter((entry) => entry === "example").length, 1);
  assert.equal(timeline.filter((entry) => entry === "french").length, 1);
  assert.equal(timeline.filter((entry) => entry === "sleep:5000").length, 1);
  const frenchIndex = timeline.indexOf("french");
  const musicIndex = timeline.indexOf("music");
  const sleepIndex = timeline.indexOf("sleep:5000");
  assert.ok(musicIndex < sleepIndex);
  assert.ok(sleepIndex < frenchIndex);
});

test("source downloader honors long Retry-After instead of 8s cap", async () => {
  let fetchCalls = 0;
  const delays = [];
  const recordingLimiter = createHostRateLimiter({
    minDelayMs: 0,
    scopeMinDelayMs: 0,
    sleep: async () => undefined,
  });
  const originalNote = recordingLimiter.noteRateLimit.bind(recordingLimiter);
  recordingLimiter.noteRateLimit = (url, delayMs) => {
    delays.push(delayMs);
    return originalNote(url, delayMs);
  };

  const downloader = createSourceDownloader({
    hostCooldownMs: 100,
    retryAttempts: 2,
    maxRetryDelayMs: 60_000,
    rateLimiter: recordingLimiter,
    sleep: async () => undefined,
    fetch: async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          headers: {
            get(name) {
              return String(name).toLowerCase() === "retry-after" ? "25" : null;
            },
          },
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get() {
            return null;
          },
        },
        async text() {
          return "downloaded";
        },
        async arrayBuffer() {
          return Buffer.from("downloaded");
        },
      };
    },
    execFileAsync: async () => {
      throw new Error("curl should not run");
    },
  });

  const result = await downloader.downloadSource("https://music.washington.edu/page", 1000);
  assert.deepEqual(result, { body: "downloaded", fetchMode: "fetch" });
  assert.equal(fetchCalls, 2);
  assert.equal(delays.length, 1);
  assert.ok(delays[0] >= 25_000, `expected Retry-After delay >= 25000, got ${delays[0]}`);
  assert.ok(delays[0] <= 60_000);
});
