import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AnimatedCardPressable } from "@/components/ui/AnimatedPressables";

export type HomeTaskMarqueeItem = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string | null;
  onPress: () => void;
};

type HomeTaskMarqueeProps = {
  items: HomeTaskMarqueeItem[];
};

const CARD_WIDTH = 288;
const CARD_GAP = 16;
const INITIAL_AUTO_SCROLL_DELAY_MS = 20000;
const AUTO_SCROLL_RESUME_DELAY_MS = 4000;
const MIN_AUTO_SCROLL_DURATION_MS = 30000;
const AUTO_SCROLL_MS_PER_PIXEL = 48;

export function HomeTaskMarquee({ items }: HomeTaskMarqueeProps) {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";
  const isGreen = resolvedTheme === "green";
  const isLight = resolvedTheme === "light";
  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass =
    isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const shellClass = isDark
    ? "bg-gray-950/60 border-gray-800"
    : isGreen
      ? "bg-emerald-950/30 border-emerald-700"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white border-gray-200";
  const cardClass = isDark
    ? "bg-gray-900/90 border-gray-800"
    : isGreen
      ? "bg-emerald-900/80 border-emerald-800"
      : isLight
        ? "bg-emerald-50/70 border-emerald-200"
        : "bg-gray-50 border-gray-200";
  const badgeClass = isDark || isGreen
    ? "bg-emerald-500/10 border border-emerald-500/20"
    : "bg-emerald-50 border border-emerald-200";

  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedAtRef = useRef(Date.now());
  const offsetRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const suppressPressRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sequenceWidth, setSequenceWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const sequenceItems = useMemo(() => {
    if (!items.length) return [] as HomeTaskMarqueeItem[];

    const estimatedBaseWidth = items.length * (CARD_WIDTH + CARD_GAP);
    const minCopies =
      containerWidth > 0 ? Math.max(1, Math.ceil((containerWidth * 1.35) / Math.max(estimatedBaseWidth, 1))) : 1;

    const repeated: HomeTaskMarqueeItem[] = [];
    for (let copyIndex = 0; copyIndex < minCopies; copyIndex += 1) {
      for (const item of items) {
        repeated.push({
          ...item,
          id: `${item.id}-sequence-${copyIndex}`,
        });
      }
    }
    return repeated;
  }, [containerWidth, items]);

  const normalizeOffset = useCallback(
    (value: number) => {
      if (sequenceWidth <= 0) return 0;

      let next = value;
      while (next <= -sequenceWidth) next += sequenceWidth;
      while (next > 0) next -= sequenceWidth;
      return next;
    },
    [sequenceWidth]
  );

  const clampDragOffset = useCallback(
    (value: number) => {
      if (sequenceWidth <= 0) return 0;
      return Math.max(-sequenceWidth, Math.min(0, value));
    },
    [sequenceWidth]
  );

  const clearResumeTimeout = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const clearSuppressPressTimeout = useCallback(() => {
    if (suppressPressTimeoutRef.current) {
      clearTimeout(suppressPressTimeoutRef.current);
      suppressPressTimeoutRef.current = null;
    }
  }, []);

  const temporarilySuppressPress = useCallback(() => {
    suppressPressRef.current = true;
    clearSuppressPressTimeout();
    suppressPressTimeoutRef.current = setTimeout(() => {
      suppressPressRef.current = false;
      suppressPressTimeoutRef.current = null;
    }, 180);
  }, [clearSuppressPressTimeout]);

  const startAutoScroll = useCallback(
    (startValue = offsetRef.current) => {
      clearResumeTimeout();
      animationRef.current?.stop();
      translateX.stopAnimation();

      if (sequenceWidth <= 0 || items.length === 0) {
        return;
      }

      const normalizedStart = normalizeOffset(startValue);
      const cycleStart = normalizedStart === 0 ? -sequenceWidth : normalizedStart;
      offsetRef.current = cycleStart;
      translateX.setValue(cycleStart);

      const duration = Math.max(
        MIN_AUTO_SCROLL_DURATION_MS,
        Math.round(sequenceWidth * AUTO_SCROLL_MS_PER_PIXEL)
      );
      const initialDuration = Math.max(
        1,
        Math.round((Math.abs(0 - cycleStart) / sequenceWidth) * duration)
      );

      const loopAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 0,
            duration,
            easing: Easing.linear,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(translateX, {
            toValue: -sequenceWidth,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: Platform.OS !== "web",
          }),
        ])
      );

      const animation = Animated.sequence([
        Animated.timing(translateX, {
          toValue: 0,
          duration: initialDuration,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateX, {
          toValue: -sequenceWidth,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]);

      animationRef.current = animation;
      animation.start(({ finished }) => {
        if (!finished) return;
        offsetRef.current = -sequenceWidth;
        translateX.setValue(-sequenceWidth);
        animationRef.current = loopAnimation;
        loopAnimation.start();
      });
    },
    [clearResumeTimeout, items.length, normalizeOffset, sequenceWidth, translateX]
  );

  const scheduleAutoScrollResume = useCallback(
    (startValue = offsetRef.current, delayMs = 0) => {
      clearResumeTimeout();

      if (sequenceWidth <= 0 || items.length === 0) {
        return;
      }

      if (delayMs <= 0) {
        startAutoScroll(startValue);
        return;
      }

      resumeTimeoutRef.current = setTimeout(() => {
        resumeTimeoutRef.current = null;
        startAutoScroll(startValue);
      }, delayMs);
    },
    [clearResumeTimeout, items.length, sequenceWidth, startAutoScroll]
  );

  useEffect(() => {
    const elapsedMs = Date.now() - mountedAtRef.current;
    const remainingDelayMs = Math.max(0, INITIAL_AUTO_SCROLL_DELAY_MS - elapsedMs);
    scheduleAutoScrollResume(0, remainingDelayMs);
    return () => {
      clearResumeTimeout();
      clearSuppressPressTimeout();
      animationRef.current?.stop();
    };
  }, [clearResumeTimeout, clearSuppressPressTimeout, scheduleAutoScrollResume]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 4,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          setIsDragging(true);
          clearResumeTimeout();
          animationRef.current?.stop();
          translateX.stopAnimation((value) => {
            const normalized = normalizeOffset(value);
            offsetRef.current = normalized;
            dragStartOffsetRef.current = normalized;
            translateX.setValue(normalized);
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const next = clampDragOffset(dragStartOffsetRef.current + gestureState.dx);
          offsetRef.current = next;
          translateX.setValue(next);
        },
        onPanResponderRelease: () => {
          setIsDragging(false);
          temporarilySuppressPress();
          const normalized = normalizeOffset(offsetRef.current);
          offsetRef.current = normalized;
          translateX.setValue(normalized);
          scheduleAutoScrollResume(normalized, AUTO_SCROLL_RESUME_DELAY_MS);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          temporarilySuppressPress();
          const normalized = normalizeOffset(offsetRef.current);
          offsetRef.current = normalized;
          translateX.setValue(normalized);
          scheduleAutoScrollResume(normalized, AUTO_SCROLL_RESUME_DELAY_MS);
        },
      }),
    [clampDragOffset, clearResumeTimeout, normalizeOffset, scheduleAutoScrollResume, temporarilySuppressPress, translateX]
  );

  if (!items.length) return null;

  const renderCard = (item: HomeTaskMarqueeItem, key: string) => (
    <AnimatedCardPressable
      key={key}
      onPress={() => {
        if (suppressPressRef.current) return;
        item.onPress();
      }}
      containerStyle={{ width: CARD_WIDTH }}
      className={`border rounded-3xl p-4 ${cardClass}`}
    >
      <View className="flex-row items-start">
        <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
          <Ionicons name={item.icon} size={18} color="#008f4e" />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-start justify-between gap-2">
            <Text className={`${textClass} font-semibold flex-1`} numberOfLines={2}>
              {item.title}
            </Text>
            {item.badge ? (
              <View className={`px-2.5 py-1 rounded-full ${badgeClass}`}>
                <Text className={`${isDark || isGreen ? "text-emerald-100" : "text-emerald-700"} text-[11px] font-semibold`}>
                  {item.badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className={`${secondaryTextClass} text-sm mt-2`} numberOfLines={3}>
            {item.body}
          </Text>
          <Text className="text-emerald-500 text-xs font-semibold mt-3">{item.actionLabel}</Text>
        </View>
      </View>
    </AnimatedCardPressable>
  );

  return (
    <View className={`${shellClass} border rounded-[28px] p-5 overflow-hidden`}>
      <View className="mb-4">
        <Text className={`${textClass} text-lg font-semibold`}>Next up</Text>
        <Text className={`${secondaryTextClass} text-sm mt-1`}>
          A steady stream of the next tasks and opportunities worth acting on.
        </Text>
      </View>

      <View
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
        style={
          Platform.OS === "web"
            ? ({
                overflow: "hidden",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
                WebkitUserSelect: "none",
                touchAction: "pan-y",
              } as any)
            : { overflow: "hidden" }
        }
        {...panResponder.panHandlers}
      >
        <Animated.View
          style={{
            flexDirection: "row",
            transform: [{ translateX }],
          }}
        >
          <View style={{ flexDirection: "row", gap: CARD_GAP, paddingRight: CARD_GAP }}>
            {sequenceItems.map((item, index) => renderCard(item, `${item.id}-clone-${index}`))}
          </View>
          <View
            onLayout={(event) => setSequenceWidth(event.nativeEvent.layout.width)}
            style={{ flexDirection: "row", gap: CARD_GAP, paddingRight: CARD_GAP }}
          >
            {sequenceItems.map((item) => renderCard(item, item.id))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
