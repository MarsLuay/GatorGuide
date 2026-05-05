import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_SYNCABLE_PROFILE_FIELD_KEYS,
  QUESTIONNAIRE_FIELD_IDS,
  STORAGE_KEYS,
  type FirestoreSyncableProfileFieldKey,
} from "@/constants/schema";
import { DEFAULT_USER_STATE } from "@/constants/profile-defaults";
import { authService, type AuthUser } from "@/services/auth/auth.service";
import type { College } from "@/services/colleges/college.service";
import { db, firebaseAuth } from "@/services/firebase/firebase";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { normalizeQuestionnaireAnswers } from "@/services/app/questionnaire.enums";
import { notificationsService } from "@/services/notifications/notifications.service";
import { savedCollegesService, type SyncSavedCollegesOptions } from "@/services/colleges/saved-colleges.service";
import { storageService } from "@/services/storage/storage.service";

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
  gpa?: string;
  resume?: string;
  transcript?: string;
  isProfileComplete?: boolean;
  /** Whether the user has seen the onboarding/tutorial */
  hasSeenOnboarding?: boolean;
};

export type QuestionnaireAnswers = Record<string, any>;

export type NotificationPreferences = {
  transferDeadlines: boolean;
  collegeDeadlines: boolean;
  scholarships: boolean;
  internships: boolean;
  generalDeadlines: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  transferDeadlines: true,
  collegeDeadlines: true,
  scholarships: true,
  internships: true,
  generalDeadlines: true,
};

export type AppDataState = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  notificationsEnabled: boolean;
  notificationPreferences: NotificationPreferences;
  savedColleges: College[];
};

const STORAGE_KEY = STORAGE_KEYS.appData;

const initialState: AppDataState = {
  user: null,
  questionnaireAnswers: {},
  notificationsEnabled: false,
  notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  savedColleges: [],
};

function withDefaultUserState<T extends Partial<User> | null | undefined>(user: T): T {
  if (!user) return user;
  if (String(user.state ?? "").trim()) return user;
  return { ...user, state: DEFAULT_USER_STATE };
}

