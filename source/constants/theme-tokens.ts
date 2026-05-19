export type ResolvedAppTheme = "light" | "dark" | "green";

type ThemeTokens = {
  textClass: string;
  secondaryTextClass: string;
  cardBgClass: string;
  dropdownSurfaceColor: string;
  inputBgClass: string;
  inactiveButtonClass: string;
  borderClass: string;
  progressBgClass: string;
  placeholderColor: string;
  textColor: string;
  secondaryTextColor: string;
  screenBaseColor: string;
  screenGradientColors: [string, string, string];
  screenOverlayTopColors: [string, string, string];
  screenOverlayBottomColors: [string, string, string];
  statusBarStyle: "light-content" | "dark-content";
  glassSurfaceColor: string;
  glassBorderColor: string;
  glassInnerGlowColor: string;
  glassSpecularColors: [string, string, string];
  glassTopSpecularColors: [string, string];
  glassChromaticColors: [string, string, string];
  glassBackdropBrightness: number;
  glassBlurIntensity: number;
  glassBlurTint: "light" | "dark";
  glassHighlightAlpha: number;
  glassShadowAlphaStrong: number;
  glassShadowAlphaSoft: number;
  glassPrimaryFill: string;
  glassPrimaryTextColor: string;
  glassSecondaryTextColor: string;
  glassTabSurfaceColor: string;
  glassTabBorderColor: string;
  glassTabInnerGlowColor: string;
  glassTabTopSpecularColors: [string, string];
  glassTabChromaticColors: [string, string, string];
  glassTabBackdropBrightness: number;
  glassTabHighlightAlpha: number;
  glassTabShadowAlphaStrong: number;
  glassTabActiveBackground: string;
  glassTabInactiveColor: string;
};

