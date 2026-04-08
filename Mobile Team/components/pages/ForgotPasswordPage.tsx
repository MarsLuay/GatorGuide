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
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GatorGuideMark } from "@/components/ui/GatorGuideMark";
import { authService } from "@/services";

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function ForgotPasswordPage() {
  const router = useRouter();
  const back = useBack(ROUTES.login);
  const { t } = useAppLanguage();
  const styles = useThemeStyles();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1120;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const formMaxWidth = isWideLayout ? 920 : isTablet ? 760 : 520;
  const successMaxWidth = isWideLayout ? 760 : isTablet ? 680 : 520;
  const contentTopPadding = insets.top + 16;
  const contentBottomPadding = Math.max(insets.bottom + 28, 32);
  const formCardPadding = isTablet ? 28 : 24;
  const heroSpacing = isTablet ? 36 : 32;

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
              maxWidth: successMaxWidth,
              alignSelf: "center",
              paddingHorizontal: shellHorizontalPadding,
            }}
          >
            <GlassCard borderRadius={28} noPadding>
              <View style={{ padding: formCardPadding }}>
              <View className="items-center" style={{ marginBottom: heroSpacing }}>
                <View className="bg-emerald-500 rounded-full" style={{ padding: isTablet ? 20 : 16 }}>
                  <MaterialIcons name="check-circle" size={isTablet ? 56 : 48} color="#001f0f" />
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
                  className={`${isDark ? "text-emerald-100" : "text-emerald-700"} text-center font-medium`}
                  selectable
                >
                  {email.trim()}
                </Text>
              </View>

              <GlassCard borderRadius={20} noPadding>
                <View style={{ padding: isTablet ? 24 : 20 }}>
                <Text className={`text-sm ${styles.secondaryTextClass} text-center`} style={{ lineHeight: 22 }}>
                  {t("auth.passwordResetInstructions")}
                </Text>
                </View>
              </GlassCard>

              <GlassButton
                onPress={() => router.replace(ROUTES.login)}
                label={t("auth.backToLogin")}
                style={{ width: "100%", marginTop: 32 }}
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
              maxWidth: formMaxWidth,
              alignSelf: "center",
              paddingHorizontal: shellHorizontalPadding,
            }}
          >
            <AnimatedIconPressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                back();
              }}
              className="flex-row items-center"
              containerStyle={{ alignSelf: "flex-start", marginBottom: 32 }}
            >
              <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
              <Text className={`${styles.secondaryTextClass} ml-2`}>{t("auth.backToLogin")}</Text>
            </AnimatedIconPressable>

            <View className="items-center" style={{ marginBottom: heroSpacing }}>
              <GatorGuideMark size={isTablet ? 120 : 108} darkMode={isDark} />
            </View>

            <Text className={`text-3xl text-center ${styles.textClass} mb-3`}>{t("auth.forgotPasswordTitle")}</Text>
            <Text className={`${styles.secondaryTextClass} text-center`} style={{ lineHeight: 24, marginBottom: heroSpacing }}>
              {t("auth.forgotPasswordMessage")}
            </Text>

            <GlassCard borderRadius={24} noPadding>
              <View className="gap-4" style={{ padding: formCardPadding }}>
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

              <GlassButton
                onPress={handleSubmit}
                disabled={!canSubmit}
                label={t("auth.sendResetLink")}
                style={{ width: "100%", marginTop: 8, opacity: !canSubmit ? 0.6 : 1 }}
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
