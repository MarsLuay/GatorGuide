import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";

export function useBack(fallback = "/") {
  const router = useRouter();
  const navigation = useNavigation();

  return useCallback(() => {
    try {
      // Prefer React Navigation's stack check (works on native)
      const nav: any = navigation;
      if (nav && typeof nav.canGoBack === "function" && nav.canGoBack()) {
        nav.goBack();
        return;
      }
    } catch {
      // ignore and fall through to router.replace
    }

    // Deterministic fallback: always replace to the provided fallback route
    router.replace(fallback);
  }, [router, navigation, fallback]);
}

export default useBack;
