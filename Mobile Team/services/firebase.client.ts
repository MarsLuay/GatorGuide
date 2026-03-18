import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { API_CONFIG } from "./config";

const app = initializeApp(API_CONFIG.firebase);  

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
