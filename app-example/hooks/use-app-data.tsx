import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type User = {
  name: string;
  email: string;
  isGuest?: boolean; // true if user is logged in as guest
  major?: string;
  gpa?: string;
  sat?: string;
  act?: string;
  resume?: string; // store a filename or local URI later
  transcript?: string; // store a filename or local URI later
};

export type QuestionnaireAnswers = Record<string, string>;

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

  signIn: (user: Pick<User, "name" | "email">) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;

  updateUser: (patch: Partial<User>) => Promise<void>;

  setQuestionnaireAnswers: (answers: QuestionnaireAnswers) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  clearAll: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [state, setState] = useState<AppDataState>(initialState);

  // Load once
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;

        if (raw) {
          const parsed = JSON.parse(raw) as AppDataState;
          setState({
            user: parsed.user ?? null,
            questionnaireAnswers: parsed.questionnaireAnswers ?? {},
            notificationsEnabled: parsed.notificationsEnabled ?? true,
          });
        }
      } catch {
        // ignore corrupt storage; fall back to initialState
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Persist on change (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [isHydrated, state]);

  const signIn = useCallback(async (u: Pick<User, "name" | "email">) => {
    setState((prev) => {
      // If user already exists with same email, preserve all their data
      if (prev.user && prev.user.email === u.email) {
        return {
          ...prev,
          user: {
            ...prev.user,
            name: u.name, // Update name in case it changed
          },
        };
      }
      
      // New user - create fresh profile
      return {
        ...prev,
        user: {
          name: u.name,
          email: u.email,
          isGuest: false,
          major: "",
          gpa: "",
          sat: "",
          act: "",
          resume: "",
          transcript: "",
        },
      };
    });
  }, []);

  const signInAsGuest = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      user: {
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
    setState((prev) => ({ ...prev, user: null }));
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...patch },
      };
    });
  }, []);

  const setQuestionnaireAnswers = useCallback(async (answers: QuestionnaireAnswers) => {
    setState((prev) => ({
      ...prev,
      questionnaireAnswers: { ...answers },
    }));
  }, []);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      notificationsEnabled: enabled,
    }));
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
      signInAsGuest,
      signOut,
      updateUser,
      setQuestionnaireAnswers,
      setNotificationsEnabled,
      clearAll,
    }),
    [isHydrated, state, signIn, signInAsGuest, signOut, updateUser, setQuestionnaireAnswers, setNotificationsEnabled, clearAll]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within <AppDataProvider />");
  }
  return ctx;
}
