import { initializeApp, getApps } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { API_CONFIG, isStubMode } from "./config";

const shouldInitFirebase = !isStubMode();

export const firebaseApp = shouldInitFirebase
  ? getApps().length
    ? getApps()[0]
    : initializeApp(API_CONFIG.firebase)
  : null;

function getAuthInstance() {
  if (!shouldInitFirebase || !firebaseApp) return null;
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  }
  return getAuth(firebaseApp);
}

export const firebaseAuth = getAuthInstance();
export const db = shouldInitFirebase && firebaseApp ? getFirestore(firebaseApp) : null;
