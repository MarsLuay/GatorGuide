import React from "react";
import {
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useThemeStyles } from "@/hooks/use-theme-styles";

import { AnimatedChipPressable } from "./AnimatedPressables";

type AppButtonProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode | ((color: string) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function AppButton({
  label,
  variant = "primary",
  icon,
  style,
  contentStyle,
  labelStyle,
  accessibilityRole = "button",
  ...rest
}: AppButtonProps) {
  const { isDark, isGreen } = useAppTheme();
  const theme = useThemeStyles();
  const { width } = useWindowDimensions();
  const isCompactWidth = width < 390;
  const isPrimary = variant === "primary";

  const backgroundColor = isPrimary
    ? isDark || isGreen
      ? "#10b981"
      : "#059669"
    : isDark
      ? "rgba(15, 23, 42, 0.82)"
      : isGreen
        ? "rgba(6, 78, 59, 0.82)"
        : "#f0fdf4";
  const borderColor = isPrimary
    ? isDark || isGreen
      ? "rgba(167, 243, 208, 0.20)"
      : "rgba(5, 150, 105, 0.24)"
    : isDark || isGreen
      ? "rgba(52, 211, 153, 0.22)"
      : "rgba(16, 185, 129, 0.20)";
  const textColor = isPrimary ? "#ffffff" : theme.textColor;
  const iconColor = isPrimary ? "#ffffff" : isDark || isGreen ? "#a7f3d0" : "#047857";
  const renderedIcon = typeof icon === "function" ? icon(iconColor) : icon;

  return (
    <AnimatedChipPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      className="rounded-2xl"
      containerStyle={style}
      style={[
        {
          width: "100%",
          minHeight: isPrimary ? (isCompactWidth ? 52 : 56) : isCompactWidth ? 50 : 54,
          borderRadius: 18,
          paddingHorizontal: isCompactWidth ? 16 : 18,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderWidth: 1,
          borderColor,
          backgroundColor,
        },
        contentStyle,
      ]}
    >
      {renderedIcon}
      <Text
        style={[
          {
            color: textColor,
            fontSize: 15,
            fontWeight: isPrimary ? "700" : "600",
            textAlign: "center",
            flexShrink: 1,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </AnimatedChipPressable>
  );
}
