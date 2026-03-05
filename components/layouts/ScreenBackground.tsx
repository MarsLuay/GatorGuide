import React from "react";
import { View, type ViewProps, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = ViewProps & {
  children: React.ReactNode;
};

export function ScreenBackground({ children, style, ...rest }: Props) {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";
  const isGreen = resolvedTheme === "green";

  const colors = isDark
    ? (["#000000", "#111827", "#000000"] as const)
    : isGreen
      ? (["#001f0f", "#003b1a", "#001f0f"] as const)
      : (["#ECFDF3", "#D9F7E8", "#ECFDF3"] as const);

  return (
    <LinearGradient colors={colors} style={[{ flex: 1 }, style]} {...rest}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}
