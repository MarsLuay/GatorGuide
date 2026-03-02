/**
 * Emerald to Scarlet Harmony - 主色卡
 * 主色必须来自此色卡
 */
export const PALETTE = {
  emerald50: "#b6e2b6",
  emerald100: "#8cd19e",
  emerald200: "#63b48b",
  emerald300: "#3a9e75",
  emerald400: "#1f8a5d",
  emerald500: "#008f4e",  // 主色
  emerald600: "#00753e",
  emerald700: "#00572b",
  emerald800: "#003b1a",
  emerald900: "#001f0f",
} as const;

export const COLORS = {
  ...PALETTE,
  primary: PALETTE.emerald500,
  primaryMedium: PALETTE.emerald300,
  primaryDark: PALETTE.emerald400,
  light: PALETTE.emerald50,
  lightMedium: PALETTE.emerald100,
  emeraldLight: PALETTE.emerald200,
  dark: PALETTE.emerald600,
  darkDeep: PALETTE.emerald700,
  forest: PALETTE.emerald800,
  nearBlack: PALETTE.emerald900,

  danger: "#EF4444",
  grayLight: "#9CA3AF",
  gray: "#6B7280",
  grayDark: "#111827",
  grayDarker: "#1F2937",
  white: "#FFFFFF",
  offWhite: "#F9FAFB",
  nearWhite: "#F0FDF4",
} as const;
