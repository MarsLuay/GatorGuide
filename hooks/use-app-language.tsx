import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { Language, translations, TranslationKey } from "@/services/translations";

const STORAGE_KEY = "app-language";
const DEFAULT_LANGUAGE: Language = "English";

type AppLanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
  hydrated: boolean;
};

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

const supportedLanguages = Object.keys(translations) as Language[];

const pickLanguageFromLocale = (languageCode?: string, scriptCode?: string, regionCode?: string, languageTag?: string): Language => {
  const normalizedLang = (languageCode || "").toLowerCase();
  const normalizedScript = (scriptCode || "").toLowerCase();
  const normalizedRegion = (regionCode || "").toLowerCase();
  const normalizedTag = (languageTag || "").toLowerCase();

  if (normalizedLang === "en") return "English";
  if (normalizedLang === "es") return "Spanish";
  if (normalizedLang === "fr") return "French";
  if (normalizedLang === "de") return "German";
  if (normalizedLang === "it") return "Italian";
  if (normalizedLang === "ja") return "Japanese";
  if (normalizedLang === "ko") return "Korean";
  if (normalizedLang === "pt") return "Portuguese";
  if (normalizedLang === "ru") return "Russian";
  if (normalizedLang === "ar") return "Arabic";
  if (normalizedLang === "hi") return "Hindi";
  if (normalizedLang === "vi") return "Vietnamese";
  if (normalizedLang === "tl") return "Tagalog";

  if (normalizedLang === "zh") {
    const isTraditional = normalizedScript === "hant" || normalizedTag.includes("-hant") || normalizedRegion === "tw" || normalizedRegion === "hk" || normalizedRegion === "mo";
    return isTraditional ? "Chinese (Traditional)" : "Chinese (Simplified)";
  }

  return DEFAULT_LANGUAGE;
};

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
          const [deviceLocale] = Localization.getLocales();
          const detected = pickLanguageFromLocale(
            deviceLocale?.languageCode,
            deviceLocale?.scriptCode,
            deviceLocale?.regionCode,
            deviceLocale?.languageTag
          );

          const safeLanguage = supportedLanguages.includes(detected) ? detected : DEFAULT_LANGUAGE;
          setLanguageState(safeLanguage);
          AsyncStorage.setItem(STORAGE_KEY, safeLanguage).catch(() => {});
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

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations[DEFAULT_LANGUAGE][key] || key;
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
