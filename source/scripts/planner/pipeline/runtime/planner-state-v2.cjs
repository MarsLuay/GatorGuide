"use strict";

/**
 * P13 planner state v2 + transcript privacy harness.
 * Opaque legacy: savedColleges / AI / roadmap survive upgrade but are not product reads.
 */

function migrateToPlannerStateV2(v1 = {}) {
  const legacy = {
    savedColleges: v1.savedColleges ?? [],
    questionnaireAnswers: v1.questionnaireAnswers ?? {},
    aiRoadmapCache: v1.aiRoadmapCache ?? null,
    chatCache: v1.chatCache ?? null,
  };

  return {
    schemaVersion: 2,
    user: v1.user ?? null,
    notificationsEnabled: Boolean(v1.notificationsEnabled),
    notificationPreferences: v1.notificationPreferences ?? {},
    activeTarget: v1.activeTarget ?? null,
    intendedTransferQuarter: v1.intendedTransferQuarter ?? null,
    preferredLoad: v1.preferredLoad ?? null,
    unavailableQuarters: v1.unavailableQuarters ?? [],
    normalizedTranscriptRef: v1.normalizedTranscriptRef ?? null,
    placementOverrides: v1.placementOverrides ?? [],
    reminderPreferences: v1.reminderPreferences ?? {},
    // Opaque — must not be read for product behavior after P14.
    __legacyOpaque: legacy,
  };
}

/**
 * Transcript ingest: always dispose source in finally (P13-B/E).
 */
async function ingestTranscript({ source, parse, dispose }, deps = {}) {
  const parseFn = parse || deps.parse;
  const disposeFn = dispose || deps.dispose;
  if (typeof parseFn !== "function" || typeof disposeFn !== "function") {
    throw new Error("parse and dispose required");
  }
  try {
    const records = await parseFn(source);
    return { ok: true, records, sourceDisposed: false };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      sourceDisposed: false,
    };
  } finally {
    await disposeFn(source);
  }
}

function assertNoTranscriptSourceLeak(payload) {
  const text = JSON.stringify(payload ?? {});
  const banned = [
    /data:application\/pdf;base64,/i,
    /"transcriptUri"/i,
    /"originalFilename"/i,
    /file:\/\/\//i,
  ];
  return !banned.some((re) => re.test(text));
}

module.exports = {
  migrateToPlannerStateV2,
  ingestTranscript,
  assertNoTranscriptSourceLeak,
};
