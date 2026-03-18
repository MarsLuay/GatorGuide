// services/config.ts
// All API keys are read from .env. Copy .env.example -> .env and fill in real values.
// Firebase: enable Authentication and Firestore in the console before use.
//
// NOTE about stub/sample data:
// - Stub mode is intended for local development and testing only.
// - Do NOT enable stub mode in production or commit a production .env with stubs enabled.
// - To enable locally, set EXPO_PUBLIC_USE_STUB_DATA=true in your local .env (local only).
//
// On localhost, Google/Microsoft login may show "missing initial state". Workarounds:
// - Use email/password auth, or set EXPO_PUBLIC_AUTH_DOMAIN=localhost:8081 and run
//   `node scripts/auth-proxy.js` while developing locally.

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

  collegeScorecard: {
    baseUrl: "https://api.data.gov/ed/collegescorecard/v1",
    apiKey: process.env.EXPO_PUBLIC_COLLEGE_SCORECARD_KEY || "STUB",
  },

  gemini: {
    apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || "STUB",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
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