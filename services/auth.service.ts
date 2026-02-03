// services/auth.service.ts
// Authentication service - handles Firebase Auth
// Currently uses stub data, will connect to Firebase later

import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from "firebase/auth";
import { isStubMode } from "./config";
import { firebaseAuth } from "./firebase";

export type AuthUser = {
  uid: string;
  email: string;
  name: string;
};

export type SignInCredentials = {
  email: string;
  name: string;
  password: string;
  isSignUp: boolean;
};

class AuthService {
  /**
   * Sign in or create user account
   * STUB: Returns mock user data
   * TODO: Replace with Firebase createUserWithEmailAndPassword / signInWithEmailAndPassword
   */
  async signIn(credentials: SignInCredentials): Promise<AuthUser> {
    if (isStubMode()) {
      // Stub implementation - simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      return {
        uid: `stub-${Date.now()}`,
        email: credentials.email,
        name: credentials.name,
      };
    }

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    if (credentials.isSignUp) {
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        credentials.email,
        credentials.password
      );

      if (credentials.name?.trim()) {
        await updateProfile(userCredential.user, { displayName: credentials.name.trim() });
      }

      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email ?? credentials.email,
        name: userCredential.user.displayName ?? credentials.name,
      };
    }

    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      credentials.email,
      credentials.password
    );

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email ?? credentials.email,
      name: userCredential.user.displayName ?? credentials.name,
    };
  }

  /**
   * Send password reset email
   * STUB: Returns success immediately
   * TODO: Replace with Firebase sendPasswordResetEmail
   */
  async sendPasswordReset(email: string): Promise<void> {
    if (isStubMode()) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(`[STUB] Password reset email sent to ${email}`);
      return;
    }

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    await sendPasswordResetEmail(firebaseAuth, email);
  }

  /**
   * Sign out current user
   * STUB: Clears local data only
   * TODO: Replace with Firebase signOut
   */
  async signOut(): Promise<void> {
    if (isStubMode()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log('[STUB] User signed out');
      return;
    }

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    await firebaseSignOut(firebaseAuth);
  }
}

export const authService = new AuthService();
