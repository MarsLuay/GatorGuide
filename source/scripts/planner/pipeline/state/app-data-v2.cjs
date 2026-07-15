"use strict";

/**
 * P13-A planner/app state v2 migration harness.
 * Moves obsolete product fields into opaque legacy without deleting them.
 */

const V2 = 2;

function migrateAppDataToV2(envelope) {
  const schemaVersion = Number(envelope?.schemaVersion ?? 0);
  const data = { ...(envelope?.data || envelope || {}) };
  const legacy = { ...(data.__legacy || {}) };

  if (Object.prototype.hasOwnProperty.call(data, "savedColleges")) {
    legacy.savedColleges = data.savedColleges;
    delete data.savedColleges;
  }
  if (data.questionnaireAnswers && typeof data.questionnaireAnswers === "object") {
    const q = { ...data.questionnaireAnswers };
    if (Object.prototype.hasOwnProperty.call(q, "roadmap")) {
      legacy.questionnaireRoadmap = q.roadmap;
      delete q.roadmap;
    }
    data.questionnaireAnswers = q;
  }

  data.plannerV2 = data.plannerV2 || {
    activeTarget: null,
    intendedTransferQuarter: null,
    preferredLoad: null,
    unavailableQuarters: [],
    normalizedTranscriptRef: null,
    overrides: [],
    reminderPreferences: { local: true, pushOptIn: false },
  };

  data.__legacy = legacy;

  return {
    schemaVersion: Math.max(schemaVersion, V2),
    data,
    migrated: schemaVersion < V2,
    shouldRewrite: schemaVersion < V2,
  };
}

/** P13-B/E: normalized transcript only — originals must not cross boundary. */
function assertNoTranscriptOriginal(payload) {
  const json = JSON.stringify(payload ?? {});
  const forbidden = [
    "data:application/pdf",
    "file://",
    "content://",
    "transcriptPath",
    "transcriptBlob",
    "originalFilename",
  ];
  for (const token of forbidden) {
    if (json.includes(token)) {
      return { ok: false, token };
    }
  }
  return { ok: true };
}

module.exports = {
  APP_DATA_SCHEMA_V2: V2,
  migrateAppDataToV2,
  assertNoTranscriptOriginal,
};
