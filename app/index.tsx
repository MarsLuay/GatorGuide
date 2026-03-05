import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppData } from "@/hooks/use-app-data";

const ONBOARDING_DEBUG_LOG_KEY = "gatorguide:onboarding-debug-log:v1";

export default function Index() {
  const router = useRouter();
  const { isHydrated, state } = useAppData();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!isHydrated || hasNavigated.current) return;

    const performNavigation = async () => {
      const appendDebug = async (message: string) => {
        if (!__DEV__) return;
        const line = `${new Date().toISOString()} | [Index] ${message}`;
        try {
          const raw = await AsyncStorage.getItem(ONBOARDING_DEBUG_LOG_KEY);
          const arr = raw ? (JSON.parse(raw) as string[]) : [];
          const next = [...arr, line].slice(-500);
          await AsyncStorage.setItem(ONBOARDING_DEBUG_LOG_KEY, JSON.stringify(next));
        } catch {
          // ignore debug persistence errors
        }
      };

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (state.user) {
        await appendDebug(
          `user=${state.user.uid} guest=${String(!!state.user.isGuest)} hasSeenOnboarding=${String(state.user.hasSeenOnboarding)} major=${String(!!state.user.major)} gpa=${String(!!state.user.gpa)}`
        );
        if (state.user.isGuest) {
          await appendDebug("route -> /(tabs) (guest)");
          router.replace("/(tabs)");
          return;
        }

        if (state.user.hasSeenOnboarding === false) {
          await appendDebug("route -> /onboarding (hasSeenOnboarding=false)");
          router.replace("/onboarding");
          return;
        }

        const hasCompletedSetup = !!(
          state.user.isProfileComplete ||
          state.user.major ||
          state.user.gpa
        );

        if (hasCompletedSetup) {
          await appendDebug("route -> /(tabs) (profile complete)");
          router.replace("/(tabs)");
        } else {
          await appendDebug("route -> /profile-setup (profile incomplete)");
          router.replace("/profile-setup");
        }
      } else {
        await appendDebug("route -> /login (no user)");
        router.replace("/login");
      }
    };

    performNavigation();
  }, [isHydrated, state.user, router]);

  return <LoadingScreen message="Preparing your data" />;
}
