import { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, Alert, Keyboard, TouchableWithoutFeedback, Platform, ScrollView, Linking } from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";
import { makeRedirectUri, useAuthRequest, useAutoDiscovery, ResponseType } from "expo-auth-session";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FormInput } from "@/components/ui/FormInput";
import { authService } from "@/services/auth.service";
import { API_CONFIG } from "@/services/config";

WebBrowser.maybeCompleteAuthSession();

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function AuthPage() {
  const router = useRouter();
  const { isHydrated, signIn, signInWithAuthUser, signInAsGuest, updateUser, setQuestionnaireAnswers } = useAppData();
  const { t } = useAppLanguage();
  const styles = useThemeStyles();
  const { isDark } = useAppTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  // types for makeRedirectUri options vary across expo-auth-session versions; cast to any
  const makeRedirect = makeRedirectUri({ useProxy: true } as any);
  const redirectUri = isNative
    ? (makeRedirect.startsWith("exp://") ? `https://auth.expo.io/@${API_CONFIG.expoUsername}/gator-guide` : makeRedirect)
    : makeRedirectUri({ scheme: "gatorguide", path: "auth" });
  const microsoftDiscovery = useAutoDiscovery("https://login.microsoftonline.com/common/v2.0");

  const [, googleResponse, googlePromptAsync] = useIdTokenAuthRequest(
    {
      clientId: API_CONFIG.googleWebClientId || "dummy",
      webClientId: API_CONFIG.googleWebClientId || undefined,
    },
    // The AuthRequest redirect options typing varies between versions; cast to any
    isNative
      ? (makeRedirect.startsWith("exp://") ? ({ redirectUri } as any) : ({ useProxy: true } as any))
      : ({ scheme: "gatorguide", path: "auth" } as any)
  );

  const [, microsoftResponse, microsoftPromptAsync] = useAuthRequest(
    {
      clientId: API_CONFIG.microsoftClientId || "dummy",
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: ResponseType.IdToken,
    },
    // useAuthRequest expects DiscoveryDocument | null — convert undefined to null
    microsoftDiscovery ?? null
  );

  useEffect(() => {
    if (googleResponse?.type !== "success" || !isNative) return;
    const idToken = (googleResponse.params as Record<string, string>).id_token;
    if (!idToken) return;
    (async () => {
      try {
        const authUser = await authService.signInWithGoogleCredential(idToken);
        await signInWithAuthUser(authUser);
        router.replace("/");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("auth.loginFailed");
        Alert.alert(t("general.error"), msg);
      }
    })();
  }, [googleResponse, isNative, signInWithAuthUser, t, router]);

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
  }, [microsoftResponse, isNative, signInWithAuthUser, t, router]);

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
          return t('auth.validation.failed_title');
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
        default:
          return t('auth.loginFailed');
      }
    };

    try {
      await signIn({ name: n || t('auth.defaultUser'), email: e, password, isSignUp }); // Use default if logging in without name

      // If signing up, check for pending guest data and restore it
      if (isSignUp) {
        try {
          const pendingData = await AsyncStorage.getItem('gatorguide:pending-account-data');
          if (pendingData) {
            const parsed = JSON.parse(pendingData);
            if (parsed.user) {
              // Merge guest data with new account (keeping the new email/name)
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
            // Clear the pending data
            await AsyncStorage.removeItem('gatorguide:pending-account-data');
          }
        } catch {
          // Silently fail - user can manually import if needed
        }

      }

      // Go to index which will route to profile-setup or tabs based on completion
      router.replace('/');
    } catch (err: any) {
      console.error('Auth error', err);
      const friendly = mapAuthError(err?.code);
      if (friendly) {
        Alert.alert(t('general.error'), friendly);
      } else {
        Alert.alert(t('general.error'), err?.message || 'Authentication failed.');
      }
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
      try {
        await googlePromptAsync();
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
        <View className="flex-row gap-4 mb-6">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

          <Pressable
            onPress={handleSubmit}
            disabled={!isHydrated || !canSubmit}
            className={`bg-green-500 rounded-lg py-4 items-center mt-2 ${
              !isHydrated || !canSubmit ? "opacity-60" : ""
            }`}
          >
            <Text className="text-black font-semibold">{isSignUp ? t("auth.createAccount") : t("auth.logIn")}</Text>
          </Pressable>

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

          <View className="mt-6">
            <View className="flex-row justify-center items-center">
              <Text className={`${styles.secondaryTextClass} text-sm mr-2`}>{t('general.needHelpQuestion') ?? 'Need Help?'}</Text>
              <Pressable onPress={() => Linking.openURL('mailto:gatorguide_mobiledevelopmentteam@outlook.com')} accessibilityRole="link">
                <Text className={`text-sm ${isDark ? 'text-green-300' : 'text-green-600'} underline font-semibold`}>{t('general.emailUs') ?? 'Email Us!'}</Text>
              </Pressable>
            </View>
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
