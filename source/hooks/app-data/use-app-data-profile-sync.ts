import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { FIRESTORE_COLLECTIONS } from "@/constants/schema";
import type { College } from "@/services/colleges/college.service";
import {
  savedCollegesService,
  type SyncSavedCollegesOptions,
} from "@/services/colleges/saved-colleges.service";
import { db } from "@/services/firebase/firebase";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  resolveUserState,
  type AppDataState,
  type User,
} from "./app-data-state";

export type LoadedServerProfile = {
  profile: Partial<User>;
  legacySavedCollegeIds: string[];
};

type UseAppDataProfileSyncArgs = {
  isHydrated: boolean;
  currentUserUid: string | null;
  currentUserIsGuest: boolean;
  stateRef: MutableRefObject<AppDataState>;
  setState: Dispatch<SetStateAction<AppDataState>>;
};

export function useAppDataProfileSync({
  isHydrated,
  currentUserUid,
  currentUserIsGuest,
  stateRef,
  setState,
}: UseAppDataProfileSyncArgs) {
  const reconciledSavedCollegesUidRef = useRef<string | null>(null);

  const loadProfileFromServer = useCallback(async (uid: string): Promise<LoadedServerProfile> => {
    if (!db) return { profile: {}, legacySavedCollegeIds: [] };

    try {
      const userDoc = await getDoc(doc(db, FIRESTORE_COLLECTIONS.users, uid));
      if (!userDoc.exists() || !userDoc.data()) return { profile: {}, legacySavedCollegeIds: [] };

      const data = userDoc.data();
      if (
        Object.prototype.hasOwnProperty.call(data, "transcript") ||
        Object.prototype.hasOwnProperty.call(data, "transcriptFileName")
      ) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.users, uid),
          {
            transcript: deleteField(),
            transcriptFileName: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch((error) => {
          void errorLoggingService.captureException(error, {
            category: "firestore",
            operation: "clear-remote-transcript-profile-fields",
            severity: "warn",
            handled: true,
            source: "use-app-data",
            metadata: {
              uid,
            },
          });
        });
      }

      return {
        profile: {
          ...(typeof data.name === "string" ? { name: data.name } : {}),
          state: resolveUserState(data.state),
          major: data.major ?? "",
          gender: data.gender ?? "",
          gpa: data.gpa ?? "",
          resume: data.resume ?? "",
          avatar: data.avatar ?? "",
          residencyType: data.residencyType ?? "",
          isProfileComplete: !!data.isProfileComplete,
        },
        legacySavedCollegeIds: Array.isArray(data.savedColleges)
          ? data.savedColleges
              .map((collegeId) => String(collegeId ?? "").trim())
              .filter(Boolean)
          : [],
      };
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "load-profile-from-server",
        severity: "warn",
        handled: true,
        source: "use-app-data",
        metadata: {
          uid,
        },
      });
      return { profile: {}, legacySavedCollegeIds: [] };
    }
  }, []);

  const loadMergedSavedColleges = useCallback(async (
    uid: string,
    legacySavedCollegeIds: string[] = [],
    options: SyncSavedCollegesOptions = {}
  ): Promise<College[]> => {
    const localSavedColleges = stateRef.current.savedColleges ?? [];
    if (!uid || !db) return localSavedColleges;

    try {
      return await savedCollegesService.syncSavedColleges(uid, localSavedColleges, legacySavedCollegeIds, options);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "sync",
        operation: "load-merged-saved-colleges",
        severity: "warn",
        handled: true,
        source: "use-app-data",
        metadata: {
          uid,
          localCount: localSavedColleges.length,
          legacyCount: legacySavedCollegeIds.length,
          includeLocalSnapshot: !!options.includeLocalSnapshot,
        },
      });
      return localSavedColleges;
    }
  }, [stateRef]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!currentUserUid || currentUserIsGuest) {
      reconciledSavedCollegesUidRef.current = null;
      return;
    }

    if (reconciledSavedCollegesUidRef.current === currentUserUid) return;
    reconciledSavedCollegesUidRef.current = currentUserUid;

    let cancelled = false;
    (async () => {
      const { legacySavedCollegeIds } = await loadProfileFromServer(currentUserUid);
      const mergedSavedColleges = await loadMergedSavedColleges(currentUserUid, legacySavedCollegeIds, {
        includeLocalSnapshot: false,
      });

      if (cancelled) return;
      setState((prev) => {
        if (prev.user?.uid !== currentUserUid || prev.user.isGuest) return prev;
        return {
          ...prev,
          savedColleges: mergedSavedColleges,
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    currentUserUid,
    currentUserIsGuest,
    loadMergedSavedColleges,
    loadProfileFromServer,
    setState,
  ]);

  return {
    reconciledSavedCollegesUidRef,
    loadProfileFromServer,
    loadMergedSavedColleges,
  };
}
