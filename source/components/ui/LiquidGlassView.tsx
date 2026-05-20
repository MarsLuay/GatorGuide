import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { useThemeStyles } from "@/hooks/use-theme-styles";

type LiquidGlassViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  borderRadius?: number;
  animate?: boolean;
  delay?: number;
  specular?: boolean;
};

export function LiquidGlassView({
  children,
  style,
  className = "",
  borderRadius = 24,
  animate = false,
  delay = 0,
  specular = true,
}: LiquidGlassViewProps) {
  const theme = useThemeStyles();
  const mountAnim = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;

    Animated.timing(mountAnim, {
      toValue: 1,
      duration: 500,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animate, delay, mountAnim]);

  const animatedStyle = animate
    ? {
        opacity: mountAnim,
        transform: [
          {
            scale: mountAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
          {
            translateY: mountAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }
    : undefined;

  const Wrapper: React.ComponentType<any> = animate ? Animated.View : View;

  if (Platform.OS === "web") {
    const surfaceStyle: React.CSSProperties & { WebkitBackdropFilter?: string } = {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      minHeight: 0,
      borderRadius,
      overflow: "hidden",
      border: `1px solid ${theme.glassBorderColor}`,
      backdropFilter: `blur(18px) saturate(1.8) brightness(${theme.glassBackdropBrightness})`,
      WebkitBackdropFilter: `blur(18px) saturate(1.8) brightness(${theme.glassBackdropBrightness})`,
      background: theme.glassSurfaceColor,
      boxShadow: [
        `inset 0 1px 0 0 rgba(255,255,255,${theme.glassHighlightAlpha})`,
        `inset 0 0 0 1px ${theme.glassInnerGlowColor}`,
        `0 8px 32px rgba(0,0,0,${theme.glassShadowAlphaStrong})`,
        `0 1px 3px rgba(0,0,0,${theme.glassShadowAlphaSoft})`,
      ].join(", "),
      transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
    };

    const chromaticStyle: React.CSSProperties = {
      position: "absolute",
      inset: 0,
      borderRadius,
      background: `linear-gradient(135deg, ${theme.glassChromaticColors[0]} 0%, ${theme.glassChromaticColors[1]} 40%, ${theme.glassChromaticColors[1]} 60%, ${theme.glassChromaticColors[2]} 100%)`,
      pointerEvents: "none",
      zIndex: 1,
    };

    const specularStyle: React.CSSProperties = {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "40%",
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      background: `linear-gradient(180deg, ${theme.glassSpecularColors[0]} 0%, ${theme.glassSpecularColors[1]} 50%, ${theme.glassSpecularColors[2]} 100%)`,
      pointerEvents: "none",
      zIndex: 2,
    };

    return (
      <Wrapper className={className} style={[{ position: "relative" }, animatedStyle, style]}>
        <div style={surfaceStyle}>
          <div style={chromaticStyle} />
          {specular ? <div style={specularStyle} /> : null}
          <div
            style={{
              position: "relative",
              zIndex: 3,
              display: "flex",
              flex: 1,
              flexDirection: "column",
              minHeight: 0,
              minWidth: 0,
              width: "100%",
            }}
          >
            {children}
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      className={className}
      style={[
        {
          borderRadius,
          borderWidth: 1,
          borderColor: theme.glassBorderColor,
          overflow: "hidden",
          position: "relative",
        },
        animatedStyle,
        style,
      ]}
    >
      <BlurView
        intensity={theme.glassBlurIntensity}
        tint={theme.glassBlurTint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.glassSurfaceColor,
          },
        ]}
      />
      <LinearGradient
        colors={theme.glassChromaticColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {specular ? (
        <View
          style={[
            styles.specWrap,
            { borderTopLeftRadius: borderRadius - 1, borderTopRightRadius: borderRadius - 1 },
          ]}
        >
          <LinearGradient
            colors={theme.glassSpecularColors}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: borderRadius - 1,
          borderWidth: 1,
          borderColor: theme.glassInnerGlowColor,
          zIndex: 1,
        }}
      />
      <View style={styles.contentLayer}>{children}</View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  contentLayer: {
    position: "relative",
    zIndex: 2,
    flex: 1,
    minHeight: 0,
  },
  specWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "35%",
    overflow: "hidden",
    zIndex: 1,
  },
});
