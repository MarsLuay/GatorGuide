const crypto = require("node:crypto");

const SUPPORT_RATE_LIMIT_COLLECTION = "supportEmailRateLimits";
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX_BODY_BYTES = 32 * 1024;
const MAX_RESPONSE_DETAIL_CHARS = 800;
const MAX_SUBJECT_CHARS = 140;
const MAX_SHORT_FIELD_CHARS = 240;
const MAX_EMAIL_FIELD_CHARS = 320;
const MAX_MESSAGE_CHARS = 4000;
const MAX_STACK_CHARS = 8000;
const MAX_JSON_BLOCK_CHARS = 5000;
const MAX_TAGS = 12;
const SUPPORT_ENDPOINT_CONFIG = {
  errorLog: {
    anonymousLimit: 12,
    trustedLimit: 60,
    ipLimit: 120,
    globalLimit: 1200,
  },
  supportMessage: {
    anonymousLimit: 3,
    trustedLimit: 10,
    ipLimit: 30,
    globalLimit: 300,
  },
};

function parseIntEnv(value, fallback, options = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  const min = Number.isFinite(options.min) ? options.min : undefined;
  const max = Number.isFinite(options.max) ? options.max : undefined;
  if (typeof min === "number" && parsed < min) return min;
  if (typeof max === "number" && parsed > max) return max;
  return parsed;
}

