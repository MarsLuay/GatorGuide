import React, { useMemo } from "react";
import { Text, View } from "react-native";

import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import { useAppTheme } from "@/hooks/use-app-theme";
import { buildLivingTransferPlan } from "@/services/planning/contracts/living-plan-engine-runtime";
import type { PlacementOverride } from "@/services/planning/contracts/living-plan-engine-runtime";
import {
  livingPlanToPlacementRows,
  moveCourseOverride,
  toggleLockOverride,
} from "@/services/planning/contracts/move-lock";
import {
  clampPreferredLoad,
  DEFAULT_PREFERRED_LOAD,
} from "@/services/planning/contracts/planner-v2-constraints";

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

function formatPlacementQuarterLabel(quarterId: string) {
  const seasonMatch = String(quarterId)
    .trim()
    .match(/^(\d{4})-(winter|spring|summer|fall)$/i);
  if (!seasonMatch) {
    return quarterId;
  }
  const season =
    seasonMatch[2].charAt(0).toUpperCase() + seasonMatch[2].slice(1).toLowerCase();
  return `${season} ${seasonMatch[1]}`;
}

function formatCourseCodeLabel(code: string) {
  const compact = String(code || "").trim().toUpperCase();
  const match = compact.match(/^([A-Z]+)(&)?(\d+[A-Z]?)$/);
  if (!match) {
    return code;
  }
  return match[2] ? `${match[1]}& ${match[3]}` : `${match[1]} ${match[3]}`;
}

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
  const { isDark } = useAppTheme();
  const unselectedChipTextClass = isDark ? "text-emerald-300" : "text-emerald-700";

  const plan = useMemo(() => {
    if (!activeTargetRuntimeId || !intendedTransferQuarter) return null;
    if (!normalizedCourseIds.length) return null;
    return buildLivingTransferPlan({
      catalogSnapshotId: "local-planner-v2",
      activeTargetRuntimeId,
      intendedTransferQuarterId: intendedTransferQuarter,
      preferredLoadCredits: clampPreferredLoad(preferredLoad ?? DEFAULT_PREFERRED_LOAD),
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
  const quarters = useMemo(() => {
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.quarterId) ?? [];
      list.push(row);
      grouped.set(row.quarterId, list);
    }
    return [...grouped.entries()].map(([quarterId, courses]) => ({
      quarterId,
      label: formatPlacementQuarterLabel(quarterId),
      courses,
    }));
  }, [rows]);

  // Keep placement inside the normal quarter/course UI — no empty nag card.
  if (!quarters.length) {
    return null;
  }

  return (
    <View className={`${cardBgClass} border ${borderClass} rounded-[28px] p-5 gap-4`}>
      <View className="gap-1">
        <Text className={`${textClass} text-lg font-semibold`}>
          {t("transferPlanner.placementTitle")}
        </Text>
        <Text className={`${secondaryTextClass} text-sm`}>
          {t("transferPlanner.placementHint")}
        </Text>
      </View>

      <View className="gap-4">
        {quarters.map((quarter) => (
          <View
            key={quarter.quarterId}
            className={`border ${borderClass} rounded-2xl px-4 py-4`}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text className={`${textClass} font-semibold flex-1`}>{quarter.label}</Text>
              <View className="px-3 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/20">
                <Text className="text-xs font-semibold text-emerald-500">
                  {t("suggestedSchedule.planned")}
                </Text>
              </View>
            </View>

            <View className="gap-2 mt-3">
              {quarter.courses.map((row) => {
                const locked = overrides.some(
                  (o) => o.courseInstanceId === row.courseInstanceId && o.locked
                );
                return (
                  <View
                    key={row.courseInstanceId}
                    className="px-3 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 gap-2"
                  >
                    <Text className={`${textClass} text-sm font-medium`}>
                      {formatCourseCodeLabel(row.code)}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      <AnimatedChipPressable
                        onPress={() =>
                          onOverridesChange(
                            toggleLockOverride(
                              overrides,
                              row.courseInstanceId,
                              row.quarterId
                            )
                          )
                        }
                        className={`rounded-full px-3 py-1.5 border items-center justify-center ${
                          locked
                            ? "bg-emerald-500 border-emerald-500"
                            : "bg-transparent border-emerald-500/30"
                        }`}
                        style={{ justifyContent: "center", alignItems: "center" }}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            locked ? "text-white" : unselectedChipTextClass
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
                        .map((targetQuarterId) => (
                          <AnimatedChipPressable
                            key={`${row.courseInstanceId}-${targetQuarterId}`}
                            onPress={() => {
                              const result = moveCourseOverride(
                                overrides,
                                row.courseInstanceId,
                                targetQuarterId
                              );
                              if (result.ok) onOverridesChange(result.overrides);
                            }}
                            className="rounded-full px-3 py-1.5 border border-emerald-500/30 items-center justify-center"
                            style={{ justifyContent: "center", alignItems: "center" }}
                          >
                            <Text className={`text-xs font-semibold ${unselectedChipTextClass}`}>
                              {t("transferPlanner.placementMoveTo", {
                                quarter: formatPlacementQuarterLabel(targetQuarterId),
                              })}
                            </Text>
                          </AnimatedChipPressable>
                        ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
