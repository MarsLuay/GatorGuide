import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";

type TourStep = {
  id: string;
  title: string;
  description: string;
  targetX: number;
  targetY: number;
};

type LayoutBox = {
  width: number;
  height: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const { state, setOnboardingSeen } = useAppData();
  const [currentStep, setCurrentStep] = useState(0);
  const [layout, setLayout] = useState<LayoutBox>({ width: 320, height: 640 });

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardClass = isDark ? "bg-emerald-950/95 border-emerald-800" : "bg-white border-emerald-200";

  const steps = useMemo<TourStep[]>(
    () => [
      {
        id: "search",
        title: "Search Bar",
        description: "Type what you want, then run search to get matching college recommendations.",
        targetX: 0.5,
        targetY: 0.18,
      },
      {
        id: "roadmap",
        title: "Roadmap",
        description: "Use Roadmap to track transfer tasks, deadlines, and your progress in one place.",
        targetX: 0.5,
        targetY: 0.46,
      },
      {
        id: "keyboard",
        title: "Keyboard Search",
        description: "Press your keyboard search/enter key after typing to quickly submit your query.",
        targetX: 0.86,
        targetY: 0.18,
      },
      {
        id: "home-tab",
        title: "Home Tab",
        description: "Home is where you search and get recommendations.",
        targetX: 0.13,
        targetY: 0.92,
      },
      {
        id: "resources-tab",
        title: "Resources Tab",
        description: "Resources has transfer links, tools, and saved planning references.",
        targetX: 0.38,
        targetY: 0.92,
      },
      {
        id: "profile-tab",
        title: "Profile Tab",
        description: "Profile stores your major, GPA, and details used to personalize recommendations.",
        targetX: 0.63,
        targetY: 0.92,
      },
      {
        id: "settings-tab",
        title: "Settings Tab",
        description: "Settings controls app preferences, language, account actions, and legal pages.",
        targetX: 0.87,
        targetY: 0.92,
      },
    ],
    []
  );

  const step = steps[currentStep];

  useEffect(() => {
    if (!state.user) {
      router.replace("/login");
      return;
    }
    const hasCompletedSetup = !!(
      state.user.isProfileComplete ||
      state.user.major ||
      state.user.gpa
    );

    if (state.user.isGuest || state.user.hasSeenOnboarding === true) {
      router.replace(hasCompletedSetup ? "/(tabs)" : "/profile-setup");
    }
  }, [state.user, router]);

  const completeTour = async () => {
    await setOnboardingSeen(true);

    const hasCompletedSetup = !!(
      state.user?.isProfileComplete ||
      state.user?.major ||
      state.user?.gpa
    );

    if (hasCompletedSetup) {
      router.replace("/(tabs)");
    } else {
      router.replace("/profile-setup");
    }
  };

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ width, height });
    }
  };

  const bubbleWidth = Math.min(320, Math.max(260, layout.width - 24));
  const bubbleHeight = 158;
  const targetPxX = layout.width * step.targetX;
  const targetPxY = layout.height * step.targetY;
  const preferTop = targetPxY > layout.height * 0.45;
  const bubbleTop = preferTop
    ? Math.max(12, targetPxY - bubbleHeight - 36)
    : Math.min(layout.height - bubbleHeight - 12, targetPxY + 26);
  const bubbleLeft = Math.max(12, Math.min(targetPxX - bubbleWidth / 2, layout.width - bubbleWidth - 12));
  const pointerOffset = Math.max(18, Math.min(targetPxX - bubbleLeft - 8, bubbleWidth - 26));

  const nextLabel = currentStep === steps.length - 1 ? "Finish" : "Next";

  const onNext = async () => {
    if (currentStep >= steps.length - 1) {
      await completeTour();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="max-w-md w-full self-center px-4 pt-10">
          <View onLayout={onCanvasLayout} className={`${cardClass} border rounded-3xl p-4 overflow-hidden`}>
            <Text className={`text-xl ${textClass} mb-1`}>Quick Tour</Text>
            <Text className={`${secondaryTextClass} text-sm mb-4`}>
              Follow the pointers to learn the app in less than a minute.
            </Text>

            <View className="rounded-2xl border border-emerald-600/40 px-3 py-3 mb-3">
              <View className="relative">
                <View className="absolute left-3 top-3">
                  <Ionicons name="search" size={18} color="#008f4e" />
                </View>
                <View className="rounded-xl border border-emerald-500/60 py-3 pl-9 pr-16">
                  <Text className={`${secondaryTextClass} text-sm`}>Search colleges by major, city, or fit...</Text>
                </View>
                <View className="absolute right-2 top-2 rounded-lg bg-emerald-500 px-3 py-2">
                  <Text className={`${isDark ? "text-white" : "text-black"} text-xs font-semibold`}>Search</Text>
                </View>
              </View>
              <View className="flex-row mt-3 gap-2">
                <View className="rounded-full bg-emerald-500/20 px-3 py-1">
                  <Text className={`${secondaryTextClass} text-xs`}>Business</Text>
                </View>
                <View className="rounded-full bg-emerald-500/20 px-3 py-1">
                  <Text className={`${secondaryTextClass} text-xs`}>Nursing</Text>
                </View>
                <View className="rounded-full bg-emerald-500/20 px-3 py-1">
                  <Text className={`${secondaryTextClass} text-xs`}>Computer Science</Text>
                </View>
              </View>
            </View>

            <View className="rounded-2xl border border-emerald-600/40 p-4 mb-20">
              <View className="flex-row items-center">
                <View className="mr-3 p-2 rounded-xl bg-emerald-500/20">
                  <Ionicons name="map" size={18} color="#008f4e" />
                </View>
                <View className="flex-1">
                  <Text className={`${textClass} font-semibold`}>View your roadmap</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>Track transfer goals and next steps.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#008f4e" />
              </View>
            </View>

            <View className="absolute left-0 right-0 bottom-0 border-t border-emerald-700/40 bg-black/20 px-2 py-3">
              <View className="flex-row justify-between">
                <View className="items-center w-1/4">
                  <Ionicons name="home" size={18} color="#008f4e" />
                  <Text className={`${secondaryTextClass} text-xs mt-1`}>Home</Text>
                </View>
                <View className="items-center w-1/4">
                  <Ionicons name="library" size={18} color="#008f4e" />
                  <Text className={`${secondaryTextClass} text-xs mt-1`}>Resources</Text>
                </View>
                <View className="items-center w-1/4">
                  <Ionicons name="person" size={18} color="#008f4e" />
                  <Text className={`${secondaryTextClass} text-xs mt-1`}>Profile</Text>
                </View>
                <View className="items-center w-1/4">
                  <Ionicons name="settings" size={18} color="#008f4e" />
                  <Text className={`${secondaryTextClass} text-xs mt-1`}>Settings</Text>
                </View>
              </View>
            </View>

            <View className="absolute inset-0 bg-black/35" pointerEvents="none" />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: targetPxX - 24,
                top: targetPxY - 24,
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 2,
                borderColor: "#34d399",
                backgroundColor: "rgba(16,185,129,0.2)",
              }}
            />

            <View
              style={{
                position: "absolute",
                left: bubbleLeft,
                top: bubbleTop,
                width: bubbleWidth,
                minHeight: bubbleHeight,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#34d399",
                backgroundColor: isDark ? "#042f2e" : "#ecfdf5",
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Text className={`${textClass} font-semibold mb-1`}>{step.title}</Text>
              <Text className={`${secondaryTextClass} text-sm`}>{step.description}</Text>
              <Text className={`${secondaryTextClass} text-xs mt-2`}>
                {currentStep + 1} of {steps.length}
              </Text>

              <View className="flex-row justify-between mt-4">
                <Pressable onPress={completeTour} className="px-3 py-2 rounded-lg bg-black/25">
                  <Text className="text-white font-semibold">Exit tutorial</Text>
                </Pressable>
                <Pressable onPress={onNext} className="px-3 py-2 rounded-lg bg-emerald-500">
                  <Text className={`${isDark ? "text-white" : "text-black"} font-semibold`}>{nextLabel}</Text>
                </Pressable>
              </View>

              <View
                style={{
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
      </ScrollView>
    </ScreenBackground>
  );
}
