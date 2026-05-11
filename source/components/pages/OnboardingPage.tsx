import { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  ScrollView,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { AnimatedCardPressable } from "@/components/ui/AnimatedPressables";
import { AppButton } from "@/components/ui/AppButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";

type TourTargetId =
  | "searchField"
  | "planningCard"
  | "searchButton"
  | "homeTab"
  | "resourcesTab"
  | "profileTab"
  | "settingsTab";

type TourStep = {
  id: string;
  title: string;
  description: string;
  target: TourTargetId;
  spotlightSize: number;
};

type LayoutBox = {
  width: number;
  height: number;
};

type TargetPoint = {
  x: number;
  y: number;
  size: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { isDark, isGreen } = useAppTheme();
  const theme = useThemeStyles();
  const { state, setOnboardingSeen } = useAppData();
  const { t, hydrated: isLanguageHydrated } = useAppLanguage();
  const {
    width: screenWidth,
    isTablet,
    isDesktop,
    topInset,
    bottomInset,
    tabBarPaddingTop,
    tabBarPaddingBottom,
    tabBarIconSize,
    tabBarLabelFontSize,
    tabBarLabelLineHeight,
    tabBarLabelMaxWidth,
    tabBarHorizontalPadding,
    tabBarItemPaddingVertical,
    tabBarItemPaddingHorizontal,
    tabBarMinHeight,
  } = useResponsiveLayout();

  const [currentStep, setCurrentStep] = useState(0);
  const [layout, setLayout] = useState<LayoutBox>({ width: 0, height: 0 });
  const [bubbleHeight, setBubbleHeight] = useState(190);

  const isCompactPhone = screenWidth < 390;
  const isWideLayout = isDesktop;
  const showStepRail = isWideLayout;
  const shellHorizontalPadding = screenWidth >= 1280 ? 32 : isTablet ? 24 : isCompactPhone ? 16 : 20;
  const pageMaxWidth = isWideLayout ? 1320 : isTablet ? 1040 : 620;
  const introWidth = isWideLayout ? 320 : undefined;
  const pageTopPadding = topInset + 16;
  const pageBottomPadding = Math.max(bottomInset + 32, 40);
  const introCardPadding = isTablet ? 24 : 20;
  const previewCardPadding = isWideLayout ? 24 : isTablet ? 20 : 16;
  const previewHeight = isWideLayout ? 680 : isTablet ? 620 : isCompactPhone ? 510 : 560;

  const textClass = theme.textClass;
  const secondaryTextClass = theme.secondaryTextClass;
  const accentColor = isDark || isGreen ? "#34d399" : "#10b981";
  const accentStrongColor = isDark || isGreen ? "#a7f3d0" : "#047857";
  const accentOnColor = isDark || isGreen ? "#042f2e" : "#f0fdf4";
  const accentSurfaceColor = isDark || isGreen ? "rgba(16, 185, 129, 0.16)" : "rgba(16, 185, 129, 0.12)";
  const accentBorderColor = isDark || isGreen ? "rgba(52, 211, 153, 0.30)" : "rgba(16, 185, 129, 0.24)";
  const previewSurfaceColor = isDark
    ? "rgba(2, 6, 23, 0.74)"
    : isGreen
      ? "rgba(6, 78, 59, 0.74)"
      : "rgba(255, 255, 255, 0.82)";
  const previewBorderColor = isDark || isGreen ? "rgba(52, 211, 153, 0.28)" : "rgba(16, 185, 129, 0.20)";
  const previewPanelColor = isDark || isGreen ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.58)";
  const previewInputSurfaceColor = isDark || isGreen ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.88)";
  const tabBarSurfaceColor = isDark
    ? "rgba(2, 6, 23, 0.62)"
    : isGreen
      ? "rgba(6, 78, 59, 0.68)"
      : "rgba(255, 255, 255, 0.76)";
  const pointerBackgroundColor = isDark ? "#042f2e" : isGreen ? "#064e3b" : "#ecfdf5";
  const spotlightFillColor = isDark || isGreen ? "rgba(16, 185, 129, 0.18)" : "rgba(16, 185, 129, 0.16)";
  const spotlightOverlayColor = isDark || isGreen ? "rgba(0, 0, 0, 0.34)" : "rgba(0, 0, 0, 0.40)";
  const stepBadgeInactiveColor = isDark ? "#0f2f2a" : isGreen ? "#064e3b" : "#d1fae5";
  const stepBadgeInactiveTextColor = isDark || isGreen ? "#e5e7eb" : "#065f46";
  const previewMutedTextColor = isDark || isGreen ? "rgba(220, 252, 231, 0.82)" : "#166534";
  const introMetaSurfaceColor = isDark || isGreen ? "rgba(16, 185, 129, 0.10)" : "rgba(255, 255, 255, 0.48)";
  const introMetaValueColor = theme.textColor;
  const introMetaBorderColor = isDark || isGreen ? accentBorderColor : "rgba(16, 185, 129, 0.16)";
  const welcomeName = state.user?.name?.trim()?.split(/\s+/)[0] ?? "";
  const hasCompletedSetup = !!(state.user?.isProfileComplete || state.user?.major || state.user?.gpa);
  const introTitle = welcomeName ? `Welcome, ${welcomeName}` : "Welcome to Gator Guide";
  const introDescription = hasCompletedSetup
    ? "Take the quick tour to see where search, resources, and your profile live before you jump into the app."
    : "Take the quick tour, then head into profile setup so your recommendations and plan start out personalized.";
  const introOutcomeText = hasCompletedSetup
    ? "You can leave the tour at any time and head straight into the app."
    : "When the tour ends, we will send you to profile setup so search and planning feel more personal.";
  const primaryFinishDestinationLabel = hasCompletedSetup ? "Open the app" : "Go to profile setup";
  const skipTourLabel = hasCompletedSetup ? "Skip to app" : "Skip to setup";
  const backLabel = isLanguageHydrated ? t("common.back") : "Back";

  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "search",
        title: "Start with Search",
        description: "Type a major, city, or goal here to quickly pull up schools that fit what you want.",
        target: "searchField",
        spotlightSize: 56,
      },
      {
        id: "planning",
        title: "Keep a Plan Visible",
        description: "Your planning card keeps transfer tasks, deadlines, and next steps in one place so nothing gets lost.",
        target: "planningCard",
        spotlightSize: 62,
      },
      {
        id: "keyboard",
        title: "Search from the Keyboard",
        description: "After typing, press your keyboard search or enter key to run a search even faster.",
        target: "searchButton",
        spotlightSize: 46,
      },
      {
        id: "home-tab",
        title: "Home Tab",
        description: "Home is your launch point for search, recommendations, and quick next actions.",
        target: "homeTab",
        spotlightSize: 44,
      },
      {
        id: "resources-tab",
        title: "Resources Tab",
        description: "Resources gives you transfer links, tools, deadlines, and saved planning references.",
        target: "resourcesTab",
        spotlightSize: 44,
      },
      {
        id: "profile-tab",
        title: "Profile Tab",
        description: "Profile stores your major, GPA, and other details that make recommendations more personal.",
        target: "profileTab",
        spotlightSize: 44,
      },
      {
        id: "settings-tab",
        title: "Settings Tab",
        description: "Settings is where you control theme, language, account actions, and support pages.",
        target: "settingsTab",
        spotlightSize: 44,
      },
    ],
    []
  );
  const nextLabel = currentStep === steps.length - 1
    ? isLanguageHydrated
      ? t("common.finish")
      : "Finish"
    : isLanguageHydrated
      ? t("common.next")
      : "Next";
  const previewTabs = useMemo(
    () => [
      {
        id: "home",
        icon: "home" as const,
        label: isLanguageHydrated ? t("navigation.home") : "Home",
      },
      {
        id: "resources",
        icon: "library" as const,
        label: isLanguageHydrated ? t("navigation.resources") : "Resources",
      },
      {
        id: "profile",
        icon: "person" as const,
        label: isLanguageHydrated ? t("navigation.profile") : "Profile",
      },
      {
        id: "settings",
        icon: "settings" as const,
        label: isLanguageHydrated ? t("navigation.settings") : "Settings",
      },
    ],
    [isLanguageHydrated, t]
  );

  const step = steps[currentStep];
  const stepProgressLabel = `Step ${currentStep + 1} of ${steps.length}`;
  const activePreviewTab =
    step.target === "resourcesTab"
      ? "resources"
      : step.target === "profileTab"
        ? "profile"
        : step.target === "settingsTab"
          ? "settings"
          : "home";
  const canvasWidth =
    layout.width ||
    Math.max(320, Math.min(screenWidth - shellHorizontalPadding * 2, isWideLayout ? 900 : isTablet ? 760 : 520));
  const canvasHeight = layout.height || previewHeight;

  const canvasMetrics = useMemo(() => {
    const previewPadding = isWideLayout ? 26 : isTablet ? 22 : 16;
    const searchSectionHeight = isWideLayout ? 156 : isTablet ? 146 : 132;
    const planningSectionHeight = isWideLayout ? 132 : isTablet ? 122 : 110;
    const sectionGap = isWideLayout ? 22 : 18;
    const searchInnerPadding = isWideLayout ? 18 : isTablet ? 16 : 14;
    const searchFieldHeight = isWideLayout ? 54 : isTablet ? 50 : 46;
    const searchButtonWidth = isWideLayout ? 96 : isTablet ? 90 : 82;
    const previewRadius = isWideLayout ? 32 : 28;
    const innerWidth = Math.max(0, canvasWidth - previewPadding * 2);
    const searchFieldLeft = previewPadding + searchInnerPadding;
    const searchFieldWidth = Math.max(220, innerWidth - searchInnerPadding * 2);
    const searchFieldTop = previewPadding + searchInnerPadding;
    const planningTop = previewPadding + searchSectionHeight + sectionGap;
    const tabBarHeight = tabBarMinHeight;
    const tabBarTop = canvasHeight - tabBarHeight;
    const tabCenterY = tabBarTop + tabBarHeight / 2;

    const targets: Record<TourTargetId, TargetPoint> = {
      searchField: {
        x: searchFieldLeft + searchFieldWidth / 2,
        y: searchFieldTop + searchFieldHeight / 2,
        size: step.spotlightSize,
      },
      planningCard: {
        x: canvasWidth / 2,
        y: planningTop + planningSectionHeight / 2,
        size: step.spotlightSize,
      },
      searchButton: {
        x: searchFieldLeft + searchFieldWidth - searchButtonWidth / 2 - 8,
        y: searchFieldTop + searchFieldHeight / 2,
        size: step.spotlightSize,
      },
      homeTab: {
        x: canvasWidth * 0.125,
        y: tabCenterY,
        size: step.spotlightSize,
      },
      resourcesTab: {
        x: canvasWidth * 0.375,
        y: tabCenterY,
        size: step.spotlightSize,
      },
      profileTab: {
        x: canvasWidth * 0.625,
        y: tabCenterY,
        size: step.spotlightSize,
      },
      settingsTab: {
        x: canvasWidth * 0.875,
        y: tabCenterY,
        size: step.spotlightSize,
      },
    };

    return {
      previewPadding,
      previewRadius,
      searchSectionHeight,
      planningSectionHeight,
      sectionGap,
      searchInnerPadding,
      searchFieldHeight,
      searchButtonWidth,
      planningTop,
      tabBarHeight,
      tabBarTop,
      targets,
    };
  }, [canvasHeight, canvasWidth, isTablet, isWideLayout, step.spotlightSize, tabBarMinHeight]);

  const currentTarget = canvasMetrics.targets[step.target];
  const bubbleWidth = Math.min(isWideLayout ? 400 : 360, Math.max(264, canvasWidth - 32));
  const preferTop = currentTarget.y > canvasHeight * 0.48;
  const bubbleTop = preferTop
    ? Math.max(14, currentTarget.y - bubbleHeight - 36)
    : Math.min(canvasHeight - bubbleHeight - 14, currentTarget.y + currentTarget.size / 2 + 18);
  const bubbleLeft = Math.max(14, Math.min(currentTarget.x - bubbleWidth / 2, canvasWidth - bubbleWidth - 14));
  const pointerOffset = Math.max(22, Math.min(currentTarget.x - bubbleLeft - 8, bubbleWidth - 30));
  const progressWidth: DimensionValue = `${((currentStep + 1) / steps.length) * 100}%`;

  const completeTour = async () => {
    await setOnboardingSeen(true);

    if (hasCompletedSetup) {
      router.replace(ROUTES.tabs);
    } else {
      router.replace(ROUTES.profileSetup);
    }
  };

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (
      width > 0 &&
      height > 0 &&
      (Math.abs(width - layout.width) > 1 || Math.abs(height - layout.height) > 1)
    ) {
      setLayout({ width, height });
    }
  };

  const onBubbleLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight > 0 && Math.abs(nextHeight - bubbleHeight) > 1) {
      setBubbleHeight(nextHeight);
    }
  };

  const onNext = async () => {
    if (currentStep >= steps.length - 1) {
      await completeTour();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const onBack = () => {
    if (currentStep <= 0) return;
    setCurrentStep((prev) => prev - 1);
  };

  return (
    <ScreenBackground includeBottomInset={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: pageTopPadding,
          paddingBottom: pageBottomPadding,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: pageMaxWidth,
            alignSelf: "center",
            paddingHorizontal: shellHorizontalPadding,
          }}
        >
          <View
            style={{
              flexDirection: showStepRail ? "row" : "column",
              gap: 24,
              alignItems: "flex-start",
            }}
          >
            <View style={{ width: introWidth, alignSelf: "stretch" }}>
              <GlassCard borderRadius={28} noPadding>
                <View style={{ padding: introCardPadding }}>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: accentBorderColor,
                      backgroundColor: accentSurfaceColor,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: accentStrongColor,
                        fontSize: 12,
                        fontWeight: "700",
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                      }}
                    >
                      Onboarding
                    </Text>
                  </View>

                  <Text className={`mt-4 text-3xl font-semibold ${textClass}`}>{introTitle}</Text>
                  <Text className={`${secondaryTextClass} mt-3`} style={{ lineHeight: 22 }}>
                    {introDescription}
                  </Text>

                  <View style={{ gap: 10, marginTop: 20 }}>
                    <View
                      style={{
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: introMetaBorderColor,
                        backgroundColor: introMetaSurfaceColor,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                      }}
                    >
                      <Text className={`${secondaryTextClass} text-xs`} style={{ letterSpacing: 0.2 }}>
                        Guided stops
                      </Text>
                      <Text
                        style={{
                          marginTop: 6,
                          color: introMetaValueColor,
                          fontSize: 22,
                          fontWeight: "700",
                        }}
                      >
                        {steps.length}
                      </Text>
                    </View>

                    <View
                      style={{
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: introMetaBorderColor,
                        backgroundColor: introMetaSurfaceColor,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                      }}
                    >
                      <Text className={`${secondaryTextClass} text-xs`} style={{ letterSpacing: 0.2 }}>
                        Tour ends at
                      </Text>
                      <Text
                        style={{
                          marginTop: 6,
                          color: introMetaValueColor,
                          fontSize: 16,
                          fontWeight: "600",
                          lineHeight: 22,
                        }}
                      >
                        {primaryFinishDestinationLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 20 }}>
                    <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
                      <Text className={`${secondaryTextClass} text-sm`}>Progress</Text>
                      <Text className={`${secondaryTextClass} text-sm`}>{stepProgressLabel}</Text>
                    </View>
                    <View
                      style={{
                        marginTop: 10,
                        height: 8,
                        overflow: "hidden",
                        borderRadius: 999,
                        backgroundColor: accentSurfaceColor,
                      }}
                    >
                      <View
                        style={{
                          height: "100%",
                          width: progressWidth,
                          borderRadius: 999,
                          backgroundColor: accentColor,
                        }}
                      />
                    </View>
                  </View>

                  <GlassCard borderRadius={22} className="mt-5">
                    <Text
                      style={{
                        color: accentStrongColor,
                        fontSize: 12,
                        fontWeight: "700",
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                      }}
                    >
                      Current stop
                    </Text>
                    <Text className={`mt-2 text-base font-semibold ${textClass}`}>{step.title}</Text>
                    <Text className={`${secondaryTextClass} mt-2 text-sm`} style={{ lineHeight: 20 }}>
                      {step.description}
                    </Text>
                  </GlassCard>

                  {showStepRail ? (
                    <View style={{ gap: 10, marginTop: 18 }}>
                      {steps.map((tourStep, index) => {
                        const isActive = index === currentStep;

                        return (
                          <AnimatedCardPressable
                            key={tourStep.id}
                            onPress={() => setCurrentStep(index)}
                            className="rounded-2xl border px-4 py-3"
                            style={{
                              borderColor: isActive ? accentColor : accentBorderColor,
                              backgroundColor: isActive ? accentSurfaceColor : undefined,
                            }}
                          >
                            <View className="flex-row items-center">
                              <View
                                className="mr-3 h-7 w-7 items-center justify-center rounded-full"
                                style={{
                                  backgroundColor: isActive ? accentColor : stepBadgeInactiveColor,
                                }}
                              >
                                <Text
                                  className="text-xs font-semibold"
                                  style={{
                                    color: isActive ? accentOnColor : stepBadgeInactiveTextColor,
                                  }}
                                >
                                  {index + 1}
                                </Text>
                              </View>
                              <Text className={`flex-1 ${isActive ? textClass : secondaryTextClass}`}>
                                {tourStep.title}
                              </Text>
                            </View>
                          </AnimatedCardPressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
                      {steps.map((tourStep, index) => (
                        <View
                          key={tourStep.id}
                          style={{
                            flex: 1,
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: index <= currentStep ? accentColor : accentBorderColor,
                            opacity: index <= currentStep ? 1 : 0.75,
                          }}
                        />
                      ))}
                    </View>
                  )}

                  <Text className={`${secondaryTextClass} mt-4 text-sm`} style={{ lineHeight: 20 }}>
                    {introOutcomeText}
                  </Text>

                  <AppButton
                    onPress={completeTour}
                    label={skipTourLabel}
                    variant="secondary"
                    style={{ marginTop: 18 }}
                  />
                </View>
              </GlassCard>
            </View>

            <View style={{ flex: 1, minWidth: 0, alignSelf: "stretch" }}>
              <GlassCard borderRadius={28} noPadding>
                <View style={{ padding: previewCardPadding }}>
                  <View className="mb-4 flex-row items-start justify-between" style={{ gap: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text className={`${textClass} font-semibold`}>Interactive Preview</Text>
                      <Text className={`${secondaryTextClass} mt-1 text-sm`} style={{ lineHeight: 20 }}>
                        The highlighted area follows the current tour step.
                      </Text>
                    </View>

                    <View
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: accentBorderColor,
                        backgroundColor: accentSurfaceColor,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: accentStrongColor,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {currentStep + 1}/{steps.length}
                      </Text>
                    </View>
                  </View>

                  <View
                    onLayout={onCanvasLayout}
                    style={{
                      position: "relative",
                      height: previewHeight,
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: canvasMetrics.previewRadius,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: previewBorderColor,
                        backgroundColor: previewSurfaceColor,
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          left: canvasMetrics.previewPadding,
                          right: canvasMetrics.previewPadding,
                          top: canvasMetrics.previewPadding,
                          height: canvasMetrics.searchSectionHeight,
                          borderRadius: 22,
                          borderWidth: 1,
                          borderColor: previewBorderColor,
                          backgroundColor: previewPanelColor,
                          padding: canvasMetrics.searchInnerPadding,
                        }}
                      >
                        <View style={{ position: "relative", height: canvasMetrics.searchFieldHeight }}>
                          <View style={{ position: "absolute", left: 12, top: canvasMetrics.searchFieldHeight / 2 - 9 }}>
                            <Ionicons name="search" size={18} color={accentStrongColor} />
                          </View>
                          <View
                            style={{
                              height: canvasMetrics.searchFieldHeight,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: accentBorderColor,
                              backgroundColor: previewInputSurfaceColor,
                              justifyContent: "center",
                              paddingLeft: 38,
                              paddingRight: canvasMetrics.searchButtonWidth + 20,
                            }}
                          >
                            <Text
                              style={{
                                color: previewMutedTextColor,
                                fontSize: 14,
                              }}
                            >
                              Search colleges by major, city, or fit...
                            </Text>
                          </View>
                          <View
                            style={{
                              position: "absolute",
                              right: 8,
                              top: 6,
                              height: canvasMetrics.searchFieldHeight - 12,
                              minWidth: canvasMetrics.searchButtonWidth,
                              borderRadius: 12,
                              paddingHorizontal: 16,
                              justifyContent: "center",
                              alignItems: "center",
                              backgroundColor: accentColor,
                            }}
                          >
                            <Text
                              style={{
                                color: accentOnColor,
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              Search
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                          {["Business", "Nursing", "Computer Science"].map((chip) => (
                            <View
                              key={chip}
                              style={{
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: accentBorderColor,
                                backgroundColor: accentSurfaceColor,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: previewMutedTextColor,
                                  fontSize: 12,
                                  fontWeight: "600",
                                }}
                              >
                                {chip}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View
                        style={{
                          position: "absolute",
                          left: canvasMetrics.previewPadding,
                          right: canvasMetrics.previewPadding,
                          top: canvasMetrics.planningTop,
                          height: canvasMetrics.planningSectionHeight,
                          borderRadius: 22,
                          borderWidth: 1,
                          borderColor: previewBorderColor,
                          backgroundColor: previewPanelColor,
                          paddingHorizontal: isWideLayout ? 18 : 16,
                          paddingVertical: isWideLayout ? 18 : 16,
                          justifyContent: "center",
                        }}
                      >
                        <View className="flex-row items-center">
                          <View
                            style={{
                              marginRight: 12,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: accentBorderColor,
                              backgroundColor: accentSurfaceColor,
                              padding: 10,
                            }}
                          >
                            <Ionicons name="map" size={18} color={accentStrongColor} />
                          </View>
                          <View className="flex-1">
                            <Text className={`${textClass} font-semibold`}>View your plan</Text>
                            <Text
                              className={`${secondaryTextClass} text-sm`}
                              style={{
                                lineHeight: 20,
                                color: previewMutedTextColor,
                              }}
                            >
                              Track transfer goals, saved deadlines, and next steps.
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={accentStrongColor} />
                        </View>
                      </View>

                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: canvasMetrics.tabBarHeight,
                          borderTopWidth: 1,
                          borderTopColor: accentBorderColor,
                          backgroundColor: tabBarSurfaceColor,
                          paddingHorizontal: tabBarHorizontalPadding,
                          paddingTop: tabBarPaddingTop,
                          paddingBottom: tabBarPaddingBottom,
                        }}
                      >
                        <View className="flex-row justify-between" style={{ flex: 1 }}>
                          {previewTabs.map((item) => {
                            const isActive = item.id === activePreviewTab;

                            return (
                              <View
                                key={item.id}
                                className="items-center justify-center"
                                style={{
                                  width: "25%",
                                  paddingVertical: tabBarItemPaddingVertical,
                                  paddingHorizontal: tabBarItemPaddingHorizontal,
                                }}
                              >
                                <View
                                  style={{
                                    width: "100%",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: 16,
                                    paddingVertical: 8,
                                    backgroundColor: isActive ? accentSurfaceColor : "transparent",
                                    borderWidth: isActive ? 1 : 0,
                                    borderColor: isActive ? accentBorderColor : "transparent",
                                  }}
                                >
                                  <Ionicons
                                    name={item.icon}
                                    size={tabBarIconSize}
                                    color={isActive ? accentStrongColor : previewMutedTextColor}
                                  />
                                  <Text
                                    allowFontScaling
                                    numberOfLines={2}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.85}
                                    style={{
                                      marginTop: 4,
                                      color: isActive ? theme.textColor : previewMutedTextColor,
                                      fontSize: tabBarLabelFontSize,
                                      lineHeight: tabBarLabelLineHeight,
                                      textAlign: "center",
                                      maxWidth: tabBarLabelMaxWidth,
                                      fontWeight: isActive ? "600" : "500",
                                    }}
                                  >
                                    {item.label}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                  <View
                    style={{
                      pointerEvents: "none",
                      position: "absolute",
                      left: 0,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: canvasMetrics.previewRadius,
                      backgroundColor: spotlightOverlayColor,
                    }}
                  />

                  <View
                    style={{
                      pointerEvents: "none",
                      position: "absolute",
                      left: currentTarget.x - currentTarget.size / 2,
                      top: currentTarget.y - currentTarget.size / 2,
                      width: currentTarget.size,
                      height: currentTarget.size,
                      borderRadius: currentTarget.size / 2,
                      borderWidth: 2,
                      borderColor: accentColor,
                      backgroundColor: spotlightFillColor,
                    }}
                  />

                  <GlassCard
                    onLayout={onBubbleLayout}
                    style={{
                      position: "absolute",
                      left: bubbleLeft,
                      top: bubbleTop,
                      width: bubbleWidth,
                    }}
                    borderRadius={18}
                    noPadding
                  >
                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingTop: 14,
                        paddingBottom: 14,
                      }}
                    >
                      <Text className={`${textClass} font-semibold mb-1`}>{step.title}</Text>
                      <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 20 }}>
                        {step.description}
                      </Text>
                      <Text
                        style={{
                          marginTop: 8,
                          color: accentStrongColor,
                          fontSize: 12,
                          fontWeight: "700",
                          letterSpacing: 0.4,
                          textTransform: "uppercase",
                        }}
                      >
                        {stepProgressLabel}
                      </Text>

                      <View className="flex-row justify-between mt-4" style={{ gap: 12 }}>
                        <AppButton
                          onPress={onBack}
                          label={backLabel}
                          disabled={currentStep === 0}
                          variant="secondary"
                          style={{ flex: 1 }}
                        />
                        <AppButton onPress={onNext} label={nextLabel} style={{ flex: 1 }} />
                      </View>

                      <View
                        style={{
                          pointerEvents: "none",
                          position: "absolute",
                          width: 16,
                          height: 16,
                          backgroundColor: pointerBackgroundColor,
                          borderLeftWidth: 1,
                          borderTopWidth: 1,
                          borderColor: accentBorderColor,
                          transform: [{ rotate: "45deg" }],
                          left: pointerOffset,
                          top: preferTop ? bubbleHeight - 8 : -8,
                        }}
                      />
                    </View>
                  </GlassCard>
                </View>
                </View>
              </GlassCard>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
