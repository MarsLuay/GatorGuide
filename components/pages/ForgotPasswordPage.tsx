// components/pages/ForgotPasswordPage.tsx
import { useMemo, useState } from "react";
import { View, Text, Pressable, Alert, Keyboard, TouchableWithoutFeedback } from "react-native";
import { router } from "expo-router";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function ForgotPasswordPage() {
  const styles = useThemeStyles();
  const { t } = useAppLanguage();

  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    return trimmed && !isEmailValid(trimmed) ? t("auth.enterValidEmail") : undefined;
  }, [email, t]);

  const canSubmit = useMemo(() => isEmailValid(email), [email]);

  const handleSubmit = () => {
    const e = email.trim();

    if (!isEmailValid(e)) {
      Alert.alert(t("auth.invalidEmail"), t("auth.enterValidEmail"));
      return;
    }

    setIsSuccess(true);

    setTimeout(() => {
      router.replace("/login");
    }, 3000);
  };

  if (isSuccess) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full max-w-md">
            <View className="items-center mb-8">
              <View className="bg-green-500 p-4 rounded-full">
                <MaterialIcons name="check-circle" size={48} color="black" />
              </View>
            </View>

            <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>{t("auth.checkYourEmail")}</Text>
            <Text className={`${styles.secondaryTextClass} text-center mb-8`}>
              {t("auth.passwordResetSent")} {email.trim()}
            </Text>

            <View className={`${styles.cardBgClass} border rounded-2xl p-6`}>
              <Text className={`text-sm ${styles.secondaryTextClass} text-center`}>
                {t("auth.passwordResetInstructions")}
              </Text>
            </View>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 px-6 py-8">
          <View className="w-full max-w-md self-center">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="mb-8 flex-row items-center"
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
            <Text className={`${styles.secondaryTextClass} ml-2`}>{t("auth.backToLogin")}</Text>
          </Pressable>

          <View className="items-center mb-8">
            <View className="bg-green-500 p-4 rounded-full">
              <FontAwesome5 name="graduation-cap" size={48} color="black" />
            </View>
          </View>

          <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>{t("auth.forgotPasswordTitle")}</Text>
          <Text className={`${styles.secondaryTextClass} text-center mb-8`}>
            {t("auth.forgotPasswordMessage")}
          </Text>

          <View className={`${styles.cardBgClass} border rounded-2xl p-6`}>
            <View className="gap-4">
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
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                className={`w-full bg-green-500 rounded-lg py-4 items-center mt-2 ${!canSubmit ? "opacity-60" : ""}`}
                style={({ pressed }) => ({
                  opacity: pressed && canSubmit ? 0.7 : undefined,
                })}
              >
                <Text className="text-black font-semibold">{t("auth.sendResetLink")}</Text>
              </Pressable>
            </View>
          </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </ScreenBackground>
  );
}
