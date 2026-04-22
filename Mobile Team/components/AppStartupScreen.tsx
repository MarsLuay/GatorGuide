import React from "react";
import { Platform, Text, View } from "react-native";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { GatorGuideMark } from "@/components/ui/GatorGuideMark";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useThemeStyles } from "@/hooks/use-theme-styles";

function WebAppStartupScreen() {
  return (
    <div className="gg-app-loading">
      <div className="gg-app-loading__layer gg-app-loading__layer--base" />
      <div className="gg-app-loading__layer gg-app-loading__layer--top" />
      <div className="gg-app-loading__layer gg-app-loading__layer--bottom" />

      <div className="gg-app-loading__content">
        <svg
          aria-hidden="true"
          className="gg-app-loading__mark"
          width="96"
          height="96"
          viewBox="0 0 1024 1024"
          fill="none"
        >
          <circle className="gg-app-loading__mark-circle" cx="512" cy="512" r="330" />
          <g transform="translate(0 62)">
            <path
              className="gg-app-loading__mark-hat"
              d="M484 282Q512 268 540 282L748 364Q776 378 748 392L540 474Q512 488 484 474L276 392Q248 378 276 364L484 282Z"
            />
            <path
              className="gg-app-loading__mark-hat"
              d="M360 448Q436 478 490 494Q512 500 534 494Q588 478 664 448V504C664 574 600 626 512 626C424 626 360 574 360 504V448Z"
            />
            <path
              className="gg-app-loading__mark-stroke"
              d="M720 382V490"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <circle className="gg-app-loading__mark-hat" cx="720" cy="496" r="14" />
            <path
              className="gg-app-loading__mark-hat"
              d="M708 518L700 572C699 582 706 590 716 590H724C734 590 741 582 740 572L732 518H708Z"
            />
          </g>
        </svg>

        <p className="gg-app-loading__text">Loading Gator Guide...</p>
      </div>
    </div>
  );
}

function NativeAppStartupScreen() {
  const { isDark, isGreen } = useAppTheme();
  const theme = useThemeStyles();

  return (
    <ScreenBackground>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View style={{ marginBottom: 16 }}>
          <GatorGuideMark size={96} darkMode={isDark || isGreen} />
        </View>
        <Text style={{ color: theme.textColor, fontSize: 16, fontWeight: "600" }}>
          Loading Gator Guide...
        </Text>
      </View>
    </ScreenBackground>
  );
}

export function AppStartupScreen() {
  if (Platform.OS === "web") {
    return <WebAppStartupScreen />;
  }

  return <NativeAppStartupScreen />;
}
