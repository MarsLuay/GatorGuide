import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { College } from "@/services/colleges/college.service";
import { savedCollegesService } from "@/services/colleges/saved-colleges.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import type { AppDataState } from "./app-data-state";

type UseSavedCollegeActionsArgs = {
  state: AppDataState;
  stateRef: MutableRefObject<AppDataState>;
  setState: Dispatch<SetStateAction<AppDataState>>;
};

export function useSavedCollegeActions({
  state,
  stateRef,
  setState,
}: UseSavedCollegeActionsArgs) {
  const addSavedCollege = useCallback(async (college: College) => {
    const currentUser = stateRef.current.user;
    const mergedSavedColleges = savedCollegesService.mergeSavedCollegeLists(stateRef.current.savedColleges ?? [], [college]);
    const mergedCollege =
      mergedSavedColleges.find((savedCollege) => String(savedCollege.id) === String(college.id)) ?? college;

    setState((prev) => ({ ...prev, savedColleges: mergedSavedColleges }));

    if (!currentUser?.uid || currentUser.isGuest) return;

    try {
      await savedCollegesService.saveCollege(currentUser.uid, mergedCollege);
      await savedCollegesService.clearPendingMutation(currentUser.uid, mergedCollege.id);
    } catch (error) {
      await savedCollegesService.queueSaveCollege(currentUser.uid, mergedCollege).catch(() => {});
      void errorLoggingService.captureException(error, {
        category: "sync",
        operation: "save-saved-college",
        severity: "warn",
        handled: true,
        source: "use-app-data",
        metadata: {
          uid: currentUser.uid,
          collegeId: mergedCollege.id,
          queuedForRetry: true,
        },
      });
    }
  }, [setState, stateRef]);

  const removeSavedCollege = useCallback(async (collegeId: string) => {
    const currentUser = stateRef.current.user;
    const nextSavedColleges = (stateRef.current.savedColleges ?? []).filter((c) => String(c.id) !== String(collegeId));

    setState((prev) => ({
      ...prev,
      savedColleges: nextSavedColleges,
    }));

    if (!currentUser?.uid || currentUser.isGuest) return;

    try {
      await savedCollegesService.removeCollege(currentUser.uid, collegeId);
      await savedCollegesService.clearPendingMutation(currentUser.uid, collegeId);
    } catch (error) {
      await savedCollegesService.queueRemoveCollege(currentUser.uid, collegeId).catch(() => {});
      void errorLoggingService.captureException(error, {
        category: "sync",
        operation: "remove-saved-college",
        severity: "warn",
        handled: true,
        source: "use-app-data",
        metadata: {
          uid: currentUser.uid,
          collegeId,
          queuedForRetry: true,
        },
      });
    }
  }, [setState, stateRef]);

  const isCollegeSaved = useCallback((collegeId: string) => {
    return (state.savedColleges ?? []).some((c) => String(c.id) === String(collegeId));
  }, [state.savedColleges]);

  return {
    addSavedCollege,
    removeSavedCollege,
    isCollegeSaved,
  };
}
