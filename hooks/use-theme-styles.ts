import { useMemo } from "react";
import { useAppTheme } from "./use-app-theme";

export function useThemeStyles() {
  const { isDark } = useAppTheme();

  return useMemo(
    () => ({
      textClass: isDark ? "text-white" : "text-emerald-900",
      secondaryTextClass: isDark ? "text-white/90" : "text-emerald-700",
      cardBgClass: isDark ? "bg-emerald-900/90 border-emerald-800" : "bg-white border-emerald-200",
      inputBgClass: isDark ? "bg-emerald-900/70 border-emerald-700" : "bg-white border-emerald-300",
      inactiveButtonClass: isDark ? "bg-emerald-800/70" : "bg-emerald-50",
      borderClass: isDark ? "border-emerald-700" : "border-emerald-300",
      progressBgClass: isDark ? "bg-emerald-800" : "bg-emerald-200",
      placeholderColor: isDark ? "#b6e2b6" : "#1f8a5d",
    }),
    [isDark]
  );
}
