import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { authService, notificationsService } from "@/services";
import {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_SYNCABLE_PROFILE_FIELD_KEYS,
  QUESTIONNAIRE_FIELD_IDS,
  STORAGE_KEYS,
  type FirestoreSyncableProfileFieldKey,
} from "@/constants/schema";
import type { AuthUser } from "@/services/auth/auth.service";
import type { College } from "@/services/colleges/college.service";
import { db, firebaseAuth } from "@/services/firebase/firebase";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { normalizeQuestionnaireAnswers } from "@/services/app/questionnaire.enums";
import { savedCollegesService, type SyncSavedCollegesOptions } from "@/services/colleges/saved-colleges.service";

export type User = {
  uid: string;
  name: string;
  email: string;
  isGuest?: boolean; // true if user is logged in as guest
  avatar?: string; // URI to profile avatar image
  state?: string;
  major?: string;
  gender?: string;
  /** American in-state | American out-of-state | International */
  residencyType?: string;
  /** Native | Advanced | Intermediate | Beginner */
  englishProficiency?: string;
  /** ielts | toefl | duolingo | self - only when not native */
  englishTestType?: string;
  /** Score (e.g. 7.5) or self-evaluation text */
  englishTestValue?: string;
  gpa?: string;
  resume?: string;
  transcript?: string;
  isProfileComplete?: boolean;
  /** Whether the user has seen the onboarding/tutorial */
  hasSeenOnboarding?: boolean;
};

export type QuestionnaireAnswers = Record<string, any>;

export type AppDataState = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  notificationsEnabled: boolean;
  savedColleges: College[];
};

const STORAGE_KEY = STORAGE_KEYS.appData;

const initialState: AppDataState = {
  user: null,
  questionnaireAnswers: {},
  notificationsEnabled: false,
  savedColleges: [],
};

function buildFirestoreUserPatch(patch: Partial<User>) {
  const syncPatch: Partial<Record<FirestoreSyncableProfileFieldKey, unknown>> = {};

  for (const key of FIRESTORE_SYNCABLE_PROFILE_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const value = patch[key];
    if (value !== undefined) {
      syncPatch[key] = value;
    }
  }

  return syncPatch;
}

type AppDataContextValue = {
  isHydrated: boolean;
  state: AppDataState;
  signIn: (user: Pick<User, "name" | "email"> & { password: string; isSignUp: boolean }) => Promise<void>;
  signInWithAuthUser: (authUser: AuthUser) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  setQuestionnaireAnswers: (answers: QuestionnaireAnswers) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  addSavedCollege: (college: College) => Promise<void>;
  removeSavedCollege: (collegeId: string) => Promise<void>;
  isCollegeSaved: (collegeId: string) => boolean;
  restoreData: (data: AppDataState) => Promise<void>;
  clearAll: () => Promise<void>;
  setOnboardingSeen: (seen: boolean) => Promise<void>;
};

