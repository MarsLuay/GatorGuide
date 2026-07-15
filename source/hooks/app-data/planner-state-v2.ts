/**
 * Soft P13-A planner fields on AppData — v1 product fields remain until P14 removal.
 * Opaque __legacy mirrors removal-bound payloads without deleting them.
 */

import type { PlannerV2State } from "@/services/planning/contracts/app-data-v2";
import { APP_DATA_SCHEMA_V2 } from "@/services/planning/contracts/app-data-v2";

export { APP_DATA_SCHEMA_V2 };
export type { PlannerV2State };

export function createEmptyPlannerV2(): PlannerV2State {
  return {
    activeTarget: null,
    intendedTransferQuarter: null,
    preferredLoad: null,
    unavailableQuarters: [],
    normalizedTranscriptRef: null,
    normalizedCourseIds: [],
    overrides: [],
    reminderPreferences: { local: true, pushOptIn: false },
  };
}

export function mirrorOpaqueLegacy(input: {
  savedColleges?: unknown;
  questionnaireAnswers?: Record<string, unknown>;
  existingLegacy?: Record<string, unknown>;
}): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...(input.existingLegacy || {}) };
  if (Array.isArray(input.savedColleges)) {
    legacy.savedColleges = input.savedColleges;
  }
  const roadmap = input.questionnaireAnswers?.roadmap;
  if (roadmap !== undefined) {
    legacy.questionnaireRoadmap = roadmap;
  }
  return legacy;
}
