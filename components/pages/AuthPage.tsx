// components/pages/AuthPage.tsx
import { useMemo, useState } from "react";
import { View, Text, Pressable, Alert, Keyboard, TouchableWithoutFeedback, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppData } from "@/hooks/use-app-data";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import { FormInput } from "@/components/ui/FormInput";

const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export default function AuthPage() {
  const { isHydrated, state, signIn, signInAsGuest } = useAppData();
  const styles = useThemeStyles();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  const emailError = useMemo(() => {
    const trimmed = email.trim();
    return trimmed && !isEmailValid(trimmed) ? "Enter a valid email." : undefined;
  }, [email]);

  const passwordError = useMemo(() => {
    return password && password.length < 6 ? "6 characters minimum" : undefined;
  }, [password]);

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
      Alert.alert("Missing info", "Please enter your name.");
      return;
    }

    if (!isEmailValid(e)) {
      Alert.alert("Invalid email", "Enter a valid email.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Invalid password", "Password must be at least 6 characters.");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signIn({ name: n || "User", email: e }); // Use "User" if logging in without name
    // Go to index which will route to profile-setup or tabs based on completion
    router.replace("/");
  };

  const handleGuestSignIn = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signInAsGuest();
    router.replace("/");
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

      <Text className={`text-3xl text-center ${styles.textClass} mb-2`}>Gator Guide</Text>
      <Text className={`${styles.secondaryTextClass} text-center mb-8`}>Find your perfect college match</Text>

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
          {isSignUp && (
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
          )}

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
            returnKeyType="next"
          />

          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? "Create a password (min 6 characters)" : "Enter your password"}
            error={passwordError}
            textClass={styles.textClass}
            secondaryTextClass={styles.secondaryTextClass}
            inputBgClass={styles.inputBgClass}
            placeholderColor={styles.placeholderColor}
            isEnabled={isHydrated}
            secureTextEntry
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

          <View className="items-center mt-4">
            <Pressable
              onPress={handleGuestSignIn}
              disabled={!isHydrated}
              className={`bg-gray-200 dark:bg-gray-700 rounded-lg py-3 px-6 w-full items-center ${
                !isHydrated ? "opacity-60" : ""
              }`}
            >
              <Text className="text-gray-800 dark:text-gray-200 font-semibold">Continue as Guest</Text>
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
