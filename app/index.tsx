import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppData } from "@/hooks/use-app-data";

export default function Index() {
  const { isHydrated, state } = useAppData();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!isHydrated || hasNavigated.current) return;
<<<<<<< HEAD
    
    hasNavigated.current = true;
    
    if (state.user) {
      // Check if user has completed profile setup (non-empty major or gpa)
      const hasCompletedSetup = (state.user.major && state.user.major.trim() !== "") || 
                                (state.user.gpa && state.user.gpa.trim() !== "");
      
      if (hasCompletedSetup) {
        router.replace("/(tabs)");
=======

    const performNavigation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (state.user) {
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
>>>>>>> 596bfb5 (WIP: updates)
      } else {
        router.replace("/login");
      }
    };

    performNavigation();
  }, [isHydrated, state.user]);

  return <LoadingScreen message="Preparing your data" />;
}