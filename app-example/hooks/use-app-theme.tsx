import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type AppTheme = "light" | "dark" | "system";

const STORAGE_KEY = "app-theme";

type AppThemeContextValue = {
  theme: AppTheme; // "light" | "dark" | "system"
  resolvedTheme: "light" | "dark";
  isDark: boolean;
  setTheme: (value: AppTheme) => void;
  hydrated: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = (useColorScheme() ?? "light") as "light" | "dark";

  const [theme, setThemeState] = useState<AppTheme>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;

        if (stored === "light" || stored === "dark" || stored === "system") {
          setThemeState(stored);
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
    // immediate UI update for all subscribed screens
    setThemeState(value);
    // persist (don’t block UI)
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

  const resolvedTheme = theme === "system" ? systemScheme : theme;

  const value = useMemo<AppThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      isDark: resolvedTheme === "dark",
      setTheme,
      hydrated,
    }),
    [theme, resolvedTheme, hydrated]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within <AppThemeProvider>");
  }
  return ctx;
}
