import { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, Alert, Keyboard, TouchableWithoutFeedback, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { makeRedirectUri, useAuthRequest, useAutoDiscovery, ResponseType } from "expo-auth-session";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";
import { authService, EMAIL_LINK_STORAGE_KEY } from "@/services/auth.service";
import { PENDING_LINK_STORAGE_KEY } from "@/components/AuthEmailLinkHandler";
import { API_CONFIG } from "@/services/config";

WebBrowser.maybeCompleteAuthSession();

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function AuthPage() {
  const { isHydrated, state, signIn, signInWithAuthUser, signInAsGuest, updateUser, setQuestionnaireAnswers } = useAppData();
  const { t } = useAppLanguage();
  const styles = useThemeStyles();

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

  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  const isExpoGo = Constants.appOwnership === "expo";
  const redirectUri = makeRedirectUri({ scheme: "gatorguide", path: "auth" });
  const microsoftDiscovery = useAutoDiscovery("https://login.microsoftonline.com/common/v2.0");

  const [microsoftRequest, microsoftResponse, microsoftPromptAsync] = useAuthRequest(
    {
      clientId: API_CONFIG.microsoftClientId || "dummy",
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: ResponseType.IdToken,
    },
    microsoftDiscovery ?? null
  );

  useEffect(() => {
    if (microsoftResponse?.type !== "success" || !isNative) return;
    const idToken = (microsoftResponse.params as Record<string, string>).id_token;
    if (!idToken) return;
    (async () => {
      try {
        const authUser = await authService.signInWithMicrosoftCredential(idToken);
        await signInWithAuthUser(authUser);
        router.replace("/");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("auth.loginFailed");
        Alert.alert(t("general.error"), msg);
      }
    })();
  }, [microsoftResponse, isNative, signInWithAuthUser, t]);

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

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    const mapAuthError = (code: string | undefined) => {
      switch (code) {
        case 'auth/invalid-email':
          return t('auth.invalidEmail');
        case 'auth/user-not-found':
          return t('auth.no_matches');
        case 'auth/wrong-password':
          return t('auth.wrongPassword');
        case 'auth/invalid-credential':
          return t('auth.invalidCredential');
        case 'auth/email-already-in-use':
          return t('auth.emailAlreadyInUse');
        case 'auth/weak-password':
          return t('auth.passwordMinimum');
        case 'auth/too-many-requests':
          return t('auth.tooManyAttempts');
        case 'auth/network-request-failed':
          return t('auth.networkError');
        case 'auth/user-disabled':
          return t('auth.accountDisabled');
        case 'auth/operation-not-allowed':
          return t('auth.signInMethodDisabled');
        case 'auth/verification-email-failed':
          return t('auth.verificationEmailFailed');
        default:
          return t('auth.loginFailed');
      }
    };

    try {
      await signIn({ name: n || t('auth.defaultUser'), email: e, password, isSignUp });

      // If signing up, check for pending guest data and restore it
      if (isSignUp) {
        try {
          const pendingData = await AsyncStorage.getItem('gatorguide:pending-account-data');
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
            await AsyncStorage.removeItem('gatorguide:pending-account-data');
          }
        } catch {
          // Silently fail
        }
      }

      router.replace('/');
    } catch (err: any) {
      console.error('Auth error', err);

      if (err?.code === 'auth/email-verification-required') {
        setVerificationPendingEmail(err?.email ?? e);
        setIsSignUp(false);
        return;
      }

      const friendly = mapAuthError(err?.code);
      if (friendly) {
        Alert.alert(t('general.error'), friendly);
        if (err?.code === 'auth/email-already-in-use' && isSignUp) {
          setIsSignUp(false);
        }
      } else {
        Alert.alert(t('general.error'), err?.message || 'Authentication failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEmailLink = async () => {
    const e = email.trim();
    if (!pendingLinkUrl || !isEmailValid(e)) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("auth.loginFailed");
      Alert.alert(t("general.error"), msg);
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      let msg = err instanceof Error ? err.message : t("auth.loginFailed");
      if (code === "auth/operation-not-allowed") {
        msg = t("auth.emailLinkNotEnabled") || "Please enable Email link (passwordless sign-in) in Firebase Console → Authentication → Sign-in method.";
      } else if (code === "auth/invalid-email") {
        msg = t("auth.emailInvalid");
      }
      Alert.alert(t("general.error"), msg);
    } finally {
      setSendingEmailLink(false);
    }
  };

  const handleGuestSignIn = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signInAsGuest();
    router.replace("/");
  };

  const handleProviderSignIn = async (provider: "google" | "microsoft") => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isWeb = Platform.OS === "web";
    if (isWeb) {
      try {
        const authUser =
          provider === "google"
            ? await authService.signInWithGoogle()
            : await authService.signInWithMicrosoft();
        await signInWithAuthUser(authUser);
        router.replace("/");
      } catch (err: unknown) {
        const msg =
          err instanceof Error && (err.message.includes("available on web") || err.message.includes("web"))
            ? t("auth.providerAvailableOnWeb")
            : err instanceof Error ? err.message : t("auth.validation.failed_message");
        Alert.alert(t("general.error"), msg);
      }
      return;
    }
    if (provider === "google") {
      if (!API_CONFIG.googleWebClientId) {
        Alert.alert(t("general.error"), t("auth.providerNotConfigured") || "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
        return;
      }
      if (isExpoGo) {
        Alert.alert(
          t("general.error"),
          "Google 登录需使用开发构建，Expo Go 不支持。\n\n请运行: npx expo run:ios\n或: npx expo run:android"
        );
        return;
      }
      try {
        const { GoogleSignin } = require("@react-native-google-signin/google-signin");
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
        router.replace("/");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("auth.loginFailed");
        Alert.alert(t("general.error"), msg);
      }
      return;
    }
    if (provider === "microsoft") {
      if (!API_CONFIG.microsoftClientId) {
        Alert.alert(t("general.error"), t("auth.providerNotConfiguredMs") || "Microsoft sign-in is not configured. Set EXPO_PUBLIC_MICROSOFT_CLIENT_ID.");
        return;
      }
      try {
        await microsoftPromptAsync();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("auth.loginFailed");
        Alert.alert(t("general.error"), msg);
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
        <View className="bg-green-500 p-4 rounded-full">
          <FontAwesome5 name="graduation-cap" size={48} color="black" />
        </View>
      </View>

      <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>{t("auth.gatorguide")}</Text>
      <Text className={`${styles.secondaryTextClass} text-center mb-8`}>{t("auth.findCollege")}</Text>

      <View className={`${styles.cardBgClass} border rounded-2xl p-6 ${isWeb ? "shadow-lg" : ""}`}>
        {verificationPendingEmail && (
          <View className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4">
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
                  const msg = err instanceof Error ? err.message : t("auth.loginFailed");
                  Alert.alert(t("general.error"), msg);
                } finally {
                  setResendingVerification(false);
                }
              }}
              disabled={resendingVerification || !password || password.length < 6}
              className="mt-3 py-2 rounded-lg items-center border border-green-500"
            >
              <Text className={`${resendingVerification || !password || password.length < 6 ? "opacity-60" : ""} ${styles.textClass}`}>
                {resendingVerification ? t("general.pleaseWait") : t("auth.resendVerificationEmail")}
              </Text>
            </Pressable>
          </View>
        )}

        {emailLinkSentTo && (
          <View className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4">
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
              <Text className="text-black font-semibold">
                {completingLink ? t("general.pleaseWait") : t("auth.completeSignIn")}
              </Text>
            </Pressable>
          </View>
        )}

        <View className="flex-row gap-4 mb-6">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setVerificationPendingEmail(null);
              setEmailLinkSentTo(null);
              setIsSignUp(true);
            }}
            className={`flex-1 py-3 rounded-lg items-center ${isSignUp ? "bg-green-500" : styles.inactiveButtonClass}`}
            disabled={!isHydrated}
          >
            <Text className={isSignUp ? "text-black" : styles.secondaryTextClass}>{t("auth.signUp")}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEmailLinkSentTo(null);
              setIsSignUp(false);
            }}
            className={`flex-1 py-3 rounded-lg items-center ${!isSignUp ? "bg-green-500" : styles.inactiveButtonClass}`}
            disabled={!isHydrated}
          >
            <Text className={!isSignUp ? "text-black" : styles.secondaryTextClass}>{t("auth.logIn")}</Text>
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
              <Pressable onPress={() => router.push("/forgot-password")} disabled={!isHydrated}>
                <Text className="text-sm text-green-500">{t("auth.forgotPassword")}</Text>
              </Pressable>
            </View>
          )}

          <View className={`flex-row items-center gap-2 my-3 ${styles.secondaryTextClass}`}>
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
            <Text className="text-xs">{t("auth.or")}</Text>
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
          </View>

          <Pressable
            onPress={handleSendEmailLink}
            disabled={!isHydrated || !isEmailValid(email.trim()) || sendingEmailLink}
            className={`${styles.cardBgClass} border ${styles.borderClass} rounded-lg py-3 flex-row items-center justify-center gap-2 ${!isHydrated || !isEmailValid(email.trim()) || sendingEmailLink ? "opacity-60" : ""}`}
          >
            <FontAwesome5 name="envelope" size={16} color="#22C55E" />
            <Text className={styles.secondaryTextClass}>
              {sendingEmailLink ? t("general.pleaseWait") : t("auth.signInWithEmailLink")}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={!isHydrated || !canSubmit || isSubmitting}
            className={`bg-green-500 rounded-lg py-4 items-center mt-2 ${
              !isHydrated || !canSubmit || isSubmitting ? "opacity-60" : ""
            }`}
          >
            <Text className="text-black font-semibold">
              {isSubmitting ? t("general.pleaseWait") : isSignUp ? t("auth.createAccount") : t("auth.logIn")}
            </Text>
          </Pressable>

          {isSignUp && (
            <Text className={`${styles.secondaryTextClass} text-xs text-center mt-2`}>
              {t("auth.verificationRequiredHint")}
            </Text>
          )}

          <View className="flex-row gap-3 mt-4">
            <Pressable
              onPress={() => handleProviderSignIn("google")}
              disabled={!isHydrated}
              className={`flex-1 ${styles.cardBgClass} border ${styles.borderClass} rounded-lg py-3 flex-row items-center justify-center gap-2 ${!isHydrated ? "opacity-60" : ""}`}
            >
              <FontAwesome5 name="google" size={18} color="#4285F4" />
              <Text className={styles.secondaryTextClass}>{t("auth.continueWithGoogle")}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleProviderSignIn("microsoft")}
              disabled={!isHydrated}
              className={`flex-1 ${styles.cardBgClass} border ${styles.borderClass} rounded-lg py-3 flex-row items-center justify-center gap-2 ${!isHydrated ? "opacity-60" : ""}`}
            >
              <FontAwesome5 name="microsoft" size={18} color="#00A4EF" />
              <Text className={styles.secondaryTextClass}>{t("auth.continueWithMicrosoft")}</Text>
            </Pressable>
          </View>

          <View className="items-center mt-4">
            <Pressable
              onPress={handleGuestSignIn}
              disabled={!isHydrated}
              className={`bg-gray-200 dark:bg-gray-700 rounded-lg py-3 px-6 w-full items-center ${
                !isHydrated ? "opacity-60" : ""
              }`}
            >
              <Text className="text-gray-800 dark:text-gray-200 font-semibold">{t("auth.continueAsGuest")}</Text>
            </Pressable>
          </View>

          <Text className={`${styles.secondaryTextClass} text-xs text-center mt-6`}>
            {t("general.needHelpEmail")}
          </Text>
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