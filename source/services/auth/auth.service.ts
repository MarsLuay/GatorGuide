import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut as firebaseSignOut,
  updateProfile,
  deleteUser as firebaseDeleteUser,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { FIRESTORE_COLLECTIONS } from "@/constants/schema";
import { DEFAULT_USER_STATE } from "@/constants/profile-defaults";
import { isStubMode } from "@/services/app/config";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { db, firebaseAuth } from "@/services/firebase/firebase";
import { deleteAllUserData } from "./userData.service";

function firebaseUserToAuthUser(u: FirebaseUser): AuthUser {
  return {
    uid: u.uid,
    email: u.email ?? "",
    name: u.displayName ?? u.email ?? "",
  };
}

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

      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.users, userCredential.user.uid),
          {
            hasSeenOnboarding: false,
            email: userCredential.user.email ?? credentials.email,
            name: credentials.name?.trim() || userCredential.user.displayName || "",
            state: DEFAULT_USER_STATE,
          },
          { merge: true }
        ).catch((error) => {
          void errorLoggingService.captureException(error, {
            category: "firestore",
            operation: "seed-user-doc-after-signup",
            severity: "warn",
            handled: true,
            source: "auth.service",
            metadata: {
              uid: userCredential.user.uid,
            },
          });
        });
      }

      return firebaseUserToAuthUser(userCredential.user);
    }

    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      credentials.email,
      credentials.password
    );

    return firebaseUserToAuthUser(userCredential.user);
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

  /**
   * Sign in with Google (Web: popup. Native: use signInWithGoogleCredential after OAuth in AuthPage.)
   */
  async signInWithGoogle(): Promise<AuthUser> {
    if (isStubMode()) {
      await new Promise((r) => setTimeout(r, 500));
      return { uid: `stub-google-${Date.now()}`, email: "google@stub.local", name: "Google User" };
    }
    if (!firebaseAuth) throw new Error("Firebase Auth not configured");
    if (Platform.OS !== "web") {
      // Native flow signs in later via id token -> credential exchange.
      throw new Error("Use signInWithGoogleCredential on native (OAuth flow in AuthPage).");
    }
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    return firebaseUserToAuthUser(result.user);
  }

  /**
   * Sign in with Google on native using id_token (and optional access_token) from OAuth.
   */
  async signInWithGoogleCredential(idToken: string, accessToken?: string | null): Promise<AuthUser> {
    if (isStubMode()) {
      await new Promise((r) => setTimeout(r, 500));
      return { uid: `stub-google-${Date.now()}`, email: "google@stub.local", name: "Google User" };
    }
    if (!firebaseAuth) throw new Error("Firebase Auth not configured");
    const credential = GoogleAuthProvider.credential(idToken, accessToken ?? undefined);
    const result = await signInWithCredential(firebaseAuth, credential);
    return firebaseUserToAuthUser(result.user);
  }

  /**
   * Sign in with Microsoft (Web: popup. Native: use signInWithMicrosoftCredential after OAuth in AuthPage.)
   */
  async signInWithMicrosoft(): Promise<AuthUser> {
    if (isStubMode()) {
      await new Promise((r) => setTimeout(r, 500));
      return { uid: `stub-ms-${Date.now()}`, email: "ms@stub.local", name: "Microsoft User" };
    }
    if (!firebaseAuth) throw new Error("Firebase Auth not configured");
    if (Platform.OS !== "web") {
      throw new Error("Use signInWithMicrosoftCredential on native (OAuth flow in AuthPage).");
    }
    const provider = new OAuthProvider("microsoft.com");
    const result = await signInWithPopup(firebaseAuth, provider);
    return firebaseUserToAuthUser(result.user);
  }

  /**
   * Sign in with Microsoft on native using id_token (and optional access_token) from OAuth.
   */
  async signInWithMicrosoftCredential(idToken: string, accessToken?: string | null): Promise<AuthUser> {
    if (isStubMode()) {
      await new Promise((r) => setTimeout(r, 500));
      return { uid: `stub-ms-${Date.now()}`, email: "ms@stub.local", name: "Microsoft User" };
    }
    if (!firebaseAuth) throw new Error("Firebase Auth not configured");
    const provider = new OAuthProvider("microsoft.com");
    const credential = provider.credential({ idToken, accessToken: accessToken ?? undefined });
    const result = await signInWithCredential(firebaseAuth, credential);
    return firebaseUserToAuthUser(result.user);
  }

  /**
   * Check for OAuth redirect result (when user returns from Google/Microsoft sign-in).
   * Call on app load to complete redirect flow.
   */
  async getRedirectResult(): Promise<AuthUser | null> {
    if (isStubMode() || !firebaseAuth) return null;
    try {
      const result = await getRedirectResult(firebaseAuth);
      return result?.user ? firebaseUserToAuthUser(result.user) : null;
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    if (isStubMode()) return;

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    await firebaseSignOut(firebaseAuth);
  }

  /**
   * Delete account: remove all user data from Firestore + Storage, then delete Firebase Auth user.
   */
  async deleteAccount(): Promise<void> {
    if (isStubMode()) return;

    if (!firebaseAuth?.currentUser) {
      throw new Error("Not signed in");
    }

    const uid = firebaseAuth.currentUser.uid;
    // Start cleanup, but don't let cleanup latency block account deletion.
    const cleanupPromise = deleteAllUserData(uid).catch((error) => {
      void errorLoggingService.captureException(error, {
        category: "sync",
        operation: "pre-delete-account-cleanup",
        severity: "warn",
        handled: true,
        source: "auth.service",
        metadata: {
          uid,
        },
      });
    });

    await firebaseDeleteUser(firebaseAuth.currentUser);

    // Give cleanup a short window post-delete, then continue regardless.
    await Promise.race([
      cleanupPromise,
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  }
}

export const authService = new AuthService();
