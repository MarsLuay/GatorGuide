// components/pages/AuthPage.tsx
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function AuthPage() {
  const { isHydrated, state, signIn } = useAppData();
  const styles = useThemeStyles();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    if (state.user) router.replace("/(tabs)");
  }, [isHydrated, state.user]);

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    return trimmed && !isEmailValid(trimmed) ? "Enter a valid email." : undefined;
  }, [email]);

  const canSubmit = useMemo(() => {
    return !!name.trim() && isEmailValid(email.trim());
  }, [name, email]);

  const handleSubmit = async () => {
    const n = name.trim();
    const e = email.trim();

    if (!n) {
      Alert.alert("Missing info", "Please enter your name.");
      return;
    }

    if (!isEmailValid(e)) {
      Alert.alert("Invalid email", "Enter a valid email.");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signIn({ name: n, email: e });
    router.replace("/profile-setup");
  };

  return (
    <ScreenBackground>
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md">
          <View className="items-center mb-8">
            <View className="bg-green-500 p-4 rounded-full">
              <FontAwesome5 name="graduation-cap" size={48} color="black" />
            </View>
          </View>

          <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>Gator Guide</Text>
          <Text className={`${styles.secondaryTextClass} text-center mb-8`}>Find your perfect college match</Text>

          <View className={`${styles.cardBgClass} border rounded-2xl p-6`}>
            <View className="flex-row gap-4 mb-6">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsSignUp(true);
                }}
                className={`flex-1 py-3 rounded-lg items-center ${isSignUp ? "bg-green-500" : styles.inactiveButtonClass}`}
                disabled={!isHydrated}
              >
                <Text className={isSignUp ? "text-black" : styles.secondaryTextClass}>Sign Up</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsSignUp(false);
                }}
                className={`flex-1 py-3 rounded-lg items-center ${!isSignUp ? "bg-green-500" : styles.inactiveButtonClass}`}
                disabled={!isHydrated}
              >
                <Text className={!isSignUp ? "text-black" : styles.secondaryTextClass}>Login</Text>
              </Pressable>
            </View>

            <View className="gap-4">
              <FormInput
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                textClass={styles.textClass}
                secondaryTextClass={styles.secondaryTextClass}
                inputBgClass={styles.inputBgClass}
                placeholderColor={styles.placeholderColor}
                isEnabled={isHydrated}
                returnKeyType="next"
              />

              <FormInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                error={emailError}
                textClass={styles.textClass}
                secondaryTextClass={styles.secondaryTextClass}
                inputBgClass={styles.inputBgClass}
                placeholderColor={styles.placeholderColor}
                isEnabled={isHydrated}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />

              {!isSignUp && (
                <View className="items-end">
                  <Pressable onPress={() => router.push("/forgot-password")} disabled={!isHydrated}>
                    <Text className="text-sm text-green-500">Forgot password?</Text>
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
                <Text className="text-black font-semibold">{isSignUp ? "Create Account" : "Sign In"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScreenBackground>
  );
}
