import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { authService } from "@/services";
import type { AuthUser } from "@/services/auth.service";
import { db } from "@/services/firebase";
import { normalizeQuestionnaireAnswers } from "@/services/questionnaire.enums";

export type User = {
  uid: string;
  name: string;
  email: string;
  isGuest?: boolean; // true if user is logged in as guest
  state?: string;
  major?: string;
  gpa?: string;
  sat?: string;
  act?: string;
  resume?: string;
  transcript?: string;
  isProfileComplete?: boolean;
};

export type QuestionnaireAnswers = Record<string, any>;

export type AppDataState = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  notificationsEnabled: boolean;
};

const STORAGE_KEY = "gatorguide:appdata:v1";

const initialState: AppDataState = {
  user: null,
  questionnaireAnswers: {},
  notificationsEnabled: true,
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
  restoreData: (data: AppDataState) => Promise<void>;
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
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw) as AppDataState;
          setState({ ...parsed, questionnaireAnswers: normalizeQuestionnaireAnswers(parsed.questionnaireAnswers ?? {}) });
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
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (userDoc.exists() && userDoc.data()) {
          const data = userDoc.data();
          profileFromServer = {
            major: data.major ?? "",
            gpa: data.gpa ?? "",
            sat: data.sat ?? "",
            act: data.act ?? "",
            resume: data.resume ?? "",
            transcript: data.transcript ?? "",
            isProfileComplete: !!data.isProfileComplete,
          };
        }
      } catch {
        // Offline or missing doc: keep empty profile
      }
    }

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
          gpa: "",
          sat: "",
          act: "",
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
            major: data.major ?? "",
            gpa: data.gpa ?? "",
            sat: data.sat ?? "",
            act: data.act ?? "",
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
        major: "",
        gpa: "",
        sat: "",
        act: "",
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
        major: "",
        gpa: "",
        sat: "",
        act: "",
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
    try {
      await authService.deleteAccount();
    } finally {
      setState((prev) => ({ ...prev, user: null }));
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
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

  const restoreData = useCallback(async (data: AppDataState) => {
    setState({
      user: data.user ?? null,
      questionnaireAnswers: normalizeQuestionnaireAnswers(data.questionnaireAnswers ?? {}),
      notificationsEnabled: data.notificationsEnabled ?? true,
    });
  }, []);

  const clearAll = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
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
      restoreData,
      clearAll,
    }),
    [isHydrated, state, signIn, signInWithAuthUser, signInAsGuest, signOut, deleteAccount, updateUser, setQuestionnaireAnswers, setNotificationsEnabled, restoreData, clearAll]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider />");
  return ctx;
}
