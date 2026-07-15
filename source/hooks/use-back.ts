import { useCallback, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useNavigation,
  useNavigationState,
  type NavigationProp,
  type ParamListBase,
} from "@react-navigation/native";
import { ROUTES } from "@/constants/routes";

type ReplaceArg = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

export type UseBackHandler = (() => void) & {
  canNavigateBack: boolean;
};

function hasRouterHistory(router: ReturnType<typeof useRouter>) {
  const routerWithHistory = router as typeof router & { canGoBack?: () => boolean };
  return typeof routerWithHistory.canGoBack === "function" && routerWithHistory.canGoBack();
}

function hasNavigationHistory(navigation: NavigationProp<ParamListBase>) {
  return Boolean(navigation.canGoBack && navigation.canGoBack());
}

export default function useBack(fallback: ReplaceArg = ROUTES.root): UseBackHandler {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  // Re-render when the stack changes so callers can show/hide the back control.
  useNavigationState((state) => state?.key ?? state?.index ?? 0);

  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const normalizedReturnTo = String(returnTo ?? "").trim().startsWith("/")
    ? String(returnTo ?? "").trim()
    : "";

  const canNavigateBack =
    Boolean(normalizedReturnTo) || hasRouterHistory(router) || hasNavigationHistory(navigation);

  const goBack = useCallback(() => {
    if (normalizedReturnTo) {
      router.replace(normalizedReturnTo as ReplaceArg);
      return;
    }

    if (hasRouterHistory(router)) {
      router.back();
      return;
    }

    if (hasNavigationHistory(navigation)) {
      navigation.goBack();
      return;
    }

    router.replace(fallback);
  }, [navigation, router, fallback, normalizedReturnTo]);

  return useMemo(() => {
    const handler = goBack as UseBackHandler;
    handler.canNavigateBack = canNavigateBack;
    return handler;
  }, [goBack, canNavigateBack]);
}
