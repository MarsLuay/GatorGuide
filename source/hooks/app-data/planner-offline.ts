/**
 * P18 soft path: derive offline timeline from persisted plannerV2.
 * Local AppData is enough — Firestore sync is not a read prerequisite.
 */

import type { PlannerV2State } from "./planner-state-v2";
import { createEmptyPlannerV2 } from "./planner-state-v2";
import { buildLivingTransferPlan } from "@/services/planning/contracts/living-plan-engine-runtime";
import { clampPreferredLoad } from "@/services/planning/contracts/planner-v2-constraints";
import {
  createMemoryPlannerStateRepository,
  projectTimelineOffline,
  type OfflineTimelineEntry,
  type PlannerLocalSnapshot,
} from "@/services/planning/planner-local-repository";

function resolveActiveTargetRuntimeId(
  plannerV2: PlannerV2State | null | undefined
): string | null {
  const activeTarget = plannerV2?.activeTarget as
    | { runtimeId?: string; campus?: string; programId?: string }
    | null
    | undefined;
  if (activeTarget?.runtimeId) return String(activeTarget.runtimeId);
  if (activeTarget?.campus && activeTarget?.programId) {
    return `${activeTarget.campus}:${activeTarget.programId}`;
  }
  return null;
}

/** Seed an in-memory P18 repo from AppData plannerV2 (offline source of truth). */
export function seedPlannerLocalRepositoryFromAppData(
  plannerV2?: PlannerV2State | null,
  revision = 0
) {
  return createMemoryPlannerStateRepository({
    plannerV2: plannerV2
      ? { ...createEmptyPlannerV2(), ...plannerV2 }
      : createEmptyPlannerV2(),
    revision,
  });
}

/**
 * Build Living Plan quarters from local plannerV2 and project an offline timeline.
 * No network / Firestore call.
 */
export function projectOfflineTimelineFromPlannerV2(
  plannerV2: PlannerV2State | null | undefined,
  opportunities: Array<{ id: string; dueAt?: string | null }> = []
): OfflineTimelineEntry[] {
  const intended = plannerV2?.intendedTransferQuarter;
  const runtimeId = resolveActiveTargetRuntimeId(plannerV2);

  let planQuarters: Array<{ key: string }> = [];
  if (typeof intended === "string" && intended.trim() && runtimeId) {
    const living = buildLivingTransferPlan({
      catalogSnapshotId: "local-planner-v2",
      activeTargetRuntimeId: runtimeId,
      intendedTransferQuarterId: intended,
      preferredLoadCredits: clampPreferredLoad(Number(plannerV2?.preferredLoad) || 3),
      unavailableQuarterIds: plannerV2?.unavailableQuarters || [],
      normalizedCourseIds: plannerV2?.normalizedCourseIds || [],
      placementOverrides: Array.isArray(plannerV2?.overrides)
        ? (plannerV2!.overrides as Array<{
            courseInstanceId: string;
            preferredQuarterId: string;
            locked: boolean;
          }>)
        : [],
    });
    planQuarters = living.quarters.map((q) => ({ key: q.quarterId }));
  } else if (typeof intended === "string" && /^\d{4}-\d{2}-\d{2}/.test(intended)) {
    planQuarters = [{ key: intended }];
  }

  return projectTimelineOffline({
    plan: { quarters: planQuarters },
    opportunities,
  });
}

export type { OfflineTimelineEntry, PlannerLocalSnapshot };
