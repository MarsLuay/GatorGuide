export const RESPONSIVE_BREAKPOINTS = {
  tabletMinWidth: 768,
  desktopMinWidth: 1180,
  phoneLikeAspectRatio: 1.5,
} as const;

export const RESPONSIVE_CONTENT_MAX_WIDTHS = {
  phone: 448,
  tablet: 880,
  desktop: 1280,
} as const;

export const RESPONSIVE_HORIZONTAL_PADDING = {
  phone: 24,
  tablet: 28,
  desktop: 32,
} as const;

export const RESPONSIVE_TAB_BAR_BASE = {
  iconSize: 24,
  labelFontSize: 12,
  labelLineHeight: 16,
  minHeight: 64,
  topPadding: 6,
  bottomPadding: 8,
  contentClearance: 16,
} as const;

export type LayoutBreakpoint = keyof typeof RESPONSIVE_CONTENT_MAX_WIDTHS;
