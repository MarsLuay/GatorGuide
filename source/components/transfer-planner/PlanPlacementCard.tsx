import React, { useMemo } from "react";
import { Text, View } from "react-native";

import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import { buildLivingTransferPlan } from "@/services/planning/contracts/living-plan-engine-runtime";
import type { PlacementOverride } from "@/services/planning/contracts/living-plan-engine-runtime";
import {
  livingPlanToPlacementRows,
  moveCourseOverride,
  toggleLockOverride,
} from "@/services/planning/contracts/move-lock";

type PlanPlacementCardProps = {
  activeTargetRuntimeId: string | null;
  borderClass: string;
  cardBgClass: string;
  intendedTransferQuarter: string | null;
  normalizedCourseIds: string[];
  onOverridesChange: (overrides: PlacementOverride[]) => void;
  overrides: PlacementOverride[];
  preferredLoad: number | null;
  secondaryTextClass: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  textClass: string;
  unavailableQuarters: string[];
};

export function PlanPlacementCard({
  activeTargetRuntimeId,
  borderClass,
  cardBgClass,
  intendedTransferQuarter,
  normalizedCourseIds,
  onOverridesChange,
  overrides,
  preferredLoad,
  secondaryTextClass,
  t,
  textClass,
  unavailableQuarters,
}: PlanPlacementCardProps) {
  const plan = useMemo(() => {
    if (!activeTargetRuntimeId || !intendedTransferQuarter) return null;
    return buildLivingTransferPlan({
      catalogSnapshotId: "local-planner-v2",
      activeTargetRuntimeId,
      intendedTransferQuarterId: intendedTransferQuarter,
      preferredLoadCredits: preferredLoad ?? 3,
      unavailableQuarterIds: unavailableQuarters,
      normalizedCourseIds,
      placementOverrides: overrides,
    });
  }, [
    activeTargetRuntimeId,
    intendedTransferQuarter,
    normalizedCourseIds,
    overrides,
    preferredLoad,
    unavailableQuarters,
  ]);

  const rows = useMemo(() => livingPlanToPlacementRows(plan), [plan]);
  const quarterIds = useMemo(
    () => [...new Set((plan?.quarters || []).map((q) => q.quarterId))],
    [plan]
  );

  if (!rows.length) {
    return (
      <View className={`${cardBgClass} border ${borderClass} rounded-2xl p-4 mb-4`}>
        <Text className={`${textClass} text-base font-semibold mb-1`}>
          {t("transferPlanner.placementTitle")}
        </Text>
        <Text className={`${secondaryTextClass} text-sm`}>
          {t("transferPlanner.placementEmpty")}
        </Text>
      </View>
    );
  }

  return (
    <View className={`${cardBgClass} border ${borderClass} rounded-2xl p-4 mb-4 gap-3`}>
      <Text className={`${textClass} text-base font-semibold`}>
        {t("transferPlanner.placementTitle")}
      </Text>
      {rows.map((row) => {
        const locked = overrides.some(
          (o) => o.courseInstanceId === row.courseInstanceId && o.locked
        );
        return (
          <View
            key={row.courseInstanceId}
            className="border border-emerald-500/20 rounded-xl p-3 gap-2"
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text className={`${textClass} text-sm font-semibold`}>{row.code}</Text>
              <Text className={`${secondaryTextClass} text-xs`}>{row.quarterId}</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <AnimatedChipPressable
                onPress={() =>
                  onOverridesChange(
                    toggleLockOverride(overrides, row.courseInstanceId, row.quarterId)
                  )
                }
                className={`rounded-full px-3 py-1.5 border ${
                  locked
                    ? "bg-emerald-500 border-emerald-500"
                    : "bg-transparent border-emerald-500/30"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    locked ? "text-emerald-950" : "text-emerald-600"
                  }`}
                >
                  {locked
                    ? t("transferPlanner.placementUnlock")
                    : t("transferPlanner.placementLock")}
                </Text>
              </AnimatedChipPressable>
              {quarterIds
                .filter((q) => q !== row.quarterId)
                .slice(0, 3)
                .map((quarterId) => (
                  <AnimatedChipPressable
                    key={`${row.courseInstanceId}-${quarterId}`}
                    onPress={() => {
                      const result = moveCourseOverride(
                        overrides,
                        row.courseInstanceId,
                        quarterId
                      );
                      if (result.ok) onOverridesChange(result.overrides);
                    }}
                    className="rounded-full px-3 py-1.5 border border-emerald-500/30"
                  >
                    <Text className="text-xs font-semibold text-emerald-600">
                      {t("transferPlanner.placementMoveTo", { quarter: quarterId })}
                    </Text>
                  </AnimatedChipPressable>
                ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
