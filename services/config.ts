// services/config.ts

export const API_CONFIG = {

  firebase: {
    apiKey: 'AIzaSyCIOLEycu5VdfBEYoLjAMEwSaX0E5fNv2A',
    authDomain: 'gatorguide.firebaseapp.com',
    projectId: 'gatorguide',
    storageBucket: 'gatorguide.firebasestorage.app',
    messagingSenderId: '789105310429',
    appId: '1:789105310429:web:64763ee16b00a8e66f7934',
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

  // default to true for local development; override with EXPO_PUBLIC_USE_STUB_DATA=false
  useStubData: true,
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