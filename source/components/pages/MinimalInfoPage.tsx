import type { ComponentProps } from "react";
import { Linking, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AppButton } from "@/components/ui/AppButton";
import { GatorGuideMark } from "@/components/ui/GatorGuideMark";
import { PageBackButton, usePageBackArrowColor } from "@/components/ui/PageBackButton";
import { ROUTES } from "@/constants/routes";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/constants/support";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppTheme } from "@/hooks/use-app-theme";
import useBack from "@/hooks/use-back";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

type MinimalInfoItem = {
  icon: MaterialIconName;
  title: string;
  body: string;
};

type MinimalInfoPageProps = {
  title: string;
  description: string;
  items: MinimalInfoItem[];
  note?: string;
  actionLabel?: string;
};

export function MinimalInfoPage({
  title,
  description,
  items,
  note,
  actionLabel,
}: MinimalInfoPageProps) {
  const { isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const theme = useThemeStyles();
  const back = useBack(ROUTES.tabsSettings);
  const { getScrollContentPadding } = useResponsiveLayout();
  const { width } = useWindowDimensions();

  const isCompactPhone = width < 390;
  const isTablet = width >= 768;
  const pageMaxWidth = width >= 1080 ? 760 : isTablet ? 680 : 560;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const cardPadding = isTablet ? 28 : 22;
  const iconColor = usePageBackArrowColor();
  const mutedSurfaceColor = isDark ? "rgba(15, 23, 42, 0.72)" : "rgba(240, 253, 244, 0.82)";
  const mutedBorderColor = isDark ? "rgba(52, 211, 153, 0.18)" : "rgba(16, 185, 129, 0.18)";
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });

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
            gap: 16,
          }}
        >
          <PageBackButton
            onPress={back}
            label={t("general.back")}
            textClassName={theme.secondaryTextClass}
          />

          <View className={`${theme.cardBgClass} border rounded-3xl`} style={{ padding: cardPadding, gap: 18 }}>
            <View className="items-center" style={{ gap: 14 }}>
              <GatorGuideMark size={isTablet ? 92 : 78} darkMode={isDark} />
              <View style={{ gap: 8 }}>
                <Text className={`${theme.textClass} text-center font-semibold`} style={{ fontSize: isTablet ? 28 : 24, lineHeight: isTablet ? 34 : 30 }}>
                  {title}
                </Text>
                <Text className={`${theme.secondaryTextClass} text-center`} style={{ lineHeight: 22 }}>
                  {description}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              {items.map((item) => (
                <View
                  key={item.title}
                  className="rounded-2xl border"
                  style={{
                    borderColor: mutedBorderColor,
                    backgroundColor: mutedSurfaceColor,
                    padding: 16,
                    gap: 8,
                  }}
                >
                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(16, 185, 129, 0.10)" }}>
                      <MaterialIcons name={item.icon} size={18} color={iconColor} />
                    </View>
                    <Text className={`${theme.textClass} flex-1 font-semibold`}>{item.title}</Text>
                  </View>
                  <Text className={`${theme.secondaryTextClass} text-sm`} style={{ lineHeight: 21 }}>
                    {item.body}
                  </Text>
                </View>
              ))}
            </View>

            {note ? (
              <Text className={`${theme.secondaryTextClass} text-xs text-center`} style={{ lineHeight: 18 }}>
                {note}
              </Text>
            ) : null}

            <AppButton
              onPress={() => {
                void Linking.openURL(SUPPORT_MAILTO);
              }}
              label={actionLabel ?? t("general.contactSupport")}
              variant="secondary"
              icon={(color) => <MaterialIcons name="mail-outline" size={18} color={color} />}
            />
            <Text className={`${theme.secondaryTextClass} text-xs text-center`} selectable>
              {SUPPORT_EMAIL}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
