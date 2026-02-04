import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function AboutPage() {
  const { isDark } = useAppTheme();
  const { t } = useAppLanguage();

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";
  const cardBgClass = isDark
    ? "bg-gray-900 border-gray-800"
    : "bg-white border-gray-200";
  const borderClass = isDark ? "border-gray-800" : "border-gray-200";

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center">
          {/* Header */}
          <View className="px-6 pt-20 pb-6">
            <Pressable
              onPress={() => router.back()}
              className="mb-4 flex-row items-center"
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
              <Text className={`${secondaryTextClass} ml-2`}>
                {t("general.back")}
              </Text>
            </Pressable>

            <Text className={`text-2xl ${textClass}`}>
              {t("about.title")}
            </Text>
          </View>

          {/* App Card */}
          <View className="px-6 mb-6">
            <View className={`${cardBgClass} border rounded-2xl p-6`}>
              <View className="items-center mb-4">
                <View className="bg-green-500 p-4 rounded-2xl">
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
                {t("about.subtitle")}
              </Text>
            </View>
          </View>

          {/* How It Works */}
          <View className="px-6 mb-6">
            <Text className={`${textClass} mb-3 px-2`}>
              {t("about.howItWorks")}
            </Text>

            <View
              className={`${cardBgClass} border rounded-2xl p-6 gap-4`}
            >
              {[
                {
                  n: "1",
                  title: t("about.step1Title"),
                  body: t("about.step1Body"),
                },
                {
                  n: "2",
                  title: t("about.step2Title"),
                  body: t("about.step2Body"),
                },
                {
                  n: "3",
                  title: t("about.step3Title"),
                  body: t("about.step3Body"),
                },
                {
                  n: "4",
                  title: t("about.step4Title"),
                  body: t("about.step4Body"),
                },
              ].map((item) => (
                <View key={item.n}>
                  <View className="flex-row items-center mb-2">
                    <View className="w-6 h-6 rounded-full bg-green-500 items-center justify-center mr-2">
                      <Text className="text-black text-sm font-semibold">
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
              {t("about.appInformation")}
            </Text>

            <View
              className={`${cardBgClass} border rounded-2xl overflow-hidden`}
            >
              <View
                className={`px-4 py-4 flex-row items-center justify-between border-b ${borderClass}`}
              >
                <Text className={secondaryTextClass}>{t("about.version")}</Text>
                <Text className={textClass}>{t("about.versionNumber")}</Text>
              </View>

              <Pressable
                onPress={() => {}}
                className={`px-4 py-4 flex-row items-center justify-between border-b ${borderClass}`}
              >
                <Text className={secondaryTextClass}>
                  Privacy Policy
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </Pressable>

              <Pressable
                onPress={() => {}}
                className="px-4 py-4 flex-row items-center justify-between"
              >
                <Text className={secondaryTextClass}>
                  Terms of Service
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </Pressable>
            </View>
          </View>

          {/* Disclaimer */}
          <View className="px-6">
            <View
              className={`${
                isDark
                  ? "bg-gray-900/50 border-gray-800"
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
