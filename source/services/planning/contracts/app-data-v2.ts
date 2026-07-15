/**
 * P13-A AppData → planner state v2 migration (opaque legacy preservation).
 * Safe to call from persistence layer; does not delete saved-college/AI payloads.
 */

export const APP_DATA_SCHEMA_V2 = 2;

export type PlannerV2State = {
  activeTarget: unknown | null;
  intendedTransferQuarter: string | null;
  preferredLoad: number | null;
  unavailableQuarters: string[];
  normalizedTranscriptRef: string | null;
  /** Course codes from deterministic transcript ingest / planner transcript state. */
  normalizedCourseIds: string[];
  overrides: unknown[];
  reminderPreferences: { local: boolean; pushOptIn: boolean };
};

export type AppDataV2Envelope = {
  schemaVersion: number;
  data: Record<string, unknown> & {
    plannerV2?: PlannerV2State;
    __legacy?: Record<string, unknown>;
  };
  migrated: boolean;
  shouldRewrite: boolean;
};

export function migrateAppDataToV2(envelope: {
  schemaVersion?: number;
  data?: Record<string, unknown>;
} & Record<string, unknown>): AppDataV2Envelope {
  const schemaVersion = Number(envelope?.schemaVersion ?? 0);
  const data: Record<string, unknown> = {
    ...((envelope?.data as Record<string, unknown>) || envelope || {}),
  };
  const legacy: Record<string, unknown> = {
    ...((data.__legacy as Record<string, unknown>) || {}),
  };

  if (Object.prototype.hasOwnProperty.call(data, "savedColleges")) {
    legacy.savedColleges = data.savedColleges;
    delete data.savedColleges;
  }

  if (data.questionnaireAnswers && typeof data.questionnaireAnswers === "object") {
    const q = { ...(data.questionnaireAnswers as Record<string, unknown>) };
    if (Object.prototype.hasOwnProperty.call(q, "roadmap")) {
      legacy.questionnaireRoadmap = q.roadmap;
      delete q.roadmap;
    }
    data.questionnaireAnswers = q;
  }

  data.plannerV2 =
    (data.plannerV2 as PlannerV2State | undefined) ||
    ({
      activeTarget: null,
      intendedTransferQuarter: null,
      preferredLoad: null,
      unavailableQuarters: [],
      normalizedTranscriptRef: null,
      normalizedCourseIds: [],
      overrides: [],
      reminderPreferences: { local: true, pushOptIn: false },
    } satisfies PlannerV2State);

  data.__legacy = legacy;

  return {
    schemaVersion: Math.max(schemaVersion, APP_DATA_SCHEMA_V2),
    data,
    migrated: schemaVersion < APP_DATA_SCHEMA_V2,
    shouldRewrite: schemaVersion < APP_DATA_SCHEMA_V2,
  };
}
