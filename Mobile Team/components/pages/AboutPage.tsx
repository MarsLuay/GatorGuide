import { View, Text, Pressable, ScrollView, Image, useWindowDimensions } from "react-native";
import { APP_VERSION } from "@/constants/app-version";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

export default function AboutPage() {
  const { isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const router = useRouter();
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();
  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : "bg-white border-emerald-200";
  const borderClass = isDark ? "border-gray-800" : "border-emerald-300";
  const mutedCardClass = isDark
    ? "bg-neutral-800 border-neutral-700"
    : "bg-gray-50 border-gray-200";
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1100;
  const showHowItWorksGrid = width >= 860;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1160 : isTablet ? 900 : 680;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const sectionGap = isTablet ? 24 : 20;
  const sideRailWidth = isWideLayout ? 320 : undefined;
  const howItWorksWidth = showHowItWorksGrid ? "48.8%" : "100%";

  const howItWorksItems = [
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
  ];

  return (
    <ScreenBackground includeBottomInset={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentPadding}
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
          <View className="pb-6">
            <Pressable
              onPress={() => router.back()}
              className="mb-4 flex-row items-center self-start"
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color={isDark ? "#b6e2b6" : "#1f8a5d"}
              />
              <Text className={`${secondaryTextClass} ml-2`}>
                {t("general.back")}
              </Text>
            </Pressable>

            <Text className={`text-2xl ${textClass}`}>
              {t("about.title")}
            </Text>
          </View>

          <View
            style={{
              flexDirection: isWideLayout ? "row" : "column",
              alignItems: "flex-start",
              gap: sectionGap,
              marginBottom: sectionGap,
            }}
          >
            <View style={{ flex: isWideLayout ? 1 : undefined, width: isWideLayout ? undefined : "100%" }}>
              <View className={`${cardBgClass} border rounded-2xl`} style={{ padding: isTablet ? 28 : 24 }}>
                <View className="items-center mb-4">
                  <Image
                    source={require("../../assets/images/icon.png")}
                    style={{ width: isTablet ? 96 : 88, height: isTablet ? 96 : 88 }}
                    resizeMode="contain"
                  />
                </View>

                <Text
                  className={`text-xl ${textClass} text-center mb-2`}
                >
                  {t("auth.gatorguide")}
                </Text>
                <Text
                  className={`${secondaryTextClass} text-center text-sm self-center`}
                  style={{ maxWidth: 620, lineHeight: 22 }}
                >
                  {t("about.subtitle")}
                </Text>
              </View>
            </View>

            <View style={{ width: sideRailWidth ?? "100%", gap: sectionGap }}>
              <View
                className={`${cardBgClass} border rounded-2xl overflow-hidden`}
              >
                <View
                  className={`px-4 py-4 flex-row items-center justify-between ${borderClass}`}
                  style={{ borderBottomWidth: 1 }}
                >
                  <Text className={secondaryTextClass}>{t("about.version")}</Text>
                  <Text className={textClass}>{APP_VERSION}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={{ marginBottom: sectionGap }}>
            <Text className={`${textClass} mb-3 px-2`}>
              {t("about.howItWorks")}
            </Text>

            <View
              className={`${cardBgClass} border rounded-2xl`}
              style={{ padding: isTablet ? 24 : 20 }}
            >
              <View
                style={{
                  flexDirection: showHowItWorksGrid ? "row" : "column",
                  flexWrap: showHowItWorksGrid ? "wrap" : "nowrap",
                  gap: 18,
                }}
              >
                {howItWorksItems.map((item) => (
                  <View key={item.n} style={{ width: howItWorksWidth }}>
                    <View className="flex-row items-center mb-2">
                      <View className="w-6 h-6 rounded-full bg-emerald-500 items-center justify-center mr-2">
                        <Text className={`${isDark ? 'text-white' : 'text-emerald-900'} text-sm font-semibold`}>
                          {item.n}
                        </Text>
                      </View>
                      <Text className={`${textClass} font-medium flex-1`}>
                        {item.title}
                      </Text>
                    </View>
                    <Text
                      className={`text-sm ${secondaryTextClass} ml-8`}
                      style={{ lineHeight: 20 }}
                    >
                      {item.body}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {isWideLayout ? null : (
            <View>
              <Text className={`${textClass} mb-3 px-2`}>
                {t("about.appInformation")}
              </Text>

              <View
                className={`${cardBgClass} border rounded-2xl overflow-hidden`}
              >
                <View
                  className={`px-4 py-4 flex-row items-center justify-between ${borderClass}`}
                  style={{ borderBottomWidth: 1 }}
                >
                  <Text className={secondaryTextClass}>{t("about.version")}</Text>
                  <Text className={textClass}>{APP_VERSION}</Text>
                </View>
              </View>
            </View>
          )}

          <View
            className={`${mutedCardClass} border rounded-2xl p-4`}
            style={{ maxWidth: 820, marginTop: sectionGap }}
          >
            <Text className={`${textClass} text-sm mb-2`}>
              {t("about.disclaimerTitle")}
            </Text>
            <Text
              className={`${secondaryTextClass} text-xs leading-relaxed`}
              style={{ lineHeight: 20 }}
            >
              {t("about.disclaimerBody")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
