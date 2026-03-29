// services/config.ts
// All API keys are read from .env. Copy .env.example -> .env and fill in real values.
// Firebase: enable Authentication and Firestore in the console before use.
//
// NOTE about stub/sample data:
// - Stub mode is intended for local development and testing only.
// - Do NOT enable stub mode in production or commit a production .env with stubs enabled.
// - To enable locally, set EXPO_PUBLIC_USE_STUB_DATA=true in your local .env (local only).
//
// On localhost, email-link / verification redirects require `localhost` in
// Firebase Authentication -> Settings -> Authorized domains.
// OAuth providers may still be stricter in local web development.

const parseIntegerEnv = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
};

export const API_CONFIG = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  },

  functions: {
    region: process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "us-central1",
  },

  logging: {
    errorWebhookUrl:
      process.env.EXPO_PUBLIC_SUPPORT_ERROR_LOG_WEBHOOK ??
      (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
        ? `https://${process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "us-central1"}-${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/sendSupportErrorLog`
        : ""),
    maxQueuedErrorLogs: parseIntegerEnv(process.env.EXPO_PUBLIC_ERROR_LOG_QUEUE_MAX, 30, 5, 200),
  },

  collegeScorecard: {
    baseUrl: "https://api.data.gov/ed/collegescorecard/v1",
    apiKey: process.env.EXPO_PUBLIC_COLLEGE_SCORECARD_KEY || "STUB",
  },

  ai: {
    gatewayFunctionName: process.env.EXPO_PUBLIC_AI_GATEWAY_FUNCTION_NAME ?? "geminiGateway",
    timeoutMs: parseIntegerEnv(process.env.EXPO_PUBLIC_AI_TIMEOUT_MS, 15000, 4000, 30000),
  },

  opportunities: {
    gatewayFunctionName:
      process.env.EXPO_PUBLIC_OPPORTUNITY_GATEWAY_FUNCTION_NAME ??
      "opportunityGateway",
    timeoutMs: parseIntegerEnv(
      process.env.EXPO_PUBLIC_OPPORTUNITY_TIMEOUT_MS,
      20000,
      4000,
      30000
    ),
  },

  useStubData: false,

  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "",
  expoUsername: process.env.EXPO_PUBLIC_EXPO_USERNAME ?? "",
};

export const isStubMode = () => {
  // Stub mode is determined only by the in-repo config flag.
  // Environment-based overrides are intentionally not used for production builds.
  return !!API_CONFIG.useStubData;
};
