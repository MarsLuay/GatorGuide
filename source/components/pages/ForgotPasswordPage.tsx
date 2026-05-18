import { useMemo, useState } from "react";
import { 
  View, 
  Text, 
  Alert, 
  Keyboard, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROUTES } from "@/constants/routes";
import useBack from "@/hooks/use-back";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { FormInput } from "@/components/ui/FormInput";
import { AppButton } from "@/components/ui/AppButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GatorGuideMark } from "@/components/ui/GatorGuideMark";
import { PageBackButton } from "@/components/ui/PageBackButton";
import { authService } from "@/services/auth/auth.service";

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function ForgotPasswordPage() {
  const router = useRouter();
  const back = useBack(ROUTES.login);
  const { t } = useAppLanguage();
  const styles = useThemeStyles();
  const { isDark, isGreen } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1120;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 760 : isTablet ? 680 : 520;
  const contentTopPadding = insets.top + 16;
  const contentBottomPadding = Math.max(insets.bottom + 28, 32);
  const formCardPadding = isTablet ? 28 : 22;
  const heroSpacing = isTablet ? 24 : 20;
  const iconSurfaceClass = isDark
    ? "bg-emerald-500/10 border-emerald-500/20"
    : isGreen
      ? "bg-emerald-500/15 border-emerald-300/20"
      : "bg-emerald-500/10 border-emerald-200";

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    return trimmed && !isEmailValid(trimmed) ? t("auth.enterValidEmail") : undefined;
  }, [email, t]);

  const canSubmit = useMemo(() => isEmailValid(email) && !isLoading, [email, isLoading]);

  const handleSubmit = async () => {
    const e = email.trim();

    if (!isEmailValid(e)) {
      Alert.alert(t("auth.invalidEmail"), t("auth.enterValidEmail"));
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      // Trigger Firebase password-reset email for the provided account.
      await authService.sendPasswordReset(e);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSuccess(true);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let message = t("auth.validation.failed_message");
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-credential') {
        message = t("auth.no_matches");
      } else if (error?.code === 'auth/too-many-requests') {
        message = t("auth.tooManyAttempts");
      } else if (error?.code === 'auth/invalid-email') {
        message = t("auth.validation.invalid_email");
      }
      
      Alert.alert(t("auth.validation.failed_title"), message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <ScreenBackground includeBottomInset={false}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingTop: contentTopPadding,
            paddingBottom: contentBottomPadding,
          }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: pageMaxWidth,
              alignSelf: "center",
              paddingHorizontal: shellHorizontalPadding,
            }}
          >
            <GlassCard borderRadius={28} noPadding>
              <View style={{ padding: formCardPadding }}>
                <View className="items-center" style={{ marginBottom: heroSpacing }}>
                  <View className={`rounded-3xl border items-center justify-center ${iconSurfaceClass}`} style={{ width: isTablet ? 88 : 76, height: isTablet ? 88 : 76 }}>
                    <MaterialIcons name="mark-email-read" size={isTablet ? 42 : 36} color="#10b981" />
                  </View>
                </View>

                <Text className={`text-3xl text-center ${styles.textClass} mb-3`}>{t("auth.checkYourEmail")}</Text>
                <Text className={`${styles.secondaryTextClass} text-center`} style={{ lineHeight: 24 }}>
                  {t("auth.passwordResetSent")}
                </Text>
                <View
                  className="self-center mt-4 mb-6 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                  style={{ maxWidth: "100%" }}
                >
                  <Text
                    className={`${isDark || isGreen ? "text-emerald-100" : "text-emerald-700"} text-center font-medium`}
                    selectable
                  >
                    {email.trim()}
                  </Text>
                </View>

                <View className={`${styles.inputBgClass} border rounded-2xl`} style={{ padding: isTablet ? 20 : 18 }}>
                  <Text className={`text-sm ${styles.secondaryTextClass} text-center`} style={{ lineHeight: 22 }}>
                    {t("auth.passwordResetInstructions")}
                  </Text>
                </View>

                <AppButton
                  onPress={() => router.replace(ROUTES.login)}
                  label={t("auth.backToLogin")}
                  style={{ width: "100%", marginTop: 28 }}
                />
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground includeBottomInset={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingTop: contentTopPadding,
            paddingBottom: contentBottomPadding,
          }}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: "100%",
              maxWidth: pageMaxWidth,
              alignSelf: "center",
              paddingHorizontal: shellHorizontalPadding,
            }}
          >
            <PageBackButton
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                back();
              }}
              label={t("auth.backToLogin")}
              textClassName={styles.secondaryTextClass}
              containerStyle={{ marginBottom: 28 }}
            />

            <GlassCard borderRadius={28} noPadding>
              <View className="gap-4" style={{ padding: formCardPadding }}>
                <View className="items-center" style={{ marginBottom: heroSpacing }}>
                  <GatorGuideMark size={isTablet ? 96 : 84} darkMode={isDark} />
                </View>

                <View style={{ gap: 8 }}>
                  <Text className={`text-3xl text-center ${styles.textClass}`}>{t("auth.forgotPasswordTitle")}</Text>
                  <Text className={`${styles.secondaryTextClass} text-center`} style={{ lineHeight: 24 }}>
                    {t("auth.forgotPasswordMessage")}
                  </Text>
                </View>

                <View className={`${styles.inputBgClass} border rounded-2xl`} style={{ padding: isTablet ? 20 : 18, marginTop: 6 }}>
                  <FormInput
                    label={t("auth.emailAddress")}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t("auth.enterEmail")}
                    error={emailError}
                    textClass={styles.textClass}
                    secondaryTextClass={styles.secondaryTextClass}
                    inputBgClass={styles.inputBgClass}
                    placeholderColor={styles.placeholderColor}
                    variant="glass"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>

                <AppButton
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  label={isLoading ? t("general.loading") : t("auth.sendResetLink")}
                  style={{ width: "100%", marginTop: 4 }}
                />
              </View>
            </GlassCard>

            <Text className={`${styles.secondaryTextClass} text-xs text-center mt-6`} style={{ lineHeight: 18 }}>
              {t("general.needHelpEmail")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
