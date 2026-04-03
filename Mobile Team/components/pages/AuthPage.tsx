import { useMemo, useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, Alert, Keyboard, TouchableWithoutFeedback, Platform, ScrollView, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { makeRedirectUri, useAuthRequest, useAutoDiscovery, ResponseType } from "expo-auth-session";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { ROUTES } from "@/constants/routes";
import { STORAGE_KEYS } from "@/constants/schema";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FormInput } from "@/components/ui/FormInput";
import { authService, EMAIL_LINK_STORAGE_KEY } from "@/services/auth/auth.service";
import { errorLoggingService } from "@/services";
import { PENDING_LINK_STORAGE_KEY } from "@/components/AuthEmailLinkHandler";
import { API_CONFIG } from "@/services/app/config";
import { SUPPORT_MAILTO } from "@/constants/support";

WebBrowser.maybeCompleteAuthSession();

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
const PENDING_DELETE_ACCOUNT_KEY = STORAGE_KEYS.pendingDeleteAccount;
const ONBOARDING_DEBUG_LOG_KEY = STORAGE_KEYS.onboardingDebugLog;

export default function AuthPage() {
  const params = useLocalSearchParams<{ emailVerified?: string | string[] }>();
  const { isHydrated, signIn, signInWithAuthUser, signInAsGuest, updateUser, setQuestionnaireAnswers, deleteAccount } = useAppData();
  const { t } = useAppLanguage();
  const styles = useThemeStyles();
  const { isDark } = useAppTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);
  const [emailLinkSentTo, setEmailLinkSentTo] = useState<string | null>(null);
  const [sendingEmailLink, setSendingEmailLink] = useState(false);
  const [pendingLinkUrl, setPendingLinkUrl] = useState<string | null>(null);
  const [completingLink, setCompletingLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [onboardingDebugEnabled, setOnboardingDebugEnabled] = useState(false);
  const [showOnboardingDebugConsole, setShowOnboardingDebugConsole] = useState(false);
  const [onboardingDebugLogs, setOnboardingDebugLogs] = useState<string[]>([]);
  const [onboardingCopyStatus, setOnboardingCopyStatus] = useState<"" | "copied" | "failed">("");
  const emailVerifiedFlag = Array.isArray(params.emailVerified) ? params.emailVerified[0] : params.emailVerified;

  const appendOnboardingDebugLog = useCallback(async (message: string) => {
    const line = `${new Date().toISOString()} | ${message}`;
    setOnboardingDebugLogs((prev) => {
      const next = [...prev, line];
      return next.slice(-300);
    });
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_DEBUG_LOG_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [...arr, line].slice(-500);
      await AsyncStorage.setItem(ONBOARDING_DEBUG_LOG_KEY, JSON.stringify(next));
    } catch {
      // ignore debug persistence errors
    }
  }, []);

  const clearOnboardingDebugLogs = useCallback(async () => {
    setOnboardingDebugLogs([]);
    setOnboardingCopyStatus("");
    await AsyncStorage.removeItem(ONBOARDING_DEBUG_LOG_KEY).catch(() => {});
  }, []);

  const copyOnboardingDebugLogs = useCallback(async () => {
    try {
      const text = onboardingDebugLogs.join("\n");
      if (!text || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setOnboardingCopyStatus("failed");
        return;
      }
      await navigator.clipboard.writeText(text);
      setOnboardingCopyStatus("copied");
    } catch {
      setOnboardingCopyStatus("failed");
    }
  }, [onboardingDebugLogs]);

  const getFriendlyAuthMessage = useCallback(
    (
      error: unknown,
      context: {
        flow?: "sign-in" | "email-link" | "provider" | "account-delete";
        provider?: "google" | "microsoft";
      } = {}
    ): string | null => {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined;
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error &&
              typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message
            : "";

      if (code === "auth/popup-closed-by-user" || /cancelled|canceled|dismissed by user/i.test(message)) {
        return null;
      }

      switch (code) {
        case "auth/invalid-email":
          return t("auth.invalidEmail");
        case "auth/user-not-found":
          return t("auth.no_matches");
        case "auth/wrong-password":
          return t("auth.wrongPassword");
        case "auth/invalid-credential":
          return t("auth.invalidCredential");
        case "auth/email-already-in-use":
          return t("auth.emailAlreadyInUse");
        case "auth/weak-password":
          return t("auth.passwordMinimum");
        case "auth/too-many-requests":
          return t("auth.tooManyAttempts");
        case "auth/network-request-failed":
          return t("auth.networkError");
        case "auth/user-disabled":
          return t("auth.accountDisabled");
        case "auth/operation-not-allowed":
          return context.flow === "email-link"
            ? t("auth.presentation.emailLinkUnavailable")
            : t("auth.presentation.signInMethodUnavailable");
        case "auth/verification-email-failed":
          return t("auth.verificationEmailFailed");
        case "auth/email-not-verified":
          return t("auth.emailNotVerified");
        case "auth/unauthorized-continue-uri":
        case "auth/invalid-continue-uri":
          return context.flow === "email-link"
            ? t("auth.presentation.emailLinkFallback")
            : t("auth.presentation.oauthFallback");
        case "auth/invalid-action-code":
        case "auth/expired-action-code":
          return t("auth.emailActionLinkFailed");
        case "auth/requires-recent-login":
          return t("auth.presentation.deleteRetryLogin");
        default:
          break;
      }

      if (context.flow === "provider") {
        if (/popup|redirect|sessionStorage|initial state/i.test(message)) {
          return t("auth.presentation.oauthFallback");
        }
        if (/available on web|web/i.test(message)) {
          return t("auth.presentation.providerUnavailableWeb");
        }
      }

      return t("auth.loginFailed");
    },
    [t]
  );

  const handlePostAuthRoute = useCallback(async () => {
    await appendOnboardingDebugLog("Post-auth route check started.");
    const pendingDelete = await AsyncStorage.getItem(PENDING_DELETE_ACCOUNT_KEY).catch(() => null);
    if (pendingDelete === "true") {
      await appendOnboardingDebugLog("Pending delete flag found. Executing deleteAccount after auth.");
      await AsyncStorage.removeItem(PENDING_DELETE_ACCOUNT_KEY).catch(() => {});
      try {
        await deleteAccount();
        await appendOnboardingDebugLog(`Post-auth deleteAccount succeeded. Redirecting to ${ROUTES.login}.`);
        Alert.alert(t("auth.presentation.accountDeletedTitle"), t("auth.presentation.accountDeletedMessage"));
        router.replace(ROUTES.login);
        return;
      } catch (err: any) {
        const code = err?.code as string | undefined;
        await appendOnboardingDebugLog(`Post-auth deleteAccount failed. code=${code ?? "none"} message=${String(err?.message ?? "unknown")}`);
        const friendly = getFriendlyAuthMessage(err, { flow: "account-delete" });
        if (friendly) {
          Alert.alert(t("general.error"), friendly);
        }
      }
    }
    await appendOnboardingDebugLog(`Post-auth route complete. Redirecting to ${ROUTES.root}`);
    setTimeout(() => router.replace(ROUTES.root), 50);
  }, [appendOnboardingDebugLog, deleteAccount, getFriendlyAuthMessage, t]);

  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  const isExpoGo = Constants.appOwnership === "expo";
  // Shared deep-link target used by native OAuth redirects.
  const redirectUri = makeRedirectUri({ scheme: "gatorguide", path: "auth" });
  const microsoftDiscovery = useAutoDiscovery("https://login.microsoftonline.com/common/v2.0");

  const [, microsoftResponse, microsoftPromptAsync] = useAuthRequest(
    {
      clientId: API_CONFIG.microsoftClientId || "dummy",
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: ResponseType.IdToken,
    },
    microsoftDiscovery ?? null
  );

  useEffect(() => {
    if (!__DEV__) return;
    AsyncStorage.getItem(ONBOARDING_DEBUG_LOG_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as string[];
        setOnboardingDebugLogs(Array.isArray(parsed) ? parsed.slice(-300) : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const storedPendingLink =
        Platform.OS === "web" && typeof window !== "undefined"
          ? window.sessionStorage.getItem(PENDING_LINK_STORAGE_KEY)
          : await AsyncStorage.getItem(PENDING_LINK_STORAGE_KEY);

      if (mounted) {
        setPendingLinkUrl(storedPendingLink);
      }
    })().catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (emailVerifiedFlag !== "1") return;

    setVerificationPendingEmail(null);
    Alert.alert(t("auth.emailVerifiedTitle"), t("auth.emailVerifiedSuccess"));

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("emailVerified");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return;
    }

    router.replace(ROUTES.login);
  }, [emailVerifiedFlag, t]);

  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "~" || event.key === "`" || event.code === "Backquote") {
        setOnboardingDebugEnabled((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (microsoftResponse?.type !== "success" || !isNative) return;
    const idToken = (microsoftResponse.params as Record<string, string>).id_token;
    if (!idToken) return;
    (async () => {
      try {
        const authUser = await authService.signInWithMicrosoftCredential(idToken);
        await signInWithAuthUser(authUser);
        await handlePostAuthRoute();
      } catch (err: unknown) {
        const friendly = getFriendlyAuthMessage(err, { flow: "provider", provider: "microsoft" });
        if (friendly) {
          Alert.alert(t("general.error"), friendly);
        }
      }
    })();
  }, [microsoftResponse, getFriendlyAuthMessage, isNative, signInWithAuthUser, t, handlePostAuthRoute]);

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    return trimmed && !isEmailValid(trimmed) ? t("auth.emailInvalid") : undefined;
  }, [email, t]);

  const passwordError = useMemo(() => {
    return password && password.length < 6 ? t("auth.passwordMinimumShort") : undefined;
  }, [password, t]);

  const canSubmit = useMemo(() => {
    if (isSignUp) {
      return !!name.trim() && isEmailValid(email.trim()) && password.length >= 6;
    }
    return isEmailValid(email.trim()) && password.length >= 6;
  }, [name, email, password, isSignUp]);

  const handleSubmit = async () => {
    const n = name.trim();
    const e = email.trim();
    await appendOnboardingDebugLog(`Submit pressed. mode=${isSignUp ? "signup" : "login"} email=${e.toLowerCase()}`);

    if (isSignUp && !n) {
      Alert.alert(t("general.error"), t("auth.pleaseEnterName"));
      return;
    }

    if (!isEmailValid(e)) {
      Alert.alert(t("general.error"), t("auth.emailInvalid"));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t("general.error"), t("auth.passwordMinimum"));
      return;
    }

    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    try {
      await signIn({ name: n || t('auth.defaultUser'), email: e, password, isSignUp });
      await appendOnboardingDebugLog(`signIn() resolved. mode=${isSignUp ? "signup" : "login"}`);

      // On signup, migrate any guest-mode progress into the new account.
      if (isSignUp) {
        try {
          const pendingData = await AsyncStorage.getItem(STORAGE_KEYS.pendingAccountData);
          if (pendingData) {
            const parsed = JSON.parse(pendingData);
            if (parsed.user) {
              await updateUser({
                major: parsed.user.major,
                gpa: parsed.user.gpa,
                resume: parsed.user.resume,
                transcript: parsed.user.transcript,
              });
            }
            if (parsed.questionnaireAnswers) {
              await setQuestionnaireAnswers(parsed.questionnaireAnswers);
            }
            await AsyncStorage.removeItem(STORAGE_KEYS.pendingAccountData);
          }
        } catch {
          void errorLoggingService.captureMessage("Pending account data migration failed after signup.", {
            category: "auth",
            operation: "migrate-pending-account-data",
            severity: "warn",
            handled: true,
            source: "auth-page",
            screen: "auth",
            route: ROUTES.login,
            metadata: {
              isSignUp: true,
            },
          });
        }
      }

      await handlePostAuthRoute();
    } catch (err: any) {
      void errorLoggingService.captureException(err, {
        category: "auth",
        operation: isSignUp ? "email-password-sign-up" : "email-password-log-in",
        severity: "error",
        handled: true,
        source: "auth-page",
        screen: "auth",
        route: ROUTES.login,
        metadata: {
          isSignUp,
          code: err?.code ?? null,
        },
      });
      await appendOnboardingDebugLog(`signIn() rejected. code=${String(err?.code ?? "none")} message=${String(err?.message ?? "unknown")}`);

      if (err?.code === 'auth/email-verification-required' || err?.code === 'auth/email-not-verified') {
        await appendOnboardingDebugLog("Signup requires email verification. Awaiting user verification login.");
        setVerificationPendingEmail(err?.email ?? e);
        setIsSignUp(false);
        return;
      }

      const friendly = getFriendlyAuthMessage(err, { flow: "sign-in" });
      if (friendly) {
        Alert.alert(t('general.error'), friendly);
        if (err?.code === 'auth/email-already-in-use' && isSignUp) {
          setIsSignUp(false);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEmailLink = async () => {
    const e = email.trim();
    if (!pendingLinkUrl || !isEmailValid(e)) return;
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCompletingLink(true);
    try {
      const authUser = await authService.signInWithEmailLink(e, pendingLinkUrl);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.sessionStorage.removeItem(PENDING_LINK_STORAGE_KEY);
      } else {
        await AsyncStorage.removeItem(PENDING_LINK_STORAGE_KEY);
      }
      await signInWithAuthUser(authUser);
      setPendingLinkUrl(null);
      await handlePostAuthRoute();
    } catch (err: unknown) {
      void errorLoggingService.captureException(err, {
        category: "auth",
        operation: "complete-email-link-sign-in",
        severity: "error",
        handled: true,
        source: "auth-page",
        screen: "auth",
        route: ROUTES.login,
      });
      const friendly = getFriendlyAuthMessage(err, { flow: "email-link" });
      if (friendly) {
        Alert.alert(t("general.error"), friendly);
      }
    } finally {
      setCompletingLink(false);
    }
  };

  const handleSendEmailLink = async () => {
    const e = email.trim();
    if (!isEmailValid(e)) {
      Alert.alert(t("general.error"), t("auth.emailInvalid"));
      return;
    }
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendingEmailLink(true);
    try {
      await authService.sendSignInLinkToEmail(e);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, e);
      } else {
        await AsyncStorage.setItem(EMAIL_LINK_STORAGE_KEY, e);
      }
      setEmailLinkSentTo(e);
      setVerificationPendingEmail(null);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      void errorLoggingService.captureException(err, {
        category: "auth",
        operation: "send-email-link-sign-in",
        severity: "error",
        handled: true,
        source: "auth-page",
        screen: "auth",
        route: ROUTES.login,
        metadata: {
          code: code ?? null,
        },
      });
      const friendly = getFriendlyAuthMessage(err, { flow: "email-link" });
      let msg = friendly ?? t("auth.loginFailed");
      if (false && friendly) {
        msg = t("auth.emailLinkNotEnabled") || "Please enable Email link (passwordless sign-in) in Firebase Console → Authentication → Sign-in method.";
      } else if (code === "auth/invalid-email") {
        msg = t("auth.emailInvalid");
      } else if (false && (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri")) {
        msg = t("auth.localhostAuthorizedDomainHint");
      }
      Alert.alert(t("general.error"), msg);
    } finally {
      setSendingEmailLink(false);
    }
  };

  const handleGuestSignIn = async () => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.removeItem(PENDING_DELETE_ACCOUNT_KEY).catch(() => {});
    await signInAsGuest();
    setTimeout(() => router.replace("/"), 50);
  };

  const handleProviderSignIn = async (provider: "google" | "microsoft") => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const isWeb = Platform.OS === "web";
    // Web and native provider auth use different SDK flows.
    if (isWeb) {
      try {
        const authUser =
          provider === "google"
            ? await authService.signInWithGoogle()
            : await authService.signInWithMicrosoft();
        await signInWithAuthUser(authUser);
        await handlePostAuthRoute();
      } catch (err: unknown) {
        void errorLoggingService.captureException(err, {
          category: "auth",
          operation: `${provider}-provider-sign-in-web`,
          severity: "error",
          handled: true,
          source: "auth-page",
          screen: "auth",
          route: ROUTES.login,
          metadata: {
            provider,
            platform: "web",
          },
        });
        const friendly = getFriendlyAuthMessage(err, { flow: "provider", provider });
        if (friendly) {
          Alert.alert(t("general.error"), friendly);
        }
      }
      return;
    }
    if (provider === "google") {
      if (!API_CONFIG.googleWebClientId) {
        Alert.alert(t("general.error"), t("auth.presentation.googleUnavailable"));
        return;
      }
      if (isExpoGo) {
        Alert.alert(t("general.error"), t("auth.presentation.googleDevBuildRequired"));
        if (Platform.OS !== "web") return;
        Alert.alert(
          t("general.error"),
          "Google 登录需使用开发构建，Expo Go 不支持。\n\n请运行: npx expo run:ios\n或: npx expo run:android"
        );
        return;
      }
      try {
        const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
        GoogleSignin.configure({ webClientId: API_CONFIG.googleWebClientId });
        const res = await GoogleSignin.signIn();
        if (res?.type === "cancelled") return;
        if (res?.type !== "success" || !res.data) throw new Error("Google sign-in failed");
        let idToken = res.data.idToken;
        if (!idToken) {
          const tokens = await GoogleSignin.getTokens();
          idToken = tokens.idToken;
        }
        if (!idToken) throw new Error("Could not get Google id token");
        const authUser = await authService.signInWithGoogleCredential(idToken);
        await signInWithAuthUser(authUser);
        await handlePostAuthRoute();
      } catch (err: unknown) {
        void errorLoggingService.captureException(err, {
          category: "auth",
          operation: "google-provider-sign-in-native",
          severity: "error",
          handled: true,
          source: "auth-page",
          screen: "auth",
          route: ROUTES.login,
          metadata: {
            provider: "google",
            platform: Platform.OS,
          },
        });
        const friendly = getFriendlyAuthMessage(err, { flow: "provider", provider: "google" });
        if (friendly) {
          Alert.alert(t("general.error"), friendly);
        }
      }
      return;
    }
    if (provider === "microsoft") {
      if (!API_CONFIG.microsoftClientId) {
        Alert.alert(t("general.error"), t("auth.presentation.microsoftUnavailable"));
        return;
      }
      try {
        await microsoftPromptAsync();
      } catch (err: unknown) {
        void errorLoggingService.captureException(err, {
          category: "auth",
          operation: "microsoft-provider-sign-in-native",
          severity: "error",
          handled: true,
          source: "auth-page",
          screen: "auth",
          route: ROUTES.login,
          metadata: {
            provider: "microsoft",
            platform: Platform.OS,
          },
        });
        const friendly = getFriendlyAuthMessage(err, { flow: "provider", provider: "microsoft" });
        if (friendly) {
          Alert.alert(t("general.error"), friendly);
        }
      }
    }
  };

  const isWeb = Platform.OS === 'web';
  const containerClass = isWeb 
    ? "flex-1 items-center justify-center px-4 py-12 min-h-screen"
    : "flex-1 items-center justify-center px-6";
  const cardMaxWidthClass = isWeb ? "w-full max-w-lg" : "w-full max-w-md";

  const authContent = (
    <View className={cardMaxWidthClass}>
      <View className="items-center mb-8">
        <View className="bg-emerald-500 p-4 rounded-full">
          <FontAwesome5 name="graduation-cap" size={48} color="#001f0f" />
        </View>
      </View>

      <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>{t("auth.gatorguide")}</Text>
      <Text className={`${styles.secondaryTextClass} text-center mb-8`}>{t("auth.findCollege")}</Text>

      <View className={`${styles.cardBgClass} border rounded-2xl p-6 ${isWeb ? "shadow-lg" : ""}`}>
        {__DEV__ && onboardingDebugEnabled ? (
          <View className="mb-4 border border-emerald-500/40 rounded-lg p-3">
            <View className="flex-row items-center justify-between">
              <Text className={`${styles.textClass} font-semibold text-sm`}>Onboarding/Auth Debug</Text>
              <Pressable onPress={() => setShowOnboardingDebugConsole((v) => !v)} className="px-3 py-1 rounded-lg bg-emerald-500">
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} text-xs font-semibold`}>
                  {showOnboardingDebugConsole ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row gap-2 mt-2">
              <Pressable onPress={copyOnboardingDebugLogs} className="px-3 py-1.5 rounded-lg bg-emerald-300">
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} text-xs font-semibold`}>Copy Logs</Text>
              </Pressable>
              <Pressable onPress={() => { void clearOnboardingDebugLogs(); }} className="px-3 py-1.5 rounded-lg bg-emerald-300">
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} text-xs font-semibold`}>Clear</Text>
              </Pressable>
            </View>
            {onboardingCopyStatus ? (
              <Text className={`${styles.secondaryTextClass} text-xs mt-2`}>
                {onboardingCopyStatus === "copied" ? "Logs copied to clipboard." : "Clipboard copy failed."}
              </Text>
            ) : null}
            {showOnboardingDebugConsole ? (
              <Text selectable className={`${styles.secondaryTextClass} text-xs mt-2`}>
                {onboardingDebugLogs.length ? onboardingDebugLogs.join("\n") : "No onboarding/auth logs yet."}
              </Text>
            ) : null}
          </View>
        ) : null}

        {verificationPendingEmail && (
          <View className="bg-emerald-500/20 border border-emerald-500 rounded-lg p-4 mb-4">
            <Text className={`${styles.textClass} font-semibold mb-1`}>{t("auth.checkYourEmail")}</Text>
            <Text className={styles.secondaryTextClass}>
              {t("auth.verificationEmailSent")}
            </Text>
            <Text className={`${styles.secondaryTextClass} mt-1`}>{t("auth.verificationRequiredHint")}</Text>
            <Text className={`${styles.secondaryTextClass} mt-2 font-medium`}>{verificationPendingEmail}</Text>
            <Pressable
              onPress={async () => {
                const e = verificationPendingEmail;
                if (!e || !password || password.length < 6) {
                  Alert.alert(t("general.error"), t("auth.enterPasswordToResend"));
                  return;
                }
                setResendingVerification(true);
                try {
                  await authService.resendVerificationEmail(e, password);
                  Alert.alert(t("auth.checkYourEmail"), t("auth.verificationEmailResent"));
                } catch (err: unknown) {
                  const friendly = getFriendlyAuthMessage(err, { flow: "sign-in" });
                  if (friendly) {
                    Alert.alert(t("general.error"), friendly);
                  }
                } finally {
                  setResendingVerification(false);
                }
              }}
              disabled={resendingVerification || !password || password.length < 6}
              className="mt-3 py-2 rounded-lg items-center border border-emerald-500"
            >
              <Text className={`${resendingVerification || !password || password.length < 6 ? "opacity-60" : ""} ${styles.textClass}`}>
                {resendingVerification ? t("general.pleaseWait") : t("auth.resendVerificationEmail")}
              </Text>
            </Pressable>
          </View>
        )}

        {emailLinkSentTo && (
          <View className="bg-emerald-500/20 border border-emerald-500 rounded-lg p-4 mb-4">
            <Text className={`${styles.textClass} font-semibold mb-1`}>{t("auth.checkYourEmail")}</Text>
            <Text className={styles.secondaryTextClass}>
              {t("auth.emailLinkSent")}
            </Text>
            <Text className={`${styles.secondaryTextClass} mt-2 font-medium`}>{emailLinkSentTo}</Text>
          </View>
        )}

        {pendingLinkUrl && (
          <View className="bg-amber-500/20 border border-amber-500 rounded-lg p-4 mb-4">
            <Text className={`${styles.textClass} font-semibold mb-1`}>{t("auth.emailLinkDifferentDevice")}</Text>
            <Text className={styles.secondaryTextClass + " mb-3"}>
              {t("auth.enterEmailToComplete")}
            </Text>
            <Pressable
              onPress={handleCompleteEmailLink}
              disabled={!isEmailValid(email.trim()) || completingLink}
              className="bg-amber-500 rounded-lg py-2 items-center mt-2"
            >
              <Text className={`${isDark ? 'text-white' : 'text-emerald-900'} font-semibold`}>
                {completingLink ? t("general.pleaseWait") : t("auth.completeSignIn")}
              </Text>
            </Pressable>
          </View>
        )}

        <View className="flex-row gap-4 mb-6">
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setVerificationPendingEmail(null);
              setEmailLinkSentTo(null);
              setIsSignUp(true);
            }}
            className={`flex-1 py-3 rounded-lg items-center ${isSignUp ? "bg-emerald-500" : styles.inactiveButtonClass}`}
            disabled={!isHydrated}
          >
            <Text className={isSignUp ? (isDark ? "text-white" : "text-emerald-900") : styles.secondaryTextClass}>{t("auth.signUp")}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEmailLinkSentTo(null);
              setIsSignUp(false);
            }}
            className={`flex-1 py-3 rounded-lg items-center ${!isSignUp ? "bg-emerald-500" : styles.inactiveButtonClass}`}
            disabled={!isHydrated}
          >
            <Text className={!isSignUp ? (isDark ? "text-white" : "text-emerald-900") : styles.secondaryTextClass}>{t("auth.logIn")}</Text>
          </Pressable>
        </View>

        <View className="gap-4">
          {isSignUp && (
            <FormInput
              label={t("auth.name")}
              value={name}
              onChangeText={setName}
              placeholder={t("auth.name")}
              textClass={styles.textClass}
              secondaryTextClass={styles.secondaryTextClass}
              inputBgClass={styles.inputBgClass}
              placeholderColor={styles.placeholderColor}
              editable={isHydrated}
              returnKeyType="next"
            />
          )}

          <FormInput
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.email")}
            error={emailError}
            textClass={styles.textClass}
            secondaryTextClass={styles.secondaryTextClass}
            inputBgClass={styles.inputBgClass}
            placeholderColor={styles.placeholderColor}
            editable={isHydrated}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <FormInput
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? t("auth.password") : t("auth.password")}
            error={passwordError}
            textClass={styles.textClass}
            secondaryTextClass={styles.secondaryTextClass}
            inputBgClass={styles.inputBgClass}
            placeholderColor={styles.placeholderColor}
            editable={isHydrated}
            secureTextEntry
            returnKeyType="done"
          />

          {!isSignUp && (
            <View className="items-end">
              <Pressable onPress={() => router.push(ROUTES.forgotPassword)} disabled={!isHydrated}>
                <Text className="text-sm text-emerald-500">{t("auth.forgotPassword")}</Text>
              </Pressable>
            </View>
          )}

          <View className={`flex-row items-center gap-2 my-3 ${styles.secondaryTextClass}`}>
            <View className="flex-1 h-px bg-emerald-300 dark:bg-gray-700" />
            <Text className="text-xs">{t("auth.or")}</Text>
            <View className="flex-1 h-px bg-emerald-300 dark:bg-gray-700" />
          </View>

          {isWeb && (
            <Text className={`${styles.secondaryTextClass} text-xs text-center mb-2`}>
              {t("auth.presentation.oauthFallback")}
            </Text>
          )}

          {!isSignUp && (
            <Pressable
              onPress={handleSendEmailLink}
              disabled={!isHydrated || !isEmailValid(email.trim()) || sendingEmailLink}
              className={`${styles.cardBgClass} border ${styles.borderClass} rounded-lg py-3 flex-row items-center justify-center gap-2 ${!isHydrated || !isEmailValid(email.trim()) || sendingEmailLink ? "opacity-60" : ""}`}
            >
              <FontAwesome5 name="envelope" size={16} color="#008f4e" />
              <Text className={styles.secondaryTextClass}>
                {sendingEmailLink ? t("general.pleaseWait") : t("auth.signInWithEmailLink")}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!isHydrated || !canSubmit || isSubmitting}
            className={`bg-emerald-500 rounded-lg py-4 items-center mt-2 ${
              !isHydrated || !canSubmit || isSubmitting ? "opacity-60" : ""
            }`}
          >
            <Text className={`${isDark ? 'text-white' : 'text-emerald-900'} font-semibold`}>
              {isSubmitting ? t("general.pleaseWait") : isSignUp ? t("auth.createAccountByEmailVerification") : t("auth.logIn")}
            </Text>
          </Pressable>


          <View className="flex-row gap-3 mt-4">
            <Pressable
              onPress={() => handleProviderSignIn("google")}
              disabled={!isHydrated}
              className={`flex-1 ${styles.cardBgClass} border ${styles.borderClass} rounded-lg py-3 flex-row items-center justify-center gap-2 ${!isHydrated ? "opacity-60" : ""}`}
            >
              <FontAwesome5 name="google" size={18} color="#3a9e75" />
              <Text className={styles.secondaryTextClass}>{t("auth.continueWithGoogle")}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleProviderSignIn("microsoft")}
              disabled={!isHydrated}
              className={`flex-1 ${styles.cardBgClass} border ${styles.borderClass} rounded-lg py-3 flex-row items-center justify-center gap-2 ${!isHydrated ? "opacity-60" : ""}`}
            >
              <FontAwesome5 name="microsoft" size={18} color="#3a9e75" />
              <Text className={styles.secondaryTextClass}>{t("auth.continueWithMicrosoft")}</Text>
            </Pressable>
          </View>

          <View className="items-center mt-4">
            <Pressable
              onPress={handleGuestSignIn}
              disabled={!isHydrated}
              className={`bg-white dark:bg-gray-900/80 border-2 border-emerald-300 dark:border-gray-700 rounded-lg py-3 px-6 w-full items-center ${
                !isHydrated ? "opacity-60" : ""
              }`}
            >
              <Text className="text-gray-900 dark:text-gray-100 font-semibold">{t("auth.continueAsGuest")}</Text>
            </Pressable>
          </View>

          <View className="flex-row justify-center items-center mt-6">
            <Text className={`${styles.secondaryTextClass} text-xs text-center mr-2`}>{t("general.needHelpQuestion") ?? "Need Help?"}</Text>
            <Pressable onPress={() => Linking.openURL(SUPPORT_MAILTO)} accessibilityRole="link">
              <Text className={`text-xs ${isDark ? "text-emerald-200" : "text-emerald-600"} underline font-semibold`}>{t("general.emailUs") ?? "Email Us!"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenBackground>
      {!isWeb ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className={containerClass}>
            {authContent}
          </View>
        </TouchableWithoutFeedback>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className={containerClass}>
            {authContent}
          </View>
        </ScrollView>
      )}
    </ScreenBackground>
  );
}

