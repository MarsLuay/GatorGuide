import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { API_CONFIG, isStubMode } from "./config";

const shouldInitFirebase = !isStubMode();

export const firebaseApp = shouldInitFirebase
  ? getApps().length
    ? getApps()[0]
    : initializeApp(API_CONFIG.firebase)
  : null;

export const firebaseAuth = shouldInitFirebase && firebaseApp ? getAuth(firebaseApp) : null;
export const db = shouldInitFirebase && firebaseApp ? getFirestore(firebaseApp) : null;
