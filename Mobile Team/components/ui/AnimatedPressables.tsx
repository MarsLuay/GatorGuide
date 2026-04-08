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

type BaseAnimatedPressableProps = Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
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

function BaseAnimatedPressable({
  children,
  animation,
  className,
  containerClassName,
  style,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: BaseAnimatedPressableProps & { animation: PressAnimationConfig }) {
  const { animatedStyle, handlePressInAnimation, handlePressOutAnimation } = usePressAnimation(animation);

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

  return (
    <Animated.View className={containerClassName} style={[animatedStyle, disabled ? styles.disabled : null, containerStyle]}>
      <Pressable
        {...rest}
        className={className}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
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
      hitSlop={props.hitSlop ?? 8}
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
});
