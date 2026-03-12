import { useMemo } from "react";
import { useAppTheme } from "./use-app-theme";

export function useThemeStyles() {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";
  const isGreen = resolvedTheme === "green";

  return useMemo(
    () => ({
      textClass: isDark ? "text-white" : isGreen ? "text-white" : "text-emerald-900",
      secondaryTextClass: isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : "text-emerald-700",
      cardBgClass: isDark
        ? "bg-gray-900/80 border-gray-800"
        : isGreen
          ? "bg-emerald-900/90 border-emerald-800"
          : "bg-white border-emerald-200",
      inputBgClass: isDark
        ? "bg-gray-800 border-gray-700"
        : isGreen
          ? "bg-emerald-900/70 border-emerald-700"
          : "bg-white border-emerald-300",
      inactiveButtonClass: isDark ? "bg-gray-800" : isGreen ? "bg-emerald-800/70" : "bg-emerald-100",
      borderClass: isDark ? "border-gray-800" : isGreen ? "border-emerald-700" : "border-emerald-300",
      progressBgClass: isDark ? "bg-gray-800" : isGreen ? "bg-emerald-800" : "bg-emerald-300",
      placeholderColor: isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : "#166534",
    }),
    [isDark, isGreen]
  );
}

