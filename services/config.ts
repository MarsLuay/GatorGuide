// services/config.ts
// API configuration - replace with real keys when ready

export const API_CONFIG = {
  // Firebase config (add from Firebase Console later)
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'STUB',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'STUB',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'STUB',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'STUB',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'STUB',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'STUB',
  },

  // College Scorecard API (free from api.data.gov)
  collegeScorecard: {
    baseUrl: 'https://api.data.gov/ed/collegescorecard/v1',
    apiKey: process.env.EXPO_PUBLIC_COLLEGE_SCORECARD_KEY || 'STUB',
  },

  // Gemini API (free tier key via .env; client usage only if you accept exposure)
  gemini: {
    apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'STUB',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },

  // Feature flags
  useStubData: process.env.EXPO_PUBLIC_USE_STUB_DATA !== 'false', // Default to stub data
};

export const isStubMode = () => API_CONFIG.useStubData || API_CONFIG.firebase.apiKey === 'STUB';
