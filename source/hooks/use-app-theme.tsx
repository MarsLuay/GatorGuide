import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { localStorageService } from "@/services/storage/local-storage.service";
import { View, useColorScheme } from "react-native";
import { getThemeTokens } from "@/constants/theme-tokens";
import { LOCAL_STORAGE_KEYS } from "@/services/storage/local-storage-contracts";

export type AppTheme = "light" | "dark" | "green" | "system";

const STORAGE_KEY = LOCAL_STORAGE_KEYS.appTheme;
const APP_THEME_VALUES: AppTheme[] = ["light", "dark", "green", "system"];

type AppThemeContextValue = {
  theme: AppTheme;
  resolvedTheme: "light" | "dark" | "green";
  isDark: boolean;
  isGreen: boolean;
  isLight: boolean;
  setTheme: (value: AppTheme) => void;
  hydrated: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function isAppTheme(value: string | null): value is AppTheme {
  return APP_THEME_VALUES.includes(value as AppTheme);
}

function normalizeAppTheme(value: AppTheme | string | null): AppTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  if (value === "green") {
    return "dark";
  }

  return "system";
}

function syncWebThemeAttributes(theme: AppTheme, resolvedTheme: "light" | "dark" | "green") {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.setAttribute("data-app-theme", theme);
  root.setAttribute("data-app-theme-resolved", resolvedTheme);
  root.style.colorScheme = resolvedTheme === "light" ? "light" : "dark";
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = (useColorScheme() ?? "light") as "light" | "dark";
  const [theme, setThemeState] = useState<AppTheme>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await localStorageService.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (isAppTheme(stored)) {
          const normalizedTheme = normalizeAppTheme(stored);
          setThemeState(normalizedTheme);

          if (stored !== normalizedTheme) {
            localStorageService.setItem(STORAGE_KEY, normalizedTheme).catch(() => {});
          }
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = (value: AppTheme) => {
    const normalizedTheme = normalizeAppTheme(value);
    setThemeState(normalizedTheme);
    localStorageService.setItem(STORAGE_KEY, normalizedTheme).catch(() => {});
  };

  const normalizedTheme = normalizeAppTheme(theme);
  const resolvedTheme = normalizedTheme === "system" ? systemScheme : normalizedTheme;
  const themeTokens = getThemeTokens(resolvedTheme);

  useEffect(() => {
    syncWebThemeAttributes(theme, resolvedTheme);
  }, [theme, resolvedTheme]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      isDark: resolvedTheme === "dark",
      isGreen: resolvedTheme === "green",
      isLight: resolvedTheme === "light",
      setTheme,
      hydrated,
    }),
    [theme, resolvedTheme, hydrated]
  );

  return (
    <AppThemeContext.Provider value={value}>
      <View
        style={{
              flex: 1,
          backgroundColor: themeTokens.screenBaseColor,
        }}
      >
        {children}
      </View>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within <AppThemeProvider>");
  }
  return ctx;
}
