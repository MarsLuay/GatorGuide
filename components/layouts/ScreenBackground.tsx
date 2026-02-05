import React from "react";
import { View, type ViewProps, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = ViewProps & {
  children: React.ReactNode;
};

export function ScreenBackground({ children, style, ...rest }: Props) {
  const { isDark } = useAppTheme();

  const colors = isDark
    ? (["#000000", "#111827", "#000000"] as const)
    : (["#FFFFFF", "#ECFDF5", "#FFFFFF"] as const);

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
