import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";

type ReplaceArg = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

export default function useBack(fallback: ReplaceArg = "/") {
  const router = useRouter();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  return useCallback(() => {
    if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace(fallback);
    }
  }, [navigation, router, fallback]);
}
