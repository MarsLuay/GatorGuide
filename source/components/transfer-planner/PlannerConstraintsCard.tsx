import React from "react";
import { Text, View } from "react-native";

import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";

type PlannerConstraintsCardProps = {
  borderClass: string;
  cardBgClass: string;
  intendedTransferQuarter: string | null;
  onPreferredLoadChange: (load: number) => void;
  preferredLoad: number | null;
  secondaryTextClass: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  textClass: string;
};

const LOAD_OPTIONS = [2, 3, 4, 5] as const;

export function PlannerConstraintsCard({
  borderClass,
  cardBgClass,
  intendedTransferQuarter,
  onPreferredLoadChange,
  preferredLoad,
  secondaryTextClass,
  t,
  textClass,
}: PlannerConstraintsCardProps) {
  const load = preferredLoad ?? 3;
  return (
    <View className={`${cardBgClass} border ${borderClass} rounded-2xl p-4 mb-4`}>
      <Text className={`${textClass} text-base font-semibold mb-1`}>
        {t("transferPlanner.planConstraintsTitle")}
      </Text>
      <Text className={`${secondaryTextClass} text-sm mb-3`}>
        {intendedTransferQuarter
          ? t("transferPlanner.intendedQuarterValue", {
              quarter: intendedTransferQuarter,
            })
          : t("transferPlanner.intendedQuarterMissing")}
      </Text>
      <Text className={`${secondaryTextClass} text-xs mb-2`}>
        {t("transferPlanner.preferredLoadLabel")}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {LOAD_OPTIONS.map((option) => {
          const selected = load === option;
          return (
            <AnimatedChipPressable
              key={option}
              onPress={() => onPreferredLoadChange(option)}
              className={`rounded-full px-3 py-1.5 border ${
                selected
                  ? "bg-emerald-500 border-emerald-500"
                  : "bg-transparent border-emerald-500/30"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  selected ? "text-white" : "text-emerald-600"
                }`}
              >
                {t("transferPlanner.preferredLoadOption", { count: option })}
              </Text>
            </AnimatedChipPressable>
          );
        })}
      </View>
    </View>
  );
}
