import React from "react";
import { View } from "react-native";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { GlassTabBar } from "@/components/GlassTabBar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";

const PRIMARY_TAB_ROUTES = ["index", "resources", "profile", "settings"] as const;
const TAB_ROUTE_ALIASES: Record<string, (typeof PRIMARY_TAB_ROUTES)[number]> = {
  roadmap: "index",
  questionnaire: "index",
  compare: "resources",
  "cost-calculator": "resources",
  "saved-colleges": "resources",
  calendar: "resources",
  "transfer-planner": "resources",
  "college-search": "resources",
  "opportunity-admin": "resources",
  "college/[collegeId]": "resources",
  language: "settings",
  about: "settings",
  privacy: "settings",
  terms: "settings",
};

type ResourcesAwareTabBarProps = BottomTabBarProps & {
  variant?: "classic" | "glass";
};

/**
 * Custom tab bar that highlights the Resources tab while users browse tool screens under Resources.
 */
export function ResourcesAwareTabBar({
  variant = "glass",
  ...props
}: ResourcesAwareTabBarProps) {
  const { state } = props;
  const { resolvedTheme } = useAppTheme();
  const theme = useThemeStyles();
  const { createResponsiveContainerStyle } = useResponsiveLayout();
  const currentRouteName = state.routes[state.index]?.name ?? "";
  const isDark = resolvedTheme === "dark";
  const isGreen = resolvedTheme === "green";
  const shellStyle = createResponsiveContainerStyle({
    maxWidth: { phone: null, tablet: null, desktop: 1280 },
    horizontalPadding: { phone: 0, tablet: 0, desktop: 24 },
  });

  const activeRouteName = TAB_ROUTE_ALIASES[currentRouteName] ?? currentRouteName;
  let modifiedState = state;
  if (activeRouteName !== currentRouteName) {
    const activeIndex = state.routes.findIndex((route) => route.name === activeRouteName);
    if (activeIndex >= 0) {
      modifiedState = { ...state, index: activeIndex };
    }
  }

  const visibleRoutes = modifiedState.routes.filter((route) =>
    PRIMARY_TAB_ROUTES.includes(route.name as (typeof PRIMARY_TAB_ROUTES)[number])
  );
  const visibleRouteNames = modifiedState.routeNames.filter((routeName) =>
    PRIMARY_TAB_ROUTES.includes(routeName as (typeof PRIMARY_TAB_ROUTES)[number])
  );
  const visibleRouteKeys = new Set(visibleRoutes.map((route) => route.key));
  const filteredDescriptors = Object.fromEntries(
    visibleRoutes.map((route) => [route.key, props.descriptors[route.key]])
  );
  const filteredState = {
    ...modifiedState,
    index: Math.max(
      0,
      visibleRoutes.findIndex((route) => route.name === activeRouteName)
    ),
    routes: visibleRoutes,
    routeNames: visibleRouteNames,
    history: modifiedState.history?.filter(
      (entry) => entry.type !== "route" || visibleRouteKeys.has(entry.key)
    ),
  } as typeof modifiedState;

  if (variant === "glass") {
    return (
      <View style={{ width: "100%", backgroundColor: theme.screenBaseColor }}>
        <View style={shellStyle}>
          <GlassTabBar
            {...props}
            state={filteredState}
            descriptors={filteredDescriptors}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        width: "100%",
        backgroundColor: isDark ? "#000000" : isGreen ? "#001f0f" : "#ECFDF3",
        borderTopWidth: 1,
        borderTopColor: isDark ? "#1F2937" : isGreen ? "#003b1a" : "#A7E3C4",
      }}
    >
      <View style={shellStyle}>
        <BottomTabBar
          {...props}
          state={filteredState}
          descriptors={filteredDescriptors}
        />
      </View>
    </View>
  );
}
