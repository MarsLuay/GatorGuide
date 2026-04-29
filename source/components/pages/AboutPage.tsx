import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { APP_VERSION } from "@/constants/app-version";
import { MaterialIcons } from "@expo/vector-icons";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedIconPressable } from "@/components/ui/AnimatedPressables";
import { GatorGuideMark } from "@/components/ui/GatorGuideMark";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import useBack from "@/hooks/use-back";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

export default function AboutPage() {
  const { isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const back = useBack(ROUTES.tabsSettings);
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();
  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : "bg-white border-emerald-200";
  const mutedCardClass = isDark
    ? "bg-neutral-800 border-neutral-700"
    : "bg-gray-50 border-gray-200";
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1120;
  const showSplitHero = width >= 980;
  const showHowItWorksGrid = width >= 860;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1140 : isTablet ? 920 : 700;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const sectionGap = isTablet ? 24 : 20;
  const heroPanelWidth = showSplitHero ? 280 : "100%";
  const howItWorksWidth = showHowItWorksGrid ? "48.6%" : "100%";
  const stepCardMinHeight = isWideLayout ? 152 : isTablet ? 144 : undefined;

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
            <AnimatedIconPressable
              onPress={back}
              containerClassName="mb-4 self-start"
              className="flex-row items-center"
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color={isDark ? "#b6e2b6" : "#1f8a5d"}
              />
              <Text className={`${secondaryTextClass} ml-2`}>
                {t("general.back")}
              </Text>
            </AnimatedIconPressable>

            <Text className={`text-2xl ${textClass}`}>
              {t("about.title")}
            </Text>
          </View>

          <View
            className={`${cardBgClass} border rounded-3xl`}
            style={{
              padding: isTablet ? 28 : 22,
              marginBottom: sectionGap,
            }}
          >
            <View
              style={{
                flexDirection: showSplitHero ? "row" : "column",
                alignItems: showSplitHero ? "stretch" : "flex-start",
                gap: sectionGap,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    alignItems: showSplitHero ? "flex-start" : "center",
                  }}
                >
                  <View style={{ marginBottom: 18 }}>
                    <GatorGuideMark size={isTablet ? 112 : 100} darkMode={isDark} />
                  </View>
                  <Text
                    className={`text-xl ${textClass}`}
                    style={{ textAlign: showSplitHero ? "left" : "center", marginBottom: 10 }}
                  >
                    {t("auth.gatorguide")}
                  </Text>
                  <Text
                    className={`${secondaryTextClass} text-sm`}
                    style={{
                      maxWidth: showSplitHero ? 620 : 680,
                      lineHeight: 22,
                      textAlign: showSplitHero ? "left" : "center",
                    }}
                  >
                    {t("about.subtitle")}
                  </Text>
                </View>
              </View>

              <View
                className={`${mutedCardClass} border rounded-2xl`}
                style={{
                  width: heroPanelWidth,
                  padding: isTablet ? 22 : 18,
                  alignSelf: showSplitHero ? "stretch" : "auto",
                }}
              >
                <View className="flex-row items-center justify-between mb-4">
                  <Text className={`${textClass} font-semibold`}>
                    {t("about.appInformation")}
                  </Text>
                  <View className="w-9 h-9 rounded-xl bg-emerald-500/10 items-center justify-center">
                    <MaterialIcons name="info-outline" size={18} color="#008f4e" />
                  </View>
                </View>

                <View className={`${cardBgClass} border rounded-2xl px-4 py-4`}>
                  <Text className={`${secondaryTextClass} text-xs uppercase tracking-wide`}>
                    {t("about.versionNumber")}
                  </Text>
                  <Text className={`${textClass} text-2xl font-semibold mt-2`}>
                    {APP_VERSION}
                  </Text>
                  <Text
                    className={`${secondaryTextClass} text-sm mt-3`}
                    style={{ lineHeight: 20 }}
                  >
                    {t("about.version")}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View
            className={`${cardBgClass} border rounded-3xl`}
            style={{ padding: isTablet ? 24 : 20, marginBottom: sectionGap }}
          >
            <Text className={`${textClass} mb-4`}>
              {t("about.howItWorks")}
            </Text>

            <View
              style={{
                flexDirection: showHowItWorksGrid ? "row" : "column",
                flexWrap: showHowItWorksGrid ? "wrap" : "nowrap",
                gap: 16,
              }}
            >
              {howItWorksItems.map((item) => (
                <View
                  key={item.n}
                  className={`${mutedCardClass} border rounded-2xl`}
                  style={{ width: howItWorksWidth, minHeight: stepCardMinHeight, padding: 18 }}
                >
                  <View className="flex-row items-center mb-3">
                    <View className="w-7 h-7 rounded-full bg-emerald-500 items-center justify-center mr-3">
                      <Text className={`${isDark ? 'text-white' : 'text-emerald-900'} text-sm font-semibold`}>
                        {item.n}
                      </Text>
                    </View>
                    <Text className={`${textClass} font-medium flex-1`}>
                      {item.title}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm ${secondaryTextClass}`}
                    style={{ lineHeight: 20 }}
                  >
                    {item.body}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View
            className={`${mutedCardClass} border rounded-3xl p-5`}
            style={{ marginBottom: isTablet ? 8 : 4 }}
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
