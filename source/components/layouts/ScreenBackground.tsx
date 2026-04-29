import React from "react";
import { View, StyleSheet, type ViewProps, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { useThemeStyles } from "@/hooks/use-theme-styles";

type Props = ViewProps & {
  children: React.ReactNode;
  safeAreaEdges?: Edge[];
  includeTopInset?: boolean;
  includeBottomInset?: boolean;
};

const DEFAULT_SAFE_AREA_EDGES: Edge[] = ["left", "right"];

export function ScreenBackground({
  children,
  style,
  safeAreaEdges = DEFAULT_SAFE_AREA_EDGES,
  includeTopInset = false,
  includeBottomInset = true,
  ...rest
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStyles();

  return (
    <View style={[styles.root, { backgroundColor: theme.screenBaseColor }, style]} {...rest}>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient colors={theme.screenGradientColors} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={theme.screenOverlayTopColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={theme.screenOverlayBottomColors}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
        <View
          style={{
            flex: 1,
            paddingTop: includeTopInset ? insets.top : 0,
            paddingBottom: includeBottomInset ? insets.bottom : 0,
          }}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
