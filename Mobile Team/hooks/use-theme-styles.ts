import { useMemo } from "react";
import { useAppTheme } from "./use-app-theme";
import { getThemeTokens } from "@/constants/theme-tokens";

export function useThemeStyles() {
  const { resolvedTheme } = useAppTheme();

  return useMemo(() => getThemeTokens(resolvedTheme), [resolvedTheme]);
}

