import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function AboutPage() {
  const { isDark, isGreen, isLight } = useAppTheme();
  const router = useRouter();
  // Reuse theme tokens for consistent card/text contrast across sections.
  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : isLight
        ? "bg-emerald-50 border-emerald-300"
        : "bg-white/90 border-gray-200";
  const borderClass = isDark ? "border-gray-800" : isGreen ? "border-emerald-700" : isLight ? "border-emerald-300" : "border-gray-200";

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View className="max-w-md w-full self-center">
          {/* Header */}
          <View className="px-6 pt-8 pb-6">
            <Pressable
              onPress={() => router.back()}
              className="mb-4 flex-row items-center"
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color={isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280"}
              />
              <Text className={`${secondaryTextClass} ml-2`}>
                Back
              </Text>
            </Pressable>

            <Text className={`text-2xl ${textClass}`}>
              About Gator Guide
            </Text>
          </View>

          {/* App Card */}
          <View className="px-6 mb-6">
            <View className={`${cardBgClass} border rounded-2xl p-6`}>
              <View className="items-center mb-4">
                <View className="bg-emerald-500 p-4 rounded-2xl">
                  <FontAwesome5
                    name="graduation-cap"
                    size={48}
                    color="black"
                  />
                </View>
              </View>

              <Text
                className={`text-xl ${textClass} text-center mb-2`}
              >
                Gator Guide
              </Text>
              <Text
                className={`${secondaryTextClass} text-center text-sm`}
              >
                Helping Green River College students find their perfect transfer
                match
              </Text>
            </View>
          </View>

          {/* How It Works */}
          <View className="px-6 mb-6">
            <Text className={`${textClass} mb-3 px-2`}>
              How It Works
            </Text>

            <View
              className={`${cardBgClass} border rounded-2xl p-6 gap-4`}
            >
              {/* Static explainer steps keep content easy to localize/replace later. */}
              {[
                {
                  n: "1",
                  title: "Profile Analysis",
                  body:
                    "The app analyzes your academic profile including GPA, test scores, major interests, and extracurricular activities.",
                },
                {
                  n: "2",
                  title: "Preference Matching",
                  body:
                    "Your preferences for campus setting, location, size, and other factors are matched against our college database.",
                },
                {
                  n: "3",
                  title: "Smart Recommendations",
                  body:
                    "Our algorithm weighs transfer credit policies, program strength, and admission probability to provide personalized recommendations.",
                },
                {
                  n: "4",
                  title: "Continuous Updates",
                  body:
                    "As you update your profile and complete more coursework, recommendations are refined to reflect your evolving academic journey.",
                },
              ].map((item) => (
                <View key={item.n}>
                  <View className="flex-row items-center mb-2">
                    <View className="w-6 h-6 rounded-full bg-emerald-500 items-center justify-center mr-2">
                      <Text className={`${isDark ? 'text-white' : 'text-black'} text-sm font-semibold`}>
                        {item.n}
                      </Text>
                    </View>
                    <Text className={`${textClass} font-medium`}>
                      {item.title}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm ${secondaryTextClass} ml-8`}
                  >
                    {item.body}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* App Info */}
          <View className="px-6 mb-4">
            <Text className={`${textClass} mb-3 px-2`}>
              App Information
            </Text>

            <View
              className={`${cardBgClass} border rounded-2xl overflow-hidden`}
            >
              <View
                className={`px-4 py-4 flex-row items-center justify-between border-b ${borderClass}`}
              >
                <Text className={secondaryTextClass}>Version</Text>
                <Text className={textClass}>1.0.0</Text>
              </View>

              <Pressable
                onPress={() => router.push("/privacy")}
                className={`px-4 py-4 flex-row items-center justify-between border-b ${borderClass}`}
              >
                <Text className={secondaryTextClass}>
                  Privacy Policy
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280"}
                />
              </Pressable>

              <Pressable
                onPress={() => router.push("/terms")}
                className="px-4 py-4 flex-row items-center justify-between"
              >
                <Text className={secondaryTextClass}>
                  Terms of Service
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280"}
                />
              </Pressable>
            </View>
          </View>

          {/* Disclaimer */}
          <View className="px-6">
            <View
              className={`${
                isDark || isGreen
                  ? "bg-neutral-800 border-neutral-700"
                  : "bg-gray-50 border-gray-200"
              } border rounded-2xl p-4`}
            >
              <Text className={`${textClass} text-sm mb-2`}>
                Disclaimer
              </Text>
              <Text
                className={`${secondaryTextClass} text-xs leading-relaxed`}
              >
                Gator Guide provides recommendations based on available data
                and your profile information. Admission decisions are made by
                individual institutions and are subject to their specific
                requirements and policies. We recommend contacting colleges
                directly for the most accurate and up-to-date information. This
                app is designed for informational purposes and does not guarantee
                admission to any institution.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
