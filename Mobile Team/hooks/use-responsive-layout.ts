import { useMemo } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  RESPONSIVE_BREAKPOINTS,
  RESPONSIVE_CONTENT_MAX_WIDTHS,
  RESPONSIVE_HORIZONTAL_PADDING,
  RESPONSIVE_TAB_BAR_BASE,
  type LayoutBreakpoint,
} from "@/constants/layout";

type ResponsiveNumericValues = Partial<Record<LayoutBreakpoint, number>>;
type ResponsiveNullableNumericValues = Partial<Record<LayoutBreakpoint, number | null>>;

export type ResponsiveContainerOptions = {
  width?: ViewStyle["width"];
  alignSelf?: ViewStyle["alignSelf"];
  maxWidth?: ResponsiveNullableNumericValues;
  horizontalPadding?: ResponsiveNumericValues;
};

export type ScrollContentPaddingOptions = {
  includeTopInset?: boolean;
  includeBottomInset?: boolean;
  includeBottomTabClearance?: boolean;
  extraTop?: number;
  extraBottom?: number;
};

function isNumeric(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveResponsiveNumber(
  values: ResponsiveNumericValues | undefined,
  breakpoint: LayoutBreakpoint,
  fallback: number
) {
  if (!values) return fallback;

  if (isNumeric(values[breakpoint])) return values[breakpoint]!;
  if (breakpoint === "desktop" && isNumeric(values.tablet)) return values.tablet!;
  if (breakpoint !== "phone" && isNumeric(values.phone)) return values.phone!;

  return fallback;
}

function resolveResponsiveNullableNumber(
  values: ResponsiveNullableNumericValues | undefined,
  breakpoint: LayoutBreakpoint,
  fallback: number | null
) {
  if (!values) return fallback;

  const direct = values[breakpoint];
  if (direct === null || isNumeric(direct)) return direct;

  if (breakpoint === "desktop") {
    const tablet = values.tablet;
    if (tablet === null || isNumeric(tablet)) return tablet;
  }

  if (breakpoint !== "phone") {
    const phone = values.phone;
    if (phone === null || isNumeric(phone)) return phone;
  }

  return fallback;
}

export function isPhoneLikeViewport(
  width: number,
  height: number,
  phoneLikeAspectRatio = RESPONSIVE_BREAKPOINTS.phoneLikeAspectRatio
) {
  return height >= width * phoneLikeAspectRatio;
}

export function getLayoutBreakpoint(
  width: number,
  height: number,
  phoneLikeAspectRatio = RESPONSIVE_BREAKPOINTS.phoneLikeAspectRatio
): LayoutBreakpoint {
  const phoneLike = isPhoneLikeViewport(width, height, phoneLikeAspectRatio);

  if (width >= RESPONSIVE_BREAKPOINTS.desktopMinWidth && !phoneLike) {
    return "desktop";
  }

  if (width >= RESPONSIVE_BREAKPOINTS.tabletMinWidth && !phoneLike) {
    return "tablet";
  }

  return "phone";
}

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const breakpoint = getLayoutBreakpoint(width, height);
    const isPhone = breakpoint === "phone";
    const isTablet = breakpoint === "tablet";
    const isDesktop = breakpoint === "desktop";

    const defaultContentMaxWidth = RESPONSIVE_CONTENT_MAX_WIDTHS[breakpoint];
    const defaultHorizontalPadding = RESPONSIVE_HORIZONTAL_PADDING[breakpoint];
    const tabBarPaddingTop = isDesktop ? 10 : isTablet ? 8 : RESPONSIVE_TAB_BAR_BASE.topPadding;
    const tabBarPaddingBottom = Math.max(RESPONSIVE_TAB_BAR_BASE.bottomPadding, insets.bottom);
    const tabBarLabelFontSize = fontScale > 1.25 ? 11 : RESPONSIVE_TAB_BAR_BASE.labelFontSize;
    const tabBarLabelLineHeight = Math.max(
      RESPONSIVE_TAB_BAR_BASE.labelLineHeight,
      Math.round(tabBarLabelFontSize * 1.35)
    );
    const tabBarIconSize = fontScale > 1.3 ? 22 : RESPONSIVE_TAB_BAR_BASE.iconSize;
    const tabBarHorizontalPadding = isDesktop ? 10 : 0;
    const tabBarItemPaddingVertical = isDesktop ? 4 : 2;
    const tabBarItemPaddingHorizontal = isDesktop ? 8 : 4;
    const tabBarMinHeight = Math.max(
      RESPONSIVE_TAB_BAR_BASE.minHeight + insets.bottom,
      tabBarPaddingTop + tabBarPaddingBottom + tabBarIconSize + tabBarLabelLineHeight + 16
    );
    const tabBarContentClearance = tabBarMinHeight + RESPONSIVE_TAB_BAR_BASE.contentClearance;
    const tabBarLabelMaxWidth = isDesktop ? 160 : isTablet ? 132 : 96;

    const createResponsiveContainerStyle = (
      options: ResponsiveContainerOptions = {}
    ): ViewStyle => {
      const maxWidth = resolveResponsiveNullableNumber(
        options.maxWidth,
        breakpoint,
        defaultContentMaxWidth
      );
      const horizontalPadding = resolveResponsiveNumber(
        options.horizontalPadding,
        breakpoint,
        defaultHorizontalPadding
      );

      return {
        width: options.width ?? "100%",
        maxWidth: maxWidth ?? undefined,
        alignSelf: options.alignSelf ?? "center",
        paddingHorizontal: horizontalPadding,
      };
    };

    const getScrollContentPadding = (options: ScrollContentPaddingOptions = {}) => ({
      paddingTop: (options.includeTopInset ? insets.top : 0) + (options.extraTop ?? 0),
      paddingBottom:
        (options.includeBottomInset ? insets.bottom : 0) +
        (options.includeBottomTabClearance ? tabBarContentClearance : 0) +
        (options.extraBottom ?? 0),
    });

    return {
      width,
      height,
      fontScale,
      breakpoint,
      isPhone,
      isTablet,
      isDesktop,
      isPhoneLikeViewport: isPhoneLikeViewport(width, height),
      topInset: insets.top,
      bottomInset: insets.bottom,
      defaultContentMaxWidth,
      defaultHorizontalPadding,
      defaultContainerStyle: createResponsiveContainerStyle(),
      createResponsiveContainerStyle,
      getScrollContentPadding,
      tabBarPaddingTop,
      tabBarPaddingBottom,
      tabBarIconSize,
      tabBarLabelFontSize,
      tabBarLabelLineHeight,
      tabBarLabelMaxWidth,
      tabBarHorizontalPadding,
      tabBarItemPaddingVertical,
      tabBarItemPaddingHorizontal,
      tabBarMinHeight,
      tabBarContentClearance,
    };
  }, [fontScale, height, insets.bottom, insets.top, width]);
}
