import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, translations } from "@/services/translations";

const STORAGE_KEY = "app-language";
const DEFAULT_LANGUAGE: Language = "English";

type AppLanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  hydrated: boolean;
};

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;

        if (stored && (Object.keys(translations) as Language[]).includes(stored as Language)) {
          setLanguageState(stored as Language);
        } else {
          // Default to English on first launch; user can change in Settings
          setLanguageState(DEFAULT_LANGUAGE);
          AsyncStorage.setItem(STORAGE_KEY, DEFAULT_LANGUAGE).catch(() => {});
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const bundle = translations as Record<Language, Record<string, string>>;
    let str = bundle[language]?.[key] || bundle[DEFAULT_LANGUAGE]?.[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };

  const value = useMemo<AppLanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      hydrated,
    }),
    [language, hydrated]
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  const ctx = useContext(AppLanguageContext);
  if (!ctx) {
    throw new Error("useAppLanguage must be used within <AppLanguageProvider>");
  }
  return ctx;
}
