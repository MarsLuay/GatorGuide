import React, { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";

export default function TabLayout() {
  const router = useRouter();
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
  }, [isHydrated, state.user, router]);

  // Show loading state while hydrating
  if (!isHydrated) {
    return <LoadingScreen message="Preparing your data" />;
  }

  // Redirect if not signed in - show loading instead of black screen while redirecting
  if (!state.user) {
    return <LoadingScreen message={t("general.loading")} />;
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
          width: "100%",
        },
        tabBarItemStyle: {
          flex: 1,
          minWidth: "25%",
          justifyContent: "center",
          alignItems: "center",
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

      {/* Keep these routes inside the tab navigator, but hide them from the tab bar */}
      <Tabs.Screen name="roadmap" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="questionnaire" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="compare" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="cost-calculator" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="language" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="about" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="privacy" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="terms" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="college/[collegeId]" options={{ tabBarButton: () => null }} />
    </Tabs>
  );
}
