import { localStorageService } from "@/services/storage/local-storage.service";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { normalizeQuestionnaireAnswers } from "@/services/app/questionnaire.enums";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { notificationsService } from "@/services/notifications/notifications.service";
import {
  initialState,
  normalizeAppDataState,
  STORAGE_KEY,
  type AppDataState,
  type QuestionnaireAnswers,
} from "./app-data-state";

type UseAppDataLocalActionsArgs = {
  setState: Dispatch<SetStateAction<AppDataState>>;
  setRestoreVersion: Dispatch<SetStateAction<number>>;
};

export function useAppDataLocalActions({
  setState,
  setRestoreVersion,
}: UseAppDataLocalActionsArgs) {
  const setQuestionnaireAnswers = useCallback(async (
    answers:
      | QuestionnaireAnswers
      | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
  ) => {
    setState((prev) => {
      const nextAnswers =
        typeof answers === "function"
          ? answers(prev.questionnaireAnswers ?? {})
          : answers;
      const normalized = normalizeQuestionnaireAnswers(nextAnswers);
      return { ...prev, questionnaireAnswers: { ...normalized } };
    });
  }, [setState]);

  const restoreData = useCallback(async (data: AppDataState) => {
    setState(normalizeAppDataState(data));
    setRestoreVersion((current) => current + 1);
  }, [setRestoreVersion, setState]);

  const clearAll = useCallback(async () => {
    await notificationsService.clearManagedNotifications().catch(() => {});
    await localStorageService.removeItem(STORAGE_KEY).catch((error) => {
      void errorLoggingService.captureException(error, {
        category: "storage",
        operation: "clear-app-data-primary",
        severity: "warn",
        handled: true,
        source: "use-app-data",
        metadata: {
          storageKey: STORAGE_KEY,
        },
      });
    });
    setState(initialState);
  }, [setState]);

  return {
    setQuestionnaireAnswers,
    restoreData,
    clearAll,
  };
}
