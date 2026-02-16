// services/config.ts
// Firebase: 使用前请在控制台启用 Authentication 与 Firestore；若用自己项目请改下方配置或 .env（见 FIREBASE_SETUP.md）

export const API_CONFIG = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyCIOLEycu5VdfBEYoLjAMEwSaX0E5fNv2A',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'gatorguide.firebaseapp.com',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'gatorguide',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'gatorguide.firebasestorage.app',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '789105310429',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:789105310429:web:64763ee16b00a8e66f7934',
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-HGYJVN199N', // 可选，Analytics
  },


  collegeScorecard: {
    baseUrl: 'https://api.data.gov/ed/collegescorecard/v1',
    apiKey: process.env.EXPO_PUBLIC_COLLEGE_SCORECARD_KEY || 'STUB',
  },

  // Gemini API (free tier key via .env; client usage only if you accept exposure)
  gemini: {
    apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'STUB',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },

  // 默认连接真实 Firebase（Auth + Firestore）。仅本地调试不用 Firebase 时设 EXPO_PUBLIC_USE_STUB_DATA=true
  useStubData: false,

  // OAuth for mobile (Google / Microsoft). 可从 Firebase Console > Authentication > Google > Web 客户端 ID 复制；也可用 .env 的 EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID 覆盖。
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '789105310429-bimgjg3oajd0uepqjhb1jmsc02si76jj.apps.googleusercontent.com',
  microsoftClientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? '',
  // Expo Go 时 Google 只接受 HTTPS 重定向；此用户名需与 Google Cloud 里填的 auth.expo.io 地址一致。可用 .env EXPO_PUBLIC_EXPO_USERNAME 覆盖。
  expoUsername: process.env.EXPO_PUBLIC_EXPO_USERNAME ?? 'zixuan_zhou',
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