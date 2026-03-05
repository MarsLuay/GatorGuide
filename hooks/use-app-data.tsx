import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { authService } from "@/services";
import type { AuthUser } from "@/services/auth.service";
import type { College } from "@/services/college.service";
import { db } from "@/services/firebase";
import { normalizeQuestionnaireAnswers } from "@/services/questionnaire.enums";

export type User = {
  uid: string;
  name: string;
  email: string;
  isGuest?: boolean; // true if user is logged in as guest
  hasSeenOnboarding?: boolean;
  state?: string;
  major?: string;
  gpa?: string;
  resume?: string;
  transcript?: string;
  isProfileComplete?: boolean;
};

export type QuestionnaireAnswers = Record<string, any>;

export type AppDataState = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  notificationsEnabled: boolean;
  savedColleges: College[];
};

const STORAGE_KEY = "gatorguide:appdata:v1";

const initialState: AppDataState = {
  user: null,
  questionnaireAnswers: {},
  notificationsEnabled: false,
  savedColleges: [],
};

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
  setOnboardingSeen: (seen: boolean) => Promise<void>;
  clearAll: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setState] = useState<AppDataState>(initialState);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Hydrate once on boot; keep backward compatibility with legacy storage key.
        let raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) raw = await AsyncStorage.getItem("gatorguide:appdata:v1");
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppDataState> & { savedColleges?: College[] };
          setState({
            user: parsed.user ?? null,
            questionnaireAnswers: normalizeQuestionnaireAnswers(parsed.questionnaireAnswers ?? {}),
            notificationsEnabled: parsed.notificationsEnabled ?? false,
            savedColleges: Array.isArray(parsed.savedColleges) ? parsed.savedColleges : [],
          });
        }
      } catch {
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    // Persist the full app data snapshot after hydration to avoid clobbering boot state.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [isHydrated, state]);

  const signIn = useCallback(async (u: Pick<User, "name" | "email"> & { password: string; isSignUp: boolean }) => {
    const authUser = await authService.signIn({
      name: u.name,
      email: u.email,
      password: u.password,
      isSignUp: u.isSignUp,
    });

    let profileFromServer: Partial<User> = {};
    if (db) {
      try {
        // Merge profile fields from Firestore so auth identity and profile stay in sync.
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (userDoc.exists() && userDoc.data()) {
          const data = userDoc.data();
          profileFromServer = {
            hasSeenOnboarding: typeof data.hasSeenOnboarding === "boolean" ? data.hasSeenOnboarding : undefined,
            state: data.state ?? "",
            major: data.major ?? "",
            gpa: data.gpa ?? "",
            resume: data.resume ?? "",
            transcript: data.transcript ?? "",
            isProfileComplete: !!data.isProfileComplete,
          };
        }
      } catch {
        // Offline or missing doc: keep empty profile
      }
    }

    if (u.isSignUp && db) {
      try {
        await setDoc(
          doc(db, "users", authUser.uid),
          { hasSeenOnboarding: false },
          { merge: true }
        );
      } catch {
        // ignore write failures; local state still controls onboarding
      }
    }

    setState((prev) => {
      const onboardingSeen =
        typeof profileFromServer.hasSeenOnboarding === "boolean"
          ? profileFromServer.hasSeenOnboarding
          : false;

      if (prev.user && prev.user.email === authUser.email) {
        return {
          ...prev,
          user: {
            ...prev.user,
            uid: authUser.uid,
            name: authUser.name || u.name,
            hasSeenOnboarding: onboardingSeen,
            ...profileFromServer,
          },
        };
      }

      return {
        ...prev,
        user: {
          uid: authUser.uid,
          name: authUser.name || u.name,
          email: authUser.email,
          isGuest: false,
          hasSeenOnboarding: onboardingSeen,
          major: "",
          state: "",
          gpa: "",
          resume: "",
          transcript: "",
          ...profileFromServer,
        },
      };
    });
  }, []);

  const signInWithAuthUser = useCallback(async (authUser: AuthUser) => {
    let profileFromServer: Partial<User> = {};
    if (db) {
      try {
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (userDoc.exists() && userDoc.data()) {
          const data = userDoc.data();
          profileFromServer = {
            hasSeenOnboarding: typeof data.hasSeenOnboarding === "boolean" ? data.hasSeenOnboarding : undefined,
            state: data.state ?? "",
            major: data.major ?? "",
            gpa: data.gpa ?? "",
            resume: data.resume ?? "",
            transcript: data.transcript ?? "",
            isProfileComplete: !!data.isProfileComplete,
          };
        }
      } catch {
        // ignore
      }
    }
    setState((prev) => ({
      ...prev,
      user: {
        uid: authUser.uid,
        name: authUser.name || "",
        email: authUser.email,
        isGuest: false,
        hasSeenOnboarding: typeof profileFromServer.hasSeenOnboarding === "boolean" ? profileFromServer.hasSeenOnboarding : false,
        major: "",
        state: "",
        gpa: "",
        resume: "",
        transcript: "",
        ...profileFromServer,
      },
    }));
  }, []);

  const signInAsGuest = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      user: {
        uid: `guest-${Date.now()}`,
        name: "Guest User",
        email: `guest-${Date.now()}@gatorguide.local`,
        isGuest: true,
        hasSeenOnboarding: true,
        major: "",
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
    } catch {
      // ignore
    }
    setState((prev) => ({ ...prev, user: null }));
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    setState((prev) => ({ ...prev, user: null }));
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateUser = useCallback(async (patch: Partial<User>) => {
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
    setState((prev) => ({ ...prev, notificationsEnabled: enabled }));
  }, []);

  const addSavedCollege = useCallback(async (college: College) => {
    setState((prev) => {
      const list = prev.savedColleges ?? [];
      if (list.some((c) => c.id === college.id)) return prev;
      return { ...prev, savedColleges: [...list, college] };
    });
  }, []);

  const removeSavedCollege = useCallback(async (collegeId: string) => {
    setState((prev) => ({
      ...prev,
      savedColleges: (prev.savedColleges ?? []).filter((c) => c.id !== collegeId),
    }));
  }, []);

  const isCollegeSaved = useCallback((collegeId: string) => {
    return (state.savedColleges ?? []).some((c) => c.id === collegeId);
  }, [state.savedColleges]);

  const restoreData = useCallback(async (data: AppDataState) => {
    setState({
      user: data.user ?? null,
      questionnaireAnswers: normalizeQuestionnaireAnswers(data.questionnaireAnswers ?? {}),
      notificationsEnabled: data.notificationsEnabled ?? false,
      savedColleges: Array.isArray(data.savedColleges) ? data.savedColleges : [],
    });
  }, []);

  const setOnboardingSeen = useCallback(async (seen: boolean) => {
    setState((prev) => {
      if (!prev.user) return prev;
      return { ...prev, user: { ...prev.user, hasSeenOnboarding: seen } };
    });

    const uid = state.user?.uid;
    const isGuest = state.user?.isGuest;
    if (!uid || isGuest || !db) return;

    try {
      await setDoc(doc(db, "users", uid), { hasSeenOnboarding: seen }, { merge: true });
    } catch {
      // ignore remote write failures; local flag still prevents repeat onboarding
    }
  }, [state.user?.uid, state.user?.isGuest]);

  const clearAll = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    await AsyncStorage.removeItem("gatorguide:appdata:v1").catch(() => {});
    setState(initialState);
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
      setOnboardingSeen,
      clearAll,
    }),
    [isHydrated, state, signIn, signInWithAuthUser, signInAsGuest, signOut, deleteAccount, updateUser, setQuestionnaireAnswers, setNotificationsEnabled, addSavedCollege, removeSavedCollege, isCollegeSaved, restoreData, setOnboardingSeen, clearAll]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider />");
  return ctx;
}
