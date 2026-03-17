import { useMemo } from "react";
import { useAppTheme } from "./use-app-theme";

export function useThemeStyles() {
  const { isDark } = useAppTheme();

  return useMemo(
    () => ({
      textClass: isDark ? "text-white" : "text-gray-900",
      secondaryTextClass: isDark ? "text-gray-400" : "text-gray-600",
      cardBgClass: isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200",
      inputBgClass: isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-300",
      inactiveButtonClass: isDark ? "bg-gray-800" : "bg-gray-100",
      borderClass: isDark ? "border-gray-800" : "border-gray-200",
      progressBgClass: isDark ? "bg-gray-800" : "bg-gray-200",
      placeholderColor: isDark ? "#9CA3AF" : "#6B7280",
    }),
    [isDark]
  );
}
