import React from "react";
import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";

const RESOURCES_CHILD_ROUTES = ["compare", "cost-calculator"];

/**
 * Custom tab bar that highlights the Resources tab when user is on Compare or Cost Calculator screens.
 */
export function ResourcesAwareTabBar(props: BottomTabBarProps) {
  const { state } = props;
  const currentRouteName = state.routes[state.index]?.name ?? "";
  const isResourcesChild = RESOURCES_CHILD_ROUTES.includes(currentRouteName);

  let modifiedState = state;
  if (isResourcesChild) {
    const resourcesIndex = state.routes.findIndex((r) => r.name === "resources");
    if (resourcesIndex >= 0) {
      modifiedState = { ...state, index: resourcesIndex };
    }
  }

  return <BottomTabBar {...props} state={modifiedState} />;
}
