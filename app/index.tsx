// app/index.tsx
import { useEffect } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";

export default function Index() {
  const { isDark } = useAppTheme();
  const { isHydrated, state } = useAppData();

  const textClass = isDark ? "text-white" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : "text-gray-600";

  useEffect(() => {
    if (!isHydrated) return;
    if (state.user) router.replace("/(tabs)");
    else router.replace("/login");
  }, [isHydrated, state.user]);

  if (!isHydrated) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center px-6">
          <Text className={`text-lg ${textClass}`}>Loading…</Text>
          <Text className={`${secondaryTextClass} mt-2`}>Preparing your data</Text>
        </View>
      </ScreenBackground>
    );
  }

  return null;
}
