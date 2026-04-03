import { useCallback, useEffect, useRef } from "react";
import { Platform, Linking, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import { STORAGE_KEYS } from "@/constants/schema";
import { authService, EMAIL_LINK_STORAGE_KEY } from "@/services/auth/auth.service";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";

const PENDING_LINK_STORAGE_KEY = STORAGE_KEYS.pendingEmailLinkUrl;
const VERIFIED_EMAIL_QUERY_FLAG = "emailVerified=1";

/**
 * Handles Firebase email link sign-in when user clicks the magic link.
 * Runs on app load (initial URL) and when app opens from background (Linking events).
 * If email is not in storage (different device), stores URL for AuthPage to complete.
 */
export function AuthEmailLinkHandler() {
  const { state, signInWithAuthUser } = useAppData();
  const { t } = useAppLanguage();
  const router = useRouter();
  const processingRef = useRef(false);

  const redirectToVerifiedLogin = useCallback(() => {
    router.replace(ROUTES.loginWithQuery(VERIFIED_EMAIL_QUERY_FLAG));
  }, [router]);

  const tryCompleteEmailVerification = useCallback(async (url: string | null) => {
    if (!url || processingRef.current) return false;
    if (!authService.isEmailVerificationLink(url)) return false;

    processingRef.current = true;
    try {
      await authService.completeEmailVerification(url);
      redirectToVerifiedLogin();
      return true;
    } catch {
      Alert.alert(t("general.error"), t("auth.emailActionLinkFailed"));
      router.replace(ROUTES.login);
      return true;
    } finally {
      processingRef.current = false;
    }
  }, [redirectToVerifiedLogin, router, t]);

  const tryCompleteEmailLinkSignIn = useCallback(async (url: string | null) => {
    if (!url || processingRef.current) return;
    if (!authService.isSignInWithEmailLink(url)) return;
    if (state.user) return; // Already signed in

    processingRef.current = true;
    try {
      let email: string | null = null;

      if (Platform.OS === "web" && typeof window !== "undefined") {
        email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
      } else {
        email = await AsyncStorage.getItem(EMAIL_LINK_STORAGE_KEY);
      }

      if (!email) {
        // Different device: store URL for AuthPage to complete with email input
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.sessionStorage.setItem(PENDING_LINK_STORAGE_KEY, url);
        } else {
          await AsyncStorage.setItem(PENDING_LINK_STORAGE_KEY, url);
        }
        router.replace(ROUTES.login);
        processingRef.current = false;
        return;
      }

      const authUser = await authService.signInWithEmailLink(email, url);

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      } else {
        await AsyncStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      }

      await signInWithAuthUser(authUser);
      setTimeout(() => router.replace(ROUTES.root), 50);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      Alert.alert(t("general.error"), msg);
    } finally {
      processingRef.current = false;
    }
  }, [router, signInWithAuthUser, state.user, t]);

  useEffect(() => {
    if (!state.user) {
      Linking.getInitialURL().then(async (url) => {
        const handledVerification = await tryCompleteEmailVerification(url);
        if (!handledVerification) {
          await tryCompleteEmailLinkSignIn(url);
        }
      });

      const sub = Linking.addEventListener("url", (e) => {
        void (async () => {
          const handledVerification = await tryCompleteEmailVerification(e.url);
          if (!handledVerification) {
            await tryCompleteEmailLinkSignIn(e.url);
          }
        })();
      });
      return () => sub.remove();
    }
  }, [state.user, tryCompleteEmailLinkSignIn, tryCompleteEmailVerification]);

  // Handle OAuth redirect result (Google/Microsoft) when user returns from redirect
  useEffect(() => {
    if (state.user) return;
    let mounted = true;
    authService.getRedirectResult().then((authUser) => {
      if (!mounted || !authUser) return;
      signInWithAuthUser(authUser);
      setTimeout(() => router.replace(ROUTES.root), 50);
    });
    return () => { mounted = false; };
  }, [state.user, signInWithAuthUser, router]);

  useEffect(() => {
    if (Platform.OS !== "web" || state.user) return;
    if (typeof window === "undefined") return;

    const href = window.location.href;
    void (async () => {
      const handledVerification = await tryCompleteEmailVerification(href);
      if (!handledVerification && href && authService.isSignInWithEmailLink(href)) {
        await tryCompleteEmailLinkSignIn(href);
      }
    })();
  }, [state.user, tryCompleteEmailLinkSignIn, tryCompleteEmailVerification]);

  return null;
}

export { PENDING_LINK_STORAGE_KEY };
