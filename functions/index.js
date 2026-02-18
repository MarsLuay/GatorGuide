const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

const SUPPORT_TO_EMAIL = "gatorguide_mobiledevelopmentteam@outlook.com";
const SUPPORT_FROM_EMAIL = process.env.SUPPORT_FROM_EMAIL || "onboarding@resend.dev";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

exports.sendSupportErrorLog = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing RESEND_API_KEY" });
    return;
  }

  try {
    const body = req.body || {};
    const timestamp = String(body.timestamp || new Date().toISOString());
    const platform = String(body.platform || "unknown");
    const message = String(body.message || "Unknown error");
    const stack = String(body.stack || "No stack provided");
    const app = String(body.app || "GatorGuide");

    const subject = `[${app}] Client Error (${platform})`;
    const html = `
      <h2>${app} Error Report</h2>
      <p><strong>Timestamp:</strong> ${timestamp}</p>
      <p><strong>Platform:</strong> ${platform}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p><strong>Stack:</strong></p>
      <pre style="white-space: pre-wrap; font-family: monospace;">${stack}</pre>
    `;

    const emailPayload = {
      from: SUPPORT_FROM_EMAIL,
      to: [SUPPORT_TO_EMAIL],
      subject,
      html,
    };

    const sendRes = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!sendRes.ok) {
      const text = await sendRes.text().catch(() => "");
      res.status(502).json({ error: `Email provider error: ${sendRes.status}`, details: text });
      return;
    }

    const provider = await sendRes.json().catch(() => ({}));
    res.status(200).json({ ok: true, provider });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", details: String(error?.message || error) });
  }
});

