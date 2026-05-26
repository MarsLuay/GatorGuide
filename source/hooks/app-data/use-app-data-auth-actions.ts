import { localStorageService } from "@/services/storage/local-storage.service";
import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { DEFAULT_USER_STATE } from "@/constants/profile-defaults";
import { STORAGE_KEYS } from "@/constants/schema";
import { authService, type AuthUser } from "@/services/auth/auth.service";
import type { College } from "@/services/colleges/college.service";
import {
  savedCollegesService,
  type SyncSavedCollegesOptions,
} from "@/services/colleges/saved-colleges.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { notificationsService } from "@/services/notifications/notifications.service";
import {
  initialState,
  resolveUserState,
  STORAGE_KEY,
  type AppDataState,
  type User,
} from "./app-data-state";
import type { LoadedServerProfile } from "./use-app-data-profile-sync";

type LoadProfileFromServer = (uid: string) => Promise<LoadedServerProfile>;

type LoadMergedSavedColleges = (
  uid: string,
  legacySavedCollegeIds?: string[],
  options?: SyncSavedCollegesOptions
) => Promise<College[]>;

type UseAppDataAuthActionsArgs = {
  stateRef: MutableRefObject<AppDataState>;
  setState: Dispatch<SetStateAction<AppDataState>>;
  loadProfileFromServer: LoadProfileFromServer;
  loadMergedSavedColleges: LoadMergedSavedColleges;
  reconciledSavedCollegesUidRef: MutableRefObject<string | null>;
};

export function useAppDataAuthActions({
  stateRef,
  setState,
  loadProfileFromServer,
  loadMergedSavedColleges,
  reconciledSavedCollegesUidRef,
}: UseAppDataAuthActionsArgs) {
  const signIn = useCallback(async (u: Pick<User, "name" | "email"> & { password: string; isSignUp: boolean }) => {
    const authUser = await authService.signIn({
      name: u.name,
      email: u.email,
      password: u.password,
      isSignUp: u.isSignUp,
    });

    const shouldPromoteLocalSavedColleges = !!stateRef.current.user?.isGuest;
    const { profile: profileFromServer, legacySavedCollegeIds } = await loadProfileFromServer(authUser.uid);
    const mergedSavedColleges = await loadMergedSavedColleges(authUser.uid, legacySavedCollegeIds, {
      includeLocalSnapshot: shouldPromoteLocalSavedColleges,
    });
    reconciledSavedCollegesUidRef.current = authUser.uid;

    setState((prev) => {
      if (prev.user && prev.user.email === authUser.email) {
        return {
          ...prev,
          user: {
            ...prev.user,
            uid: authUser.uid,
            name: authUser.name || u.name,
            ...profileFromServer,
            state: resolveUserState(profileFromServer.state ?? prev.user.state),
          },
          savedColleges: mergedSavedColleges,
        };
      }

      return {
        ...prev,
        user: {
          uid: authUser.uid,
          name: authUser.name || u.name,
          email: authUser.email,
          isGuest: false,
          major: "",
          gender: "",
          state: DEFAULT_USER_STATE,
          gpa: "",
          resume: "",
          transcript: "",
          ...profileFromServer,
        },
        savedColleges: mergedSavedColleges,
      };
    });
  }, [
    loadMergedSavedColleges,
    loadProfileFromServer,
    reconciledSavedCollegesUidRef,
    setState,
    stateRef,
  ]);

  const signInWithAuthUser = useCallback(async (authUser: AuthUser) => {
    const shouldPromoteLocalSavedColleges = !!stateRef.current.user?.isGuest;
    const { profile: profileFromServer, legacySavedCollegeIds } = await loadProfileFromServer(authUser.uid);
    const mergedSavedColleges = await loadMergedSavedColleges(authUser.uid, legacySavedCollegeIds, {
      includeLocalSnapshot: shouldPromoteLocalSavedColleges,
    });
    reconciledSavedCollegesUidRef.current = authUser.uid;

    setState((prev) => ({
      ...prev,
      user: {
        uid: authUser.uid,
        name: authUser.name || "",
        email: authUser.email,
        isGuest: false,
        major: "",
        gender: "",
        state: DEFAULT_USER_STATE,
        gpa: "",
        resume: "",
        transcript: "",
        ...profileFromServer,
      },
      savedColleges: mergedSavedColleges,
    }));
  }, [
    loadMergedSavedColleges,
    loadProfileFromServer,
    reconciledSavedCollegesUidRef,
    setState,
    stateRef,
  ]);

  const signInAsGuest = useCallback(async () => {
    reconciledSavedCollegesUidRef.current = null;
    setState((prev) => ({
      ...prev,
      user: {
        uid: `guest-${Date.now()}`,
        name: "Guest User",
        email: `guest-${Date.now()}@gatorguide.local`,
        isGuest: true,
        major: "",
        gender: "",
        state: DEFAULT_USER_STATE,
        gpa: "",
        resume: "",
        transcript: "",
      },
    }));
  }, [reconciledSavedCollegesUidRef, setState]);

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "auth",
        operation: "sign-out",
        severity: "warn",
        handled: true,
        source: "use-app-data",
      });
    }
    await notificationsService.clearManagedNotifications().catch(() => {});
    setState(initialState);
    reconciledSavedCollegesUidRef.current = null;
    await localStorageService.removeItem(STORAGE_KEY);
  }, [reconciledSavedCollegesUidRef, setState]);

  const deleteAccount = useCallback(async () => {
    const signedInUid = stateRef.current.user?.isGuest ? null : stateRef.current.user?.uid ?? null;
    try {
      await authService.deleteAccount();
    } finally {
      if (signedInUid) {
        await savedCollegesService.clearPendingSyncState(signedInUid).catch(() => {});
      }
      await notificationsService.clearManagedNotifications().catch(() => {});
      setState(initialState);
      reconciledSavedCollegesUidRef.current = null;
      await localStorageService.multiRemove([STORAGE_KEY, STORAGE_KEYS.guestProfileShow]);
    }
  }, [reconciledSavedCollegesUidRef, setState, stateRef]);

  return {
    signIn,
    signInWithAuthUser,
    signInAsGuest,
    signOut,
    deleteAccount,
  };
}
