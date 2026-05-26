import type { Href } from "expo-router";

import { ROUTES } from "@/constants/routes";
import type { User } from "@/hooks/use-app-data";

export function hasCompletedProfileSetup(user: User | null | undefined) {
  return !!(user?.isProfileComplete || user?.major || user?.gpa);
}

export type RouteAccessRedirectOptions = {
  isHydrated: boolean;
  user: User | null;
  requireUser?: boolean;
  allowGuest?: boolean;
  unauthenticatedRedirect?: Href;
  guestRedirect?: Href;
  resolveRedirect?: (user: User | null) => Href | null;
};

export function resolveRouteAccessRedirect({
  isHydrated,
  user,
  requireUser = true,
  allowGuest = true,
  unauthenticatedRedirect = ROUTES.login,
  guestRedirect = ROUTES.tabs,
  resolveRedirect,
}: RouteAccessRedirectOptions): Href | null {
  if (!isHydrated) return null;
  if (requireUser && !user) return unauthenticatedRedirect;
  if (requireUser && user && !allowGuest && user.isGuest) return guestRedirect;
  return resolveRedirect?.(user) ?? null;
}

export function shouldRenderRouteAccessLoading(options: {
  isHydrated: boolean;
  redirectTarget: Href | null;
}) {
  return !options.isHydrated || !!options.redirectTarget;
}
