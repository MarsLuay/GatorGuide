import { ROUTES } from "@/constants/routes";
import { STORAGE_KEYS } from "@/constants/schema";
import type { AppDataState } from "@/hooks/use-app-data";
import { localStorageService } from "@/services/storage/local-storage.service";
import * as Haptics from "expo-haptics";
import type { Router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function useAccountDeletion({
  deleteAccount,
  isHydrated,
  router,
  signOut,
  state,
  t,
}: {
  deleteAccount: () => Promise<void>;
  isHydrated: boolean;
  router: Router;
  signOut: () => Promise<void>;
  state: AppDataState;
  t: Translate;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
    } catch {
      // Preserve existing logout behavior: navigation still returns to login.
    } finally {
      router.replace(ROUTES.login);
    }
  }, [router, signOut]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!isHydrated) return;
    try {
      if (state.user?.isGuest) {
        await signOut();
      } else {
        await deleteAccount();
      }
      await localStorageService.removeItem(STORAGE_KEYS.guestProfileShow).catch(() => {});
      router.replace(ROUTES.login);
    } catch {
      Alert.alert(t("general.error"), t("settings.deleteRetryMessage"));
    }
  }, [deleteAccount, isHydrated, router, signOut, state.user?.isGuest, t]);

  return {
    handleDeleteConfirm,
    handleLogout,
    setShowDeleteConfirm,
    showDeleteConfirm,
  };
}
