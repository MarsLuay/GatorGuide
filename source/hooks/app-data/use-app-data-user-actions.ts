import {
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { FIRESTORE_COLLECTIONS } from "@/constants/schema";
import { db, firebaseAuth } from "@/services/firebase/firebase";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  buildFirestoreUserPatch,
  type AppDataState,
  type User,
} from "./app-data-state";

type UseAppDataUserActionsArgs = {
  setState: Dispatch<SetStateAction<AppDataState>>;
};

export function useAppDataUserActions({ setState }: UseAppDataUserActionsArgs) {
  const patchUserLocally = useCallback(async (patch: Partial<User>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...patch },
      };
    });
  }, [setState]);

  const updateUser = useCallback(async (patch: Partial<User>) => {
    const firestorePatch = buildFirestoreUserPatch(patch);
    const firestoreUid = firebaseAuth?.currentUser?.uid ?? null;
    const shouldClearRemoteTranscript = Object.prototype.hasOwnProperty.call(patch, "transcript");

    if (firestoreUid && db && (Object.keys(firestorePatch).length > 0 || shouldClearRemoteTranscript)) {
      try {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.users, firestoreUid),
          {
            ...firestorePatch,
            ...(shouldClearRemoteTranscript
              ? {
                  transcript: deleteField(),
                  transcriptFileName: deleteField(),
                }
              : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        void errorLoggingService.captureException(error, {
          category: "firestore",
          operation: "persist-user-profile-patch",
          severity: "error",
          handled: false,
          source: "use-app-data",
          metadata: {
            uid: firestoreUid,
            fields: Object.keys(firestorePatch),
          },
        });
        throw error;
      }
    }

    setState((prev) => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...patch },
      };
    });
  }, [setState]);

  const setOnboardingSeen = useCallback(async (seen: boolean) => {
    setState((prev) => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, hasSeenOnboarding: seen },
      };
    });
  }, [setState]);

  return {
    patchUserLocally,
    updateUser,
    setOnboardingSeen,
  };
}
