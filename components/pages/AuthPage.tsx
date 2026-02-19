import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function AuthPage() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark
    ? "bg-gray-900 border-gray-800"
    : "bg-white border-gray-200";
  const inputBgClass = isDark
    ? "bg-gray-800 border-gray-700"
    : "bg-gray-50 border-gray-300";
  const inactiveButtonClass = isDark ? "bg-gray-800" : "bg-gray-100";
  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";

  const handleSubmit = () => {
  if (!name.trim() || !email.trim()) return;

  if (isSignUp && !acceptedTerms) return;

  router.replace("/(tabs)");
};

  return (
    <ScreenBackground>
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md">
          {/* Logo */}
          <View className="items-center mb-8">
            <View className="bg-green-500 p-4 rounded-full">
              <FontAwesome5
                name="graduation-cap"
                size={48}
                color="black"
              />
            </View>
          </View>

          <Text className={`text-3xl text-center ${textClass} mb-2`}>
            Gator Guide
          </Text>
          <Text className={`${secondaryTextClass} text-center mb-8`}>
            Find your perfect college match
          </Text>

          {/* Auth Card */}
          <View className={`${cardBgClass} border rounded-2xl p-6`}>
            {/* Tabs */}
            <View className="flex-row gap-4 mb-6">
              <Pressable
                onPress={() => {
                  setIsSignUp(true);
                  setAcceptedTerms(false);
                }}
                className={`flex-1 py-3 rounded-lg items-center ${
                  isSignUp ? "bg-green-500" : inactiveButtonClass
                }`}
              >
                <Text
                  className={
                    isSignUp ? "text-black" : secondaryTextClass
                  }
                >
                  Sign Up
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setIsSignUp(false);
                  setAcceptedTerms(false);
                }}
                className={`flex-1 py-3 rounded-lg items-center ${
                  !isSignUp ? "bg-green-500" : inactiveButtonClass
                }`}
              >
                <Text
                  className={
                    !isSignUp ? "text-black" : secondaryTextClass
                  }
                >
                  Login
                </Text>
              </Pressable>
            </View>

            {/* Form */}
            <View className="gap-4">
              <View>
                <Text className={`text-sm ${secondaryTextClass} mb-2`}>
                  Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={placeholderColor}
                  className={`w-full ${inputBgClass} ${textClass} border rounded-lg px-4 py-3`}
                />
              </View>

              <View>
                <Text className={`text-sm ${secondaryTextClass} mb-2`}>
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={placeholderColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className={`w-full ${inputBgClass} ${textClass} border rounded-lg px-4 py-3`}
                />
              </View>

              {!isSignUp && (
                <View className="items-end">
                  <Pressable
                    onPress={() => router.push("/forgot-password")}
                  >
                    <Text className="text-sm text-green-500">
                      Forgot password?
                    </Text>
                  </Pressable>
                </View>
              )}

              {isSignUp && (
  <Pressable
    onPress={() => setAcceptedTerms((v) => !v)}
    className="flex-row items-start mt-2"
  >
    <View
      className={`mt-0.5 w-5 h-5 rounded border ${
        acceptedTerms ? "bg-green-500 border-green-500" : inputBgClass
      } items-center justify-center`}
    >
      {acceptedTerms && <Text className="text-black font-bold">✓</Text>}
    </View>

    <Text className={`${secondaryTextClass} ml-3 flex-1 text-sm leading-relaxed`}>
      I agree to the{" "}
      <Link href="/terms" className="text-green-500">
        Terms of Service
      </Link>{" "}
      and acknowledge the{" "}
      <Link href="/privacy" className="text-green-500">
        Privacy Policy
      </Link>
      .
    </Text>
  </Pressable>
)}


              <Pressable
                onPress={handleSubmit}
                className="bg-green-500 rounded-lg py-4 items-center mt-2"
              >
                <Text className="text-black font-semibold">
                  {isSignUp ? "Create Account" : "Sign In"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScreenBackground>
  );
}