type LoadedServerProfile = {
  profile: Partial<User>;
  legacySavedCollegeIds: string[];
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setState] = useState<AppDataState>(initialState);
  const stateRef = useRef(state);
  const reconciledSavedCollegesUidRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppDataState> & { savedColleges?: College[] };
          setState({
            user: parsed.user ?? null,
            questionnaireAnswers: normalizeQuestionnaireAnswers(parsed.questionnaireAnswers ?? {}),
            notificationsEnabled: parsed.notificationsEnabled ?? false,
            savedColleges: Array.isArray(parsed.savedColleges)
              ? savedCollegesService.mergeSavedCollegeLists([], parsed.savedColleges)
              : [],
          });
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
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) => {
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

  useEffect(() => {
    if (!isHydrated) return;
    void errorLoggingService.flushPendingLogs();
  }, [isHydrated, state.user?.uid]);

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;
    (async () => {
      if (!state.notificationsEnabled) {
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
        enabled: true,
        deadline: state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.deadline],
      }).catch((error) => {
        void errorLoggingService.captureException(error, {
          category: "notifications",
          operation: "sync-deadline-notifications",
          severity: "warn",
          handled: true,
          source: "use-app-data",
          metadata: {
            hasDeadline: !!String(
              state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.deadline] ?? ""
            ).trim(),
          },
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    state.notificationsEnabled,
    state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.deadline],
  ]);

  const loadProfileFromServer = useCallback(async (uid: string): Promise<LoadedServerProfile> => {
    if (!db) return { profile: {}, legacySavedCollegeIds: [] };

    try {
      const userDoc = await getDoc(doc(db, FIRESTORE_COLLECTIONS.users, uid));
      if (!userDoc.exists() || !userDoc.data()) return { profile: {}, legacySavedCollegeIds: [] };

      const data = userDoc.data();
      return {
        profile: {
          ...(typeof data.name === "string" ? { name: data.name } : {}),
          state: data.state ?? "",
          major: data.major ?? "",
          gender: data.gender ?? "",
          gpa: data.gpa ?? "",
          resume: data.resume ?? "",
          transcript: data.transcript ?? "",
          avatar: data.avatar ?? "",
          residencyType: data.residencyType ?? "",
          englishProficiency: data.englishProficiency ?? "",
          englishTestType: data.englishTestType ?? "",
          englishTestValue: data.englishTestValue ?? "",
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
  }, []);

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
          state: "",
          gpa: "",
          resume: "",
          transcript: "",
          ...profileFromServer,
        },
        savedColleges: mergedSavedColleges,
      };
    });
  }, [loadMergedSavedColleges, loadProfileFromServer]);

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
        state: "",
        gpa: "",
        resume: "",
        transcript: "",
        ...profileFromServer,
      },
      savedColleges: mergedSavedColleges,
    }));
  }, [loadMergedSavedColleges, loadProfileFromServer]);

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
        state: "",
        gpa: "",
        resume: "",
        transcript: "",
      },
    }));
  }, []);

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
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

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
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const currentUser = state.user;
    if (!currentUser?.uid || currentUser.isGuest) {
      reconciledSavedCollegesUidRef.current = null;
      return;
    }

    if (reconciledSavedCollegesUidRef.current === currentUser.uid) return;
    reconciledSavedCollegesUidRef.current = currentUser.uid;

    let cancelled = false;
    (async () => {
      const { legacySavedCollegeIds } = await loadProfileFromServer(currentUser.uid);
      const mergedSavedColleges = await loadMergedSavedColleges(currentUser.uid, legacySavedCollegeIds, {
        includeLocalSnapshot: false,
      });

      if (cancelled) return;
      setState((prev) => {
        if (prev.user?.uid !== currentUser.uid || prev.user.isGuest) return prev;
        return {
          ...prev,
          savedColleges: mergedSavedColleges,
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, state.user?.uid, state.user?.isGuest, loadMergedSavedColleges, loadProfileFromServer]);

  const updateUser = useCallback(async (patch: Partial<User>) => {
    const firestorePatch = buildFirestoreUserPatch(patch);
    const firestoreUid = firebaseAuth?.currentUser?.uid ?? null;

    if (firestoreUid && db && Object.keys(firestorePatch).length > 0) {
      try {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.users, firestoreUid),
          {
            ...firestorePatch,
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
  }, []);

  const setQuestionnaireAnswers = useCallback(async (answers: QuestionnaireAnswers) => {
    const normalized = normalizeQuestionnaireAnswers(answers);
    setState((prev) => ({ ...prev, questionnaireAnswers: { ...normalized } }));
  }, []);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      notificationsService.configureNotificationHandler();
    } else {
      await notificationsService.clearManagedNotifications().catch(() => {});
    }

    setState((prev) => ({ ...prev, notificationsEnabled: enabled }));
  }, []);

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
  }, []);

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
  }, []);

  const isCollegeSaved = useCallback((collegeId: string) => {
    return (state.savedColleges ?? []).some((c) => String(c.id) === String(collegeId));
  }, [state.savedColleges]);

  const restoreData = useCallback(async (data: AppDataState) => {
    setState({
      user: data.user ?? null,
      questionnaireAnswers: normalizeQuestionnaireAnswers(data.questionnaireAnswers ?? {}),
      notificationsEnabled: data.notificationsEnabled ?? false,
      savedColleges: Array.isArray(data.savedColleges)
        ? savedCollegesService.mergeSavedCollegeLists([], data.savedColleges)
        : [],
    });
  }, []);

  const clearAll = useCallback(async () => {
    await notificationsService.clearManagedNotifications().catch(() => {});
    await AsyncStorage.removeItem(STORAGE_KEY).catch((error) => {
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
  }, []);

  const setOnboardingSeen = useCallback(async (seen: boolean) => {
    setState((prev) => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, hasSeenOnboarding: seen },
      };
    });
  }, []);

  const value = useMemo<AppDataContextValue>(
    () => ({
      isHydrated,
      state,
      signIn,
      signInWithAuthUser,
      signInAsGuest,
      signOut,
      deleteAccount,
      updateUser,
      setQuestionnaireAnswers,
      setNotificationsEnabled,
      addSavedCollege,
      removeSavedCollege,
      isCollegeSaved,
      restoreData,
      clearAll,
      setOnboardingSeen,
    }),
    [isHydrated, state, signIn, signInWithAuthUser, signInAsGuest, signOut, deleteAccount, updateUser, setQuestionnaireAnswers, setNotificationsEnabled, addSavedCollege, removeSavedCollege, isCollegeSaved, restoreData, clearAll, setOnboardingSeen]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider />");
  return ctx;
}
