import React, { useCallback, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type PressAnimationConfig = {
  pressedScale: number;
  pressedOpacity: number;
  pressedTranslateY?: number;
  pressInSpeed: number;
  pressInBounciness: number;
  pressOutSpeed: number;
  pressOutBounciness: number;
};

export const TOUCH_TARGET_MIN_SIZE = 48;
export const COMPACT_CONTROL_HIT_SLOP = 8;

type BaseAnimatedPressableProps = Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  enforceTouchTarget?: boolean;
};

type InternalBaseAnimatedPressableProps = BaseAnimatedPressableProps & {
  animation: PressAnimationConfig;
  touchTargetStyle?: ViewStyle;
  defaultHitSlop?: PressableProps["hitSlop"];
};

export function usePressAnimation({
  pressedScale,
  pressedOpacity,
  pressedTranslateY = 0,
  pressInSpeed,
  pressInBounciness,
  pressOutSpeed,
  pressOutBounciness,
}: PressAnimationConfig) {
  const progress = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    (toValue: 0 | 1) => {
      Animated.spring(progress, {
        toValue,
        useNativeDriver: true,
        speed: toValue === 1 ? pressInSpeed : pressOutSpeed,
        bounciness: toValue === 1 ? pressInBounciness : pressOutBounciness,
      }).start();
    },
    [pressInBounciness, pressInSpeed, pressOutBounciness, pressOutSpeed, progress]
  );

  const animatedStyle = useMemo(
    () => ({
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, pressedOpacity],
      }),
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, pressedScale],
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, pressedTranslateY],
          }),
        },
      ],
    }),
    [pressedOpacity, pressedScale, pressedTranslateY, progress]
  );

  return {
    animatedStyle,
    handlePressInAnimation: () => animateTo(1),
    handlePressOutAnimation: () => animateTo(0),
  };
}

function getTouchTargetEnforcementStyle(
  style: StyleProp<ViewStyle>,
  touchTargetStyle: ViewStyle | undefined
): ViewStyle | null {
  if (!touchTargetStyle) return null;

  const flattenedStyle = StyleSheet.flatten(style);
  const enforcedStyle: ViewStyle = {};

  if (
    typeof touchTargetStyle.minWidth === "number" &&
    (typeof flattenedStyle?.minWidth !== "number" || flattenedStyle.minWidth < touchTargetStyle.minWidth)
  ) {
    enforcedStyle.minWidth = touchTargetStyle.minWidth;
  }

  if (
    typeof touchTargetStyle.minHeight === "number" &&
    (typeof flattenedStyle?.minHeight !== "number" || flattenedStyle.minHeight < touchTargetStyle.minHeight)
  ) {
    enforcedStyle.minHeight = touchTargetStyle.minHeight;
  }

  return Object.keys(enforcedStyle).length ? enforcedStyle : null;
}

function BaseAnimatedPressable({
  children,
  animation,
  className,
  containerClassName,
  style,
  containerStyle,
  touchTargetStyle,
  defaultHitSlop,
  enforceTouchTarget = true,
  disabled,
  hitSlop,
  onPressIn,
  onPressOut,
  ...rest
}: InternalBaseAnimatedPressableProps) {
  const { animatedStyle, handlePressInAnimation, handlePressOutAnimation } = usePressAnimation(animation);
  const touchTargetEnforcementStyle = enforceTouchTarget
    ? getTouchTargetEnforcementStyle(style, touchTargetStyle)
    : null;

  const handlePressIn: PressableProps["onPressIn"] = useCallback(
    (event: GestureResponderEvent) => {
      if (!disabled) handlePressInAnimation();
      onPressIn?.(event);
    },
    [disabled, handlePressInAnimation, onPressIn]
  );

  const handlePressOut: PressableProps["onPressOut"] = useCallback(
    (event: GestureResponderEvent) => {
      handlePressOutAnimation();
      onPressOut?.(event);
    },
    [handlePressOutAnimation, onPressOut]
  );

  // touch-audit-ignore: low-level animated primitive wraps RN Pressable and enforces shared touch targets.
  return (
    <Animated.View className={containerClassName} style={[animatedStyle, disabled ? styles.disabled : null, containerStyle]}>
      <Pressable
        {...rest}
        className={className}
        disabled={disabled}
        hitSlop={hitSlop ?? defaultHitSlop}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[enforceTouchTarget ? touchTargetStyle : null, style, touchTargetEnforcementStyle]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

type SharedAnimatedPressableProps = BaseAnimatedPressableProps;

export function AnimatedCardPressable(props: SharedAnimatedPressableProps) {
  return (
    <BaseAnimatedPressable
      {...props}
      touchTargetStyle={styles.touchTarget}
      animation={{
        pressedScale: 0.988,
        pressedOpacity: 0.98,
        pressedTranslateY: 1,
        pressInSpeed: 42,
        pressInBounciness: 0,
        pressOutSpeed: 26,
        pressOutBounciness: 7,
      }}
    />
  );
}

export function AnimatedIconPressable(props: SharedAnimatedPressableProps) {
  return (
    <BaseAnimatedPressable
      {...props}
      touchTargetStyle={styles.iconTouchTarget}
      defaultHitSlop={COMPACT_CONTROL_HIT_SLOP}
      animation={{
        pressedScale: 0.94,
        pressedOpacity: 0.78,
        pressInSpeed: 50,
        pressInBounciness: 0,
        pressOutSpeed: 30,
        pressOutBounciness: 8,
      }}
    />
  );
}

export function AnimatedChipPressable(props: SharedAnimatedPressableProps) {
  return (
    <BaseAnimatedPressable
      {...props}
      touchTargetStyle={styles.touchTarget}
      animation={{
        pressedScale: 0.975,
        pressedOpacity: 0.92,
        pressedTranslateY: 0.5,
        pressInSpeed: 46,
        pressInBounciness: 0,
        pressOutSpeed: 28,
        pressOutBounciness: 7,
      }}
    />
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.55,
  },
  touchTarget: {
    minWidth: TOUCH_TARGET_MIN_SIZE,
    minHeight: TOUCH_TARGET_MIN_SIZE,
  },
  iconTouchTarget: {
    minWidth: TOUCH_TARGET_MIN_SIZE,
    minHeight: TOUCH_TARGET_MIN_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
