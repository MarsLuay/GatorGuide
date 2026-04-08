import React from "react";
import { View, StyleSheet, type ViewProps } from "react-native";

import { LiquidGlassView } from "./LiquidGlassView";

type GlassCardProps = ViewProps & {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  borderRadius?: number;
  animate?: boolean;
  delay?: number;
};

export function GlassCard({
  children,
  style,
  className = "",
  noPadding = false,
  borderRadius = 20,
  animate = false,
  delay = 0,
  ...rest
}: GlassCardProps) {
  return (
    <LiquidGlassView
      className={className}
      borderRadius={borderRadius}
      style={style}
      animate={animate}
      delay={delay}
      {...rest}
    >
      <View style={noPadding ? undefined : styles.content}>{children}</View>
    </LiquidGlassView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
});
