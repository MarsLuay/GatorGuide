import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  // @ts-ignore
  getReactNativePersistence 
} from "firebase/auth"; 
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_CONFIG } from "./config"; 

const firebaseConfig = {
  apiKey: API_CONFIG.firebase.apiKey,
  authDomain: API_CONFIG.firebase.authDomain,
  projectId: API_CONFIG.firebase.projectId,
  storageBucket: API_CONFIG.firebase.storageBucket,
  messagingSenderId: API_CONFIG.firebase.messagingSenderId,
  appId: Platform.select({
    ios: "1:789105310429:ios:34f7260f58a11df26f7934",
    android: "1:789105310429:android:f1a0ada4f7ca55cf6f7934",
    default: API_CONFIG.firebase.appId, 
  }),
};

const app = initializeApp(firebaseConfig);


export const auth = initializeAuth(app, {
  persistence: (getReactNativePersistence as any)(AsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;