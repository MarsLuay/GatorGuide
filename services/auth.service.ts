import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  updateProfile 
} from "firebase/auth";
import { isStubMode } from "./config";
import { firebaseAuth } from "./firebase";

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
  password: string;
  isSignUp: boolean;
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

  async signOut(): Promise<void> {
    if (isStubMode()) return;

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    await firebaseSignOut(firebaseAuth);
  }
}

export const authService = new AuthService();