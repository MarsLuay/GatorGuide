// components/pages/ForgotPasswordPage.tsx
import { useMemo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function ForgotPasswordPage() {
  const styles = useThemeStyles();

  const [email, setEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    return trimmed && !isEmailValid(trimmed) ? "Enter a valid email." : undefined;
  }, [email]);

  const canSubmit = useMemo(() => isEmailValid(email), [email]);

  const handleSubmit = () => {
    const e = email.trim();

    if (!isEmailValid(e)) {
      Alert.alert("Invalid email", "Enter a valid email.");
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

            <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>Check Your Email</Text>
            <Text className={`${styles.secondaryTextClass} text-center mb-8`}>
              We&apos;ve sent a password reset link to {email.trim()}
            </Text>

            <View className={`${styles.cardBgClass} border rounded-2xl p-6`}>
              <Text className={`text-sm ${styles.secondaryTextClass} text-center`}>
                Click the link in the email to reset your password. If you don&apos;t see it, check your spam folder.
              </Text>
            </View>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View className="flex-1 px-6 py-8">
        <View className="w-full max-w-md self-center">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="mb-8 flex-row items-center"
          >
            <MaterialIcons name="arrow-back" size={20} color={styles.placeholderColor} />
            <Text className={`${styles.secondaryTextClass} ml-2`}>Back to Login</Text>
          </Pressable>

          <View className="items-center mb-8">
            <View className="bg-green-500 p-4 rounded-full">
              <FontAwesome5 name="graduation-cap" size={48} color="black" />
            </View>
          </View>

          <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>Forgot Password?</Text>
          <Text className={`${styles.secondaryTextClass} text-center mb-8`}>
            Enter your email and we&apos;ll send you a reset link
          </Text>

          <View className={`${styles.cardBgClass} border rounded-2xl p-6`}>
            <View className="gap-4">
              <FormInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
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
              >
                <Text className="text-black font-semibold">Send Reset Link</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScreenBackground>
  );
}
