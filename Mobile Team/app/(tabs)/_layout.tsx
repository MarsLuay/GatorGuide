import React, { useMemo } from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { ResourcesAwareTabBar } from "@/components/ResourcesAwareTabBar";
import { RouteAccessBoundary } from "@/components/navigation/RouteAccessBoundary";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

export default function TabLayout() {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";
  const isGreen = resolvedTheme === "green";
  const isLight = resolvedTheme === "light";
  const { isHydrated } = useAppData();
  const { t } = useAppLanguage();
  const {
    tabBarPaddingTop,
    tabBarPaddingBottom,
    tabBarIconSize,
    tabBarLabelFontSize,
    tabBarLabelLineHeight,
    tabBarLabelMaxWidth,
    tabBarHorizontalPadding,
    tabBarItemPaddingVertical,
    tabBarItemPaddingHorizontal,
    tabBarMinHeight,
  } = useResponsiveLayout();

  const titles = useMemo(
    () => ({
      home: isHydrated ? t("navigation.home") : "Home",
      resources: isHydrated ? t("navigation.resources") : "Resources",
      profile: isHydrated ? t("navigation.profile") : "Profile",
      settings: isHydrated ? t("navigation.settings") : "Settings",
    }),
    [isHydrated, t]
  );

  const active = "#008f4e";
  const inactive = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#00753e" : "#6B7280";

  const renderTabLabel = (label: string, color: string, focused: boolean) => (
    <Text
      allowFontScaling
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      style={{
        color,
        fontSize: tabBarLabelFontSize,
        lineHeight: tabBarLabelLineHeight,
        textAlign: "center",
        fontWeight: focused ? "600" : "500",
        paddingHorizontal: tabBarItemPaddingHorizontal,
        maxWidth: tabBarLabelMaxWidth,
      }}
    >
      {label}
    </Text>
  );

  const buildTabOptions = (
    title: string,
    iconName: keyof typeof Ionicons.glyphMap
  ) => ({
    title,
    tabBarLabel: ({ color, focused }: { color: string; focused: boolean }) =>
      renderTabLabel(title, color, focused),
    tabBarIcon: ({ color }: { color: string }) => (
      <Ionicons name={iconName} size={tabBarIconSize} color={color} />
    ),
  });

  return (
    <RouteAccessBoundary allowGuest loadingMessage="Preparing your data">
      <Tabs
        tabBar={(props) => <ResourcesAwareTabBar {...props} variant="glass" />}
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: active,
          tabBarInactiveTintColor: inactive,
          tabBarStyle: {
            backgroundColor: isDark ? "#000000" : isGreen ? "#001f0f" : "#ECFDF3",
            borderTopColor: "transparent",
            borderTopWidth: 0,
            elevation: 0,
            width: "100%",
            minHeight: tabBarMinHeight,
            height: tabBarMinHeight,
            paddingTop: tabBarPaddingTop,
            paddingBottom: tabBarPaddingBottom,
            paddingHorizontal: tabBarHorizontalPadding,
          },
          tabBarItemStyle: {
            flex: 1,
            minWidth: 0,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: tabBarItemPaddingVertical,
            paddingHorizontal: tabBarItemPaddingHorizontal,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={buildTabOptions(titles.home, "home")}
        />

        <Tabs.Screen
          name="resources"
          options={buildTabOptions(titles.resources, "library")}
        />

        <Tabs.Screen
          name="profile"
          options={buildTabOptions(titles.profile, "person")}
        />

        <Tabs.Screen
          name="settings"
          options={buildTabOptions(titles.settings, "settings")}
        />

        {/* Keep these routes inside the tab navigator, but hide them from the tab bar */}
        <Tabs.Screen name="roadmap" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="calendar" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="opportunity-admin" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="transfer-planner" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="college-search" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="questionnaire" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="compare" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="cost-calculator" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="saved-colleges" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="language" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="about" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="privacy" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="terms" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="college/[collegeId]" options={{ tabBarButton: () => null }} />
      </Tabs>
    </RouteAccessBoundary>
  );
}
