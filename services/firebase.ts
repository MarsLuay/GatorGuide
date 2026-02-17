import { initializeApp, getApps } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
// Some firebase packages expose react-native persistence from a subpath
// and types may not be present in all installs — fall back with a ts-ignore.
// @ts-ignore
// Avoid static import of 'firebase/auth/react-native' which may not be present
// in all installs/bundlers. Resolve at runtime only when on native platforms.
let getReactNativePersistence: any | undefined;
try {
  // Use eval to prevent bundlers from statically analyzing the require call
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-var-requires
  const req: any = eval("require");
  const mod = req("firebase/auth/react-native");
  getReactNativePersistence = mod?.getReactNativePersistence;
} catch {
  getReactNativePersistence = undefined;
}
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
    if (getReactNativePersistence) {
      return initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    }
    // Fallback: initialize without react-native persistence if it's not available
    return initializeAuth(firebaseApp);
  }
  return getAuth(firebaseApp);
}

export const firebaseAuth = getAuthInstance();
export const db = shouldInitFirebase && firebaseApp ? getFirestore(firebaseApp) : null;
