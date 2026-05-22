import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { notificationsService } from "@/services/notifications/notifications.service";
import {
  normalizeNotificationPreferences,
  type AppDataState,
  type NotificationPreferences,
} from "./app-data-state";

type UseAppDataNotificationSyncArgs = {
  isHydrated: boolean;
  notificationsEnabled: boolean;
  transferDeadlinesEnabled: boolean;
  deadline: unknown;
  setState: Dispatch<SetStateAction<AppDataState>>;
};

export function useAppDataNotificationSync({
  isHydrated,
  notificationsEnabled,
  transferDeadlinesEnabled,
  deadline,
  setState,
}: UseAppDataNotificationSyncArgs) {
  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;
    (async () => {
      if (!notificationsEnabled) {
        await notificationsService.clearManagedNotifications().catch(() => {});
        return;
      }

      notificationsService.configureNotificationHandler();
      const permissionStatus = await notificationsService.getPermissionStatus();

      if (cancelled) return;

      if (permissionStatus !== "granted") {
        await notificationsService.clearManagedNotifications().catch(() => {});
        if (cancelled) return;

        setState((prev) => (
          prev.notificationsEnabled
            ? { ...prev, notificationsEnabled: false }
            : prev
        ));
        return;
      }

      await notificationsService.syncDeadlineNotifications({
        enabled: !!transferDeadlinesEnabled,
        deadline,
      }).catch((error) => {
        void errorLoggingService.captureException(error, {
          category: "notifications",
          operation: "sync-deadline-notifications",
          severity: "warn",
          handled: true,
          source: "use-app-data",
          metadata: {
            hasDeadline: !!String(deadline ?? "").trim(),
          },
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    notificationsEnabled,
    transferDeadlinesEnabled,
    deadline,
    setState,
  ]);
}

type UseAppDataNotificationActionsArgs = {
  setState: Dispatch<SetStateAction<AppDataState>>;
};

export function useAppDataNotificationActions({ setState }: UseAppDataNotificationActionsArgs) {
  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      notificationsService.configureNotificationHandler();
    } else {
      await notificationsService.clearManagedNotifications().catch(() => {});
    }

    setState((prev) => ({ ...prev, notificationsEnabled: enabled }));
  }, [setState]);

  const setNotificationPreferences = useCallback(async (patch: Partial<NotificationPreferences>) => {
    setState((prev) => ({
      ...prev,
      notificationPreferences: normalizeNotificationPreferences({
        ...prev.notificationPreferences,
        ...patch,
      }),
    }));
  }, [setState]);

  return {
    setNotificationsEnabled,
    setNotificationPreferences,
  };
}
