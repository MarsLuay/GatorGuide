import { Text, View } from "react-native";
import { formatMatchScore, getMatchBadgeClass, getMatchColorClass } from "@/utils/match-color";

type MatchScoreBadgeProps = {
  score: number | null | undefined;
  text?: string;
  size?: "compact" | "default";
  className?: string;
  textClassName?: string;
};

export function MatchScoreBadge({
  score,
  text,
  size = "default",
  className = "",
  textClassName = "",
}: MatchScoreBadgeProps) {
  const formattedScore = formatMatchScore(score);
  if (!formattedScore) return null;

  const containerSizeClass = size === "compact" ? "px-2.5 py-1" : "px-3 py-1.5";
  const labelSizeClass = size === "compact" ? "text-xs" : "text-sm";

  return (
    <View
      className={`self-start rounded-full border ${containerSizeClass} ${getMatchBadgeClass(score)} ${className}`.trim()}
    >
      <Text className={`${labelSizeClass} font-semibold ${getMatchColorClass(score)} ${textClassName}`.trim()}>
        {text ?? `${formattedScore} match`}
      </Text>
    </View>
  );
}
