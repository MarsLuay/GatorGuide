import { useEffect, useMemo, type ReactNode } from "react";
import { type Href, useRouter } from "expo-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ROUTES } from "@/constants/routes";
import { useAppData, type User } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import {
  resolveRouteAccessRedirect,
  shouldRenderRouteAccessLoading,
} from "./route-access-state";

export { hasCompletedProfileSetup } from "./route-access-state";

type RouteAccessBoundaryProps = {
  children: ReactNode;
  requireUser?: boolean;
  allowGuest?: boolean;
  loadingMessage?: string;
  unauthenticatedRedirect?: Href;
  guestRedirect?: Href;
  resolveRedirect?: (user: User | null) => Href | null;
};

export function RouteAccessBoundary({
  children,
  requireUser = true,
  allowGuest = true,
  loadingMessage,
  unauthenticatedRedirect = ROUTES.login,
  guestRedirect = ROUTES.tabs,
  resolveRedirect,
}: RouteAccessBoundaryProps) {
  const router = useRouter();
  const { t } = useAppLanguage();
  const { isHydrated, state } = useAppData();
  const user = state.user;
  const resolvedLoadingMessage = loadingMessage ?? t("startup.preparingData");

  const redirectTarget = useMemo(
    () =>
      resolveRouteAccessRedirect({
        allowGuest,
        guestRedirect,
        isHydrated,
        requireUser,
        resolveRedirect,
        unauthenticatedRedirect,
        user,
      }),
    [allowGuest, guestRedirect, isHydrated, requireUser, resolveRedirect, unauthenticatedRedirect, user]
  );

  useEffect(() => {
    if (!redirectTarget) return;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (shouldRenderRouteAccessLoading({ isHydrated, redirectTarget })) {
    return <LoadingScreen message={resolvedLoadingMessage} />;
  }

  return <>{children}</>;
}
