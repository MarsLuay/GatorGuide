import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, translations } from "@/services/translations";

const STORAGE_KEY = "app-language";
const DEFAULT_LANGUAGE: Language = "English";

function normalizeLang(input?: string): Language {
  if (!input) return DEFAULT_LANGUAGE;
  const keys = Object.keys(translations) as Language[];
  const raw = input.trim().toLowerCase();

  if (/^en\b|english/.test(raw)) return "English";
  if (/^es\b|spanish/.test(raw)) return "Spanish";
  if (/^zh[-_]?hans|zh-cn|simplified/.test(raw)) return "Chinese (Simplified)";
  if (/^zh[-_]?hant|zh-tw|traditional/.test(raw)) return "Chinese (Traditional)";
  if (/^fr\b|french/.test(raw)) return "French";
  if (/^de\b|german/.test(raw)) return "German";
  if (/^it\b|italian/.test(raw)) return "Italian";
  if (/^ja\b|japanese/.test(raw)) return "Japanese";
  if (/^ko\b|korean/.test(raw)) return "Korean";
  if (/^pt\b|portuguese/.test(raw)) return "Portuguese";
  if (/^ru\b|russian/.test(raw)) return "Russian";
  if (/^ar\b|arabic/.test(raw)) return "Arabic";
  if (/^hi\b|hindi/.test(raw)) return "Hindi";
  if (/^vi\b|vietnamese/.test(raw)) return "Vietnamese";
  if (/^tl\b|tagalog/.test(raw)) return "Tagalog";

  for (const k of keys) {
    if (k.toLowerCase() === raw) return k;
    if (k.toLowerCase().startsWith(raw)) return k;
    if (k.toLowerCase().includes(raw)) return k;
  }

  return keys.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : keys[0];
}

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
        } else if (stored) {
          const mapped = normalizeLang(stored);
          setLanguageState(mapped);
          AsyncStorage.setItem(STORAGE_KEY, mapped).catch(() => {});
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
    const mapped = normalizeLang(String(value));
    setLanguageState(mapped);
    AsyncStorage.setItem(STORAGE_KEY, mapped).catch(() => {});
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const bundle = translations as Record<Language, Record<string, string>>;
    const langBundle = bundle[language] ?? {};
    const enBundle = bundle[DEFAULT_LANGUAGE] ?? {};

    // Try current language first
    let str = langBundle[key];

    // If missing (undefined) or the entry is just the key itself, fall back to English
    if (str === undefined || str === key) {
      str = enBundle[key];
    }

    // Final fallback: return the key unchanged
    if (str === undefined) str = key;

    // Interpolation (preserve existing behavior)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\{${k}\}`, "g"), String(v));
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
