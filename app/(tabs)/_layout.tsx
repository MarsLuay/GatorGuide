import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function TabLayout() {
  const { isDark } = useAppTheme();
  const { isHydrated, state } = useAppData();
  const { t } = useAppLanguage();
  const [titles, setTitles] = useState({
    home: "Home",
    resources: "Resources",
    profile: "Profile",
    settings: "Settings",
  });

  // Update titles when language changes
  useEffect(() => {
    if (!isHydrated) return;
    setTitles({
      home: t("navigation.home"),
      resources: t("navigation.resources"),
      profile: t("navigation.profile"),
      settings: t("navigation.settings"),
    });
  }, [isHydrated, t]);

  // Protect tabs from direct deep link access
  useEffect(() => {
    if (!isHydrated) return;
    if (!state.user) {
      router.replace("/login");
    }
  }, [isHydrated, state.user]);

  // Show loading state while hydrating
  if (!isHydrated) {
    return <LoadingScreen message="Preparing your data" />;
  }

  // Redirect if not signed in
  if (!state.user) {
    return null;
  }

  const active = "#22C55E";
  const inactive = isDark ? "#9CA3AF" : "#6B7280";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: isDark ? "#000000" : "#FFFFFF",
          borderTopColor: isDark ? "#1F2937" : "#E5E7EB",
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        safeAreaInsets: {
          top: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: titles.home,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="resources"
        options={{
          title: titles.resources,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: titles.profile,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size ?? 26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: titles.settings,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size ?? 26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
