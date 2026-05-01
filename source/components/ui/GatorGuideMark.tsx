import React from "react";
import Svg, {
  Circle,
  G,
  Path,
  Rect,
} from "react-native-svg";

type GatorGuideMarkProps = {
  size?: number;
  darkMode?: boolean;
  withBackground?: boolean;
  fullCircle?: boolean;
};

export function GatorGuideMark({
  size = 112,
  darkMode = false,
  withBackground = false,
  fullCircle = false,
}: GatorGuideMarkProps) {
  const backgroundFill = darkMode ? "#001f0f" : "#FFFFFF";
  const circleFill = darkMode ? "#2DCC6D" : "#29C766";
  const hatFill = "#050505";
  const circleRadius = fullCircle ? 512 : 330;
  const iconScale = 512 / 330;
  const iconTransform = fullCircle
    ? `translate(512 512) scale(${iconScale}) translate(-512 -512) translate(0 62)`
    : "translate(0 62)";

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
      {withBackground ? <Rect width={1024} height={1024} fill={backgroundFill} /> : null}
      <Circle cx="512" cy="512" r={circleRadius} fill={circleFill} />
      <G transform={iconTransform}>
        <Path
          d="M484 282Q512 268 540 282L748 364Q776 378 748 392L540 474Q512 488 484 474L276 392Q248 378 276 364L484 282Z"
          fill={hatFill}
        />
        <Path
          d="M360 448Q436 478 490 494Q512 500 534 494Q588 478 664 448V504C664 574 600 626 512 626C424 626 360 574 360 504V448Z"
          fill={hatFill}
        />
        <Path
          d="M720 382V490"
          stroke={hatFill}
          strokeWidth="20"
          strokeLinecap="round"
        />
        <Circle cx="720" cy="496" r="14" fill={hatFill} />
        <Path
          d="M708 518L700 572C699 582 706 590 716 590H724C734 590 741 582 740 572L732 518H708Z"
          fill={hatFill}
        />
      </G>
    </Svg>
  );
}