function makeHttpError(status, message, details = "") {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function getHeader(req, name) {
  const getterValue =
    typeof req.get === "function" ? req.get(name) : undefined;
  const headers = req.headers ?? {};
  const directValue = headers[name] ?? headers[name.toLowerCase()];
  const value = getterValue ?? directValue;
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function getRawBodySize(req) {
  const contentLength = Number.parseInt(getHeader(req, "content-length"), 10);
  const measuredSizes = [
    Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : 0,
    Buffer.isBuffer(req.rawBody) ? req.rawBody.length : 0,
    typeof req.rawBody === "string" ? Buffer.byteLength(req.rawBody) : 0,
    Buffer.byteLength(JSON.stringify(req.body ?? {})),
  ];
  return Math.max(...measuredSizes);
}

function getMaxBodyBytes(env = process.env) {
  return parseIntEnv(env.SUPPORT_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES, {
    min: 1024,
    max: 256 * 1024,
  });
}

function assertBodySize(req, env = process.env) {
  const maxBodyBytes = getMaxBodyBytes(env);
  const bodyBytes = getRawBodySize(req);
  if (bodyBytes > maxBodyBytes) {
    throw makeHttpError(
      413,
      "Request body is too large.",
      `Maximum request body size is ${maxBodyBytes} bytes.`
    );
  }
  return bodyBytes;
}

function truncateText(value, max, fallback = "") {
  const raw = String(value ?? fallback)
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (raw.length <= max) return raw;
  const omitted = raw.length - max;
  return `${raw.slice(0, max)}\n[truncated ${omitted} characters]`;
}

function truncateOneLine(value, max = MAX_SHORT_FIELD_CHARS, fallback = "") {
  return truncateText(value, max, fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJsonBlock(value) {
  if (value == null) return "";
  try {
    return truncateText(JSON.stringify(value, null, 2), MAX_JSON_BLOCK_CHARS);
  } catch {
    return truncateText(value, MAX_JSON_BLOCK_CHARS);
  }
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => truncateOneLine(tag, 80))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

function normalizeDetailsForResponse(value) {
  return truncateOneLine(value, MAX_RESPONSE_DETAIL_CHARS);
}

function getClientIp(req) {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  const forwardedIp = forwardedFor.split(",").map((part) => part.trim()).find(Boolean);
  const raw =
    forwardedIp ||
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown";
  return truncateOneLine(raw, 128, "unknown") || "unknown";
}

function getBearerToken(req) {
  const authorization = getHeader(req, "authorization");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getAppCheckToken(req) {
  return getHeader(req, "x-firebase-appcheck").trim();
}

async function resolveSupportRequestIdentity(req, admin) {
  const ip = getClientIp(req);
  const bearerToken = getBearerToken(req);
  const appCheckToken = getAppCheckToken(req);
  let authUid = null;
  let authEmail = null;
  let appCheckAppId = null;

  if (bearerToken && admin?.auth) {
    try {
      const decoded = await admin.auth().verifyIdToken(bearerToken);
      authUid = truncateOneLine(decoded?.uid, 128) || null;
      authEmail = truncateOneLine(decoded?.email, MAX_EMAIL_FIELD_CHARS) || null;
    } catch {
      // Invalid optional auth tokens do not authenticate the request.
    }
  }

  if (appCheckToken && typeof admin?.appCheck === "function") {
    try {
      const decoded = await admin.appCheck().verifyToken(appCheckToken);
      appCheckAppId = truncateOneLine(decoded?.appId, 128) || null;
    } catch {
      // Invalid optional App Check tokens fall back to anonymous throttling.
    }
  }

  return {
    ip,
    ipHash: hashValue(ip).slice(0, 32),
    authUid,
    authEmail,
    appCheckAppId,
    trusted: !!authUid || !!appCheckAppId,
  };
}

function getSupportRateLimitConfig(endpoint, env = process.env) {
  const defaults = SUPPORT_ENDPOINT_CONFIG[endpoint] ?? SUPPORT_ENDPOINT_CONFIG.supportMessage;
  const prefix = endpoint === "errorLog" ? "SUPPORT_ERROR_LOG" : "SUPPORT_MESSAGE";
  return {
    windowMs: parseIntEnv(env.SUPPORT_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS, {
      min: 60 * 1000,
      max: 24 * 60 * 60 * 1000,
    }),
    anonymousLimit: parseIntEnv(env[`${prefix}_ANONYMOUS_HOURLY_LIMIT`], defaults.anonymousLimit, {
      min: 1,
      max: 5000,
    }),
    trustedLimit: parseIntEnv(env[`${prefix}_TRUSTED_HOURLY_LIMIT`], defaults.trustedLimit, {
      min: 1,
      max: 5000,
    }),
    ipLimit: parseIntEnv(env[`${prefix}_IP_HOURLY_LIMIT`], defaults.ipLimit, {
      min: 1,
      max: 10000,
    }),
    globalLimit: parseIntEnv(env[`${prefix}_GLOBAL_HOURLY_LIMIT`], defaults.globalLimit, {
      min: 1,
      max: 100000,
    }),
  };
}

function buildRateLimitDimensions(endpoint, identity, env = process.env) {
  const config = getSupportRateLimitConfig(endpoint, env);
  const primaryIdentity = identity.authUid
    ? `auth:${identity.authUid}`
    : identity.appCheckAppId
      ? `appcheck:${identity.appCheckAppId}:ip:${identity.ipHash}`
      : `ip:${identity.ipHash}`;

  return [
    {
      name: "primary",
      key: `${endpoint}:primary:${hashValue(primaryIdentity).slice(0, 40)}`,
      limit: identity.trusted ? config.trustedLimit : config.anonymousLimit,
      windowMs: config.windowMs,
    },
    {
      name: "ip",
      key: `${endpoint}:ip:${identity.ipHash}`,
      limit: config.ipLimit,
      windowMs: config.windowMs,
    },
    {
      name: "global",
      key: `${endpoint}:global`,
      limit: config.globalLimit,
      windowMs: config.windowMs,
    },
  ];
}

class MemoryRateLimitStore {
  constructor() {
    this.entries = new Map();
  }

  async consume({ key, limit, windowMs, now = Date.now() }) {
    const bucketStartMs = Math.floor(now / windowMs) * windowMs;
    const bucketKey = `${key}:${bucketStartMs}`;
    const current = this.entries.get(bucketKey) ?? 0;
    if (current >= limit) {
      return {
        allowed: false,
        count: current,
        limit,
        retryAfterSeconds: Math.max(1, Math.ceil((bucketStartMs + windowMs - now) / 1000)),
      };
    }

    this.entries.set(bucketKey, current + 1);
    return {
      allowed: true,
      count: current + 1,
      limit,
      retryAfterSeconds: 0,
    };
  }
}

class FirestoreRateLimitStore {
  constructor(db, options = {}) {
    this.db = db;
    this.collectionName = options.collectionName || SUPPORT_RATE_LIMIT_COLLECTION;
  }

  async consume({ key, limit, windowMs, now = Date.now() }) {
    const bucketStartMs = Math.floor(now / windowMs) * windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((bucketStartMs + windowMs - now) / 1000));
    const docId = hashValue(`${key}:${bucketStartMs}`).slice(0, 80);
    const ref = this.db.collection(this.collectionName).doc(docId);
    let result = null;

    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists ? Number(snapshot.data()?.count ?? 0) : 0;
      if (current >= limit) {
        result = {
          allowed: false,
          count: current,
          limit,
          retryAfterSeconds,
        };
        return;
      }

      transaction.set(
        ref,
        {
          keyHash: hashValue(key).slice(0, 80),
          count: current + 1,
          limit,
          bucketStartAt: new Date(bucketStartMs),
          expiresAt: new Date(bucketStartMs + windowMs * 2),
          updatedAt: new Date(now),
        },
        { merge: true }
      );
      result = {
        allowed: true,
        count: current + 1,
        limit,
        retryAfterSeconds: 0,
      };
    });

    return result;
  }
}

async function enforceRateLimits(store, dimensions, now = Date.now()) {
  for (const dimension of dimensions) {
    const result = await store.consume({ ...dimension, now });
    if (!result?.allowed) {
      const error = makeHttpError(429, "Too many support requests. Please try again later.");
      error.retryAfterSeconds = result?.retryAfterSeconds ?? Math.ceil(dimension.windowMs / 1000);
      error.rateLimit = {
        name: dimension.name,
        limit: dimension.limit,
      };
      throw error;
    }
  }
}

function buildInfoRows(rows) {
  return rows
    .map(([label, value]) => [label, truncateOneLine(value, MAX_SHORT_FIELD_CHARS)])
    .filter(([, value]) => String(value || "").trim());
}

function buildSupportErrorEmail(body) {
  const timestamp = truncateOneLine(body.timestamp || new Date().toISOString(), 80);
  const platform = truncateOneLine(body.platform || "unknown", 80);
  const message = truncateText(body.message || "Unknown error", MAX_MESSAGE_CHARS);
  const stack = truncateText(body.stack || "No stack provided", MAX_STACK_CHARS);
  const app = truncateOneLine(body.app || "GatorGuide", 80);
  const severity = truncateOneLine(body.severity || "error", 40);
  const category = truncateOneLine(body.category || "app", 80);
  const operation = truncateOneLine(body.operation || "unknown-operation", 120);
  const handled = typeof body.handled === "boolean" ? body.handled : true;
  const source = truncateOneLine(body.source || "app", 120);
  const screen = truncateOneLine(body.screen || "", 120);
  const route = truncateOneLine(body.route || "", 180);
  const errorName = truncateOneLine(body.errorName || "", 120);
  const errorCode = truncateOneLine(body.errorCode || "", 120);
  const authState = truncateOneLine(body.authState || "unknown", 80);
  const appVersion = truncateOneLine(body.appVersion || "", 80);
  const buildVersion = truncateOneLine(body.buildVersion || "", 80);
  const appOwnership = truncateOneLine(body.appOwnership || "", 80);
  const userId = truncateOneLine(body.userId || "", 128);
  const tags = normalizeTags(body.tags);
  const detailBlock = safeJsonBlock(body.details);
  const metadataBlock = safeJsonBlock(body.metadata);

  const infoRows = buildInfoRows([
    ["Severity", severity],
    ["Category", category],
    ["Operation", operation],
    ["Handled", handled ? "true" : "false"],
    ["Source", source],
    ["Screen", screen],
    ["Route", route],
    ["Error name", errorName],
    ["Error code", errorCode],
    ["Auth state", authState],
    ["User ID", userId],
    ["App version", appVersion],
    ["Build version", buildVersion],
    ["App ownership", appOwnership],
    ["Tags", tags.join(", ")],
  ]);

  const detailsHtml = detailBlock
    ? `<p><strong>Details:</strong></p><pre style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(detailBlock)}</pre>`
    : "";
  const metadataHtml = metadataBlock
    ? `<p><strong>Metadata:</strong></p><pre style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(metadataBlock)}</pre>`
    : "";

  const subject = truncateOneLine(`[${app}] Client Error (${platform})`, MAX_SUBJECT_CHARS);
  const html = `
      <h2>${escapeHtml(app)} Error Report</h2>
      <p><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
      <p><strong>Platform:</strong> ${escapeHtml(platform)}</p>
      <p><strong>Message:</strong> ${escapeHtml(message)}</p>
      ${infoRows.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")}
      <p><strong>Stack:</strong></p>
      <pre style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(stack)}</pre>
      ${detailsHtml}
      ${metadataHtml}
    `;

  return { subject, html };
}

function buildSupportMessageEmail(body) {
  const rawMessage = String(body.message || "").trim();
  if (!rawMessage) {
    throw makeHttpError(400, "Message is required");
  }

  const message = truncateText(rawMessage, MAX_MESSAGE_CHARS);
  const timestamp = truncateOneLine(body.timestamp || new Date().toISOString(), 80);
  const platform = truncateOneLine(body.platform || "unknown", 80);
  const app = truncateOneLine(body.app || "GatorGuide", 80);
  const userName = truncateOneLine(body.userName || "Unknown", 160);
  const userEmail = truncateOneLine(body.userEmail || "Unknown", MAX_EMAIL_FIELD_CHARS);
  const userUid = truncateOneLine(body.userUid || "Unknown", 128);

  const subject = truncateOneLine(
    `[${app}] Support message from ${userName}`,
    MAX_SUBJECT_CHARS
  );
  const html = `
      <h2>${escapeHtml(app)} Support Request</h2>
      <p><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
      <p><strong>Platform:</strong> ${escapeHtml(platform)}</p>
      <p><strong>User name:</strong> ${escapeHtml(userName)}</p>
      <p><strong>User email:</strong> ${escapeHtml(userEmail)}</p>
      <p><strong>User UID:</strong> ${escapeHtml(userUid)}</p>
      <p><strong>Message:</strong></p>
      <pre style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(message)}</pre>
    `;

  return { subject, html };
}

function buildEmailPayload({ from, to, subject, html }) {
  return {
    from,
    to: [to],
    subject,
    html,
  };
}

module.exports = {
  DEFAULT_MAX_BODY_BYTES,
  MAX_MESSAGE_CHARS,
  MAX_STACK_CHARS,
  SUPPORT_ENDPOINT_CONFIG,
  FirestoreRateLimitStore,
  MemoryRateLimitStore,
  assertBodySize,
  buildEmailPayload,
  buildRateLimitDimensions,
  buildSupportErrorEmail,
  buildSupportMessageEmail,
  enforceRateLimits,
  escapeHtml,
  getClientIp,
  getRawBodySize,
  makeHttpError,
  normalizeDetailsForResponse,
  resolveSupportRequestIdentity,
  truncateText,
};
