import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppData } from "@/hooks/use-app-data";

export default function Index() {
  const { isHydrated, state } = useAppData();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!isHydrated || hasNavigated.current) return;

    const performNavigation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (state.user) {
        // Skip profile setup for guests
        if (state.user.isGuest) {
          router.replace("/(tabs)");
          return;
        }

        // Check if user has completed profile setup
        const hasCompletedSetup = !!(
          state.user.major || 
          state.user.gpa || 
          state.user.isProfileComplete
        );

        if (hasCompletedSetup) {
          router.replace("/(tabs)");
        } else {
          router.replace("/profile-setup");
        }
      } else {
        router.replace("/login");
      }
    };

    performNavigation();
  }, [isHydrated, state.user]);

  return <LoadingScreen message="Preparing your data" />;
}