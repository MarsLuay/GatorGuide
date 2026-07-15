/**
 * P12 move/lock — stable course-instance IDs + plannerV2 override helpers.
 */

import type { PlacementOverride } from "@/services/planning/contracts/living-plan-engine-runtime";
import type { LivingTransferPlan } from "@/services/planning/contracts/living-plan-engine-runtime";

export function createCourseInstanceId(input: {
  code: string;
  quarterId: string;
  occurrence?: number;
}) {
  const code = String(input.code || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  return `${code}@${input.quarterId}#${input.occurrence ?? 0}`;
}

export function parseCourseInstanceId(instanceId: string): {
  code: string;
  quarterId: string;
  occurrence: number;
} | null {
  const m = String(instanceId || "").match(/^([^@]+)@([^#]+)#(\d+)$/);
  if (!m) return null;
  return { code: m[1], quarterId: m[2], occurrence: Number(m[3]) };
}

export function toggleLockOverride(
  overrides: PlacementOverride[],
  courseInstanceId: string,
  preferredQuarterId: string
): PlacementOverride[] {
  const next = [...overrides];
  const idx = next.findIndex((o) => o.courseInstanceId === courseInstanceId);
  if (idx >= 0) {
    const current = next[idx];
    if (current.locked) {
      next.splice(idx, 1);
      return next;
    }
    next[idx] = { ...current, locked: true, preferredQuarterId };
    return next;
  }
  next.push({ courseInstanceId, preferredQuarterId, locked: true });
  return next;
}

export function moveCourseOverride(
  overrides: PlacementOverride[],
  courseInstanceId: string,
  toQuarterId: string
): { ok: true; overrides: PlacementOverride[] } | { ok: false; conflict: "locked" } {
  const existing = overrides.find((o) => o.courseInstanceId === courseInstanceId);
  if (existing?.locked) {
    return { ok: false, conflict: "locked" };
  }
  const next = overrides.filter((o) => o.courseInstanceId !== courseInstanceId);
  next.push({
    courseInstanceId,
    preferredQuarterId: toQuarterId,
    locked: false,
  });
  return { ok: true, overrides: next };
}

export function livingPlanToPlacementRows(plan: LivingTransferPlan | null | undefined) {
  const rows: Array<{ courseInstanceId: string; quarterId: string; code: string }> = [];
  for (const quarter of plan?.quarters || []) {
    for (const courseInstanceId of quarter.courseInstanceIds) {
      const parsed = parseCourseInstanceId(courseInstanceId);
      rows.push({
        courseInstanceId,
        quarterId: quarter.quarterId,
        code: parsed?.code || courseInstanceId,
      });
    }
  }
  return rows;
}
