import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { localStorageService } from "@/services/storage/local-storage.service";
import {
  getTranslationBundle,
  isSupportedLanguage,
  Language,
  SUPPORTED_LANGUAGES,
} from "@/services/app/translations";
import { LOCAL_STORAGE_KEYS } from "@/services/storage/local-storage-contracts";

const STORAGE_KEY = LOCAL_STORAGE_KEYS.appLanguage;
const DEFAULT_LANGUAGE: Language = "English";

function normalizeLang(input?: string): Language {
  // Map legacy labels/codes to canonical language keys used by translations.
  if (!input) return DEFAULT_LANGUAGE;
  const keys = SUPPORTED_LANGUAGES;
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
  if (/^fa\b|persian|farsi/.test(raw)) return "Persian";
  if (/^hi\b|hindi/.test(raw)) return "Hindi";
  if (/^vi\b|vietnamese/.test(raw)) return "Vietnamese";
  if (/^tl\b|tagalog/.test(raw)) return "Tagalog";

  for (const k of keys) {
    if (k.toLowerCase() === raw) return k;
    if (k.toLowerCase().startsWith(raw)) return k;
    if (k.toLowerCase().includes(raw)) return k;
  }

  return DEFAULT_LANGUAGE;
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
        const stored = await localStorageService.getItem(STORAGE_KEY);
        if (!mounted) return;

        if (stored && isSupportedLanguage(stored)) {
          setLanguageState(stored as Language);
        } else if (stored) {
          // Rewrite old/partial values into canonical key format.
          const mapped = normalizeLang(stored);
          setLanguageState(mapped);
          localStorageService.setItem(STORAGE_KEY, mapped).catch(() => {});
        } else {
          // Intentionally do not read the device locale. Fresh installs,
          // new users, and guests always start in English.
          setLanguageState(DEFAULT_LANGUAGE);
          localStorageService.setItem(STORAGE_KEY, DEFAULT_LANGUAGE).catch(() => {});
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback((value: Language) => {
    const mapped = normalizeLang(String(value));
    setLanguageState(mapped);
    localStorageService.setItem(STORAGE_KEY, mapped).catch(() => {});
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const langBundle = getTranslationBundle(language) ?? {};
    const enBundle = getTranslationBundle(DEFAULT_LANGUAGE) ?? {};

    // Resolve from current language, then English, then the key as a last fallback.
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
        const token = `{${k}}`;
        str = str.split(token).join(String(v));
      }
    }

    return str;
  }, [language]);

  const value = useMemo<AppLanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      hydrated,
    }),
    [language, setLanguage, t, hydrated]
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
