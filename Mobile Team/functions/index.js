const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { geminiGateway } = require("./geminiGateway");

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

const SUPPORT_TO_EMAIL = "gatorguide@outlook.com";
const SUPPORT_FROM_EMAIL = process.env.SUPPORT_FROM_EMAIL || "onboarding@resend.dev";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

async function sendWithResend(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = new Error("Missing RESEND_API_KEY");
    error.status = 500;
    throw error;
  }

  const sendRes = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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

exports.sendSupportErrorLog = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const timestamp = String(body.timestamp || new Date().toISOString());
    const platform = String(body.platform || "unknown");
    const message = String(body.message || "Unknown error");
    const stack = String(body.stack || "No stack provided");
    const app = String(body.app || "GatorGuide");
    const severity = String(body.severity || "error");
    const category = String(body.category || "app");
    const operation = String(body.operation || "unknown-operation");
    const handled = typeof body.handled === "boolean" ? body.handled : true;
    const source = String(body.source || "app");
    const screen = String(body.screen || "");
    const route = String(body.route || "");
    const errorName = String(body.errorName || "");
    const errorCode = String(body.errorCode || "");
    const authState = String(body.authState || "unknown");
    const appVersion = String(body.appVersion || "");
    const buildVersion = String(body.buildVersion || "");
    const appOwnership = String(body.appOwnership || "");
    const userId = String(body.userId || "");
    const tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag || "")).filter(Boolean) : [];
    const details = body.details ?? null;
    const metadata = body.metadata ?? null;

    const detailBlock = details == null ? "" : escapeHtml(JSON.stringify(details, null, 2));
    const metadataBlock = metadata == null ? "" : escapeHtml(JSON.stringify(metadata, null, 2));
    const infoRows = [
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
    ].filter(([, value]) => String(value || "").trim());

    const detailsHtml = detailBlock
      ? `<p><strong>Details:</strong></p><pre style="white-space: pre-wrap; font-family: monospace;">${detailBlock}</pre>`
      : "";
    const metadataHtml = metadataBlock
      ? `<p><strong>Metadata:</strong></p><pre style="white-space: pre-wrap; font-family: monospace;">${metadataBlock}</pre>`
      : "";

    const subject = `[${app}] Client Error (${platform})`;
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

    const emailPayload = {
      from: SUPPORT_FROM_EMAIL,
      to: [SUPPORT_TO_EMAIL],
      subject,
      html,
    };

    const provider = await sendWithResend(emailPayload);
    res.status(200).json({ ok: true, provider });
  } catch (error) {
    const status = Number(error?.status) || 500;
    res.status(status).json({
      error: String(error?.message || "Unexpected error"),
      details: String(error?.details || ""),
    });
  }
});

exports.sendSupportMessage = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const timestamp = String(body.timestamp || new Date().toISOString());
    const platform = String(body.platform || "unknown");
    const app = String(body.app || "GatorGuide");
    const userName = String(body.userName || "Unknown");
    const userEmail = String(body.userEmail || "Unknown");
    const userUid = String(body.userUid || "Unknown");

    const subject = `[${app}] Support message from ${userName}`;
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

    const emailPayload = {
      from: SUPPORT_FROM_EMAIL,
      to: [SUPPORT_TO_EMAIL],
      subject,
      html,
    };

    const provider = await sendWithResend(emailPayload);
    res.status(200).json({ ok: true, provider });
  } catch (error) {
    const status = Number(error?.status) || 500;
    res.status(status).json({
      error: String(error?.message || "Unexpected error"),
      details: String(error?.details || ""),
    });
  }
});

exports.geminiGateway = geminiGateway;

