/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// Primary brand accent used by shared UI elements.
const accent = "#008f4e";

export const Colors = {
  light: {
    text: "#052e16",
    background: "#ECFDF3",
    tint: accent,
    icon: "#166534",
    tabIconDefault: "#166534",
    tabIconSelected: accent,
  },
  green: {
    text: "#FFFFFF",
    background: "#001f0f",
    tint: accent,
    icon: "#b6e2b6",
    tabIconDefault: "#b6e2b6",
    tabIconSelected: accent,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: accent,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: accent,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
