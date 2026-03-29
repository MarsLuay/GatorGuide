import { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  type DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

type TourTargetId =
  | "searchField"
  | "roadmapCard"
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
  const { isDark } = useAppTheme();
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

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/85" : "text-emerald-700";
  const cardClass = isDark ? "bg-emerald-950/95 border-emerald-800" : "bg-white border-emerald-200";
  const subCardClass = isDark ? "bg-emerald-950/80 border-emerald-700/70" : "bg-emerald-50/90 border-emerald-200";

  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "search",
        title: "Search Bar",
        description: "Type what you want, then run search to get matching college recommendations.",
        target: "searchField",
        spotlightSize: 56,
      },
      {
        id: "roadmap",
        title: "Roadmap",
        description: "Use Roadmap to track transfer tasks, deadlines, and your progress in one place.",
        target: "roadmapCard",
        spotlightSize: 62,
      },
      {
        id: "keyboard",
        title: "Keyboard Search",
        description: "Press your keyboard search or enter key after typing to quickly submit your query.",
        target: "searchButton",
        spotlightSize: 46,
      },
      {
        id: "home-tab",
        title: "Home Tab",
        description: "Home is where you search and get recommendations.",
        target: "homeTab",
        spotlightSize: 44,
      },
      {
        id: "resources-tab",
        title: "Resources Tab",
        description: "Resources has transfer links, tools, and saved planning references.",
        target: "resourcesTab",
        spotlightSize: 44,
      },
      {
        id: "profile-tab",
        title: "Profile Tab",
        description: "Profile stores your major, GPA, and details used to personalize recommendations.",
        target: "profileTab",
        spotlightSize: 44,
      },
      {
        id: "settings-tab",
        title: "Settings Tab",
        description: "Settings controls app preferences, language, account actions, and legal pages.",
        target: "settingsTab",
        spotlightSize: 44,
      },
    ],
    []
  );
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
  const canvasWidth = layout.width || Math.max(320, Math.min(screenWidth - shellHorizontalPadding * 2, isWideLayout ? 900 : isTablet ? 760 : 520));
  const canvasHeight = layout.height || previewHeight;

  const canvasMetrics = useMemo(() => {
    const previewPadding = isWideLayout ? 26 : isTablet ? 22 : 16;
    const searchSectionHeight = isWideLayout ? 156 : isTablet ? 146 : 132;
    const roadmapSectionHeight = isWideLayout ? 132 : isTablet ? 122 : 110;
    const sectionGap = isWideLayout ? 22 : 18;
    const searchInnerPadding = isWideLayout ? 18 : isTablet ? 16 : 14;
    const searchFieldHeight = isWideLayout ? 54 : isTablet ? 50 : 46;
    const searchButtonWidth = isWideLayout ? 96 : isTablet ? 90 : 82;
    const previewRadius = isWideLayout ? 32 : 28;
    const innerWidth = Math.max(0, canvasWidth - previewPadding * 2);
    const searchFieldLeft = previewPadding + searchInnerPadding;
    const searchFieldWidth = Math.max(220, innerWidth - searchInnerPadding * 2);
    const searchFieldTop = previewPadding + searchInnerPadding;
    const roadmapTop = previewPadding + searchSectionHeight + sectionGap;
    const tabBarHeight = tabBarMinHeight;
    const tabBarTop = canvasHeight - tabBarHeight;
    const tabCenterY = tabBarTop + tabBarHeight / 2;

    const targets: Record<TourTargetId, TargetPoint> = {
      searchField: {
        x: searchFieldLeft + searchFieldWidth / 2,
        y: searchFieldTop + searchFieldHeight / 2,
        size: step.spotlightSize,
      },
      roadmapCard: {
        x: canvasWidth / 2,
        y: roadmapTop + roadmapSectionHeight / 2,
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
      roadmapSectionHeight,
      sectionGap,
      searchInnerPadding,
      searchFieldHeight,
      searchButtonWidth,
      roadmapTop,
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
  const nextLabel = currentStep === steps.length - 1 ? "Finish" : "Next";

  const completeTour = async () => {
    await setOnboardingSeen(true);

    const hasCompletedSetup = !!(
      state.user?.isProfileComplete ||
      state.user?.major ||
      state.user?.gpa
    );

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
              <View className={`${cardClass} border rounded-3xl`} style={{ padding: introCardPadding }}>
                <Text className={`text-2xl font-semibold ${textClass}`}>Quick Tour</Text>
                <Text className={`${secondaryTextClass} mt-2`} style={{ lineHeight: 22 }}>
                  Follow the pointers to learn the app in less than a minute.
                </Text>

                <View className="mt-6">
                  <View className="h-2 rounded-full bg-emerald-200/70 overflow-hidden">
                    <View className="h-full bg-emerald-500" style={{ width: progressWidth }} />
                  </View>
                </View>

                <View className={`${subCardClass} border rounded-2xl mt-5 px-4 py-4`}>
                  <Text className={`text-sm font-semibold ${textClass}`}>{step.title}</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`} style={{ lineHeight: 20 }}>
                    {step.description}
                  </Text>
                  <Text className={`${secondaryTextClass} text-xs mt-3`}>
                    Step {currentStep + 1} of {steps.length}
                  </Text>
                </View>

                {showStepRail ? (
                  <View style={{ gap: 10, marginTop: 18 }}>
                    {steps.map((tourStep, index) => {
                      const isActive = index === currentStep;

                      return (
                        <Pressable
                          key={tourStep.id}
                          onPress={() => setCurrentStep(index)}
                          className="rounded-2xl border px-4 py-3"
                          style={{
                            borderColor: isActive ? "#10B981" : isDark ? "rgba(52, 211, 153, 0.22)" : "rgba(16, 185, 129, 0.18)",
                            backgroundColor: isActive
                              ? isDark
                                ? "rgba(16, 185, 129, 0.14)"
                                : "rgba(16, 185, 129, 0.09)"
                              : undefined,
                          }}
                        >
                          <View className="flex-row items-center">
                            <View
                              className="mr-3 h-7 w-7 items-center justify-center rounded-full"
                              style={{ backgroundColor: isActive ? "#10B981" : isDark ? "#0f2f2a" : "#d1fae5" }}
                            >
                              <Text
                                className="text-xs font-semibold"
                                style={{ color: isActive ? "#042f1a" : isDark ? "#e5e7eb" : "#065f46" }}
                              >
                                {index + 1}
                              </Text>
                            </View>
                            <Text className={`flex-1 ${isActive ? textClass : secondaryTextClass}`}>{tourStep.title}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0, alignSelf: "stretch" }}>
              <View className={`${cardClass} border rounded-3xl`} style={{ padding: previewCardPadding }}>
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className={`${textClass} font-semibold`}>Tutorial Preview</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>
                    {currentStep + 1} / {steps.length}
                  </Text>
                </View>

                <View
                  onLayout={onCanvasLayout}
                  style={{
                    position: "relative",
                    height: previewHeight,
                  }}
                >
                  <View
                    className={`${isDark ? "bg-emerald-950/90 border-emerald-800" : "bg-emerald-50 border-emerald-200"} border`}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: canvasMetrics.previewRadius,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      className="border"
                      style={{
                        position: "absolute",
                        left: canvasMetrics.previewPadding,
                        right: canvasMetrics.previewPadding,
                        top: canvasMetrics.previewPadding,
                        height: canvasMetrics.searchSectionHeight,
                        borderRadius: 22,
                        borderColor: "rgba(52, 211, 153, 0.38)",
                        padding: canvasMetrics.searchInnerPadding,
                      }}
                    >
                      <View style={{ position: "relative", height: canvasMetrics.searchFieldHeight }}>
                        <View style={{ position: "absolute", left: 12, top: canvasMetrics.searchFieldHeight / 2 - 9 }}>
                          <Ionicons name="search" size={18} color="#008f4e" />
                        </View>
                        <View
                          className="border"
                          style={{
                            height: canvasMetrics.searchFieldHeight,
                            borderRadius: 16,
                            borderColor: "rgba(16, 185, 129, 0.6)",
                            justifyContent: "center",
                            paddingLeft: 38,
                            paddingRight: canvasMetrics.searchButtonWidth + 20,
                          }}
                        >
                          <Text className={`${secondaryTextClass} text-sm`}>
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
                            backgroundColor: "#10B981",
                          }}
                        >
                          <Text className={`${isDark ? "text-white" : "text-emerald-900"} text-xs font-semibold`}>
                            Search
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        {["Business", "Nursing", "Computer Science"].map((chip) => (
                          <View key={chip} className="rounded-full bg-emerald-500/20 px-3 py-1.5">
                            <Text className={`${secondaryTextClass} text-xs`}>{chip}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View
                      className="border"
                      style={{
                        position: "absolute",
                        left: canvasMetrics.previewPadding,
                        right: canvasMetrics.previewPadding,
                        top: canvasMetrics.roadmapTop,
                        height: canvasMetrics.roadmapSectionHeight,
                        borderRadius: 22,
                        borderColor: "rgba(52, 211, 153, 0.38)",
                        paddingHorizontal: isWideLayout ? 18 : 16,
                        paddingVertical: isWideLayout ? 18 : 16,
                        justifyContent: "center",
                      }}
                    >
                      <View className="flex-row items-center">
                        <View className="mr-3 rounded-xl bg-emerald-500/20 p-2.5">
                          <Ionicons name="map" size={18} color="#008f4e" />
                        </View>
                        <View className="flex-1">
                          <Text className={`${textClass} font-semibold`}>View your roadmap</Text>
                          <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 20 }}>
                            Track transfer goals and next steps.
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#008f4e" />
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
                        borderTopColor: "rgba(52, 211, 153, 0.3)",
                        backgroundColor: isDark ? "rgba(2, 6, 23, 0.62)" : "rgba(255,255,255,0.76)",
                        paddingHorizontal: tabBarHorizontalPadding,
                        paddingTop: tabBarPaddingTop,
                        paddingBottom: tabBarPaddingBottom,
                      }}
                    >
                      <View className="flex-row justify-between" style={{ flex: 1 }}>
                        {previewTabs.map((item) => (
                          <View
                            key={item.id}
                            className="items-center justify-center"
                            style={{
                              width: "25%",
                              paddingVertical: tabBarItemPaddingVertical,
                              paddingHorizontal: tabBarItemPaddingHorizontal,
                            }}
                          >
                            <Ionicons name={item.icon} size={tabBarIconSize} color="#008f4e" />
                            <Text
                              allowFontScaling
                              numberOfLines={2}
                              adjustsFontSizeToFit
                              minimumFontScale={0.85}
                              className={secondaryTextClass}
                              style={{
                                marginTop: 4,
                                fontSize: tabBarLabelFontSize,
                                lineHeight: tabBarLabelLineHeight,
                                textAlign: "center",
                                maxWidth: tabBarLabelMaxWidth,
                              }}
                            >
                              {item.label}
                            </Text>
                          </View>
                        ))}
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
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
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
                      borderColor: "#34d399",
                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                    }}
                  />

                  <View
                    onLayout={onBubbleLayout}
                    style={{
                      position: "absolute",
                      left: bubbleLeft,
                      top: bubbleTop,
                      width: bubbleWidth,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "#34d399",
                      backgroundColor: isDark ? "#042f2e" : "#ecfdf5",
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 14,
                    }}
                  >
                    <Text className={`${textClass} font-semibold mb-1`}>{step.title}</Text>
                    <Text className={`${secondaryTextClass} text-sm`} style={{ lineHeight: 20 }}>
                      {step.description}
                    </Text>
                    <Text className={`${secondaryTextClass} text-xs mt-2`}>
                      {currentStep + 1} of {steps.length}
                    </Text>

                    <View className="flex-row justify-between mt-4" style={{ gap: 12 }}>
                      <Pressable onPress={completeTour} className="px-3 py-2 rounded-lg bg-black/25">
                        <Text className="text-white font-semibold">Exit tutorial</Text>
                      </Pressable>
                      <Pressable onPress={onNext} className="px-3 py-2 rounded-lg bg-emerald-500">
                        <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                          {nextLabel}
                        </Text>
                      </Pressable>
                    </View>

                    <View
                      style={{
                        pointerEvents: "none",
                        position: "absolute",
                        width: 16,
                        height: 16,
                        backgroundColor: isDark ? "#042f2e" : "#ecfdf5",
                        borderLeftWidth: 1,
                        borderTopWidth: 1,
                        borderColor: "#34d399",
                        transform: [{ rotate: "45deg" }],
                        left: pointerOffset,
                        top: preferTop ? bubbleHeight - 8 : -8,
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
