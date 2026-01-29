// components/pages/AuthPage.tsx
import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";

export default function AuthPage() {
  const { isDark } = useAppTheme();
  const { isHydrated, state, signIn } = useAppData();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";
  const inputBgClass = isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-300";
  const inactiveButtonClass = isDark ? "bg-gray-800" : "bg-gray-100";
  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";

  useEffect(() => {
    if (!isHydrated) return;
    if (state.user) router.replace("/(tabs)");
  }, [isHydrated, state.user]);

  // - at least 1 char before @
  // - at least 1 char between @ and .
  // - at least 1 char after .
  const isEmailValid = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

  const canSubmit = useMemo(() => {
    const n = name.trim();
    const e = email.trim();
    return !!n && isEmailValid(e);
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

    await signIn({ name: n, email: e });
    router.replace("/(tabs)");
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

          <Text className={`text-3xl text-center ${textClass} mb-2`}>Gator Guide</Text>
          <Text className={`${secondaryTextClass} text-center mb-8`}>Find your perfect college match</Text>

          <View className={`${cardBgClass} border rounded-2xl p-6`}>
            <View className="flex-row gap-4 mb-6">
              <Pressable
                onPress={() => setIsSignUp(true)}
                className={`flex-1 py-3 rounded-lg items-center ${isSignUp ? "bg-green-500" : inactiveButtonClass}`}
                disabled={!isHydrated}
              >
                <Text className={isSignUp ? "text-black" : secondaryTextClass}>Sign Up</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsSignUp(false)}
                className={`flex-1 py-3 rounded-lg items-center ${!isSignUp ? "bg-green-500" : inactiveButtonClass}`}
                disabled={!isHydrated}
              >
                <Text className={!isSignUp ? "text-black" : secondaryTextClass}>Login</Text>
              </Pressable>
            </View>

            <View className="gap-4">
              <View>
                <Text className={`text-sm ${secondaryTextClass} mb-2`}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={placeholderColor}
                  className={`w-full ${inputBgClass} ${textClass} border rounded-lg px-4 py-3`}
                  editable={isHydrated}
                  returnKeyType="next"
                />
              </View>

              <View>
                <Text className={`text-sm ${secondaryTextClass} mb-2`}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={placeholderColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className={`w-full ${inputBgClass} ${textClass} border rounded-lg px-4 py-3`}
                  editable={isHydrated}
                  returnKeyType="done"
                />
                {!!email.trim() && !isEmailValid(email) ? (
                  <Text className="text-xs text-red-400 mt-2">Enter a valid email (minimum format: d@d.c).</Text>
                ) : null}
              </View>

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