const THEME_TOKENS: Record<ResolvedAppTheme, ThemeTokens> = {
  light: {
    textClass: "text-emerald-900",
    secondaryTextClass: "text-emerald-700",
    cardBgClass: "bg-emerald-500/5 border-emerald-200",
    dropdownSurfaceColor: "#FFFFFF",
    inputBgClass: "bg-emerald-500/5 border-emerald-300",
    inactiveButtonClass: "bg-emerald-100",
    borderClass: "border-emerald-300",
    progressBgClass: "bg-emerald-300",
    placeholderColor: "#166534",
    textColor: "#052e16",
    secondaryTextColor: "#166534",
    screenBaseColor: "#ECFDF3",
    screenGradientColors: ["#F6FFF9", "#E5FBEE", "#D7F6E4"],
    screenOverlayTopColors: ["rgba(255,255,255,0.76)", "rgba(255,255,255,0.18)", "transparent"],
    screenOverlayBottomColors: ["rgba(16,185,129,0.10)", "rgba(96,165,250,0.05)", "transparent"],
    statusBarStyle: "dark-content",
    glassSurfaceColor: "rgba(255,255,255,0.08)",
    glassBorderColor: "rgba(255,255,255,0.50)",
    glassInnerGlowColor: "rgba(255,255,255,0.25)",
    glassSpecularColors: ["rgba(255,255,255,0.70)", "rgba(255,255,255,0.12)", "transparent"],
    glassTopSpecularColors: ["rgba(255,255,255,0.50)", "transparent"],
    glassChromaticColors: ["rgba(100,180,255,0.04)", "transparent", "rgba(255,120,180,0.03)"],
    glassBackdropBrightness: 1.08,
    glassBlurIntensity: 42,
    glassBlurTint: "light",
    glassHighlightAlpha: 0.55,
    glassShadowAlphaStrong: 0.08,
    glassShadowAlphaSoft: 0.04,
    glassPrimaryFill: "rgba(0,143,78,0.30)",
    glassPrimaryTextColor: "#FFFFFF",
    glassSecondaryTextColor: "#052e16",
    glassTabSurfaceColor: "rgba(255,255,255,0.06)",
    glassTabBorderColor: "rgba(255,255,255,0.50)",
    glassTabInnerGlowColor: "rgba(255,255,255,0.25)",
    glassTabTopSpecularColors: ["rgba(255,255,255,0.50)", "transparent"],
    glassTabChromaticColors: ["rgba(100,180,255,0.04)", "transparent", "rgba(255,120,180,0.03)"],
    glassTabBackdropBrightness: 1.08,
    glassTabHighlightAlpha: 0.55,
    glassTabShadowAlphaStrong: 0.08,
    glassTabActiveBackground: "rgba(0,143,78,0.10)",
    glassTabInactiveColor: "#00753e",
  },
  dark: {
    textClass: "text-white",
    secondaryTextClass: "text-gray-400",
    cardBgClass: "bg-gray-900/80 border-gray-800",
    dropdownSurfaceColor: "#111827",
    inputBgClass: "bg-gray-800 border-gray-700",
    inactiveButtonClass: "bg-gray-800",
    borderClass: "border-gray-800",
    progressBgClass: "bg-gray-800",
    placeholderColor: "#9CA3AF",
    textColor: "#FFFFFF",
    secondaryTextColor: "#9CA3AF",
    screenBaseColor: "#020617",
    screenGradientColors: ["#020617", "#111827", "#03120c"],
    screenOverlayTopColors: ["rgba(52,211,153,0.10)", "rgba(255,255,255,0.02)", "transparent"],
    screenOverlayBottomColors: ["rgba(96,165,250,0.10)", "rgba(0,0,0,0.06)", "transparent"],
    statusBarStyle: "light-content",
    glassSurfaceColor: "rgba(255,255,255,0.03)",
    glassBorderColor: "rgba(255,255,255,0.18)",
    glassInnerGlowColor: "rgba(255,255,255,0.07)",
    glassSpecularColors: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.02)", "transparent"],
    glassTopSpecularColors: ["rgba(255,255,255,0.10)", "transparent"],
    glassChromaticColors: ["rgba(100,180,255,0.06)", "transparent", "rgba(255,120,180,0.05)"],
    glassBackdropBrightness: 1.15,
    glassBlurIntensity: 35,
    glassBlurTint: "dark",
    glassHighlightAlpha: 0.18,
    glassShadowAlphaStrong: 0.40,
    glassShadowAlphaSoft: 0.20,
    glassPrimaryFill: "rgba(0,180,90,0.35)",
    glassPrimaryTextColor: "#FFFFFF",
    glassSecondaryTextColor: "#FFFFFF",
    glassTabSurfaceColor: "rgba(2,6,23,0.82)",
    glassTabBorderColor: "rgba(148,163,184,0.16)",
    glassTabInnerGlowColor: "rgba(255,255,255,0.03)",
    glassTabTopSpecularColors: ["rgba(255,255,255,0.05)", "transparent"],
    glassTabChromaticColors: ["rgba(16,185,129,0.10)", "transparent", "rgba(59,130,246,0.05)"],
    glassTabBackdropBrightness: 0.92,
    glassTabHighlightAlpha: 0.06,
    glassTabShadowAlphaStrong: 0.55,
    glassTabActiveBackground: "rgba(16,185,129,0.18)",
    glassTabInactiveColor: "#9CA3AF",
  },
  green: {
    textClass: "text-white",
    secondaryTextClass: "text-emerald-100",
    cardBgClass: "bg-emerald-900/90 border-emerald-800",
    dropdownSurfaceColor: "#064e3b",
    inputBgClass: "bg-emerald-900/70 border-emerald-700",
    inactiveButtonClass: "bg-emerald-800/70",
    borderClass: "border-emerald-700",
    progressBgClass: "bg-emerald-800",
    placeholderColor: "#b6e2b6",
    textColor: "#FFFFFF",
    secondaryTextColor: "#b6e2b6",
    screenBaseColor: "#001f0f",
    screenGradientColors: ["#001f0f", "#003b1a", "#062915"],
    screenOverlayTopColors: ["rgba(200,255,220,0.14)", "rgba(255,255,255,0.03)", "transparent"],
    screenOverlayBottomColors: ["rgba(59,130,246,0.08)", "rgba(0,31,15,0.06)", "transparent"],
    statusBarStyle: "light-content",
    glassSurfaceColor: "rgba(200,255,220,0.03)",
    glassBorderColor: "rgba(180,255,200,0.15)",
    glassInnerGlowColor: "rgba(200,255,220,0.06)",
    glassSpecularColors: ["rgba(200,255,220,0.18)", "rgba(255,255,255,0.03)", "transparent"],
    glassTopSpecularColors: ["rgba(200,255,220,0.12)", "transparent"],
    glassChromaticColors: ["rgba(80,220,160,0.05)", "transparent", "rgba(140,180,255,0.04)"],
    glassBackdropBrightness: 1.08,
    glassBlurIntensity: 30,
    glassBlurTint: "dark",
    glassHighlightAlpha: 0.24,
    glassShadowAlphaStrong: 0.26,
    glassShadowAlphaSoft: 0.14,
    glassPrimaryFill: "rgba(0,180,90,0.30)",
    glassPrimaryTextColor: "#FFFFFF",
    glassSecondaryTextColor: "#FFFFFF",
    glassTabSurfaceColor: "rgba(200,255,220,0.03)",
    glassTabBorderColor: "rgba(180,255,200,0.15)",
    glassTabInnerGlowColor: "rgba(200,255,220,0.06)",
    glassTabTopSpecularColors: ["rgba(200,255,220,0.12)", "transparent"],
    glassTabChromaticColors: ["rgba(80,220,160,0.05)", "transparent", "rgba(140,180,255,0.04)"],
    glassTabBackdropBrightness: 1.08,
    glassTabHighlightAlpha: 0.24,
    glassTabShadowAlphaStrong: 0.26,
    glassTabActiveBackground: "rgba(200,255,220,0.08)",
    glassTabInactiveColor: "#b6e2b6",
  },
};

THEME_TOKENS.green = THEME_TOKENS.dark;

export function getThemeTokens(resolvedTheme: ResolvedAppTheme) {
  return THEME_TOKENS[resolvedTheme];
}
