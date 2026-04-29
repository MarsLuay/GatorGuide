import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import useBack from "@/hooks/use-back";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { Language } from "@/services/app/translations";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedCardPressable, AnimatedIconPressable } from "@/components/ui/AnimatedPressables";

type LanguageOption = {
  key: Language;
  nativeLabel: string;
  direction?: "ltr" | "rtl";
};

const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { key: "English", nativeLabel: "English" },
  { key: "Spanish", nativeLabel: "Espa\u00f1ol" },
  { key: "Chinese (Simplified)", nativeLabel: "\u7b80\u4f53\u4e2d\u6587" },
  { key: "Chinese (Traditional)", nativeLabel: "\u7e41\u9ad4\u4e2d\u6587" },
  { key: "French", nativeLabel: "Fran\u00e7ais" },
  { key: "German", nativeLabel: "Deutsch" },
  { key: "Italian", nativeLabel: "Italiano" },
  { key: "Japanese", nativeLabel: "\u65e5\u672c\u8a9e" },
  { key: "Korean", nativeLabel: "\ud55c\uad6d\uc5b4" },
  { key: "Portuguese", nativeLabel: "Portugu\u00eas" },
  { key: "Russian", nativeLabel: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
  { key: "Arabic", nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", direction: "rtl" },
  { key: "Hindi", nativeLabel: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  { key: "Vietnamese", nativeLabel: "Ti\u1ebfng Vi\u1ec7t" },
  { key: "Persian", nativeLabel: "\u0641\u0627\u0631\u0633\u06cc", direction: "rtl" },
  { key: "Tagalog", nativeLabel: "Tagalog" },
] as const;

export default function LanguagePage() {
  const { isDark, isGreen, isLight } = useAppTheme();
  const { language, setLanguage, t } = useAppLanguage();
  const back = useBack("/(tabs)/settings");
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();

  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const cardBgClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white/90 border-gray-200";
  const itemBorderClass = isDark ? "border-gray-800" : isGreen ? "border-emerald-700" : isLight ? "border-emerald-300" : "border-gray-200";
  const iconColor = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280";
  const isPageRTL = language === "Arabic" || language === "Persian";
  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const isWideLayout = width >= 1120;
  const showLanguageGrid = width >= 860;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1080 : isTablet ? 860 : 560;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });
  const optionCardWidth = showLanguageGrid ? (isWideLayout ? "48.8%" : "48.2%") : "100%";
  const optionMinHeight = isTablet ? 96 : 84;

  const handleSelectLanguage = (lang: Language) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLanguage(lang);
    back();
  };

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
              containerClassName="mb-4"
              className="items-center"
              style={{
                flexDirection: isPageRTL ? "row-reverse" : "row",
              }}
              containerStyle={{ alignSelf: isPageRTL ? "flex-end" : "flex-start" }}
            >
              <MaterialIcons name={isPageRTL ? "arrow-forward" : "arrow-back"} size={20} color={iconColor} />
              <Text className={`${secondaryTextClass} ${isPageRTL ? "mr-2" : "ml-2"}`}>{t("general.back")}</Text>
            </AnimatedIconPressable>

            <Text className={`text-2xl ${isPageRTL ? "text-right" : ""} ${textClass}`}>{t("settings.language")}</Text>
          </View>

          <View
            style={{
              flexDirection: showLanguageGrid ? "row" : "column",
              flexWrap: showLanguageGrid ? "wrap" : "nowrap",
              gap: 14,
            }}
          >
            {LANGUAGE_OPTIONS.map((lang) => {
              const isSelected = language === lang.key;
              const isNativeRTL = lang.direction === "rtl";

              return (
                <AnimatedCardPressable
                  key={lang.key}
                  onPress={() => handleSelectLanguage(lang.key)}
                  className={`${cardBgClass} border rounded-2xl px-4 py-4`}
                  containerStyle={{
                    width: optionCardWidth,
                    minHeight: optionMinHeight,
                  }}
                  style={{
                    justifyContent: "center",
                    borderColor: isSelected ? "#10B981" : undefined,
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(16, 185, 129, 0.16)"
                        : isGreen
                          ? "rgba(16, 185, 129, 0.18)"
                          : "rgba(16, 185, 129, 0.1)"
                      : undefined,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isNativeRTL ? "row-reverse" : "row",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        className={textClass}
                        style={{
                          fontSize: 17,
                          lineHeight: 24,
                          textAlign: isNativeRTL ? "right" : "left",
                          writingDirection: isNativeRTL ? "rtl" : "ltr",
                        }}
                      >
                        {lang.nativeLabel}
                      </Text>
                      {lang.nativeLabel !== lang.key ? (
                        <Text
                          className={`${secondaryTextClass} mt-1`}
                          numberOfLines={2}
                          style={{
                            lineHeight: 20,
                            textAlign: isNativeRTL ? "right" : "left",
                          }}
                        >
                          {lang.key}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        marginLeft: isNativeRTL ? 0 : 12,
                        marginRight: isNativeRTL ? 12 : 0,
                      }}
                    >
                      {isSelected ? (
                        <MaterialIcons name="check-circle" size={22} color="#10B981" />
                      ) : (
                        <View
                          className={`rounded-full border ${itemBorderClass}`}
                          style={{ width: 22, height: 22, opacity: 0.8 }}
                        />
                      )}
                    </View>
                  </View>
                </AnimatedCardPressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
