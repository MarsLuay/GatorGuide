import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ROUTES } from "@/constants/routes";
import { useAppData } from "@/hooks/use-app-data";
import { authService } from "@/services/auth/auth.service";

/**
 * Completes provider redirects on app load.
 */
export function AuthRedirectHandler() {
  const { state, signInWithAuthUser } = useAppData();
  const router = useRouter();

  useEffect(() => {
    if (state.user) return;

    let mounted = true;
    authService.getRedirectResult().then((authUser) => {
      if (!mounted || !authUser) return;
      void signInWithAuthUser(authUser);
      setTimeout(() => router.replace(ROUTES.root), 50);
    });

    return () => {
      mounted = false;
    };
  }, [state.user, signInWithAuthUser, router]);

  return null;
}
