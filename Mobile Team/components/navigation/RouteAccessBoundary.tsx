import { useEffect, useMemo, type ReactNode } from "react";
import { type Href, useRouter } from "expo-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppData, type User } from "@/hooks/use-app-data";

type RouteAccessBoundaryProps = {
  children: ReactNode;
  requireUser?: boolean;
  allowGuest?: boolean;
  loadingMessage?: string;
  unauthenticatedRedirect?: Href;
  guestRedirect?: Href;
  resolveRedirect?: (user: User | null) => Href | null;
};

export function hasCompletedProfileSetup(user: User | null | undefined) {
  return !!(user?.isProfileComplete || user?.major || user?.gpa);
}

export function RouteAccessBoundary({
  children,
  requireUser = true,
  allowGuest = true,
  loadingMessage = "Preparing your data",
  unauthenticatedRedirect = "/login",
  guestRedirect = "/(tabs)",
  resolveRedirect,
}: RouteAccessBoundaryProps) {
  const router = useRouter();
  const { isHydrated, state } = useAppData();
  const user = state.user;

  const redirectTarget = useMemo(() => {
    if (!isHydrated) return null;
    if (requireUser && !user) return unauthenticatedRedirect;
    if (requireUser && user && !allowGuest && user.isGuest) return guestRedirect;
    return resolveRedirect?.(user) ?? null;
  }, [allowGuest, guestRedirect, isHydrated, requireUser, resolveRedirect, unauthenticatedRedirect, user]);

  useEffect(() => {
    if (!redirectTarget) return;
    router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (!isHydrated || redirectTarget) {
    return <LoadingScreen message={loadingMessage} />;
  }

  return <>{children}</>;
}
