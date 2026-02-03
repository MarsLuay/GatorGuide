import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from './firebase'; 
import { isStubMode } from './config';

export type AuthUser = {
  uid: string;
  email: string;
  name: string;
  major?: string;
  gpa?: string;
};

export type SignInCredentials = {
  email: string;
  name: string;
  password?: string; 
};

class AuthService {
  async signIn(credentials: SignInCredentials): Promise<AuthUser> {
    if (isStubMode()) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        uid: `stub-${Date.now()}`,
        email: credentials.email,
        name: credentials.name,
      };
    }

    try {
      const password = credentials.password || "TemporaryPassword123!"; 
      let userCredential;

      try {
        userCredential = await signInWithEmailAndPassword(auth, credentials.email, password);
      } catch (error: any) {
     
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          userCredential = await createUserWithEmailAndPassword(auth, credentials.email, password);
        } else {
          throw error;
        }
      }

      const user = userCredential.user;
      const userDocRef = doc(db, 'users', user.uid);
      
      const userSnap = await getDoc(userDocRef);
      const cloudData = userSnap.exists() ? userSnap.data() : {};

      setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: credentials.name || cloudData.displayName || cloudData.name,
        lastLogin: serverTimestamp(), 
      }, { merge: true }).catch(console.warn);

      return {
        uid: user.uid,
        email: user.email!,
        name: cloudData.displayName || cloudData.name || credentials.name,
        major: cloudData.major || cloudData.profileData?.major || "",
        gpa: cloudData.gpa || cloudData.profileData?.gpa || "",
      };
    } catch (error) {
      throw error;
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    if (isStubMode()) return;
    await sendPasswordResetEmail(auth, email);
  }

  async signOut(): Promise<void> {
    if (isStubMode()) return;
    await firebaseSignOut(auth);
  }

  async updateUserProfile(uid: string, data: any): Promise<void> {
    if (isStubMode()) return;
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        ...data,
        isProfileComplete: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      throw error;
    }
  }
}

export const authService = new AuthService();