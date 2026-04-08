import React from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useThemeStyles } from "@/hooks/use-theme-styles";

import { usePressAnimation } from "./AnimatedPressables";
import { LiquidGlassView } from "./LiquidGlassView";

type GlassButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassButton({
  label,
  variant = "primary",
  icon,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: GlassButtonProps) {
  const theme = useThemeStyles();
  const isPrimary = variant === "primary";
  const { animatedStyle, handlePressInAnimation, handlePressOutAnimation } = usePressAnimation({
    pressedScale: 0.96,
    pressedOpacity: 0.97,
    pressedTranslateY: 1,
    pressInSpeed: 48,
    pressInBounciness: 0,
    pressOutSpeed: 30,
    pressOutBounciness: 8,
  });

  const textColor = isPrimary ? theme.glassPrimaryTextColor : theme.glassSecondaryTextColor;

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        style={styles.pressable}
        onPressIn={(event) => {
          handlePressInAnimation();
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          handlePressOutAnimation();
          onPressOut?.(event);
        }}
        {...rest}
      >
        <LiquidGlassView borderRadius={14} style={styles.surface}>
          <View
            style={[
              styles.row,
              isPrimary
                ? {
                    backgroundColor: theme.glassPrimaryFill,
                  }
                : null,
            ]}
          >
            {icon}
            <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          </View>
        </LiquidGlassView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    alignSelf: "stretch",
  },
  surface: {
    width: "100%",
    alignSelf: "stretch",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
    borderRadius: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
});
