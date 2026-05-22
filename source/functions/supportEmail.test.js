const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_MESSAGE_CHARS,
  MAX_STACK_CHARS,
  MemoryRateLimitStore,
  assertBodySize,
  buildRateLimitDimensions,
  buildSupportErrorEmail,
  buildSupportMessageEmail,
  enforceRateLimits,
  resolveSupportRequestIdentity,
} = require("./supportEmail");

test("support message payloads require a non-empty message", () => {
  assert.throws(
    () => buildSupportMessageEmail({ message: "   " }),
    (error) => error.status === 400 && /Message is required/.test(error.message)
  );
});

test("support messages are HTML-escaped and truncated before email rendering", () => {
  const email = buildSupportMessageEmail({
    app: "GatorGuide<script>",
    userName: "Student\r\nBcc: bad@example.com",
    userEmail: "student@example.com",
    message: `<b>${"x".repeat(MAX_MESSAGE_CHARS + 20)}</b>`,
  });

  assert.match(email.html, /&lt;b&gt;/);
  assert.match(email.html, /\[truncated \d+ characters\]/);
  assert.doesNotMatch(email.html, /<b>/);
  assert.doesNotMatch(email.subject, /\r|\n/);
});

test("error logs truncate large message, stack, details, and metadata fields", () => {
  const email = buildSupportErrorEmail({
    message: "m".repeat(MAX_MESSAGE_CHARS + 50),
    stack: "s".repeat(MAX_STACK_CHARS + 50),
    details: { html: "<img src=x onerror=alert(1)>", payload: "d".repeat(7000) },
    metadata: { nested: "z".repeat(7000) },
  });

  assert.match(email.html, /\[truncated \d+ characters\]/);
  assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.ok(email.html.length < MAX_MESSAGE_CHARS + MAX_STACK_CHARS + 16000);
});

test("request body size caps reject oversized support bodies", () => {
  assert.throws(
    () =>
      assertBodySize(
        { headers: { "content-length": "2048" }, body: {} },
        { SUPPORT_MAX_BODY_BYTES: "1024" }
      ),
    (error) => error.status === 413 && /too large/.test(error.message)
  );
});

test("request body sizing uses the largest available size signal", () => {
  assert.throws(
    () =>
      assertBodySize(
        {
          headers: { "content-length": "10" },
          rawBody: Buffer.alloc(2048),
          body: { tiny: true },
        },
        { SUPPORT_MAX_BODY_BYTES: "1024" }
      ),
    (error) => error.status === 413
  );
});

test("anonymous support-message rate limits block repeated abuse", async () => {
  const store = new MemoryRateLimitStore();
  const identity = {
    ip: "203.0.113.4",
    ipHash: "ip-hash",
    authUid: null,
    authEmail: null,
    appCheckAppId: null,
    trusted: false,
  };
  const dimensions = buildRateLimitDimensions("supportMessage", identity, {
    SUPPORT_RATE_LIMIT_WINDOW_MS: "3600000",
    SUPPORT_MESSAGE_ANONYMOUS_HOURLY_LIMIT: "2",
    SUPPORT_MESSAGE_IP_HOURLY_LIMIT: "20",
    SUPPORT_MESSAGE_GLOBAL_HOURLY_LIMIT: "200",
  });

  await enforceRateLimits(store, dimensions, 1000);
  await enforceRateLimits(store, dimensions, 1000);
  await assert.rejects(
    () => enforceRateLimits(store, dimensions, 1000),
    (error) => error.status === 429 && Number.isFinite(error.retryAfterSeconds)
  );
});

test("auth/app-check identity is used for trusted throttling when tokens verify", async () => {
  const req = {
    headers: {
      authorization: "Bearer auth-token",
      "x-firebase-appcheck": "app-check-token",
      "x-forwarded-for": "198.51.100.5, 10.0.0.1",
    },
  };
  const admin = {
    auth: () => ({
      verifyIdToken: async (token) => {
        assert.equal(token, "auth-token");
        return { uid: "user-123", email: "student@example.com" };
      },
    }),
    appCheck: () => ({
      verifyToken: async (token) => {
        assert.equal(token, "app-check-token");
        return { appId: "app-abc" };
      },
    }),
  };

  const identity = await resolveSupportRequestIdentity(req, admin);
  assert.equal(identity.authUid, "user-123");
  assert.equal(identity.authEmail, "student@example.com");
  assert.equal(identity.appCheckAppId, "app-abc");
  assert.equal(identity.trusted, true);
  assert.equal(identity.ip, "198.51.100.5");

  const [primary] = buildRateLimitDimensions("supportMessage", identity, {
    SUPPORT_MESSAGE_TRUSTED_HOURLY_LIMIT: "9",
    SUPPORT_MESSAGE_ANONYMOUS_HOURLY_LIMIT: "1",
  });
  assert.equal(primary.limit, 9);
});