function resolveUserState(value: unknown) {
  return String(value ?? "").trim() || DEFAULT_USER_STATE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    transferDeadlines:
      typeof value.transferDeadlines === "boolean"
        ? value.transferDeadlines
        : DEFAULT_NOTIFICATION_PREFERENCES.transferDeadlines,
    collegeDeadlines:
      typeof value.collegeDeadlines === "boolean"
        ? value.collegeDeadlines
        : DEFAULT_NOTIFICATION_PREFERENCES.collegeDeadlines,
    scholarships:
      typeof value.scholarships === "boolean"
        ? value.scholarships
        : DEFAULT_NOTIFICATION_PREFERENCES.scholarships,
    internships:
      typeof value.internships === "boolean"
        ? value.internships
        : DEFAULT_NOTIFICATION_PREFERENCES.internships,
    generalDeadlines:
      typeof value.generalDeadlines === "boolean"
        ? value.generalDeadlines
        : DEFAULT_NOTIFICATION_PREFERENCES.generalDeadlines,
  };
}

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
  restoreVersion: number;
  state: AppDataState;
  signIn: (user: Pick<User, "name" | "email"> & { password: string; isSignUp: boolean }) => Promise<void>;
  signInWithAuthUser: (authUser: AuthUser) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  patchUserLocally: (patch: Partial<User>) => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  setQuestionnaireAnswers: (
    answers:
      | QuestionnaireAnswers
      | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
  ) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setNotificationPreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
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
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [state, setState] = useState<AppDataState>(initialState);
  const stateRef = useRef(state);
  const reconciledSavedCollegesUidRef = useRef<string | null>(null);
  const currentDeadlineAnswer =
    state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.deadline];
  const currentUserUid = state.user?.uid ?? null;
  const currentUserIsGuest = !!state.user?.isGuest;
  const currentUserTranscript = state.user?.transcript ?? "";

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
            user: withDefaultUserState(parsed.user ?? null),
            questionnaireAnswers: normalizeQuestionnaireAnswers(parsed.questionnaireAnswers ?? {}),
            notificationsEnabled: parsed.notificationsEnabled ?? false,
            notificationPreferences: normalizeNotificationPreferences(parsed.notificationPreferences),
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
        enabled: !!state.notificationPreferences.transferDeadlines,
        deadline: currentDeadlineAnswer,
      }).catch((error) => {
        void errorLoggingService.captureException(error, {
          category: "notifications",
          operation: "sync-deadline-notifications",
          severity: "warn",
          handled: true,
          source: "use-app-data",
          metadata: {
            hasDeadline: !!String(currentDeadlineAnswer ?? "").trim(),
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
    state.notificationPreferences.transferDeadlines,
    currentDeadlineAnswer,
  ]);

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
        state: DEFAULT_USER_STATE,
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
        state: DEFAULT_USER_STATE,
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
      await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_KEYS.guestProfileShow]);
    }
  }, []);

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
  }, [isHydrated, currentUserUid, currentUserIsGuest, loadMergedSavedColleges, loadProfileFromServer]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!currentUserUid) return;

    let cancelled = false;
    void (async () => {
      const localTranscript = await storageService.getTranscript(currentUserUid).catch(() => null);
      const nextTranscriptUrl = localTranscript?.url ?? "";

      if (cancelled) return;
      setState((prev) => {
        if (!prev.user || prev.user.uid !== currentUserUid) return prev;
        if (String(prev.user.transcript ?? "") === nextTranscriptUrl) return prev;
        return {
          ...prev,
          user: {
            ...prev.user,
            transcript: nextTranscriptUrl,
          },
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, currentUserUid, currentUserTranscript]);

  const patchUserLocally = useCallback(async (patch: Partial<User>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...patch },
      };
    });
  }, []);

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
  }, []);

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
  }, []);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      notificationsService.configureNotificationHandler();
    } else {
      await notificationsService.clearManagedNotifications().catch(() => {});
    }

    setState((prev) => ({ ...prev, notificationsEnabled: enabled }));
  }, []);

  const setNotificationPreferences = useCallback(async (patch: Partial<NotificationPreferences>) => {
    setState((prev) => ({
      ...prev,
      notificationPreferences: normalizeNotificationPreferences({
        ...prev.notificationPreferences,
        ...patch,
      }),
    }));
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
      user: withDefaultUserState(data.user ?? null),
      questionnaireAnswers: normalizeQuestionnaireAnswers(data.questionnaireAnswers ?? {}),
      notificationsEnabled: data.notificationsEnabled ?? false,
      notificationPreferences: normalizeNotificationPreferences(data.notificationPreferences),
      savedColleges: Array.isArray(data.savedColleges)
        ? savedCollegesService.mergeSavedCollegeLists([], data.savedColleges)
        : [],
    });
    setRestoreVersion((current) => current + 1);
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
      restoreVersion,
      state,
      signIn,
      signInWithAuthUser,
      signInAsGuest,
      signOut,
      deleteAccount,
      patchUserLocally,
      updateUser,
      setQuestionnaireAnswers,
      setNotificationsEnabled,
      setNotificationPreferences,
      addSavedCollege,
      removeSavedCollege,
      isCollegeSaved,
      restoreData,
      clearAll,
      setOnboardingSeen,
    }),
    [isHydrated, restoreVersion, state, signIn, signInWithAuthUser, signInAsGuest, signOut, deleteAccount, patchUserLocally, updateUser, setQuestionnaireAnswers, setNotificationsEnabled, setNotificationPreferences, addSavedCollege, removeSavedCollege, isCollegeSaved, restoreData, clearAll, setOnboardingSeen]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider />");
  return ctx;
}
