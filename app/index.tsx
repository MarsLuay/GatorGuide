import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppData } from "@/hooks/use-app-data";

export default function Index() {
  const router = useRouter();
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

        // User already completed profile setup → go to main (no need to fill again)
        const hasCompletedSetup = !!(
          state.user.isProfileComplete ||
          state.user.major ||
          state.user.gpa
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
  }, [isHydrated, state.user, router]);

  return <LoadingScreen message="Preparing your data" />;
}