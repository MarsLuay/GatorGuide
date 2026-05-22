import { initializeApp, getApps } from "firebase/app";
import * as firebaseAuthSdk from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import { API_CONFIG, isStubMode } from "@/services/app/config";

type ReactNativePersistenceFactory = (
  storage: firebaseAuthSdk.ReactNativeAsyncStorage
) => firebaseAuthSdk.Persistence;

type FirebaseAuthModuleWithReactNativePersistence = typeof firebaseAuthSdk & {
  getReactNativePersistence?: ReactNativePersistenceFactory;
};

const getReactNativePersistence = (
  firebaseAuthSdk as FirebaseAuthModuleWithReactNativePersistence
).getReactNativePersistence;

const shouldInitFirebase = !isStubMode() && !!API_CONFIG.firebase.apiKey;

export const firebaseApp = shouldInitFirebase
  ? getApps().length
    ? getApps()[0]
    : initializeApp(API_CONFIG.firebase)
  : null;

function getAuthInstance() {
  if (!shouldInitFirebase || !firebaseApp) return null;
  if (Platform.OS === "ios" || Platform.OS === "android") {
    if (getReactNativePersistence) {
      return firebaseAuthSdk.initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    }
    // Fallback: initialize without react-native persistence if it's not available
    return firebaseAuthSdk.initializeAuth(firebaseApp);
  }
  return firebaseAuthSdk.getAuth(firebaseApp);
}

export const firebaseAuth = getAuthInstance();
export const db = shouldInitFirebase && firebaseApp ? getFirestore(firebaseApp) : null;
export const functionsClient =
  shouldInitFirebase && firebaseApp ? getFunctions(firebaseApp, API_CONFIG.functions.region) : null;
export const storage = shouldInitFirebase && firebaseApp ? getStorage(firebaseApp) : null;
