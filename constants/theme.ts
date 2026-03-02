/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// 主色 #008f4e | 70%主 30%辅 10%强调 | 对比度4.5-7:1
const accent = "#008f4e";

export const Colors = {
  light: {
    text: "#001f0f",           // 主文字 emerald900 on 浅底
    background: "#FFFFFF",     // 偏白主背景
    tint: accent,
    icon: "#1f8a5d",           // 辅色 emerald400
    tabIconDefault: "#00753e", // 辅色 emerald600
    tabIconSelected: accent,
  },
  dark: {
    text: "#FFFFFF",           // 主文字 白 on 深底 高对比
    background: "#001f0f",     // 70% 主背景 emerald900
    tint: accent,
    icon: "#b6e2b6",           // 辅色 emerald50 更亮易读
    tabIconDefault: "#b6e2b6",
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
