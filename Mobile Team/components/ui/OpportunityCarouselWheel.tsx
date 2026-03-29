import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MatchedOpportunity } from "@/services/opportunity-matching.service";
import { useAppTheme } from "@/hooks/use-app-theme";

type OpportunityCarouselWheelProps = {
  opportunities: MatchedOpportunity[];
  onOpenOpportunity: (opportunity: MatchedOpportunity) => void;
  onViewAll: () => void;
};

function formatOpportunityDueLabel(value: string | null) {
  if (!value) return "Rolling";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Rolling";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return parsed.toDateString();
  }
}

function getOpportunityTypeLabel(opportunity: MatchedOpportunity) {
  if (opportunity.type === "scholarship") return "Scholarship";
  if (opportunity.type === "internship") return "Opportunity";
  return "Deadline";
}

export function OpportunityCarouselWheel({
  opportunities,
  onOpenOpportunity,
  onViewAll,
}: OpportunityCarouselWheelProps) {
  const { isDark, isGreen, isLight } = useAppTheme();
  const { fontScale = 1 } = useWindowDimensions();
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const [resumeCountdownSeconds, setResumeCountdownSeconds] = useState(0);
  const [wheelContainerWidth, setWheelContainerWidth] = useState(0);
  const interactionResumeAtRef = useRef<number | null>(null);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveFontScale = Math.max(1, fontScale);

  const visibleOpportunities = useMemo(
    () => opportunities.filter((opportunity) => !opportunity.isDone).slice(0, 7),
    [opportunities]
  );

  const clearInteractionTimeout = useCallback(() => {
    if (!interactionTimeoutRef.current) return;
    clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = null;
  }, []);

  const handleWheelLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setWheelContainerWidth((previous) => (previous === nextWidth ? previous : nextWidth));
  }, []);

  const pauseAutoRotationForInteraction = useCallback(() => {
    if (isManuallyPaused) return;

    clearInteractionTimeout();
    interactionResumeAtRef.current = Date.now() + 10_000;
    setIsInteractionPaused(true);
    setResumeCountdownSeconds(10);

    interactionTimeoutRef.current = setTimeout(() => {
      interactionResumeAtRef.current = null;
      setIsInteractionPaused(false);
      setResumeCountdownSeconds(0);
      interactionTimeoutRef.current = null;
    }, 10_000);
  }, [clearInteractionTimeout, isManuallyPaused]);

  useEffect(() => {
    return () => {
      clearInteractionTimeout();
    };
  }, [clearInteractionTimeout]);

  useEffect(() => {
    if (!isInteractionPaused || isManuallyPaused) {
      setResumeCountdownSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const resumeAt = interactionResumeAtRef.current;
      if (!resumeAt) {
        setIsInteractionPaused(false);
        setResumeCountdownSeconds(0);
        return;
      }

      const remainingMs = Math.max(0, resumeAt - Date.now());
      setResumeCountdownSeconds(Math.ceil(remainingMs / 1000));
    }, 250);

    return () => clearInterval(interval);
  }, [isInteractionPaused, isManuallyPaused]);

  useEffect(() => {
    if (isManuallyPaused || isInteractionPaused || visibleOpportunities.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setRotationDegrees((previous) => (previous + 0.55) % 360);
    }, 100);

    return () => clearInterval(interval);
  }, [isInteractionPaused, isManuallyPaused, visibleOpportunities.length]);

  const wheelLayout = useMemo(() => {
    const availableWidth = Math.max(320, wheelContainerWidth || 420);
    const accessibilityScale = Math.min(effectiveFontScale, 1.12);
    const scale = Math.max(0.78, Math.min(availableWidth / 420, 1.35));
    const diameter = Math.round(420 * scale);
    const cardWidth = Math.max(148, Math.round(162 * scale));
    const cardHeight = Math.max(104, Math.round(102 * scale * accessibilityScale));
    const orbitRadiusX = Math.max(0, Math.round(Math.min(140 * scale, diameter / 2 - cardWidth / 2 - 12)));
    const orbitRadiusY = Math.max(0, Math.round(Math.min(96 * scale, diameter / 2 - cardHeight / 2 - 12)));
    const outerRingSize = Math.round(296 * scale);
    const innerRingSize = Math.round(220 * scale);
    const centerCardWidth = Math.max(
      176,
      Math.min(Math.round(182 * scale * Math.min(effectiveFontScale, 1.08)), Math.round(availableWidth * 0.52))
    );
    const centerCardMinHeight = Math.max(136, Math.round(136 * scale * accessibilityScale));

    return {
      availableWidth,
      diameter,
      cardWidth,
      cardHeight,
      orbitRadiusX,
      orbitRadiusY,
      outerRingSize,
      innerRingSize,
      centerCardWidth,
      centerCardMinHeight,
      shouldStackHeader: availableWidth < 560 || effectiveFontScale > 1.1,
      shouldStackLeadCard: availableWidth < 620 || effectiveFontScale > 1.15,
    };
  }, [effectiveFontScale, wheelContainerWidth]);

  const wheelCards = useMemo(() => {
    return visibleOpportunities
      .map((opportunity, index) => {
        const angle =
          (index / Math.max(visibleOpportunities.length, 1)) * Math.PI * 2 +
          (rotationDegrees * Math.PI) / 180 -
          Math.PI / 2;
        const x = Math.cos(angle) * wheelLayout.orbitRadiusX;
        const y = Math.sin(angle) * wheelLayout.orbitRadiusY;
        const depth = (Math.sin(angle) + 1) / 2;
        const scale = 0.78 + depth * 0.34;
        const opacity = 0.42 + depth * 0.58;
        return {
          opportunity,
          x,
          y,
          depth,
          scale,
          opacity,
        };
      })
      .sort((left, right) => left.depth - right.depth);
  }, [rotationDegrees, visibleOpportunities, wheelLayout.orbitRadiusX, wheelLayout.orbitRadiusY]);

  const leadOpportunity = visibleOpportunities[0] ?? null;
  const cardClass = isDark
    ? "bg-gray-950/95 border-gray-800"
    : isGreen
      ? "bg-emerald-950/75 border-emerald-700"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white border-gray-200";
  const shellClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white/90 border-gray-200";
  const textClass = isDark ? "text-white" : isGreen ? "text-white" : "text-emerald-900";
  const secondaryTextClass =
    isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : "text-emerald-700";

  if (!visibleOpportunities.length) return null;

  return (
    <View className={`${shellClass} border rounded-[28px] p-5 mt-6 overflow-hidden`}>
      <View
        className="mb-4"
        style={
          wheelLayout.shouldStackHeader
            ? { gap: 12 }
            : {
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }
        }
      >
        <View className="flex-row items-start" style={{ flex: 1, minWidth: 0 }}>
          <View className="mr-3 p-2 rounded-xl bg-emerald-500/15">
            <Ionicons name="sparkles-outline" size={18} color="#008f4e" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text className={`${textClass} font-semibold text-lg`}>
              Recommended Opportunity Wheel
            </Text>
            <Text className={`${secondaryTextClass} text-sm`}>
              Rotating unfinished picks from your shared opportunities
            </Text>
          </View>
        </View>

        <Pressable
          onPressIn={pauseAutoRotationForInteraction}
          onPress={onViewAll}
          style={wheelLayout.shouldStackHeader ? { alignSelf: "flex-start" } : undefined}
        >
          <Text className="text-emerald-500 text-sm font-medium">View all</Text>
        </Pressable>
      </View>

      <View
        onLayout={handleWheelLayout}
        style={{ width: "100%", height: wheelLayout.diameter, alignItems: "center", justifyContent: "center" }}
      >
        <View
          style={{
            position: "absolute",
            pointerEvents: "none",
            width: wheelLayout.outerRingSize,
            height: wheelLayout.outerRingSize,
            borderRadius: wheelLayout.outerRingSize / 2,
            borderWidth: 1,
            borderColor: isDark ? "rgba(75,85,99,0.35)" : "rgba(16,185,129,0.18)",
          }}
        />
        <View
          style={{
            position: "absolute",
            pointerEvents: "none",
            width: wheelLayout.innerRingSize,
            height: wheelLayout.innerRingSize,
            borderRadius: wheelLayout.innerRingSize / 2,
            borderWidth: 1,
            borderColor: isDark ? "rgba(75,85,99,0.25)" : "rgba(16,185,129,0.12)",
          }}
        />

        {wheelCards.map((card) => (
          <Pressable
            key={card.opportunity.opportunityId}
            onPressIn={pauseAutoRotationForInteraction}
            onPress={() => onOpenOpportunity(card.opportunity)}
            style={{
              position: "absolute",
              left: wheelLayout.diameter / 2 - wheelLayout.cardWidth / 2 + card.x,
              top: wheelLayout.diameter / 2 - wheelLayout.cardHeight / 2 + card.y,
              width: wheelLayout.cardWidth,
              height: wheelLayout.cardHeight,
              zIndex: Math.round(card.depth * 100),
              opacity: card.opacity,
              transform: [{ scale: card.scale }],
            }}
            className={`${cardClass} border rounded-2xl p-3`}
          >
            <Text className={`${textClass} text-sm font-semibold`} numberOfLines={2}>
              {card.opportunity.title}
            </Text>
            <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={1}>
              {card.opportunity.organizationName || getOpportunityTypeLabel(card.opportunity)}
            </Text>
            <View className="flex-row items-center justify-between mt-3">
              <Text className="text-emerald-500 text-xs font-semibold">
                {formatOpportunityDueLabel(card.opportunity.computedDueAt)}
              </Text>
              <Text className={`${secondaryTextClass} text-[11px]`}>
                {Math.max(0, Math.round(card.opportunity.matchScore))}/100
              </Text>
            </View>
          </Pressable>
        ))}

        <View
          className={`${cardClass} border rounded-[28px] px-5 py-4 items-center justify-center`}
          style={{ width: wheelLayout.centerCardWidth, minHeight: wheelLayout.centerCardMinHeight }}
        >
          <Text className={`${textClass} text-base font-semibold text-center`}>
            Opportunity Wheel
          </Text>
          <Text className={`${secondaryTextClass} text-xs text-center mt-1`}>
            Auto-rotating recommended opportunities
          </Text>
          <Pressable
            onPress={() => {
              if (isManuallyPaused) {
                setIsManuallyPaused(false);
                return;
              }

              clearInteractionTimeout();
              interactionResumeAtRef.current = null;
              setIsInteractionPaused(false);
              setResumeCountdownSeconds(0);
              setIsManuallyPaused(true);
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-500"
          >
            <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} text-sm font-semibold`}>
              {isManuallyPaused ? "Resume wheel" : "Pause wheel"}
            </Text>
          </Pressable>
          {!isManuallyPaused && isInteractionPaused && resumeCountdownSeconds > 0 ? (
            <Text className={`${secondaryTextClass} text-[11px] text-center mt-2`}>
              Resumes in {resumeCountdownSeconds}s
            </Text>
          ) : null}
        </View>
      </View>

      {leadOpportunity ? (
        <View className={`${cardClass} border rounded-2xl p-4 mt-4`}>
          <View
            style={
              wheelLayout.shouldStackLeadCard
                ? { gap: 16 }
                : { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }
            }
          >
            <View style={wheelLayout.shouldStackLeadCard ? undefined : { flex: 1, minWidth: 0, paddingRight: 16 }}>
              <Text
                className={`${textClass} font-semibold`}
                numberOfLines={wheelLayout.shouldStackLeadCard ? 2 : 1}
              >
                {leadOpportunity.title}
              </Text>
              <Text
                className={`${secondaryTextClass} text-sm mt-1`}
                numberOfLines={wheelLayout.shouldStackLeadCard ? 3 : 2}
              >
                {leadOpportunity.summary}
              </Text>
              <View className="flex-row flex-wrap gap-2 mt-3">
                <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Text className="text-emerald-500 text-xs font-semibold">
                    {getOpportunityTypeLabel(leadOpportunity)}
                  </Text>
                </View>
                <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Text className="text-emerald-500 text-xs font-semibold">
                    Due {formatOpportunityDueLabel(leadOpportunity.computedDueAt)}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPressIn={pauseAutoRotationForInteraction}
              onPress={() => onOpenOpportunity(leadOpportunity)}
              className="px-4 py-2 rounded-xl bg-emerald-500"
              style={wheelLayout.shouldStackLeadCard ? { alignSelf: "flex-start" } : undefined}
            >
              <Text className={`${isDark || isGreen ? "text-white" : "text-emerald-900"} text-sm font-semibold`}>
                Open
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
