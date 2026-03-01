import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithCredential,
  signOut as firebaseSignOut,
  updateProfile,
  deleteUser as firebaseDeleteUser,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  User as FirebaseUser,
  type ActionCodeSettings,
} from "firebase/auth";
import { Platform } from "react-native";
import { API_CONFIG, isStubMode } from "./config";
import { firebaseAuth } from "./firebase";
import { deleteAllUserData } from "./userData.service";

/** Storage key for email when sending sign-in link (same-device completion) */
export const EMAIL_LINK_STORAGE_KEY = "gatorguide:emailForSignIn";

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

      // 直接登录，无需邮箱验证
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

  /**
   * Resend verification email. User must sign in with password first.
   */
  async resendVerificationEmail(email: string, password: string): Promise<void> {
    if (isStubMode()) {
      await new Promise((r) => setTimeout(r, 500));
      console.log(`[STUB] Verification email resent to ${email}`);
      return;
    }

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    try {
      await sendEmailVerification(userCredential.user);
    } finally {
      await firebaseSignOut(firebaseAuth);
    }
  }

  /**
   * Send sign-in link to email (passwordless). User clicks link to sign in.
   * Requires Firebase Console: Authentication → Sign-in method → Enable "Email link (passwordless sign-in)".
   */
  async sendSignInLinkToEmail(email: string): Promise<void> {
    if (isStubMode()) {
      await new Promise((r) => setTimeout(r, 500));
      console.log(`[STUB] Sign-in link sent to ${email}`);
      return;
    }

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    const authDomain = API_CONFIG.firebase.authDomain ?? "gatorguide.firebaseapp.com";
    const actionCodeSettings: ActionCodeSettings = {
      url: `https://${authDomain}/__/auth/links`,
      handleCodeInApp: true,
      iOS: {
        bundleId: "com.mobiledevelopment.gatorguide",
      },
      android: {
        packageName: "com.mobiledevelopment.gatorguide",
        installApp: false,
        minimumVersion: "1",
      },
    };

    await sendSignInLinkToEmail(firebaseAuth, email, actionCodeSettings);
  }

  /**
   * Check if the given URL is a sign-in with email link.
   */
  isSignInWithEmailLink(url: string): boolean {
    if (isStubMode()) return false;
    if (!firebaseAuth) return false;
    return isSignInWithEmailLink(firebaseAuth, url);
  }

  /**
   * Complete sign-in with email link. Call after isSignInWithEmailLink returns true.
   * Email can be from storage (same device) or user input (different device).
   */
  async signInWithEmailLink(email: string, url: string): Promise<AuthUser> {
    if (isStubMode()) {
      await new Promise((r) => setTimeout(r, 500));
      return { uid: `stub-link-${Date.now()}`, email, name: email.split("@")[0] ?? "User" };
    }

    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    const result = await signInWithEmailLink(firebaseAuth, email, url);
    return firebaseUserToAuthUser(result.user);
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
    await deleteAllUserData(uid);
    await firebaseDeleteUser(firebaseAuth.currentUser);
  }
}

export const authService = new AuthService();