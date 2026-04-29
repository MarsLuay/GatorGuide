import React from "react";
import { View, TextInput, StyleSheet, type TextInputProps } from "react-native";

import { useThemeStyles } from "@/hooks/use-theme-styles";

import { LiquidGlassView } from "./LiquidGlassView";

type GlassInputProps = TextInputProps & {
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export function GlassInput({ left, right, style, ...rest }: GlassInputProps) {
  const theme = useThemeStyles();

  return (
    <LiquidGlassView borderRadius={16}>
      <View style={styles.row}>
        {left}
        <TextInput
          style={[styles.input, { color: theme.textColor }, style]}
          placeholderTextColor={theme.placeholderColor}
          {...rest}
        />
        {right}
      </View>
    </LiquidGlassView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
});
