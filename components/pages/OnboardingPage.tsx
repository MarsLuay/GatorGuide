import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppData } from "@/hooks/use-app-data";

export default function OnboardingPage() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const { state, setOnboardingSeen } = useAppData();

  const textClass = isDark ? "text-white" : "text-emerald-900";
  const secondaryTextClass = isDark ? "text-white/90" : "text-emerald-700";
  const cardClass = isDark ? "bg-emerald-900/90 border-emerald-800" : "bg-white border-emerald-200";
  const borderClass = isDark ? "border-emerald-700" : "border-emerald-300";

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

  const handleContinue = async () => {
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

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="max-w-md w-full self-center px-6 pt-20">
          <View className={`${cardClass} border rounded-2xl p-6`}>
            <Text className={`text-2xl ${textClass} mb-2`}>Welcome to GatorGuide</Text>
            <Text className={`${secondaryTextClass} mb-6`}>
              This quick tour appears once when your account is created.
            </Text>

            <View className="gap-4">
              <View className={`rounded-xl border ${borderClass} p-4`}>
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="search" size={18} color="#008f4e" />
                  <Text className={`${textClass} ml-2 font-medium`}>Find best-fit colleges</Text>
                </View>
                <Text className={`${secondaryTextClass} text-sm`}>
                  Search with profile + preferences to get ranked recommendations.
                </Text>
              </View>

              <View className={`rounded-xl border ${borderClass} p-4`}>
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="map" size={18} color="#008f4e" />
                  <Text className={`${textClass} ml-2 font-medium`}>Track your roadmap</Text>
                </View>
                <Text className={`${secondaryTextClass} text-sm`}>
                  Keep application tasks, documents, and progress in one place.
                </Text>
              </View>

              <View className={`rounded-xl border ${borderClass} p-4`}>
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="build" size={18} color="#008f4e" />
                  <Text className={`${textClass} ml-2 font-medium`}>Use planning tools</Text>
                </View>
                <Text className={`${secondaryTextClass} text-sm`}>
                  Compare schools, estimate costs, and save resources for transfer planning.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleContinue}
              className="mt-6 bg-emerald-500 rounded-lg py-4 items-center"
            >
              <Text className={`${isDark ? "text-white" : "text-black"} font-semibold`}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
