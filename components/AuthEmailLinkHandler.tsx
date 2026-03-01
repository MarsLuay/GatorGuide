import { useEffect, useRef } from "react";
import { Platform, Linking, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { authService, EMAIL_LINK_STORAGE_KEY } from "@/services/auth.service";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";

const PENDING_LINK_STORAGE_KEY = "gatorguide:pendingEmailLinkUrl";

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

  const tryCompleteEmailLinkSignIn = async (url: string | null) => {
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
        router.replace("/login");
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
      setTimeout(() => router.replace("/"), 50);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      Alert.alert(t("general.error"), msg);
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    if (!state.user) {
      Linking.getInitialURL().then(tryCompleteEmailLinkSignIn);

      const sub = Linking.addEventListener("url", (e) => {
        tryCompleteEmailLinkSignIn(e.url);
      });
      return () => sub.remove();
    }
  }, [state.user]);

  // Handle OAuth redirect result (Google/Microsoft) when user returns from redirect
  useEffect(() => {
    if (state.user) return;
    let mounted = true;
    authService.getRedirectResult().then((authUser) => {
      if (!mounted || !authUser) return;
      signInWithAuthUser(authUser);
      setTimeout(() => router.replace("/"), 50);
    });
    return () => { mounted = false; };
  }, [state.user, signInWithAuthUser, router]);

  useEffect(() => {
    if (Platform.OS !== "web" || state.user) return;
    if (typeof window === "undefined") return;

    const href = window.location.href;
    if (href && authService.isSignInWithEmailLink(href)) {
      tryCompleteEmailLinkSignIn(href);
    }
  }, [state.user]);

  return null;
}

export { PENDING_LINK_STORAGE_KEY };
