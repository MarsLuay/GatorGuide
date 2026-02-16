import {
  createUserWithEmailAndPassword,
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
import { Platform } from "react-native";
import { isStubMode } from "./config";
import { firebaseAuth } from "./firebase";
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