const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { geminiGateway } = require("./geminiGateway");
const { opportunityGateway } = require("./opportunityGateway");
const {
  fetchWithTimeout,
} = require("./fetchWithTimeout");
const {
  FirestoreRateLimitStore,
  assertBodySize,
  buildEmailPayload,
  buildRateLimitDimensions,
  buildSupportErrorEmail,
  buildSupportMessageEmail,
  enforceRateLimits,
  normalizeDetailsForResponse,
  resolveSupportRequestIdentity,
} = require("./supportEmail");

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

const SUPPORT_TO_EMAIL = "gatorguide@outlook.com";
const SUPPORT_FROM_EMAIL = process.env.SUPPORT_FROM_EMAIL || "onboarding@resend.dev";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10000;
const supportRateLimitStore = new FirestoreRateLimitStore(admin.firestore());
const supportHttpOptions = {
  cors: true,
  timeoutSeconds: 30,
  maxInstances: 5,
};

async function sendWithResend(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = new Error("Missing RESEND_API_KEY");
    error.status = 500;
    throw error;
  }

  const sendRes = await fetchWithTimeout(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    operation: "Email provider request",
    timeoutErrorFactory: () => {
      const timeoutError = new Error("Email provider request timed out");
      timeoutError.status = 504;
      return timeoutError;
    },
    timeoutMs: RESEND_TIMEOUT_MS,
  });

  if (!sendRes.ok) {
    const text = await sendRes.text().catch(() => "");
    const error = new Error(`Email provider error: ${sendRes.status}`);
    error.status = 502;
    error.details = text;
    throw error;
  }

  return sendRes.json().catch(() => ({}));
}

async function prepareSupportRequest(req, endpoint) {
  assertBodySize(req);
  const identity = await resolveSupportRequestIdentity(req, admin);
  await enforceRateLimits(
    supportRateLimitStore,
    buildRateLimitDimensions(endpoint, identity)
  );
  return {
    body: req.body || {},
    identity,
  };
}

function sendSupportErrorResponse(res, error) {
  const status = Number(error?.status) || 500;
  if (status === 429 && Number.isFinite(error?.retryAfterSeconds)) {
    res.set("Retry-After", String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
  }

  res.status(status).json({
    error: normalizeDetailsForResponse(error?.message || "Unexpected error"),
    details:
      status >= 500
        ? ""
        : normalizeDetailsForResponse(error?.details || ""),
  });
}

exports.sendSupportErrorLog = onRequest(supportHttpOptions, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { body } = await prepareSupportRequest(req, "errorLog");
    const email = buildSupportErrorEmail(body);
    const emailPayload = buildEmailPayload({
      from: SUPPORT_FROM_EMAIL,
      to: SUPPORT_TO_EMAIL,
      ...email,
    });

    const provider = await sendWithResend(emailPayload);
    res.status(200).json({ ok: true, provider });
  } catch (error) {
    sendSupportErrorResponse(res, error);
  }
});

exports.sendSupportMessage = onRequest(supportHttpOptions, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { body } = await prepareSupportRequest(req, "supportMessage");
    const email = buildSupportMessageEmail(body);
    const emailPayload = buildEmailPayload({
      from: SUPPORT_FROM_EMAIL,
      to: SUPPORT_TO_EMAIL,
      ...email,
    });

    const provider = await sendWithResend(emailPayload);
    res.status(200).json({ ok: true, provider });
  } catch (error) {
    sendSupportErrorResponse(res, error);
  }
});

exports.geminiGateway = geminiGateway;
exports.opportunityGateway = opportunityGateway;

