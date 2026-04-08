import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";

const BORDER_RADIUS = 28;

type TabIconRenderer = (props: {
  focused: boolean;
  color: string;
  size: number;
}) => React.ReactNode;

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useThemeStyles();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const {
    isTablet,
    isDesktop,
    tabBarPaddingTop,
    tabBarPaddingBottom,
    tabBarIconSize,
    tabBarItemPaddingVertical,
    tabBarItemPaddingHorizontal,
    tabBarMinHeight,
  } = useResponsiveLayout();

  const pillMarginHorizontal = useMemo(() => {
    if (isDesktop) return 0;
    if (isTablet) return 8;
    return screenWidth >= 640 ? 16 : 12;
  }, [isDesktop, isTablet, screenWidth]);

  const tabRowPaddingBottom = Math.max(tabBarPaddingBottom, insets.bottom + 8);
  const pillBase = [styles.pill, { marginHorizontal: pillMarginHorizontal, borderColor: theme.glassTabBorderColor }];

  const renderTabs = () =>
    state.routes.map((route, index) => {
      const { options } = descriptors[route.key];
      const focused = index === state.index;
      const color = focused ? "#008f4e" : theme.glassTabInactiveColor;
      const icon = options.tabBarIcon as TabIconRenderer | undefined;
      const label = options.tabBarLabel;
      const title = typeof options.title === "string" ? options.title : route.name;
      const accessibilityLabel =
        typeof options.tabBarAccessibilityLabel === "string"
          ? options.tabBarAccessibilityLabel
          : title;

      let labelNode: React.ReactNode;
      if (typeof label === "function") {
        labelNode = label({
          focused,
          color,
          position: "below-icon",
          children: title,
        });
      } else if (typeof label === "string") {
        labelNode = (
          <Text style={[styles.label, { color }]} numberOfLines={1}>
            {label}
          </Text>
        );
      } else {
        labelNode = (
          <Text style={[styles.label, { color }]} numberOfLines={1}>
            {title}
          </Text>
        );
      }

      return (
        <TabItem
          key={route.key}
          routeKey={route.key}
          routeName={route.name}
          focused={focused}
          color={color}
          activeBg={theme.glassTabActiveBackground}
          icon={icon}
          iconSize={tabBarIconSize}
          labelNode={labelNode}
          accessibilityLabel={accessibilityLabel}
          testID={options.tabBarButtonTestID}
          navigation={navigation}
          tabBarItemPaddingVertical={tabBarItemPaddingVertical}
          tabBarItemPaddingHorizontal={tabBarItemPaddingHorizontal}
        />
      );
    });

  if (Platform.OS === "web") {
    const surfaceStyle: React.CSSProperties & { WebkitBackdropFilter?: string } = {
      position: "absolute",
      inset: 0,
      borderRadius: BORDER_RADIUS,
      backdropFilter: `blur(24px) saturate(1.8) brightness(${theme.glassTabBackdropBrightness})`,
      WebkitBackdropFilter: `blur(24px) saturate(1.8) brightness(${theme.glassTabBackdropBrightness})`,
      background: theme.glassTabSurfaceColor,
      boxShadow: [
        `inset 0 1px 0 0 rgba(255,255,255,${theme.glassTabHighlightAlpha})`,
        `inset 0 0 0 1px ${theme.glassTabInnerGlowColor}`,
        `0 8px 32px rgba(0,0,0,${theme.glassTabShadowAlphaStrong})`,
      ].join(", "),
    };

    return (
      <View style={[styles.wrapper, { minHeight: tabBarMinHeight + 8 }]}>
        <View style={pillBase}>
        <div style={surfaceStyle} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: BORDER_RADIUS,
            background: `linear-gradient(135deg, ${theme.glassTabChromaticColors[0]} 0%, ${theme.glassTabChromaticColors[1]} 40%, ${theme.glassTabChromaticColors[1]} 60%, ${theme.glassTabChromaticColors[2]} 100%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "45%",
            borderTopLeftRadius: BORDER_RADIUS,
            borderTopRightRadius: BORDER_RADIUS,
            background: `linear-gradient(180deg, ${theme.glassTabTopSpecularColors[0]} 0%, ${theme.glassTabTopSpecularColors[1]} 100%)`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <View
          style={[
            styles.tabRow,
            {
              paddingTop: tabBarPaddingTop,
              paddingBottom: tabRowPaddingBottom,
            },
          ]}
        >
          {renderTabs()}
        </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { minHeight: tabBarMinHeight + 8 }]}>
      <View style={[...pillBase, { overflow: "hidden" }]}>
        <BlurView
          intensity={theme.glassBlurIntensity}
          tint={theme.glassBlurTint}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.glassTabSurfaceColor,
            },
          ]}
        />
        <LinearGradient
          colors={theme.glassTabChromaticColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.specNative,
            {
              borderTopLeftRadius: BORDER_RADIUS,
              borderTopRightRadius: BORDER_RADIUS,
            },
          ]}
        >
          <LinearGradient
            colors={theme.glassTabTopSpecularColors}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: BORDER_RADIUS - 1,
            borderWidth: 1,
            borderColor: theme.glassTabInnerGlowColor,
            zIndex: 1,
          }}
        />
        <View
          style={[
            styles.tabRow,
            {
              paddingTop: tabBarPaddingTop,
              paddingBottom: tabRowPaddingBottom,
            },
          ]}
        >
          {renderTabs()}
        </View>
      </View>
    </View>
  );
}

function TabItem({
  routeKey,
  routeName,
  focused,
  color,
  activeBg,
  icon,
  iconSize,
  labelNode,
  accessibilityLabel,
  testID,
  navigation,
  tabBarItemPaddingVertical,
  tabBarItemPaddingHorizontal,
}: {
  routeKey: string;
  routeName: string;
  focused: boolean;
  color: string;
  activeBg: string;
  icon?: TabIconRenderer;
  iconSize: number;
  labelNode: React.ReactNode;
  accessibilityLabel: string;
  testID?: string;
  navigation: BottomTabBarProps["navigation"];
  tabBarItemPaddingVertical: number;
  tabBarItemPaddingHorizontal: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  }, [scaleAnim]);

  const onPress = () => {
    const event = navigation.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    });

    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName as never);
    }

    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const onLongPress = () => {
    navigation.emit({
      type: "tabLongPress",
      target: routeKey,
    });
  };

  return (
    <Pressable
      style={[
        styles.tab,
        {
          paddingVertical: tabBarItemPaddingVertical,
          paddingHorizontal: tabBarItemPaddingHorizontal,
        },
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={focused ? { selected: true } : {}}
      testID={testID}
    >
      {focused ? <View style={[styles.activeIndicator, { backgroundColor: activeBg }]} /> : null}
      <Animated.View style={{ zIndex: 1, alignItems: "center", transform: [{ scale: scaleAnim }] }}>
        {icon?.({ focused, color, size: iconSize })}
        {labelNode}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    justifyContent: "center",
  },
  pill: {
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
  },
  specNative: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    overflow: "hidden",
    zIndex: 1,
  },
  tabRow: {
    flexDirection: "row",
    zIndex: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    minWidth: 0,
  },
  activeIndicator: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: "12%",
    right: "12%",
    borderRadius: 16,
    zIndex: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
});
