import React from "react";
import {
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
  COMPACT_CONTROL_HIT_SLOP,
  TOUCH_TARGET_MIN_SIZE,
} from "@/components/ui/AnimatedPressables";

/*
 * Use TouchIconButton for compact icon actions, TouchCard for tappable cards/rows,
 * TouchChip for pills and segmented options, TouchToggleRow for settings switches,
 * and TouchOptionRow for checkbox/radio/dropdown-style option rows.
 */

type AnimatedCardPressableProps = React.ComponentProps<typeof AnimatedCardPressable>;
type AnimatedChipPressableProps = React.ComponentProps<typeof AnimatedChipPressable>;
type AnimatedIconPressableProps = React.ComponentProps<typeof AnimatedIconPressable>;

type AccessibilityState = PressableProps["accessibilityState"];
type AccessibilityRole = PressableProps["accessibilityRole"];

type TouchIconButtonProps = Omit<AnimatedIconPressableProps, "children"> & {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  accessibilityLabel: string;
};

type TouchCardProps = AnimatedCardPressableProps;

type TouchChipProps = AnimatedChipPressableProps & {
  selected?: boolean;
};

type TouchToggleRowProps = Omit<AnimatedCardPressableProps, "accessibilityRole" | "accessibilityState"> & {
  checked: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
};

type TouchOptionRowProps = Omit<AnimatedCardPressableProps, "accessibilityRole" | "accessibilityState"> & {
  checked?: boolean | "mixed";
  expanded?: boolean;
  accessibilityRole?: "button" | "checkbox" | "radio";
  accessibilityState?: AccessibilityState;
};

function mergeAccessibilityState(
  accessibilityState: AccessibilityState | undefined,
  nextState: AccessibilityState
): AccessibilityState {
  return {
    ...accessibilityState,
    ...nextState,
  };
}

export function TouchIconButton({
  children,
  icon,
  style,
  accessibilityRole = "button",
  hitSlop = COMPACT_CONTROL_HIT_SLOP,
  ...props
}: TouchIconButtonProps) {
  return (
    <AnimatedIconPressable
      {...props}
      accessibilityRole={accessibilityRole}
      hitSlop={hitSlop}
      style={[styles.iconButton, style]}
    >
      {icon ?? children}
    </AnimatedIconPressable>
  );
}

export function TouchCard({
  style,
  accessibilityRole = "button",
  ...props
}: TouchCardProps) {
  return (
    <AnimatedCardPressable
      {...props}
      accessibilityRole={accessibilityRole}
      style={[styles.touchTargetHeight, style]}
    />
  );
}

export function TouchChip({
  selected,
  disabled,
  accessibilityRole = "button",
  accessibilityState,
  style,
  ...props
}: TouchChipProps) {
  return (
    <AnimatedChipPressable
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={mergeAccessibilityState(accessibilityState, {
        selected,
        disabled: !!disabled,
      })}
      disabled={disabled}
      style={[styles.touchTargetHeight, style]}
    />
  );
}

export function TouchToggleRow({
  checked,
  disabled,
  accessibilityRole = "switch",
  accessibilityState,
  style,
  ...props
}: TouchToggleRowProps) {
  return (
    <AnimatedCardPressable
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={mergeAccessibilityState(accessibilityState, {
        checked,
        disabled: !!disabled,
      })}
      disabled={disabled}
      style={[styles.touchRow, style]}
    />
  );
}

export function TouchOptionRow({
  checked,
  disabled,
  expanded,
  accessibilityRole = "button",
  accessibilityState,
  style,
  ...props
}: TouchOptionRowProps) {
  return (
    <AnimatedCardPressable
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={mergeAccessibilityState(accessibilityState, {
        checked,
        disabled: !!disabled,
        expanded,
      })}
      disabled={disabled}
      style={[styles.touchRow, style]}
    />
  );
}

const styles = StyleSheet.create({
  iconButton: {
    minWidth: TOUCH_TARGET_MIN_SIZE,
    minHeight: TOUCH_TARGET_MIN_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  touchTargetHeight: {
    minHeight: TOUCH_TARGET_MIN_SIZE,
  },
  touchRow: {
    minHeight: TOUCH_TARGET_MIN_SIZE,
    width: "100%",
  },
} satisfies Record<string, StyleProp<ViewStyle>>);
