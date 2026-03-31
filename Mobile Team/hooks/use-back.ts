import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { ROUTES } from "@/constants/routes";

type ReplaceArg = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

export default function useBack(fallback: ReplaceArg = ROUTES.root) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const normalizedReturnTo = String(returnTo ?? "").trim();

  return useCallback(() => {
    if (normalizedReturnTo) {
      router.replace(normalizedReturnTo as ReplaceArg);
    } else if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace(fallback);
    }
  }, [navigation, router, fallback, normalizedReturnTo]);
}
