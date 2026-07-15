import React from "react";
import { Text, View } from "react-native";

import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  clampPreferredLoad,
  PREFERRED_LOAD_OPTIONS,
} from "@/services/planning/contracts/planner-v2-constraints";

type PlannerConstraintsCardProps = {
  borderClass: string;
  cardBgClass: string;
  onPreferredLoadChange: (load: number) => void;
  preferredLoad: number | null;
  secondaryTextClass: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  textClass: string;
};

export function PlannerConstraintsCard({
  borderClass,
  cardBgClass,
  onPreferredLoadChange,
  preferredLoad,
  secondaryTextClass,
  t,
  textClass,
}: PlannerConstraintsCardProps) {
  const { isDark } = useAppTheme();
  const load = clampPreferredLoad(preferredLoad);
  const unselectedTextClass = isDark ? "text-emerald-300" : "text-emerald-700";

  return (
    <View className={`${cardBgClass} border ${borderClass} rounded-2xl p-4 mb-4`}>
      <Text className={`${textClass} text-base font-semibold mb-1`}>
        {t("transferPlanner.planConstraintsTitle")}
      </Text>
      <Text className={`${secondaryTextClass} text-xs mb-2`}>
        {t("transferPlanner.preferredLoadLabel")}
      </Text>
      <View className="flex-row gap-2">
        {PREFERRED_LOAD_OPTIONS.map((option) => {
          const selected = load === option;
          const label = t("transferPlanner.preferredLoadOption", { count: option });
          return (
            <AnimatedChipPressable
              key={option}
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onPreferredLoadChange(option)}
              containerClassName="flex-1"
              className={`rounded-xl px-2 py-2.5 border items-center justify-center ${
                selected
                  ? "bg-emerald-500 border-emerald-500"
                  : "bg-transparent border-emerald-500/30"
              }`}
              style={{ justifyContent: "center", alignItems: "center", minHeight: 44 }}
            >
              <Text
                className={`text-xs font-semibold text-center ${
                  selected ? "text-white" : unselectedTextClass
                }`}
                numberOfLines={1}
              >
                {label}
              </Text>
            </AnimatedChipPressable>
          );
        })}
      </View>
    </View>
  );
}
