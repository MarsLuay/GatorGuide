import {
  ActionCodeURL,
  applyActionCode,
  createUserWithEmailAndPassword,
  getRedirectResult,
  reload,
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
import { doc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { ROUTES } from "@/constants/routes";
import { FIRESTORE_COLLECTIONS, STORAGE_KEYS } from "@/constants/schema";
import { isStubMode } from "./config";
import { errorLoggingService } from "./error-logging.service";
import { db, firebaseAuth } from "./firebase";
import { deleteAllUserData } from "./userData.service";

/** Storage key for email when sending sign-in link (same-device completion) */
export const EMAIL_LINK_STORAGE_KEY = STORAGE_KEYS.emailForSignIn;

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

type EmailActionType = "verify-email" | "email-link-sign-in";

class AuthService {
  private buildEmailActionUrl(action: EmailActionType): string {
    const query = new URLSearchParams({ authFlow: action }).toString();
    const loginPath = ROUTES.login.replace(/^\//, "");

    if (Platform.OS === "web" && typeof window !== "undefined") {
      return `${window.location.origin}${ROUTES.login}?${query}`;
    }

    return `gatorguide://${loginPath}?${query}`;
  }

  private getEmailActionSettings(action: EmailActionType, handleCodeInApp = true): ActionCodeSettings {
    return {
      url: this.buildEmailActionUrl(action),
      handleCodeInApp,
      iOS: {
        bundleId: "com.mobiledevelopment.gatorguide",
      },
      android: {
        packageName: "com.mobiledevelopment.gatorguide",
        installApp: false,
        minimumVersion: "1",
      },
    };
  }

  private buildVerificationRequiredError(email: string): Error & { code?: string; email?: string } {
    const err = new Error("Email verification required") as Error & { code?: string; email?: string };
    err.code = "auth/email-not-verified";
    err.email = email;
    return err;
  }

  private parseEmailActionLink(url: string): ActionCodeURL | null {
    if (!url) return null;
    try {
      return ActionCodeURL.parseLink(url);
    } catch {
      return null;
    }
  }

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

      // 注册必须邮箱验证：发送验证邮件后登出，用户验证后才能登录
      // Enforce verification at signup time before allowing a normal login session.
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.users, userCredential.user.uid),
          {
            hasSeenOnboarding: false,
            email: userCredential.user.email ?? credentials.email,
            name: credentials.name?.trim() || userCredential.user.displayName || "",
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

      await sendEmailVerification(
        userCredential.user,
        this.getEmailActionSettings("verify-email")
      );
      await firebaseSignOut(firebaseAuth);
      throw this.buildVerificationRequiredError(credentials.email);
    }

    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      credentials.email,
      credentials.password
    );

    await reload(userCredential.user);
    if (!userCredential.user.emailVerified) {
      await firebaseSignOut(firebaseAuth);
      throw this.buildVerificationRequiredError(credentials.email);
    }

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
      await sendEmailVerification(
        userCredential.user,
        this.getEmailActionSettings("verify-email")
      );
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

    const actionCodeSettings = this.getEmailActionSettings("email-link-sign-in");

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

  isEmailVerificationLink(url: string): boolean {
    if (isStubMode() || !firebaseAuth) return false;
    const actionLink = this.parseEmailActionLink(url);
    return actionLink?.operation === "VERIFY_EMAIL" && !!actionLink.code;
  }

  async completeEmailVerification(url: string): Promise<void> {
    if (isStubMode()) return;
    if (!firebaseAuth) {
      throw new Error("Firebase Auth not configured yet");
    }

    const actionLink = this.parseEmailActionLink(url);
    if (!actionLink || actionLink.operation !== "VERIFY_EMAIL" || !actionLink.code) {
      throw new Error("Invalid email verification link");
    }

    await applyActionCode(firebaseAuth, actionLink.code);
    if (firebaseAuth.currentUser) {
      await reload(firebaseAuth.currentUser).catch((error) => {
        void errorLoggingService.captureException(error, {
          category: "auth",
          operation: "reload-after-email-verification",
          severity: "warn",
          handled: true,
          source: "auth.service",
        });
      });
    }
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
