import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, type Dispatch, type SetStateAction } from "react";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  STORAGE_KEY,
  type AppDataState,
} from "./app-data-state";
import {
  parsePersistedAppDataState,
  serializeAppDataState,
} from "./app-data-persistence";

type UseAppDataStorageArgs = {
  isHydrated: boolean;
  setIsHydrated: Dispatch<SetStateAction<boolean>>;
  state: AppDataState;
  setState: Dispatch<SetStateAction<AppDataState>>;
};

export function useAppDataStorage({
  isHydrated,
  setIsHydrated,
  state,
  setState,
}: UseAppDataStorageArgs) {
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) {
          const persisted = parsePersistedAppDataState(raw);
          setState(persisted.state);
        }
      } catch (error) {
        void errorLoggingService.captureException(error, {
          category: "storage",
          operation: "hydrate-app-data",
          severity: "warn",
          handled: true,
          source: "use-app-data",
          metadata: {
            storageKey: STORAGE_KEY,
          },
        });
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setIsHydrated, setState]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, serializeAppDataState(state)).catch((error) => {
      void errorLoggingService.captureException(error, {
        category: "storage",
        operation: "persist-app-data",
        severity: "warn",
        handled: true,
        source: "use-app-data",
        metadata: {
          storageKey: STORAGE_KEY,
          hasUser: !!state.user,
        },
      });
    });
  }, [isHydrated, state]);
}
