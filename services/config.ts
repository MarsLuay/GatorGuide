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


  useStubData: false, 
};

export const isStubMode = () => false;