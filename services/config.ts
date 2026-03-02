// services/config.ts
// 所有 API 密钥从 .env 读取，请复制 .env.example 为 .env 并填入实际值
// Firebase: 使用前请在控制台启用 Authentication 与 Firestore

// localhost 用 Google/Microsoft 登录会触发 "missing initial state"。解决：用邮箱/密码，或设 EXPO_PUBLIC_AUTH_DOMAIN=localhost:8081 并运行 node scripts/auth-proxy.js

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
  try {
    // Allow explicit override from environment variable
    const env = process.env.EXPO_PUBLIC_USE_STUB_DATA;
    if (typeof env === 'string') return env === 'true';
  } catch {
    // ignore
  }
  return !!API_CONFIG.useStubData;
};